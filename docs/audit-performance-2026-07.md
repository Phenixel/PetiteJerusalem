# Audit de performance — juillet 2026

> Note : le signalement initial parlait d'un « site blanc » (erreur de
> dictée vocale) ; le symptôme réel est un **site lent**. La section 1
> (cache HTML → écran blanc post-déploiement) reste un bug réel confirmé
> par l'Error tracking et les correctifs sont conservés, mais la cause du
> signalement est à chercher en section 0.

Contexte : après l'ajout de PostHog, un testeur a signalé un site devenu
**lent** — sur tout le site, ordinateur et téléphone — alors que le
propriétaire ne voit rien sur sa machine. Cet audit couvre : les causes
plausibles d'une lenteur généralisée, l'impact réel du tracking PostHog,
et un état des lieux complet (bundle, Firestore, functions, rendu).

## 0. Lenteur généralisée sur un appareil donné : suspects et mitigations

Une lenteur qui touche *toutes* les pages chez un utilisateur (mais pas
chez tout le monde) pointe vers ce qui tourne en continu, pas vers une
page en particulier. Par ordre de probabilité :

1. **Session replay PostHog** — c'est la nouveauté récente qui coûte du
   CPU pendant *toute* la visite : rrweb observe et sérialise chaque
   mutation du DOM. Imperceptible sur une machine récente, sensible sur un
   téléphone d'entrée de gamme ou un vieux laptop. → **Désactivé pour tout
   le monde pour l'instant** (`disable_session_recording: true`), le temps
   d'objectiver la lenteur via les Web Vitals. Les événements produit et
   l'Error tracking restent actifs partout. À la réactivation, préférer un
   échantillonnage (PostHog → Settings → Session replay → sampling) et/ou
   l'exclusion des appareils modestes (`useDevicePerf.ts`).
2. **Les illustrations SVG en animation infinie** — CONFIRMÉ par une trace
   Firefox Profiler (le problème ne se reproduit pas sous Chrome) : 154
   animations CSS actives sur la session, thread du site réveillé en
   permanence (~18 repaints/s à vide), retards d'entrée jusqu'à 136 ms.
   Deux aggravants : `illu-flow` anime `stroke-dashoffset`, que Firefox ne
   peut pas composer sur GPU (repaint du SVG à chaque frame), et
   `IllustrationProfil` (étincelles infinies) vit dans AccountCta, affiché
   aux visiteurs non connectés sur plusieurs pages — d'où « tout le site »
   lent. → **Corrigé** : les boucles d'attente des 4 illustrations sont
   finies (2-3 itérations, ~10 s de vie après l'entrée, fin sur l'état de
   repos) ; les animations de survol, auto-limitées, restent infinies.
3. **Le mur de pierre animé** (`StoneWallBackground.vue`) — deux halos de
   60/45 vmax en animation infinie derrière un mask SVG plein écran, sur
   toutes les pages, plus un `backdrop-filter: blur(12px)` sur les barres
   de recherche sticky au-dessus d'un fond qui bouge en permanence : le
   flou est recalculé à chaque frame même sans interaction. Aggravant décisif
   sous Firefox : si le GPU est sur liste noire des drivers, Firefox rend en
   **logiciel** (Software WebRender) — mask, backdrop-filter et gradients
   animés sont alors rasterisés au CPU à chaque frame, pendant que Chrome
   garde l'accélération → « lent sous Firefox mais pas sous Chrome », avec un
   thread principal presque idle dans le profiler (le coût vit dans le
   processus GPU, absent de la trace fournie). → **Mitigé** (`useDevicePerf`) :
   le mur se fige et le backdrop-filter se coupe (classe `perf-lite`) quand
   (a) peu de cœurs/RAM, (b) le renderer WebGL est logiciel
   (llvmpipe/SwiftShader…) ou absent, ou (c) une sonde rAF mesure < 40 fps au
   repos après chargement. Chaque déclenchement envoie l'événement
   `perf_degraded_rendering` (raison + renderer) à PostHog. Tests côté
   testeur : `about:support` → section Graphics → ligne « Compositing »
   (WebRender vs WebRender (Software)), et « réduire les animations » dans
   l'OS.
4. **Le mini-lecteur audio** — `currentTime` (ref globale) était publié
   ~4×/s pendant toute l'écoute → re-rendus continus sur toutes les pages
   tant qu'un chiour joue (et autant de mutations DOM à sérialiser pour le
   replay). → **Corrigé** : publication au changement de seconde (1 Hz).
