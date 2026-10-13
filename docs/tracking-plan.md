# Plan de suivi (PostHog)

Ce que l'application et le site envoient à PostHog, et pourquoi. Le projet est
`Petite Jerusalem` (région EU). Le code vit dans
`src/services/analyticsService.ts`.

## Les règles

- **Aucun événement existant n'est renommé ni supprimé.** Les analyses et les
  entonnoirs déjà construits s'appuient dessus ; un nom qui change casse la
  continuité des données sans prévenir. On ajoute, on ne remplace pas. Quand
  une propriété est mal nommée, la bonne se pose **à côté** de l'ancienne, et
  les deux partent ensemble le temps que les analyses basculent.
- **Convention** : `snake_case`, verbe au passé (`session_created`,
  `calendar_viewed`). Les propriétés aussi.
- **Le suivi ne part qu'en production** : le site public
  (`petite-jerusalem.fr`) ou l'app native. Ni `npm run dev`, ni
  `npm run preview`, ni les canaux de preview Firebase (voir
  `isTrackedSurface`). `localStorage.setItem('ph_debug', '1')` force le
  chargement n'importe où pour vérifier une instrumentation ; les événements
  partent alors avec `env: 'preview'` et s'excluent de toute analyse.
- **Rien ne part sans consentement** (ePrivacy/RGPD). Avant toute réponse,
  les événements attendent dans une file bornée et sont rejoués au
  chargement ; pendant un refus, rien ne s'y garde, et un accord donné
  ensuite n'envoie que ce qui suit. Un nouvel accord, même dans une session
  qui suit un refus, rétablit la capture (posthog-js garde le refus et le
  relirait). Tenu par `src/__tests__/analyticsConsent.test.ts`.
- **Toute nouvelle propriété est documentée ici**, dans la section de son
  événement.
- **Aucune adresse email dans une URL suivie.** PostHog enregistre l'adresse
  de chaque page (`$current_url`, `$referrer`, leurs `$initial_*`, et
  l'adresse d'entrée de la session, `$session_entry_url`, jointe à chaque
  événement) et le replay la montre : une donnée personnelle ne se passe pas
  en paramètre d'adresse. L'invitation à créer un compte transmet l'adresse de l'invité
  par l'état de la navigation ; `before_send` retire en plus tout paramètre
  `email` des URL envoyées (`withoutPersonalParams`, tenu par
  `src/__tests__/analyticsPersonalParams.test.ts`).

## Les propriétés portées par tous les événements

Posées par `register()` et par `before_send`, y compris sur les `$exception`
et les `$pageview` automatiques.

| Propriété       | Valeurs                 | À quoi elle sert                              |
| --------------- | ----------------------- | --------------------------------------------- |
| `env`           | `production`, `preview` | Écarter ce qui ne vient pas de la vraie prod. |
| `app_platform`  | `web`, `ios`, `android` | Séparer le site des deux apps.                |
| `app_version`   | `v3.10.6`...            | Rattacher un bug à une release.               |
| `replay_cohort` | `web`, `on`, `off`      | Mesurer le coût du session replay dans l'app. |
| `is_logged_in`  | booléen                 | Segmenter anonyme / connecté.                 |
| `locale`        | `fr`, `en`, `he`        | Segmenter par langue.                         |

Dans l'app, l'origine `https://localhost` de la webview Capacitor est
réécrite en `app://ios` / `app://android` : `$current_url` reste donc lisible
et porte bien la route, sur les `$exception` comme sur le reste.

## Calendrier et pages de fête

### `calendar_viewed` (existant)

Posé à l'ouverture de `/calendrier` et de `/calendrier/<fete>`.

| Propriété  | Valeurs                                           | Statut             |
| ---------- | ------------------------------------------------- | ------------------ |
| `festival` | le slug français de la fête, ou `null` sur le hub | existant, conservé |
| `holiday`  | la même valeur                                    | **nouveau**        |

`holiday` double `festival` sans le remplacer : c'est le nom qu'emploient les
événements de conversion ci-dessous, et les deux se croisent alors sans
traitement particulier. `festival` reste pour ne pas couper les analyses en
cours.

### `calendar_cta_clicked` (nouveau)

