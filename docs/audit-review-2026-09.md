# Revue de code et d'optimisation (septembre 2026)

Passe complète sur le dépôt : failles, bugs, code mort, performance du site et
de l'app, et pistes d'amélioration. Six lectures parallèles (services,
composants et composables, vues, backend et règles, build et contenu, app
native et hors ligne), chaque constat vérifié dans le code avant d'être
retenu. Ce document distingue ce que la PR corrige de ce qu'elle laisse en
chantier, avec pour chaque chantier le fichier où commencer.

Complète l'audit de performance de juillet (`audit-performance-2026-07.md`),
dont il vérifie aussi les acquis : l'un d'eux avait sauté (section 1).

Les chantiers de la section 2 sont suivis dans la base « Tâches » du Notion
du projet (une tâche par chantier, étiquetée) ; cette section en garde la
synthèse et le point d'entrée dans le code.

## 1. Corrigé dans cette PR

### Poids du site et de l'app

- **Firestore était revenu dans le chargement initial.** Depuis le découpage
  de `src/firebase/`, `moderationService` importait `firebase/firestore` en
  statique pour le signalement, et `authService` (donc App.vue) l'importe
  pour le filtre de termes : le SDK Firestore entier (671 kB, 173 kB gzip)
  était de nouveau préchargé par `index.html` sur chaque page, web et app.
  Le signalement charge maintenant Firestore à la demande. JS préchargé :
  335 kB gzip avant, 162 kB gzip après.
- **Un test tient la frontière** (`src/__tests__/initialBundle.test.ts`) : il
  suit les imports statiques depuis `main.ts` et refuse Firestore, Storage,
  Functions, hebcal et PostHog dans ce graphe. Il échouait sur la base, il
  passe maintenant ; un import ajouté par mégarde le fera échouer avec le
  chemin exact.
- **App.vue** : la barre du bas, le bandeau de mise à jour (et son service
  Capacitor) et l'avis hors ligne passent en composants asynchrones ; le site
  n'embarque plus une ligne de ce qui ne concerne que l'app.
- **main.ts** : la synchronisation des textes téléchargés ne se lance que
  dans l'app ; sur le site elle tirait le service, le catalogue et les shims
  Capacitor (sept requêtes, ~18 kB gzip) pour lire une clé vide.
- **index.html** : la famille Google « Noto Serif Hebrew » quittait l'URL
  bloquante (le sous-ensemble embarqué dans `/fonts` passe avant elle dans
  chaque pile, elle ne servait plus) ; ce sous-ensemble est préchargé.
- Trois icônes jamais référencées retirées du registre embarqué.
- `@tailwindcss/vite` passe en dépendance de développement ; `app:build` ne
  prérend plus les 1 465 pages du site pour les supprimer aussitôt.

### Fluidité (surtout petits téléphones)

- **Pincement de lecture** (`useReadingPinch`) : l'écouteur `touchmove` non
  passif n'est posé que pendant un geste à deux doigts. Posé en permanence
  sur `document`, il forçait le navigateur à attendre le script avant chaque
  défilement à un doigt, pendant toute la lecture : le texte « accrochait ».
- **Barre de progression de lecture** : `transform: scaleX` au lieu d'une
  largeur animée à chaque frame de défilement (mise en page et peinture
  relancées à chacune).
- **Liens** : `a { transition: all }` transitionnait aussi les propriétés de
  mise en page de tous les liens du site ; restreint aux couleurs, opacité,
  transformation et ombre.
- **Mur de pierre** : inchangé. Les halos restent animés partout ; ils ne
  sont figés que sur les appareils déjà détectés comme faibles
  (`useDevicePerf`, verdict persisté), mécanisme existant. Si les Web Vitals
  mobiles le justifient un jour, `stone-wall--static` sur `pointer: coarse`
  est la piste (voir la tâche Notion « Fluidité »).
