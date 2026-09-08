# Revue de code (septembre 2026, suite) : propreté, doublons, fluidité, bout en bout

Deuxième passe après `audit-review-2026-09.md`, à trois fins : rendre le code
plus propre (doublons, code mort, chaînes en dur), améliorer la fluidité, et
poser une suite de tests de bout en bout réutilisable, qui a servi à chercher
des bugs existants. Quatre relectures parallèles (chaînes de lecture,
bibliothèque et lecteur, coquille et préférences, documentation), chaque
constat vérifié dans le code avant d'être corrigé ; puis la suite Playwright
jouée sur le résultat.

Ce document dit ce qui a été fait ici et ce qui reste, avec le fichier où
commencer. Les tests sont décrits dans `tests.md`.

## 1. Tests de bout en bout (nouveau)

- `playwright.config.ts`, `e2e/`, `scripts/e2e.mjs` : deux projets, `public`
  (pages sans Firebase) et `firebase` (comptes, chaînes, chiourim, lecture du
  jour, contre les émulateurs Auth et Firestore). `npm run test:e2e` réutilise
  des émulateurs déjà lancés, sinon en démarre des vides avec le CLI firebase,
  sinon joue le projet `public` seul.
- Socle (`e2e/support/`) : consentement et introduction déjà réglés, échec sur
  toute erreur JavaScript de la page, comptes et données posés par l'API REST
  des émulateurs (`scripts/lib/firebase-emulator.mjs`, partagé avec les
  captures des fiches des stores).
- Job `e2e` dans `ci.yml`, en parallèle de la validation.

Ce que la suite a trouvé sur la base, corrigé ici :

- **Page blanche sur `/lire/:id`** (ancienne adresse, marque-pages, liens
  partagés) : la redirection canonique se faisait au montage de la vue, que le
  routeur réutilise ; elle se joue maintenant dans un garde de route
  (`src/router/lireRedirect.ts`).
- **Pages sans `h1`** : accueil, accueil du partage, page d'une chaîne, lecture
  du jour n'avaient qu'un `h2` depuis le retrait du `h1` du bandeau.
- **Recherche du catalogue** : « Berakhot » ne trouvait rien dans la
  bibliothèque (nom latin ignoré, alors que le partage le cherchait).

## 2. Bugs corrigés

### Chaînes de lecture

- Réservations expirées fantômes : après un tirage expiré, le « lu » et
  l'annulation tombaient sur l'expirée (erreur, ou annulation muette). Les
  recherches excluent l'expiration et la confirmation purge les expirées de
  l'emplacement (`reservationService.findActiveReservation`,
  `pruneExpiredForSlots`, testés).
- Modale d'édition : un second watcher remplissait la date en UTC (chaque
  réessai après échec reculait la date limite de deux heures) ; la modale
  fermait avant de savoir si l'écriture avait réussi (saisie perdue). Elle
  attend maintenant le résultat (`save` renvoie une promesse) et reste ouverte
  en cas d'échec.
- Un texte entièrement réservé par plusieurs personnes ressortait
  « Disponible » (`getTextDisplayStatus`).
- `ReservationGoneError` n'était traitée que dans le lecteur : les trois autres
  écrans affichaient une erreur technique et gardaient un interrupteur faux.
- Sélection non purgée après rechargement, auth non écoutée sur la page d'une
  chaîne (inscription depuis la modale invisible), changement de slug sans
  rechargement, `deadline_days` calculé à minuit UTC.

### Bibliothèque et lecteur