Un départ depuis la page d'une fête. C'est la mesure de ce que ces pages
rapportent : elles sont la première source de trafic du site, et sur les 231
visiteurs venus d'un moteur en trente jours, 3 % seulement avaient ouvert une
seconde page.

| Propriété  | Valeurs                                                    |
| ---------- | ---------------------------------------------------------- |
| `holiday`  | le slug français de la fête (`souccot`, `yom-kippour`...)  |
| `cta_type` | `internal_link`, `app_store`, `play_store`                 |
| `target`   | le chemin visé pour un lien interne, la clé du store sinon |

### `app_download_clicked` (existant)

| Propriété | Valeurs                                          | Statut      |
| --------- | ------------------------------------------------ | ----------- |
| `store`   | `apple`, `android`                               | existant    |
| `offered` | nombre de stores proposés                        | existant    |
| `source`  | `calendar_festival`, `reading_menu`... ou `null` | **nouveau** |

Le bouton de téléchargement vit à plusieurs endroits ; sans `source`,
l'événement ne disait pas lequel rapporte.

### `date_converter_opened` (nouveau)

L'ouverture du convertisseur de dates, depuis le bouton « Convertir une date »
du calendrier (`DateConverterModal.vue`).

| Propriété | Valeurs                                               |
| --------- | ----------------------------------------------------- |
| `source`  | `calendar_button` (le seul point d'entrée, à ce jour) |

### `date_converted` (nouveau)

Un outil du convertisseur réellement servi : posé au premier réglage que fait
la personne, une fois par outil et par ouverture. À chaque chiffre changé,
l'événement ne dirait plus rien.

| Propriété | Valeurs                                             |
| --------- | --------------------------------------------------- |
| `tool`    | `hebrew_to_civil`, `civil_to_hebrew`, `bar_mitzvah` |

Ni la date ni l'année : une date de naissance désigne une personne.

## Introduction de première ouverture

L'introduction de l'app native (`OnboardingFlow.vue`). Elle est passée de six
pages à cinq, consentement compris, en septembre 2026, et « Passer »
n'est plus proposé que sur la dernière, celle des gestes : sur les 90
jours d'avant, 69 des 148 fins étaient un « Passer », dont 55 dès la première
ou la deuxième page après le consentement. `app_version` sépare les deux
formes pour mesurer l'effet.

### `onboarding_started` (existant)

| Propriété | Valeurs                                                     |
| --------- | ----------------------------------------------------------- |
| `steps`   | nombre de pages : 5, ou 4 si le consentement est déjà donné |

### `onboarding_step_viewed` (existant)

| Propriété | Valeurs                                                    | Statut                                |
| --------- | ---------------------------------------------------------- | ------------------------------------- |
| `step`    | `consent`, `settings`, `offline`, `essentials`, `gestures` | `essentials`, `gestures` **nouveaux** |
| `index`   | rang de la page, à partir de 0                             | existant                              |

`daily`, `library` et `zmanim` ne partent plus : ces trois pages sont réunies
dans `essentials`, et les gestes de `library` ont leur page, `gestures`.

### `onboarding_finished` (existant)

| Propriété             | Valeurs                                           | Statut              |
| --------------------- | ------------------------------------------------- | ------------------- |
| `via`                 | `finish`, `skip`, `escape`, `daily`               | `daily` **nouveau** |
| `step`                | la page où l'introduction s'est terminée          | existant            |
| `wants_daily_reading` | vrai quand elle se termine sur la lecture du jour | existant            |

`daily` : le bouton « Composer ma lecture du jour » de la page `essentials`,
qui termine l'introduction et y conduit. `skip` et `escape` ne partent plus que
de `gestures`, la seule page qu'on puisse passer. `wants_daily_reading` garde son sens
(l'introduction mène à la lecture du jour), il vaut maintenant `via = daily`.

### `onboarding_offline_download_started`, `onboarding_offline_download_finished` (existants)

Inchangés : le choix des textes à emporter reste une page de l'introduction
(51 téléchargements lancés sur la même période).

## Profil

Le site et l'app n'ont pas le même profil (voir docs/design.md, « Le profil
de l'app est une liste, pas un menu ») : un menu latéral sur le site, une
liste de lignes et des sous-pages dans l'app. Les deux posent les mêmes
événements, avec les mêmes valeurs ; `app_platform` les sépare.

### `profile_tab_opened` (existant)

Sur le site, un onglet du menu ; dans l'app, l'arrivée sur une sous-page
(`/profile/<section>`), y compris par un retour ou un lien direct.

| Propriété | Valeurs                                                                                           | Statut              |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| `tab`     | `my-info`, `security`, `appearance`, `preferences`, `notifications`, `about`                      | existant, conservé  |
| `tab`     | `language` (app seulement : la langue y a sa sous-page ; sur le site, elle est dans `appearance`) | **nouvelle valeur** |

`notifications` et `about` ne venaient que de l'app. `about` n'y part plus :
ce qu'il ouvrait (pages d'information, support, cookies) est désormais en
lignes sur la page du profil elle-même, sans sous-page à compter.

### `profile_shortcut_clicked` (existant)

Un raccourci du profil vers ce qui y vivait autrefois : `shortcut` vaut
`daily_reading` ou `my_sessions`, sur le site comme dans l'app (groupe « Mes
lectures »).

## Lecture de la tefila

### `hazara_opened` (nouveau)

Le bouton « 'Hazara », à la fin d'une 'Amida que le 'hazan répète : il
remonte au début de la 'Amida, les passages du 'hazan dépliés (voir
docs/design.md, « La 'hazara repart du début de la 'Amida »). Sans propriété
à lui : `$current_url` dit l'office. Il dit si le bouton est trouvé, et s'il
sert à l'office en communauté plutôt qu'à la prière seul.

## Bibliothèque

### `moadim_now_opened` (nouveau, plus posé)

L'encart posé en tête du sidour le temps d'une fête (`MoadimNowBanner`), qui
mène aux textes de la fête dans Moadim. Il dit si l'on cherche ces textes
depuis le sidour.

N'est plus posé depuis la page du Sidour (octobre 2026, voir « Sidour et
Étude ») : la liste du sidour a disparu avec son encart, et les textes de la
fête remontent d'eux-mêmes en tête de la page. Le nom reste réservé, et ses
données passées gardent leur sens.