- **Session replay PostHog dans l'app : mesuré plutôt que coupé.** Chaque
  appareil natif tire une fois sa cohorte (replay actif ou non, gardée sur
  l'appareil) et tous ses événements portent `replay_cohort` : les Web
  Vitals (INP surtout) se comparent entre les deux moitiés dans PostHog. Le
  web n'est pas concerné (`web`). À trancher après quelques semaines : replay
  partout ou nulle part, et le tirage disparaît.
- **Page de gestion d'une chaîne** : inscrire un invité ne remplace plus
  toute la page par un spinner (liste démontée, défilement perdu).
- **Lecteur audio** : la sonde de durée ne repart plus quand le morceau est
  déjà dans le lecteur global, et elle relâche son téléchargement (`load()`)
  à la navigation.
- **Page de gestion d'une chaîne** : index de réservations en `computed`
  (les fonctions du template refaisaient un parcours des réservations dix
  fois par ligne, quadratique sur une chaîne du Talmud), chapitres mis en
  cache.
- **Lecture du jour, mode « gérer »** : filtrage du catalogue attendu 150 ms
  après la dernière frappe (comme la bibliothèque), sélection en `Set`.
- **Accueil** : une seule horloge partagée (`useNow`) pour les cartes
  horaires, 'Omer, lune et sidour, au lieu de quatre `setInterval`.
- **Widgets** : les payloads (hebcal, catalogue) sont importés à la demande
  au premier calcul, plus au chargement de l'app.
- **QR de partage** : module npm en `import()` (chunk hashé, immuable, typé)
  à la place d'un script vendorisé de 57 kB servi sans cache ni hash.

### Bugs

- **Date limite décalée à chaque enregistrement** : la modale d'édition
  affichait l'heure UTC dans un champ `datetime-local`, réinterprétée en heure
  locale à la sauvegarde ; chaque « Enregistrer » sans toucher la date la
  reculait de deux heures en France. Formatage local (`toDateTimeLocal`).
- **Date limite d'une nouvelle chaîne** : `new Date("YYYY-MM-DD")` lit minuit
  UTC, la veille au soir à l'ouest de Greenwich. La chaîne court maintenant
  jusqu'à la fin locale du jour choisi (`endOfLocalDay`), et la règle « chaîne
  terminée » vit une seule fois dans `sessionService.isSessionFinished`
  (trois copies avant).
- **Texte fantôme dans le lecteur** : deux textes enchaînés vite faisaient
  partir deux requêtes, et la première revenue écrivait l'ancien texte sous
  la nouvelle adresse. Jeton de requête dans `loadContent`.
- **Lecteur en mode chaîne** : une chaîne introuvable ou hors ligne faisait
  rejeter le montage en silence ; le texte reste lisible, l'erreur est
  journalisée.
- **Filtre de modération contourné par un « ! »** : la table leet convertit
  « ! » en « i » sur tout le texte, donc « pute! » devenait « putei » et
  passait. La substitution ne vaut plus qu'au contact d'une lettre ; test
  ajouté.
- **Suppression de compte** : les préférences, la progression et les
  marque-pages étaient purgés AVANT `deleteUser`, que Firebase refuse sans
  connexion récente ; un compte email pouvait se retrouver vidé mais
  toujours là. La fraîcheur de la connexion est vérifiée avant la purge.
- **Inscription email** : le pseudo n'était pas répercuté aux abonnés (la
  navbar gardait l'email) ; un `setTimeout(100)` en tenait lieu.
- **Textes corrigés invisibles une semaine sur le web** : `/texts/**` est
  servi avec sept jours de cache et l'URL ne portait pas l'empreinte du
  manifeste (jamais chargé sur le web). Le manifeste (12 kB, no-cache) est
  chargé une fois par session avant le premier texte.
- **Chapitres du Talmud** : un échec réseau sur `talmud-chapters.json` était
  mémorisé pour toute la session (découpage daf par daf jusqu'au rechargement).
- **Cache des séries** jamais invalidé par le backoffice (création,
  suppression, renommage d'auteur).
- **Signalement impossible** d'une chaîne au titre de plus de 300 caractères
  (plafond des règles) : nom tronqué.
- **Pages chiourim** : le rafraîchissement en arrière-plan reposait le chiour
  précédent si l'on avait changé d'épisode entre-temps ; clé `v-for` sur le
  nom (doublons possibles) remplacée par le slug ; rejet non géré dans le
  studio.
- **Balises sociales** : l'image `og:image` de la page précédente restait sur
  la suivante.
- **Barre de progression d'une chaîne** : classe `fill-mode-backwards`
  inexistante en Tailwind 4, d'où un flash à chaque affichage.
- **Accessibilité** : `aria-label` français en dur sur le bouton de remontée
  (toutes langues) ; deux `h1` par page (le bandeau du site en portait un).

### Backend et règles

- **Masquage automatique forgeable** : trois signalements anonymes du même
  appareil (identifiant invité librement choisi, ou absent, auquel cas la
  fonction comptait le document lui-même) masquaient n'importe quelle chaîne.
  Seuls les comptes pèsent maintenant dans le seuil ; les signalements
  d'invités restent comptés et visibles dans le backoffice. Les règles
  exigent un identifiant invité non vide pour un signalement sans compte.
- **`setTitle` de l'aperçu social** : remplacement par chaîne, donc `$'`,
  `$&` ou `$1` dans un nom de chaîne étaient interprétés (un titre « $' »
  recopiait tout le HTML suivant dans la balise). Fonction de remplacement.
- **Rappel quotidien** : jour et heure calculés dans le fuseau du lieu de
  l'utilisateur (Paris avant : passé minuit à Paris, la progression d'un
  lecteur en Israël était jugée périmée et le rappel partait à tort) ;
  `hourCycle: "h23"` (certaines versions ICU donnent « 24 » à minuit) ;
  délai porté à cinq minutes ; un profil en échec ne bloque plus les
  suivants.
- **Aperçu social** : délai de cinq secondes sur le `fetch` du shell (un
  visiteur humain attendait sinon le timeout de la fonction) ; le binaire
  resvg et ses 1,3 Mo de polices ne se chargent plus au démarrage à froid
  des callables, du trigger et du scheduler.
- **Carte OG** : la dernière ligne du titre ne recevait qu'un mot avant
  l'ellipse (`maxLines - 1`).
- **CI** : les Cloud Functions sont compilées sur chaque PR (avant, la
  première compilation avait lieu au déploiement, après la mise en ligne du
  site).
- `firebase.json` : `trailingSlash: false` (`/horaires/` répondait 200 avec
  le shell sans canonique) ; JSON-LD prérendu avec `<` échappé.
- **Règles des sessions** : titre, description, slug, nom du créateur et
  tableau de réservations typés et bornés à la création et à la mise à jour
  par le propriétaire (rien ne les bornait, jusqu'au mégaoctet du document) ;
  `personId` figé (plus de transfert de session par son propriétaire).
- **Migration des réservations invité** : sessions candidates prises dans le
  cache partagé au lieu d'une lecture complète de la collection à chaque
  connexion (trois fois par page de connexion).
- **Aperçu social** : `/chiourim/serie/:id` résolu par un seul document,
  au lieu de tomber sur le scan du catalogue.

### App native

- **Rotation du jeton FCM** : le nouveau jeton remplace l'ancien dans le
  profil dès que le plugin le signale ; avant, les rappels s'éteignaient en
  silence jusqu'à une réactivation à la main.
- **Réglages hors ligne** : la page de profil (réglages sans compte dans
  l'app) affichait « connexion impossible » pour changer un thème local.
- **iOS** : `getToken()` juste après la permission peut échouer tant que le
  jeton APNs n'est pas arrivé ; on attend l'événement du plugin avant de
  conclure à un refus.
- **Avis hors ligne** : « réessayer » rejoue la navigation au lieu de
  redémarrer toute l'app.
- **Bundle natif** : image de partage, preuve de propriété, manifeste des
  textes et version publiée quittent le bundle (reliquats du site).
- Commentaires périmés de `capacitor.config.ts` et d'App.vue remis d'accord
  avec le code.

### Code mort retiré

Onze `window.confirm` remplacés par la modale de l'app (`useConfirm`), les
actions de `useZmanimLocation` renommées (`locateDevice`, `selectCity`,
`resetPlace` : ce ne sont pas des composables), les canoniques et liens de
partage sur `SITE_URL` dans quatorze vues (donnaient `capacitor://localhost`
dans l'app), cinq tests sans DOM passés en environnement node.

Flux de connexion Google par redirection (six méthodes et l'aller-retour
inutile de `getRedirectResult` au montage de la page de connexion),
`getPermissionStatus` et `sendTest` du service push (la Cloud Function
`sendTestNotification` reste, appelable à la main), `updateSerie`,
`getSeriesForAuteur`, l'interface `Guest`, la prop `isReserving` (jamais
alimentée, testée dans six expressions), l'état « succès » d'un message
jamais atteint (`NewSession`), le store `readingNavSections` (écrit, jamais
lu), la classe `menu-open` du body (aucune règle CSS), une condition RTL
toujours fausse dans le sélecteur de langue, un double `applySessionSeo`.

## 2. Chantiers recommandés (non faits ici)

Par ordre de valeur. Chaque ligne donne le point d'entrée ; chacun a sa
tâche dans la base Notion du projet.

### Sécurité et données

1. **Réservations modifiables par n'importe qui** (`firestore.rules`, règles
   `isUpdateReservationOnly` / `isRemoveOneReservationOnly`). Sans compte,
   tout client peut réécrire le tableau `reservations` d'une chaîne à taille
   constante ou en retirer une, la sienne ou celle d'un autre ; côté
   interface, saisir l'email d'un autre invité suffit à obtenir ses boutons
   (`canUserDeleteReservation` compare à l'email tapé). C'est un choix
   assumé (identité invité par email, sans compte), mais c'est le point le
   plus exposé du modèle. Sortie : sous-collection
   `sessions/{id}/reservations/{rid}` avec propriété par uid ou identifiant
   invité vérifiée par les règles, ou un callable pour les mutations.
   Migration de données à prévoir.
3. **Chaînes masquées toujours lisibles** (`allow read: if true`) : le
   masquage n'existe que côté client. `allow get` conditionné à `hidden`
   après backfill du champ.
4. **Chiourim non publiés listables** avec leur URL audio
   (`chiourFirestoreRepository`, règles `chiourim`). `allow list` sur
   `published == true`, et un callable pour les brouillons du studio.
5. **Dépôts studio orphelins** (`storage.rules`, `studioUploads/`) : aucune
   purge. Règle de cycle de vie GCS à poser à la main et à consigner.
6. **Emails de tiers dans le bundle** (`src/config/analyticsAudience.ts`) :
   comparer des empreintes, ou poser `user_type` côté serveur.
7. **App Check** sur les callables (studio, notification de test).
8. **Clé de compte de service à durée illimitée** dans les secrets GitHub :
   Workload Identity Federation.

### Coût Firestore (grossit avec l'usage)

1. **Toute la collection `sessions` à chaque visite** (`firestoreService`,
   `getSessions`) et **à chaque connexion** (`migrateGuestReservations`,
   appelé trois fois depuis la page de connexion). `where` sur `isEnded`,
   `orderBy` + `limit`, réservations en sous-collection ou compteur ;
   migration des invités depuis le cache déjà chargé, et seulement si un
   identifiant local existe.
2. **Rappel quotidien : scan de tous les profils toutes les cinq minutes**
   (`functions/src/dailyReminder.ts`). Dénormaliser un créneau
   (`pushReminderSlot`) côté client et requêter dessus ; précalculer le
   créneau de chkia une fois par jour.
3. **Aperçu social devant le trafic humain** : vérifier en production que
   l'en-tête `Cache-Control: no-cache` du bloc `**` de `firebase.json` ne
   l'emporte pas sur celui des fonctions (`curl -sI` sur une page chiour) ;
   le cas échéant, blocs `headers` dédiés aux routes réécrites.
4. `getChiourim()` (catalogue entier) dans la fonction pour les pages
   auteur ; le filet pour documents hérités n'a plus d'objet depuis la
   migration.

### Poids et démarrage

1. **`fr.ts` entier dans l'entrée** (18 kB gzip, dont ~12 kB d'espaces de
   noms de pages lazy) : découper par espace de noms et fusionner à l'entrée
   de la route, comme pour en et he. Gain ~10 kB gzip sur chaque première
   page.
2. **`seoPages.ts` en un seul chunk** (35 kB gzip) chargé entier par toute
   page de contenu (mentions légales comprises) : helpers dans un petit
   module, contenus par famille et par langue en `import()`.
3. **Polices Google bloquantes dans l'app** : la coquille native attend
   `fonts.googleapis.com` avant le premier rendu (portail captif, réseau
   lent). Embarquer Inter et Frank Ruhl Libre en woff2 sous-ensemblés
   (~150 kB) et retirer le lien Google de `app.html`. Licences OFL.
4. **`TextZoom` natif** : régler `setTextZoom(100)` dans `MainActivity`
   plutôt qu'après le montage (reflow visible sur Android à police système
   agrandie), et retirer le plugin.