5. **Le poids du chargement initial** (§4) et **les lectures Firestore
   complètes** (§1) — ils rendent chaque *navigation* lente sur petite
   connexion, sans expliquer à eux seuls une lenteur d'interaction.

Pour objectiver tout ça : les Core Web Vitals sont désormais capturés
(INP en particulier mesure la lenteur d'interaction réelle, par page et
par appareil) — PostHog → Web analytics → Web vitals après déploiement.

## 1. L'écran blanc : cache HTML + chunks hashés (corrigé)

**PostHog n'est pas en cause.** Le mécanisme :

1. Chaque build Vite génère des chunks JS avec un hash dans le nom
   (`AdminChiourimPage-uB4ZZNbv.js`). À chaque déploiement, les anciens
   fichiers disparaissent.
2. `firebase.json` ne définissait **aucun** `Cache-Control` pour le HTML :
   Firebase Hosting applique alors `max-age=3600` par défaut. Un navigateur
   pouvait donc garder jusqu'à 1 h un HTML qui référence des chunks supprimés
   → 404 sur le module principal → page blanche, sur tous les appareils de
   l'utilisateur qui a visité le site juste avant un déploiement.
3. Même problème en cours de session : un onglet ouvert sur l'ancienne
   version obtient « Failed to fetch dynamically imported module » en
   naviguant vers une page lazy-loadée. **Confirmé dans PostHog Error
   tracking** (issue active du 2026-07-28 sur `AdminChiourimPage-uB4ZZNbv.js`).

Correctifs appliqués :

- `firebase.json` : `Cache-Control: no-cache` sur `**` (le HTML est
  revalidé à chaque visite ; les blocs `/assets/**` — immutable 1 an — et
  `/texts/**` — 7 jours — passent après et gardent donc la priorité, la
  règle Firebase étant « le dernier bloc qui matche gagne »). Les images
  à la racine (favicons, og-image) gardent un cache d'un jour.
- `src/main.ts` : écouteur `vite:preloadError` — si un chunk est
  introuvable après un déploiement, la page se recharge une fois
  (garde de 60 s en sessionStorage pour ne pas boucler hors ligne).

À savoir : l'Error tracking ne voit que les erreurs *après* chargement de
PostHog (prod + consentement accordé). Un écran blanc au chargement initial
n'apparaîtra jamais dans PostHog — le no-cache sur le HTML est la vraie
protection.

## 2. PostHog ralentit-il le site ? Pas le tracking — seul le replay pèse

L'intégration (`src/services/analyticsService.ts`) est déjà faite dans les
règles de l'art :

- chargé **uniquement en prod**, par **import dynamique**, après le montage
  de l'app : le SDK (~76 kB gzip) ne bloque jamais le premier rendu ;
- soumis au **consentement** : la plupart des visiteurs anonymes qui
  refusent ne chargent rien du tout ;
- toutes les méthodes sont des no-ops si le SDK n'est pas chargé
  (adblock, échec réseau) : aucun appel ne peut casser l'app.

Le seul poste réellement coûteux côté client est le **session replay**
(enregistrement rrweb : CPU + réseau en continu pendant toute la visite).
Désormais coupé pour tout le monde (voir §0) ; à la réactivation, préférer
l'échantillonnage — et ne jamais toucher aux événements produit, qui ne
coûtent rien.

Ajout fait : `capture_performance: { web_vitals: true }` → l'onglet
**Web analytics → Web vitals** de PostHog donnera des mesures terrain
(LCP/INP/CLS/FCP) page par page pour objectiver la suite de cet audit.

## 3. Problèmes de performance identifiés (par priorité)

> État (fin de la PR de performance) : tout ce qui suit est **corrigé**, sauf
> (a) la dénormalisation Firestore de `sessions` (`participantIds`) — elle
> demande une migration de données coordonnée, hors périmètre d'une PR
> front — et (b) le pré-découpage des textes par chapitre, qui touche le mode
> hors-ligne et mérite sa propre PR testée. Détail des correctifs dans la
> description de la PR.

### Priorité 1 — Firestore : lectures de collections entières