| Propriété  | Valeurs                                                   | Statut      |
| ---------- | --------------------------------------------------------- | ----------- |
| `source`   | `library_sidour`                                          | **nouveau** |
| `festival` | le livre de la fête, `Souccot`, `Yamim Noraim`, `Hanouka` | **nouveau** |

### `sidour_brahot_opened` (nouveau, plus posé)

Le lien « Vous cherchez le Birkat Hamazon ou une autre brakha ? », en tête du
sidour (`SidourBrahotLink`), qui mène au livre des Brahot. Il dit combien de
lecteurs viennent chercher le Birkat Hamazon ou une brakha dans le sidour.

N'est plus posé depuis la page du Sidour (octobre 2026) : les brahot y sont
dans la même liste que les offices. Le nom reste réservé.

| Propriété    | Valeurs                                            | Statut      |
| ------------ | -------------------------------------------------- | ----------- |
| `source`     | `library_sidour`                                   | **nouveau** |
| `had_search` | booléen : une recherche était tapée dans le sidour | **nouveau** |

## Sidour et Étude (octobre 2026)

La barre du bas de l'app devient Accueil, Sidour, horaires, Étude, Profil
(voir `docs/design.md`, « Le Sidour s'ouvre sur le moment »). Rien n'est
renommé ni retiré : deux événements s'ajoutent pour la nouvelle page, et
quelques propriétés prennent une valeur de plus.

### `sidour_viewed` (nouveau)

L'arrivée sur la page du Sidour (`/sidour`). Il dit ce que la carte du moment
proposait à ce moment-là : le dénominateur de `sidour_text_opened`, et de quoi
voir si l'on vient au Sidour à l'heure des offices.

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `hero` | `chaharit`, `minha`, `arvit` (l'office dont c'est l'heure), `next_chaharit`, `next_minha`, `next_arvit` (celui qui vient, entre deux plages), `hanouka`, `slihot`, `halevana` (la bénédiction de la lune, les nuits où elle se dit), `feast` (entre deux offices, le texte de la fête en cours ; `feast` dit laquelle), ou `null` | **nouveau** |
| `feast` | la fête dont les textes remontent en tête : `tichri`, `souccot`, `hanouka`, ou `null` | **nouveau** |

### `sidour_text_opened` (nouveau)

Un texte ouvert depuis la page du Sidour. Il dit si la carte du moment sert,
et ce qu'on cherche dans la liste.

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `text` | le texte, `corpus/slug` (`sidour/chaharit`, `brahot/birkat-hamazon`...) | **nouveau** |
| `source` | `hero` (la carte du moment), `extra` (la ligne sous elle, un soir d'occasion : l'office ou la havdala), `list` (la liste) | **nouveau** |
| `section` | pour `list`, le groupe : `offices`, `soir`, `brahot`, `occasions`, `vie`, `fetes`, ou la fête en tête (`tichri`, `souccot`, `hanouka`) ; `null` sinon | **nouveau** |
| `feast` | comme sur `sidour_viewed` | **nouveau** |

### Les outils : `kotel_compass_opened`, `tefilin_mirror_opened` (existants), `naanouim_compass_opened` (existant, une propriété de plus)

La page du Sidour porte une rangée d'outils (voir `docs/design.md`, « Les
outils du Sidour ») : ils gardent leurs événements, qui disent d'où on les
ouvre. Le dénominateur des ouvertures depuis le Sidour est `sidour_viewed`.

| Événement | Propriété | Valeurs | Statut |
| --- | --- | --- | --- |
| `kotel_compass_opened` | `source` | `title` (le titre du passage), `menu` (le menu de lecture), `sidour` (la rangée d'outils) | `sidour` **nouveau** |
| `tefilin_mirror_opened` | `source` | `title`, `menu`, `sidour` | `sidour` **nouveau** |
| `naanouim_compass_opened` | `source` | `title` (le titre des brahot du loulav), `rubric` (une consigne du Hallel), `sidour` | **nouveau** : l'événement n'avait pas de propriété |

### Valeurs ajoutées à des propriétés existantes

| Événement | Propriété | Valeur ajoutée | Ce qu'elle dit |
| --- | --- | --- | --- |
| `library_tab_switched` | `tab` | `chiourim` | les onglets de l'Étude sont trois : `reading` (la bibliothèque), `chiourim`, `sharing`. Le nom de l'événement reste celui d'origine. |
| `text_opened` | `entry` | `sidour` | la lecture s'ouvre depuis la page du Sidour (`services/readingEntry.ts`). |
| `tehilim_day_opened` | `source` | `library_today` | depuis « Aujourd'hui », en bas de la bibliothèque. |
| `chnei_mikra_opened` | `source` | `library_today` | idem. |
| `offline_download_completed` | `scope` | `feast` | les textes de la fête, téléchargés d'eux-mêmes quand ils remontent en tête du Sidour (app) ; `tab` porte alors la fête (`tichri`, `souccot`, `hanouka`). |

`library_corpus_opened` ne porte plus que les corpus d'étude (`tehilim`,
`michna`, `talmud`, `tanakh`) : les listes de liturgie mènent au Sidour.
`library_search_result_opened` peut porter un `corpus` de liturgie (`Sidour`,
`Brahot`, `Moadim`) : ce sont les résultats rangés « Dans le Sidour ».
`offline_download_started`, `offline_download_completed` et
`offline_download_deleted` posés par la ligne « Hors ligne » gardent
`tab: Tout`, pour l'étude entière. Sa corbeille libère aussi les textes du
Sidour téléchargés à part (ceux d'une fête, d'anciennes copies des brahot) :
`books_count` les compte avec le reste.

`offline_download_delete_failed` (existant, jamais documenté) part quand la
corbeille échoue, depuis la ligne « Hors ligne » comme depuis une page de
livre. Mêmes propriétés que `offline_download_deleted` (`scope`, `tab`,
`books_count`), plus `error_message`, le message de l'erreur.

Le téléchargement des textes de la fête (`scope: feast`) ne part qu'en
ligne, et un seul à la fois : hors connexion, il attend une visite suivante
au lieu d'envoyer un lot vide.

## Chaîne perpétuelle de Tehilim

La chaîne toujours ouverte, et les noms qu'on lui confie (voir
`docs/chaine-perpetuelle.md`). Aucun nom ne part dans un événement : ce sont
des personnes, malades ou disparues ; on ne mesure que les gestes.