5. `widgetService.init()` à lancer après `router.isReady()` et
   `requestIdleCallback` (les payloads sont déjà importés à la demande).
6. Un seul build par PR (`ci.yml` et `preview.yml` en font deux) ;
   `firebase-tools` épinglé ; `lastmod` réel dans le sitemap (aujourd'hui la
   date du build sur 1 465 URLs).

### Fluidité

1. **Index de réservations** : `TextStudiesList` et `SessionManagementPage`
   ont maintenant chacun les leurs ; les réunir dans un composable
   `useReservationIndex(session)`.
2. **Trois écouteurs de défilement** sur une page de lecture (ScrollToTop,
   ReadingMenu, ReadingProgressBar) : un `useScrollFrame()` partagé.
3. **Flou de la navbar** (`backdrop-blur-md`) re-rasterisé à chaque frame de
   défilement sur mobile ; ne le garder qu'au pointeur fin.
4. Bandes de progression restantes en `width` animée (cartes de session,
   lecture du jour, lecteur audio) : même passage à `scaleX`.

### App native

1. **Bouton retour Android aveugle aux surcouches** : introduction, dialogue
   de confirmation, modales et menu de lecture ne se ferment pas au geste
   retour, qui navigue en dessous ou minimise l'app. Une pile de
   gestionnaires (`useBackHandler`) consultée avant `router.back()`.