- Lecture du jour laissée ouverte la nuit : la progression de la veille était
  réécrite comme celle du jour (`ensureSameDay` avant chaque écriture et au
  retour à l'écran).
- Mode « gérer » : chercher un texte liturgique donnait une zone vide sans
  message ; le menu de lecture et la barre de progression s'affichaient en mode
  « gérer » et masquaient le bouton de remontée.
- Menu de lecture : ancres dupliquées (marqueur sans ligne partageant son
  offset avec le bloc suivant), saut au mauvais passage ; ancre par index de
  bloc.
- Tehilim du jour et paracha : jour civil sans chkia, et non réactif au temps
  dans deux des trois consommateurs (`useTehilimDay`, `useWeeklyParasha`,
  branchés sur l'horloge partagée et `visibilitychange`).
- Métadonnées SEO figées au changement de langue (bibliothèque, chnei mikra,
  lecteur), minuteurs de debounce et de surbrillance non nettoyés.

### Coquille, préférences, natif

- **Bouton retour Android** : il naviguait sous les modales et minimisait
  l'app depuis l'introduction. Pile de surcouches (`useOverlayStack`)
  consultée avant `router.back()` ; composant `AppModal` (Teleport, Échap,
  focus, fermeture à la navigation, verrou de défilement) pour les dialogues
  de la coquille ; les modales de session s'inscrivent dans la pile.
- **Analytics** : `capture` était un no-op tant que PostHog n'était pas
  chargé ; `home_viewed` et le début du funnel d'introduction étaient perdus.
  File bornée rejouée à l'initialisation ; `identify` seulement après le
  premier verdict d'auth.
- **Pages de ville** : visiter `/horaires/marseille` persistait Marseille
  comme lieu de l'utilisateur (accueil, sidour, widgets) et émettait un
  événement « ville choisie » à chaque chargement. Le lieu de la page ne se
  persiste plus.
- **Rotation du jeton push hors ligne** : les rappels s'éteignaient pour de
  bon (préférences par défaut en cas d'échec de lecture). Lecture stricte,
  rotation gardée en attente et rejouée au retour du réseau, une seule
  écriture.
- Préférences : un échec d'écriture verrouillait la valeur en mémoire (le
  serveur n'était plus relu à la reconnexion).
- Icône Apple absente du bouton de connexion (FontAwesome jamais chargé),
  erreurs d'auth triées sur le message plutôt que le code, rejet non géré du
  backoffice des chiourim, `watchEffect` qui se réveillait lui-même.

## 3. Fluidité

- **Un seul écouteur de défilement** (`useScrollFrame`, un `requestAnimationFrame`,
  hauteur du document lue dans l'image) pour le bouton de remontée, le menu de
  lecture (qui forçait un reflow à chaque événement), la barre de progression
  et la position de lecture.
- **Office recalculé toutes les minutes** : la chaîne horloge, jour hébraïque,
  occasions, blocs visibles re-rendait tout le texte ; une clé scalaire du jour
  la coupe. Trois `setInterval` remplacés par `useNow`.
- **Bandes de progression en `scaleX`** (`ProgressBar.vue`), partout où une
  largeur animée relançait mise en page et peinture (cartes, lecture du jour,
  lecteur audio, envois).
- Cartes de la bibliothèque : état de téléchargement en `Map` calculée (six
  appels par carte, 150 cartes, avant). Lecture du jour : sections repliées en
  `v-if` et `content-visibility: auto`. Page de gestion d'une chaîne :
  sections disponibles et lignes de chapitres préparées en `computed`, bascule
  « lu » optimiste au lieu d'une relecture Firestore.
- `Intl.DateTimeFormat` mis en cache (`intlCache`), `computeZmanim` mémoïsé
  par lieu et par jour, flou de la navbar réservé au pointeur fin, mur de
  pierre généré après le premier rendu, widgets initialisés après
  `router.isReady()` et à l'heure creuse, `CollapseTransition` sur
  `transitionend` et `prefers-reduced-motion`.

## 4. Doublons retirés

| Ce qui était écrit plusieurs fois | Où il vit maintenant |
| --- | --- |
| Index de réservations, cache de chapitres, clés d'emplacement, tout sélectionner (3 copies) | `composables/useReservationIndex.ts` |
| Sauvegarde (4) et fin (2) d'une chaîne, avec analytics et toasts | `composables/useSessionEditing.ts` |
| Filtrage du catalogue (3, divergentes) | `services/catalogSearch.ts`, `useCatalogSearch`, `CatalogSearchField.vue` |
| Thème, polices, apparence (~150 lignes identiques) | `composables/createAccountPreference.ts` |
| Marque-pages du lecteur et de la lecture du jour | `composables/useVerseBookmarks.ts` |
| État et bascule de téléchargement d'un livre (2, télémétrie divergente) | `composables/useBookDownload.ts` |
| Plage de psaumes (3), titre de paracha (3) | `composables/useTehilimDay.ts`, `dailyCycles.parashaTitle` |
| Rendu du Talmud daf par daf (2) | `components/TalmudDafText.vue` |
| Distance orthodromique (3), Firestore paresseux (2), cache TTL (2), tri des épisodes (2), connexion Google et Apple (2 blocs) | `services/geo.ts`, `firebase/lazy.ts`, `services/cached.ts`, `serieService.byEpisode`, `loginView.socialSignIn` |
| Statistiques d'avancement d'une chaîne (4 définitions) | `sessionService.getSessionReservationStats` (hors expirées, un texte entier compte pour toutes ses places) |
| Fin de journée locale (3), table des types de textes (2), validation du formulaire invité (2), appartenance d'une réservation (2, sans l'identifiant invité local) | `dateService.endOfLocalDay`, `TextTypeService`, `reservationService.assertGuestFormValid`, `isOwnReservation` |
| Suffixe « | Petite Jérusalem » (6) | `seoService.pageTitle` |

`sessionService` a perdu ses méthodes mortes et sept délégations d'une ligne ;
il en garde huit, appelées par le lecteur (voir section 6).

## 5. Chaînes en dur et code mort

- Les erreurs métier portent un code (`services/appError.ts` :
  `SlotTakenError`, `GuestNameRequiredError`, `SessionMissingError`,
  `AuthFlowError`, `PreferencesSaveError`…) et `useToast.errorFromException`
  les traduit par `errors.*` ; plus aucun message de service n'est affiché
  brut, et le lecteur ne détecte plus un conflit par `includes("déjà
  réservée")`.
- Libellés « Chapitre N », « Daf 2a à 7b » construits dans `textService` :
  structurés (`heading`) et formatés par la vue (`useTextLabels`) ; le prérendu
  garde le français.
- Traduites : « Session introuvable », erreurs de chargement, titre SEO de la
  page de gestion, page introuvable du guide des zmanim, intention introuvable,
  liens de bas de page du lecteur, `aria-label` du pied de page, repli
  « Utilisateur » (plus jamais écrit en base), ponctuation « libellé : valeur »
  paramétrée.
- Retirés : `Session.isCompleted` (jamais vrai), champ `available` des
  réservations (jamais lu), branche `#full`, `useNativeApp()`, `resetPlace`,
  `isRtl`, `watchDayKey`, l'emit `serieCreated`, deux méthodes mortes de
  `sessionService`, dix-sept clés de traduction sans lecteur (dans les trois
  langues), le mot-clé `export` sur treize classes doublées d'un singleton et
  une douzaine de symboles à usage interne. Un test symétrique dans
  `i18nUsage.test.ts` refuse désormais toute clé de `fr.ts` sans lecteur.

## 6. Ce qui reste (par valeur)

1. **Réservation depuis le lecteur** : `TextReadingPage.vue` (`reserve`,
   `cancelReservation`, `toggleRead`) reste une copie de `DetailSession` ;
   un `useSessionReservation(session, user, form, source)` les réunirait, et
   `sessionService` pourrait alors perdre ses huit dernières délégations
   (`deleteReservation`, `canUserDeleteReservation`, `createReservationForUser`,
   `createLocalReservation`, `isReservationExpired`, `isTextOrSectionReserved`,
   `markReservationAsCompleted`, `formatBookName`).
2. **Modales de session sur `AppModal`** : `EditSessionModal`,
   `ReportSessionModal`, `ShareModal`, `GuestIdentityModal`,
   `ReminderSettingsModal` et les deux modales inline de
   `SessionManagementPage` s'inscrivent dans la pile du retour mais gardent
   leur propre calque (ni Échap, ni piège de focus).
3. **Composants de plus de mille lignes** : `TextReadingPage` (encore ~1 900
   lignes), `DailyReading`, `SessionManagementPage`, `DetailSession`. Les
   composables extraits ici sont le préalable ; la suite est de sortir la
   barre d'outils et le rendu par type de texte du lecteur.
4. **Taille de lecture** (`useReadingSize`) : le seul réglage qui ne suit pas
   le compte (appareil seul), alors que thème et polices le font. À trancher.
5. **`Chapitre`/`Daf` dans le prérendu** : reste en français, par choix ; les
   pages `/en` et `/he` de la bibliothèque n'existent pas encore.
6. Les chantiers de sécurité et de coût Firestore de la revue précédente
   (`audit-review-2026-09.md`, section 2) restent entiers.