### `perpetual_chain_opened` (nouveau)

L'entrée dans la chaîne par ses deux portes : la carte en tête du partage, et
la ligne qui la propose à la création d'une session de Tehilim. Il dit si la
chaîne attire depuis l'accueil, et si la ligne de la création détourne vers
elle ceux qui cherchaient des lecteurs.

| Propriété | Valeurs                     | Statut      |
| --------- | --------------------------- | ----------- |
| `source`  | `share_home`, `new_session` | **nouveau** |

### `prayer_name_form_opened` (nouveau)

« Proposer un nom », ou un nom du lecteur touché pour le modifier. Sans
compte, la fenêtre ne s'ouvre pas : l'invitation à se connecter la remplace
(`signup_prompt_shown`, variante `prayer_name`). C'est le dénominateur de
`prayer_name_saved`.

| Propriété          | Valeurs                       | Statut      |
| ------------------ | ----------------------------- | ----------- |
| `session_id`       | identifiant de la chaîne      | **nouveau** |
| `mode`             | `add`, `edit`                 | **nouveau** |
| `source`           | `session_page`, `new_session` | **nouveau** |
| `is_authenticated` | booléen                       | **nouveau** |

### `prayer_name_saved` (nouveau)

Un nom ajouté, corrigé ou prolongé. Les prolongations disent si l'on revient
sur ses noms au bout de trente jours.