2. **Textes téléchargés sauvegardés sur iCloud** (`Directory.Data` =
   Documents sur iOS, ~40 Mo retéléchargeables) : motif de rejet possible
   (guideline 2.23). Poser `NSURLIsExcludedFromBackupKey` sur
   `Documents/texts` depuis le plugin Swift.
3. **Rachi de la paracha jamais téléchargeable** : élagué du bundle mais
   absent des livres hors ligne ; l'option Rachi du chnei mikra échoue sans
   réseau.
4. Éclair blanc au lancement Android : `setBackgroundColor(TRANSPARENT)` sur
   la WebView dans `setup-android.mjs`, le fond jour/nuit de la fenêtre
   transparaît.

### Qualité et dette

- **Quatre composants de plus de mille lignes** (`DailyReading`,
  `TextReadingPage`, `SessionManagementPage`, `DetailSession`). Le préalable
  est d'extraire ce qui est écrit plusieurs fois : édition et fin de session
  (quatre copies), réservation depuis le lecteur (copie de `DetailSession`),
  filtrage du catalogue, le triptyque thème / polices / apparence des
  composables de préférences (~150 lignes identiques).
- **`sessionService`** : façade de délégation vers `reservationService`,
  `SearchService`, `TextTypeService`, `DateService` (plus de vingt méthodes
  d'une ligne), alors que les vues appellent aussi `reservationService`
  directement.
- **Chaînes françaises en dur** dans des vues traduites (« Session
  introuvable », « Utilisateur », titres SEO de pages internes).
- Outillage : `scripts/*.mjs` ni lintés ni typés ; `noUnusedLocals` absent ;
  tous les tests en jsdom, y compris ceux qui n'en ont pas besoin ; `knip` en
  CI trouverait les exports morts restants (`READING_LEAD_SOLO`, `hubHeading`,
  `localePrefix`, `CITY_NAMES`, `PARASHA_*`, `ZMANIM_GUIDE_*`).

## 3. Pistes produit

- **Tableau de bord du créateur** sur la page de gestion : qui a réservé
  quoi, qui n'a rien lu ; les données sont déjà là (`sessionGuests`).
- **Lien vers un verset** : `?verset=N` fonctionne dans le lecteur, mais
  aucune action ne le copie ; le bouton de sélection ne propose que le
  marque-page.
- **Nouvelle chaîne** : la sélection de livres part avec tout coché, d'où des
  chaînes de 2 700 dafim par défaut ; choix explicite ou avertissement.
- **Chaîne introuvable** : message non traduit et pas de retour vers le
  partage ; hors ligne, la barre de réservation disparaît sans explication.
- **Notifications** : après un refus définitif, proposer « Ouvrir les
  réglages » ; glisser « il reste 2 lectures sur 3 » dans le rappel et
  deep-linker sur le premier texte non lu (la fonction lit déjà la
  progression).
- **Widgets trilingues** (ressources `values-en` / `values-iw`,
  `openAppFallback` en dur) ; widget Android « horaires essentiels » et
  raccourcis bibliothèque (le payload existe déjà côté Android).
- **Réglages manquants** dans l'app : « télécharger seulement en Wi-Fi » (ou
  confirmation au-delà de 5 Mo), « vider les textes hors ligne »
  (`removeBooks` existe).
- **Introduction** : fusionner Bibliothèque et Hors ligne ; demander la
  position depuis la page Horaires (la permission la plus utile aux widgets).
- **Purge des signalements** résolus de plus de 90 jours (le backoffice lit
  la collection entière).