| Où | Problème |
| --- | --- |
| `src/services/firestoreService.ts:94` | `getDocs(collection(db, "sessions"))` sans `where`/`limit` : **toute** la collection (avec les tableaux `reservations` complets) est téléchargée. Utilisé par la home, le profil et la liste des sessions → le coût croît avec l'usage total du site, pas avec ce que l'utilisateur voit. |
| `src/views/HomeView.vue:55`, `ProfilePage.vue:74` | Tout est chargé puis filtré côté client pour trouver les 2-3 sessions de l'utilisateur. Fix : champ dénormalisé `participantIds` + `array-contains`, ou requête `where("personId", "==", uid)`. |
| `src/services/reservationService.ts:379` | `migrateGuestReservations` fait un **scan complet à chaque login** (appelé 3× depuis `loginView.vue`), même sans réservation invitée. Fix : ne lancer que si un id invité local existe + requête ciblée. |
| `src/views/Chiourim/DetailChiour.vue:116` | Un visiteur qui ouvre un lien de chiour partagé télécharge tout le catalogue pour trouver un document. Fix : `getDoc(doc(db, "chiourim", slug))`. |
| `src/services/sessionService.ts:243` | `generateUniqueSlug` : une requête Firestore par itération jusqu'à trouver un slug libre. Fix : suffixe aléatoire court. |

### Priorité 2 — Functions : `socialPreview` devant le trafic humain

- `firebase.json` route `/share-reading/session/**` **et** `/chiourim/**`
  vers la function `socialPreview` : chaque visite humaine de ces pages
  (les URL les plus partagées du site) paie un cold start + une requête
  Firestore + un `fetch` du shell avant le premier octet de HTML.
- `functions/src/index.ts:27` : `maxInstances: 3` **global** — un pic de
  trafic sur un lien WhatsApp met les visiteurs en file d'attente.
- Fixes : réserver la rewrite aux user-agents crawlers (ou prerender),
  `maxInstances` par fonction + `minInstances: 1` sur `socialPreview`,
  `getDoc` par slug au lieu du catalogue entier, sortir la lecture des
  polices (1,23 Mo de TTF) du chemin par requête dans `ogCard.ts`.

### Priorité 3 — Lecture de textes : fichiers entiers pour un chapitre

- `textService.ts:238` : lire **un chapitre** télécharge et parse le
  fichier du traité entier (jusqu'à **1,76 Mo**, `shabbat.json`), avec 9
  passes regex sur tout le traité. Très lourd sur mobile.
- `DailyReadingItem.vue:36` : chaque entrée de lecture du jour charge son
  fichier complet en parallèle au montage du profil (~5 Mo pour 3 traités).
- Fix : pré-découper les corpus par chapitre/daf au build
  (`scripts/download-texts.mjs`) et ne récupérer que la section demandée ;
  charger les items du profil à l'ouverture (accordéon/IntersectionObserver).

### Priorité 4 — Bundle initial et rendu

- Chunk `firebase` : **872 kB (214 kB gzip)** chargé dès la home (App.vue
  importe `auth` en statique). Piste : séparer `firestore`/`storage` du
  chunk, et différer ce qui n'est pas l'auth.
- `index.html` : stylesheet Google Fonts **bloquante** avec 7 familles /
  19 graisses — toutes les alternatives sélectionnables sont téléchargées
  par tous les visiteurs. Fix : ne garder en bloquant que les familles par
  défaut, charger les autres à la demande depuis `useFonts.ts`.
- `sessionService.ts:16` importe `textStudies.json` (64 kB) en statique →
  il atterrit dans le bundle initial via la home. Fix : import dynamique.
- `i18n.ts` : les 3 locales (92 kB de source) sont toutes dans le bundle
  initial. Fix : ne charger que la locale active, `import()` les autres.
- `seoPages.ts` (94 kB) est tiré dans les chunks de `DetailSession`,
  `DetailChiour` et `ProfilePage` **juste pour la constante `SITE_URL`**.
  Fix : déplacer `SITE_URL` dans un petit `src/config/site.ts`.

### Priorité 5 — Rendu des grandes listes

- `TextStudiesList.vue` : `isReserved()` / `getReservation()` etc. sont des
  fonctions appelées depuis le template → recalcul en O(cartes × sections ×
  réservations) à chaque frappe dans la recherche (150 cartes pour une
  chaîne de Tehilim). Fix : précalculer une `Map` par session dans un
  `computed`.
- `useAudioPlayer.ts:94` : `currentTime` (ref singleton) mis à jour ~4×/s
  pendant toute la lecture → re-rendus continus partout où le mini-player
  est monté. Fix : throttle à ~1 Hz.
- `TextReadingPage.vue:723` : `transliterate(line)` appelé dans le template,
  jamais mémoïsé. Fix : `computed` par section.

### Points sains (rien à faire)

- Aucun `onSnapshot` qui fuit ; caches avec TTL et dédup des requêtes en
  vol dans `firestoreService`/`chiourService`/`serieService`.
- Aucune image lourde (max 76 kB) ; illustrations en SVG inline.
- Toutes les routes sauf la home sont lazy-loadées.
- `ChiourimPage.vue` : pattern cache-first bien fait.