| Propriété        | Valeurs                        | Statut      |
| ---------------- | ------------------------------ | ----------- |
| `session_id`     | identifiant de la chaîne       | **nouveau** |
| `action`         | `added`, `updated`, `renewed`  | **nouveau** |
| `kind`           | `refoua`, `leilouy`            | **nouveau** |
| `has_death_date` | booléen (leilouy nichmat daté) | **nouveau** |

### `prayer_name_removed` (nouveau)

Un nom retiré par son auteur (une guérison, une erreur).

| Propriété    | Valeurs                  | Statut      |
| ------------ | ------------------------ | ----------- |
| `session_id` | identifiant de la chaîne | **nouveau** |
| `kind`       | `refoua`, `leilouy`      | **nouveau** |

### `signup_prompt_shown`, `signup_prompt_clicked` (existants)

Une valeur de plus pour `variant` : `prayer_name`, l'invitation à se
connecter posée devant « Proposer un nom ».

## Ajouts d'octobre 2026

Les ajouts qui suivent répondent à l'audit d'usage
(`docs/audit-usage-posthog-2026-10.md`, section 5) : rien n'y est renommé ni
retiré, chaque propriété nouvelle se pose à côté des anciennes.

### Clics morts (`$dead_click`, nouveau)

Activés dans le SDK (`capture_dead_clicks`, `analyticsService.ts`) : un
appui qui ne change rien à l'écran (ni défilement, ni sélection, ni
changement du DOM). Ils montrent ce qu'on prend pour une commande sans en
être une, ou une commande qui ne répond pas. Les corps de texte de la lecture
en sont exclus par la classe `ph-no-deadclick` (`TextReadingPage.vue`) : on y
appuie sans rien demander (double appui du défilement, lecture du doigt).

### Bibliothèque hors ligne : `offline_download_completed` (existant)

Une propriété de plus sur le lot (`scope: all`, « Tout télécharger ») :

| Propriété      | Valeurs                                       | Statut             |
| -------------- | --------------------------------------------- | ------------------ |
| `books_count`  | les livres effectivement rapportés            | existant, conservé |
| `books_failed` | les livres perdus en route, 0 le plus souvent | **nouveau**        |

`books_failed` porte le même nom que sur
`onboarding_offline_download_finished`, qui le posait déjà. Il devient utile
maintenant qu'un échec n'arrête plus le lot : `offline_download_failed` part
pour chaque livre manqué, puis le lot va jusqu'au bout et
`offline_download_completed` dit ce qui manque. Les deux événements se
suivent donc dans un même lot, ce qui n'arrivait pas avant. Le lot s'arrête
encore, sans `offline_download_completed`, quand les livres suivants
échoueraient tous : hors connexion au premier échec, permission de stockage
refusée (Android 10 et moins), ou trois échecs de suite (place épuisée, site
injoignable). Voir `composables/useBookDownload.ts` et
`src/__tests__/offlineDownloadAll.test.ts`.

### Lecture : `text_opened` (existant)

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `source` | `library`, `session` | existant, conservé |
| `entry` | `search`, `resume`, `push`, `home`, `library`, `sidour`, `daily_reading`, `chnei_mikra`, `tehilim_day`, `reading`, `zmanim`, `calendar`, `session`, `direct`, `other` | **nouveau** |

`entry` dit d'où l'on arrive (`services/readingEntry.ts`) : un indice laissé
juste avant la navigation quand l'adresse ne peut pas le dire (un résultat de
recherche, « Reprendre ma lecture », une notification), sinon la page
précédente. `reading` : depuis un autre texte (psaume suivant, office
suivant) ; `direct` : sans page précédente (widget, lien partagé, moteur de
recherche, page rechargée).

### Recherche

`library_search_used` et `chiourim_search_used` (existants) continuent de
partir à la première frappe. À côté, la recherche **posée**
(`composables/useSearchTracking.ts`) : le terme n'a plus bougé depuis 1,2 s,
un résultat s'ouvre, ou l'on quitte la page. Jamais deux fois de suite le
même terme, jamais un terme vide.

#### `library_search_performed` (nouveau)

| Propriété | Valeurs |
| --- | --- |
| `scope` | `all` depuis l'étagère, sinon le rayon (`tehilim`, `sidour`...) |
| `query` | le terme, en minuscules, espaces resserrées, 40 caractères au plus |
| `query_length` | sa longueur |
| `results_count` | le nombre de textes trouvés |

#### `library_search_result_opened` (nouveau)

| Propriété | Valeurs |
| --- | --- |
| `scope` | comme ci-dessus |
| `rank` | le rang du texte dans les résultats tels qu'ils s'affichent (par rayon, puis par livre), à partir de 1 |
| `corpus` | le type du texte (`Tehilim`, `Sidour`...) |
| `text_id` | son identifiant dans le catalogue |

#### `chiourim_search_performed` (nouveau)

`category` (le filtre en cours), `query`, `query_length`, `results_count`,
comme pour la bibliothèque.

### Horaires

#### `zmanim_day_changed` (nouveau)

| Propriété | Valeurs |
| --- | --- |
| `via` | `arrow`, `picker` (le calendrier sous la date), `today` (« Revenir à aujourd'hui ») |
| `offset_days` | l'écart avec aujourd'hui après le changement |
| `arrow_streak` | les flèches touchées à la suite, 0 hors flèche |

Au troisième appui de suite sur une flèche, l'astuce `zmanim-date` est
appelée (voir docs/design.md, « Une astuce se joue sur la page, une fois »).

#### `zmanim_location_requested` (existant)

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `granted` | booléen | existant, conservé |
| `source` | `sidour`, ou absent sur la page des horaires | existant, conservé |
| `outcome` | `granted`, `denied` (refus de l'utilisateur), `unavailable` (pas de signal, délai dépassé) | **nouveau** |
| `duration_ms` | l'attente de la réponse | **nouveau** |

### Connexion

#### `login_viewed` (nouveau)

| Propriété | Valeurs |
| --- | --- |
| `reason` | ce qui y a mené (`services/loginReason.ts`) : `direct`, `daily_reading`, `share_reading`, `profile`, `admin`, `other` |
| `mode` | `login` ou `signup` à l'arrivée |
| `last_method` | la dernière méthode de connexion de l'appareil : `google`, `apple`, `email`, ou `null` |

#### `email_auth_failed` (existant)

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `mode` | `login`, `signup` | existant |
| `reason` | le code Firebase (`auth/...`), ou `error` | existant |
| `reason` | `password_mismatch` (les deux mots de passe diffèrent), `moderation` (nom affiché refusé) | **nouvelles valeurs** ; elles partaient jusqu'ici sous `error` |
| `last_method` | comme `login_viewed` | **nouveau** |

#### `google_signin_clicked`, `apple_signin_clicked`, `*_signin_failed` (existants)

`attempt` (**nouveau**) : le rang de l'essai depuis l'arrivée sur l'écran. Il
dit combien d'échecs cèdent au deuxième essai (l'erreur Apple 1000).

#### `login_help_clicked` (nouveau)

La sortie proposée sous une erreur email (docs/design.md, « L'écran de
connexion dit quoi faire »).

| Propriété | Valeurs |
| --- | --- |
| `help` | `signup` (créer le compte), `login` (s'y connecter), `provider` (le bouton de la dernière méthode) |
| `reason` | la raison de l'échec qui l'a proposée, comme `email_auth_failed.reason` |

#### `password_reset_opened` (nouveau)

« Mot de passe oublié ? » touché sous le champ du mot de passe (docs/design.md,
« L'écran de connexion dit quoi faire »).

| Propriété | Valeurs |
| --- | --- |
| `after_error` | la raison de l'échec affiché à ce moment, comme `email_auth_failed.reason` (`auth/invalid-credential` le plus souvent), ou `null` |
| `last_method` | comme `login_viewed` |

#### `password_reset_requested` (nouveau)

L'envoi de l'email de réinitialisation. Ni l'adresse, ni le fait qu'elle ait un
compte : Firebase ne le dit pas, et une adresse sans compte compte comme
`sent`.

| Propriété | Valeurs |
| --- | --- |
| `outcome` | `sent`, `failed` |
| `reason` | le code Firebase d'un échec (`auth/too-many-requests`, `auth/invalid-email`, `auth/network-request-failed`...), `error` sans code, `null` pour `sent` |

#### `account_delete_failed` (existant)

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `reason` | `requires_recent_login`, `reauth_cancelled`, `error` | existant |
| `reason` | `wrong_password` : le mot de passe saisi dans la confirmation (compte à mot de passe) est faux | **nouvelle valeur**, avec le champ de mot de passe de la confirmation |

Après `account_deleted`, le suivi est remis à zéro comme à la déconnexion
(`signed_out`) : les événements suivants repartent anonymes.

### Lecture du jour : `daily_reading_viewed` (nouveau)

À l'arrivée sur `/bibliotheque/lecture-du-jour`, une fois la liste chargée.

| Propriété | Valeurs |
| --- | --- |
| `state` | `empty` (rien de composé), `in_progress`, `all_done`, `error` (chargement en échec) |
| `total_count` | les lectures du jour (le chnei mikra hebdomadaire n'y compte pas) |
| `done_count` | celles déjà faites |

### Chaînes

#### `session_deadline_warned` (nouveau)

La confirmation demandée quand la date limite tombe ce soir ou demain soir
(`services/sessionDeadline.ts`).

| Propriété | Valeurs |
| --- | --- |
| `deadline_days` | 1 (ce soir) ou 2 (demain soir), le même calcul que `session_created.deadline_days` |
| `confirmed` | vrai si la chaîne est créée telle quelle, faux si l'on revient à la date |

#### `share_modal_opened`, `share_channel_selected` (existants)

`trigger` (**nouveau**) : `button` (le bouton Partager) ou `after_create` (la
fenêtre ouverte d'elle-même juste après la création d'une chaîne). Il mesure
ce que le second rapporte au premier.

### Mes dates

`occasion_opened` (existant, le bandeau de l'accueil) est conservé. À côté :

| Événement | Propriétés |
| --- | --- |
| `occasions_opened` (nouveau) | `source` (`calendar_button`, `calendar_row`), `occasions_count` (les dates déjà inscrites) |
| `occasion_saved` (nouveau) | `kind` (`yahrzeit`, `birthday`, `other`), `is_new`, `on_account` (la date suit le compte, ou reste sur l'appareil), `date_entry` (**nouveau** : `hebrew` pour une date saisie en hébreu, `civil` pour une date saisie par sa date civile et convertie) |
| `occasion_removed` (nouveau) | `kind` |

Ni le nom ni la date : ils désignent une personne.

### Page introuvable : `not_found_viewed` (nouveau)

`path` : le chemin demandé, sans la requête (elle peut porter un email ou un
jeton). `$referrer` dit d'où venait le lien mort.

### Astuces : `feature_tip_shown`, `feature_tip_finished` (existants)

`tip` reçoit une **nouvelle valeur**, `zmanim-date` : le calendrier sous la
date des horaires.
