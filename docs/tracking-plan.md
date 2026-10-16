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
`parcours` (Mon parcours, **nouvelle valeur**, qui remplace `daily_reading`
depuis que la lecture du jour y vit), `my_sessions`, ou `support` (« Nous
écrire », **nouvelle valeur**, site seulement), sur le site comme dans
l'app (groupe « Mes lectures »). Dans l'app, la ligne de Mon parcours
(qui dit désormais la journée) l'envoie, avec ou sans compte ; sur le site,
le lien « Mon parcours » du bandeau du profil, et la ligne du menu, qui
reste.

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

### `chnei_mikra_aliya_toggled` (nouveau)

Une montée cochée ou décochée sur la page du chnei mikra
(`/bibliotheque/chnei-mikra`, `useChneiMikraChecks`). Il dit si la case sert,
et jusqu'où la semaine se lit.

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `done` | vrai si la montée vient d'être cochée, faux si décochée | **nouveau** |
| `text_id` | le texte de la paracha (une paracha double en a deux) | **nouveau** |
| `aliya` | la montée, telle que le texte la nomme (`Rishon`, `Sheni`...) | **nouveau** |

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

### `kotel_compass_calibration_opened` (nouveau)

On touche « Calibrer » sous la boussole du Kotel (voir `docs/design.md`, « La
boussole se demande en l'ouvrant, dit sa précision, et se tient à plat »).
Rapporté à `kotel_compass_opened`, il dit combien de gens doutent de la
flèche ; `accuracy` dit si c'est la précision affichée qui les y a poussés.

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `accuracy` | la précision affichée au moment du toucher : `high`, `medium`, `low`, ou `unknown` quand l'appareil ne la donne pas (Chrome sur le site) | **nouveau** |

### Valeurs ajoutées à des propriétés existantes

| Événement | Propriété | Valeur ajoutée | Ce qu'elle dit |
| --- | --- | --- | --- |
| `library_tab_switched` | `tab` | `chiourim` | les onglets de l'Étude sont trois : `reading` (la bibliothèque), `chiourim`, `sharing`. Le nom de l'événement reste celui d'origine. |
| `text_opened` | `entry` | `sidour` | la lecture s'ouvre depuis la page du Sidour (`services/readingEntry.ts`). |
| `tehilim_day_opened` | `source` | `library_today` | depuis « Aujourd'hui », en bas de la bibliothèque. |
| `chnei_mikra_opened` | `source` | `library_today` | idem. |
| `offline_download_started`, `offline_download_completed`, `offline_download_failed` | `scope` | `parcours` | les textes de la journée, téléchargés depuis Mon parcours (app ; Ma journée, d'où ils partaient, a été retirée) ; l'ancienne page de la lecture du jour envoyait `daily_reading`. |
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
| `entry` | `search`, `resume`, `push`, `home`, `library`, `sidour`, `daily_reading`, `parcours`, `chnei_mikra`, `tehilim_day`, `reading`, `zmanim`, `calendar`, `session`, `direct`, `other` | **nouveau** ; `parcours` (depuis une page de Mon parcours) **ajouté** |

`entry` dit d'où l'on arrive (`services/readingEntry.ts`) : un indice laissé
juste avant la navigation quand l'adresse ne peut pas le dire (un résultat de
recherche, « Reprendre ma lecture », une notification, un texte rouvert
depuis la table d'étude, `table`, **nouvelle valeur**), sinon la page
précédente. `reading` : depuis un autre texte (psaume suivant, office
suivant) ; `direct` : sans page précédente (widget, lien partagé, moteur de
recherche, page rechargée).

### Lecture : `page_form_toggled` (nouveau)

Le lecteur passe une guemara dans la forme de la page de Vilna, ou une
paracha dans celle du Sefer Torah, ou l'en retire (bouton de la barre
d'outils ou du menu de lecture, `TextReadingPage.vue`, voir `docs/design.md`,
« Un texte se lit aussi dans la forme de sa page »). Il dit si la forme est
trouvée, et pour quel corpus elle sert. Ne part qu'au changement du choix
gardé : passer à la phonétique et en revenir ne le touche pas.

| Propriété | Valeurs                                                  | Statut      |
| --------- | -------------------------------------------------------- | ----------- |
| `enabled` | `true` (la forme s'affiche), `false` (retour à l'hébreu) | **nouveau** |
| `form`    | `daf` (page de Vilna), `scroll` (Sefer Torah)            | **nouveau** |
| `text_id` | l'id du texte dans le catalogue (`textStudies.json`)     | **nouveau** |

### Lecture : `commentaries_opened`, `commentaries_closed` (nouveaux)

Les commentaires d'un passage (Rachi, Tossafot, Bartenura, Tossefot Yom
Tov, voir `docs/design.md`,
« Les commentaires d'un passage s'ouvrent depuis sa bulle, puis suivent la
lecture ») : `commentaries_opened` part quand la rangée « Commentaires » de
la bulle ouvre le panneau d'étude, `commentaries_closed` quand on le ferme
(croix, Échap, retour, changement de texte). Le second dit si le panneau
sert à un passage ou à l'étude d'un daf entier. `corpus` dit lequel : une
guemara (`talmud`), une paracha (`torah`), une michna (`mishna`), un verset
des Neviim, des Ketouvim ou un psaume (`tanakh`).

| Événement             | Propriété         | Valeurs                                                    | Statut      |
| --------------------- | ----------------- | ---------------------------------------------------------- | ----------- |
| `commentaries_opened` | `corpus`          | `talmud`, `torah`, `mishna`, `tanakh` (Neviim, Ketouvim)   | **nouveau** |
| `commentaries_opened` | `text_id`         | l'id du texte dans le catalogue                            | **nouveau** |
| `commentaries_opened` | `count`           | le nombre de commentaires du passage                       | **nouveau** |
| `commentaries_closed` | `passages_viewed` | les passages vus dans le panneau, celui de l'ouverture compris | **nouveau** |

`passage_action` (existant) prend une valeur de plus pour `action` :
`commentaries`, l'appui sur la rangée de la bulle.

### Lecture : `commentaries_resized` (nouveau)

Sur un écran large, la colonne des commentaires se règle en tirant son bord
gauche (ou au clavier, par les flèches) ; un double appui sur le bord lui
rend sa largeur d'origine. L'événement part à la fin du geste, une fois, et
dit si la largeur par défaut convient à qui étudie.

| Événement              | Propriété        | Valeurs                                                 | Statut      |
| ---------------------- | ---------------- | ------------------------------------------------------- | ----------- |
| `commentaries_resized` | `width`          | la largeur choisie, en pixels ; `null` quand on la rétablit | **nouveau** |
| `commentaries_resized` | `viewport_width` | la largeur de la fenêtre, en pixels                     | **nouveau** |

### La table d'étude

Les textes mis de côté pour passer de l'un à l'autre (docs/design.md, « Des
textes mis de côté, sur la table »). Tous **nouveaux**.

#### `text_set_aside`

Un texte posé sur la table.

| Propriété | Valeurs |
| --- | --- |
| `text_id` | l'identifiant du texte dans le catalogue |
| `corpus` | son rayon (`tanakh`, `talmud`, `moussar`...) ; jamais un texte du Sidour, qui ne se pose pas sur la table |
| `texts_count` | le nombre de textes sur la table une fois celui-ci posé |
| `from` | `header` (le bouton en tête du texte), `menu` (le menu de lecture), `table` (« Poser aussi », depuis le panneau) |
| `already_on_table` | le texte y était déjà, il n'a fait que retenir sa page (absent pour `from: table`) |

#### `reading_table_opened`

Le panneau de la table ouvert depuis la barre (la flèche, le livre du texte
lu, un glissement vers le haut). `texts_count` : les textes posés.

#### `reading_table_text_opened`

Un texte rouvert depuis la table : un livre de la barre, ou une ligne du
panneau. Le `text_opened` qui suit porte `entry: table`.

| Propriété | Valeurs |
| --- | --- |
| `text_id` | l'identifiant du texte |
| `corpus` | son rayon |
| `texts_count` | les textes posés |
| `was_open` | c'était le texte déjà à l'écran (le panneau se referme seulement) |
| `from` | `bar` (un livre de la barre), `table` (une ligne du panneau) |

#### `reading_table_text_removed`

Un texte rangé d'une croix. `text_id`, et `texts_count` : ceux qui restent.

#### `reading_table_library_opened`

« Retour à la bibliothèque », touché au bas de la table. `texts_count` : les
textes posés.

#### `reading_table_cleared`

« Tout ranger », confirmé. `texts_count` : les textes rangés.

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
| `reason` | ce qui y a mené (`services/loginReason.ts`) : `direct`, `daily_reading`, `parcours` (une page de Mon parcours, sur le site ; **nouvelle valeur**), `share_reading`, `profile`, `admin`, `other` |
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

À l'arrivée sur la lecture du jour. Depuis Mon parcours, il partait de Ma
journée ; Ma journée retirée, il part quand on déplie le portefeuille de
l'accueil (la journée entière, sous les yeux), avec `parcours_wallet_opened`.
Il compte toute la journée : textes, programmes, habitudes (voir « Mon
parcours » plus bas). La page `/bibliotheque/lecture-du-jour`, revenue,
l'envoie aussi à l'arrivée ; `source` (**nouvelle propriété**) dit d'où :
`wallet` (le portefeuille de l'accueil) ou `page` (la lecture du jour).

| Propriété | Valeurs |
| --- | --- |
| `state` | `empty` (rien de prévu), `in_progress`, `all_done` ; `error` ne part plus (rien ne se charge) |
| `total_count` | les tâches du jour (les tâches de la semaine, comme le chnei mikra, et celles mises de côté n'y comptent pas) |
| `done_count` | celles déjà faites |
| `source` | `wallet` ou `page` |

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
date des horaires ; et quatre pour le tutoriel de Mon parcours,
`parcours-home`, `parcours-page`, `parcours-create`, `parcours-program`, qui
partent aussi du site.

### Informations de l'équipe : `announcement_poll_answered` (nouveau)

Un vote envoyé à un sondage (voir `docs/informations.md`), depuis la page de
l'information, dans l'app ou sur le site.

| Propriété       | Valeurs                                                       |
| --------------- | ------------------------------------------------------------- |
| `id`            | l'identifiant de l'information                                |
| `choices_count` | le nombre de choix cochés (1, sauf sondage à choix multiples) |
| `changed`       | `true` si l'appareil change un vote déjà envoyé               |

Pas le choix lui-même : les réponses se comptent dans Firestore
(`announcements/{id}/votes`), le backoffice les affiche.

### Nous écrire : `support_reply_sent` (nouveau)

La personne relance un de ses messages depuis la page « Nous écrire »
(`/contact`), dans l'app ou sur le site (voir `docs/feedback.md`). Le premier
message reste `feedback_sent` (existant, inchangé).

| Propriété | Valeurs                                                          |
| --------- | ---------------------------------------------------------------- |
| `kind`    | la nature du fil : `idea`, `bug`, `error` ou `other`             |

Pas le texte : il est dans le fil, que seul le backoffice lit.

## Cours audio : l'écoute en liste, et le lien vers les textes

Les cours s'écoutent désormais comme dans une application d'écoute : une
liste devient la file du lecteur, l'épisode suivant s'enchaîne, un cours
entamé reprend où on l'a laissé. Et un cours peut dire le texte de la
bibliothèque qu'il étudie (voir `services/chiourTexte.ts`).

### `chiour_played` (existant, trois propriétés de plus)

| Propriété | Valeurs | Statut |
| --- | --- | --- |
| `chiour_slug`, `chiour_title`, `duration_seconds` |  | existants, conservés |
| `source` | `chiour` (la page du cours), `serie`, `auteur`, `catalogue`, `reprise` (la rangée « Reprendre l'écoute »), `texte` (les cours sous un texte de la bibliothèque) | **nouveau** |
| `autoplay` | vrai quand la fin du cours précédent l'a enchaîné | **nouveau** |
| `resumed` | vrai quand il reprend là où on l'avait laissé | **nouveau** |

`source` est celle du geste qui a lancé la file : les cours qu'elle enchaîne
la gardent, et portent `autoplay`.

### `chiour_opened` (existant, une propriété de plus)

`texte_id` (**nouveau**) : l'identifiant du texte que le cours étudie, `null`
s'il n'en a pas.

### `chiour_text_opened` (nouveau)

D'un cours, d'une série ou du lecteur plein écran vers son texte (« Lire le texte »).

| Propriété | Valeurs |
| --- | --- |
| `source` | `chiour`, `serie`, `lecteur` (le lecteur plein écran) |
| `chiour_slug` | le cours, `null` depuis une série |
| `texte_id` | l'identifiant du texte dans le catalogue |
| `chapitre` | le chapitre visé, `null` pour le texte entier |

### `text_chiourim_shown` (nouveau)

L'encart « Cours sur ce chapitre » (ou « sur ce texte ») s'affiche sous un
texte de la bibliothèque : le dénominateur des écoutes lancées depuis un
texte (`chiour_played`, `source` `texte`). Une fois par texte et par chapitre
ouvert.

| Propriété | Valeurs |
| --- | --- |
| `texte_id` | l'identifiant du texte |
| `chapitre` | le chapitre ouvert, `null` sur le texte entier |
| `chiourim_count` | les cours du texte |
| `chapter_count` | ceux du chapitre ouvert |

### `chiourim_filters_opened` (nouveau)

Le bouton « Filtres » du catalogue ouvre son panneau (les thèmes, les
rabbanim). `results_count` : les cours affichés à l'ouverture.
`chiourim_category_filtered` (existant) continue de partir au choix d'un
thème, depuis ce panneau ; `category` vaut `all` quand on le retire.

### `chiourim_rav_filtered` (nouveau)

Un rav choisi (ou retiré) dans les filtres du catalogue.

| Propriété | Valeurs |
| --- | --- |
| `auteur` | le nom du rav, `null` quand le filtre est retiré |
| `results_count` | les cours affichés |

## Traductions (octobre 2026)

La traduction sous l'hébreu (`composables/useTranslation.ts`,
`docs/traductions.md`) : deux événements nouveaux, pour savoir si elle est
trouvée, dans quelle langue on la lit, et donc où compléter le français.

### `translation_toggled` (nouveau)

La commande « Traduction » de la barre d'outils, ou l'interrupteur des
réglages de lecture.

| Propriété | Valeurs |
| --- | --- |
| `enabled` | `true` à l'allumage, `false` à l'extinction |
| `lang` | la langue de la traduction du texte ouvert (`fr`, `en`), `null` si aucune |

### `translation_language_changed` (nouveau)

Une autre langue choisie dans les réglages de lecture, sur un texte traduit
dans les deux (le Tanakh, une partie de la Michna).

| Propriété | Valeurs |
| --- | --- |
| `lang` | la langue choisie (`fr`, `en`) |

## Mon parcours

Programmes, habitudes, lectures du calendrier et textes du jour, la journée et
le mur (`/parcours`). La lecture du jour y vit désormais. Le suivi qui se
répète d'un écran à l'autre (cocher, mettre de côté, arriver sur la journée)
passe par `src/services/parcours/tracking.ts`.

### `parcours_viewed` (nouveau)

À l'arrivée sur Mon parcours.

| Propriété | Valeurs |
| --- | --- |
| `objectives_count` | les objectifs en cours |
| `streak` | la série en cours, en jours |
| `signed_in` | vrai avec un compte (sans compte, tout reste sur l'appareil) |

### `parcours_wall_viewed` (nouveau)

À l'arrivée sur le mur entier. `weeks` : les colonnes montrées.

### `parcours_day_opened` (nouveau)

Un jour du mur, ouvert pour le compléter après coup. `source` :
`parcours_wall` (le mur de Mon parcours) ou `parcours_full_wall` (le mur
entier).

### `parcours_task_marked` (nouveau)

Une tâche cochée ou décochée.

| Propriété | Valeurs |
| --- | --- |
| `done` | vrai quand elle est cochée |
| `kind` | `program`, `habit`, `cycle`, `text` |
| `source` | d'où : `home_deck_swipe` (la carte du dessus de la pile de l'accueil, glissée), `home_wallet_swipe` (une carte du portefeuille, glissée à droite ou, pour la décocher, à gauche), `home_sheet` (la fiche d'une carte), `journee_row` (Ma journée, retirée : ne part plus), `objective_swipe` (la portion du jour ou de la semaine, glissée sur la page d'un programme), `reader` (au bas d'une lecture ouverte depuis le parcours, l'anneau tiré vers le haut), `parcours_wall`, `parcours_full_wall` (un jour du mur), `daily_page` (**nouvelle valeur** : « Marquer comme lu » sur la page de la lecture du jour) ; la carte « Lecture du jour » de l'accueil, glissée, en envoie un par texte |
| `days_ago` | 0 aujourd'hui, 1 hier... : ce qui se coche après coup |

Une tâche de la lecture du jour d'avant (un texte du jour, une lecture du
calendrier), cochée le jour même, envoie aussi `daily_reading_marked_read`
(existant, jamais documenté), avec ses propriétés d'alors : `marked`, `scope`
(`text`, `option` avec `option: tehilim-jour`, `parasha_week`),
`done_count`, `total_count`, `all_done`, comptés sur la journée.

### `parcours_task_skipped` (nouveau)

« Pas aujourd'hui », ou son contraire. `skipped`, `kind`, `source`
(`home_sheet`, depuis la fiche d'une carte de l'accueil ; `journee` ne part
plus : Ma journée n'a plus que « fait » et « plus tard »).

### `parcours_task_postponed` (nouveau)

« Plus tard » sur l'accueil : la carte passe sous la pile, le temps de la
journée. `kind` (le genre de l'objectif, ou `occasion`, `catch_up` pour une
carte en plus), et `source` : `swipe` (la carte du dessus glissée à gauche),
`wallet_swipe` (une carte du portefeuille glissée à gauche), `sheet` (sa
fiche) ; `journee_swipe` (une ligne de Ma journée glissée à gauche) ne part
plus, Ma journée a été retirée.

### `parcours_wallet_opened` (nouveau)

Le portefeuille de l'accueil, la journée étalée. `source` : `swipe` (la
pile tirée vers le bas) ou `day_bar` (la barre de la journée touchée).

### `parcours_occasion_marked` (nouveau)

Une carte d'occasion de la pile dite faite, ou défaite : elle ne compte pas
dans la journée, l'appareil s'en souvient.

| Propriété | Valeurs |
| --- | --- |
| `occasion` | `halevana` (la bénédiction de la lune), `omer` (le compte du soir), `hanouka` (l'allumage) |
| `done` | vrai quand elle est faite |
| `source` | `home_deck_swipe`, `home_wallet_swipe`, `home_sheet` (comme `parcours_task_marked`) |

`birkat_halevana_opened` et `omer_opened` (existants) partent toujours avec
`source: home` quand leur carte est touchée dans la pile, comme quand elles
étaient des bandeaux.

### `home_card_clicked` (existant)

`card` prend une valeur de plus, `parcours_task` : une carte du paquet ou du
portefeuille touchée, qui ouvre sa page (le texte, l'office). Elle porte
alors `kind` (**nouvelle propriété**), le genre de l'objectif : `program`,
`habit`, `cycle`, `text` ; ou `occasion` (la lune, le 'Omer, 'Hanouka) et
`catch_up` (« Rattraper ») pour une carte en plus. `daily_reading` ne part plus : la carte de la
lecture du jour a laissé place au paquet.

### `home_block_moved`, `home_block_hidden`, `home_block_shown` (nouveaux)

L'accueil à son goût (`/accueil/modifier`) : un bloc déplacé, masqué, ou
remis. `block` : `horaires`, `volumes`, `portes`, `reprendre`, `dates` ; et
pour un déplacement, `to`, sa nouvelle place (0 juste sous le paquet du jour).
`home_card_clicked` prend aussi `card: resume`, le bloc « Reprendre ».
`card: announcements` ne part plus : le lien des informations a quitté le bas
de l'accueil (il reste au pied de page du site et dans le profil de l'app) ;
la carte d'une annonce, elle, envoie toujours `announcement_opened`.

### `parcours_units_marked` (nouveau)

Les cases d'une portion, cochées une à une sur la page d'un programme à la semaine (« Où j'en suis cette semaine »).
`units` : les unités lues aujourd'hui ; `source` : `objective_cells`.

### `parcours_read_ahead` (nouveau)

La suite d'un programme lue en avance : la portion d'après, ouverte par
« Lire la suite » (au bas d'une portion faite, sur la page du programme, ou
le volume de l'accueil touché quand la portion du jour est faite) et
marquée lue au bas de la lecture.

| Propriété | Valeurs |
| --- | --- |
| `corpus` | `michna`, `talmud`, `tanakh`, `tehilim` |
| `units` | les unités de la portion lue en avance |

### `parcours_objective_created` (nouveau)

| Propriété | Valeurs |
| --- | --- |
| `kind` | `program`, `habit`, `cycle`, `text` |
| `corpus`, `rhythm`, `parts_count`, `texts_count` | un programme : `michna`, `talmud`, `tanakh`, `tehilim` ; `daily`, `weekdays`, `weekly` ; les parties prises (sedarim, traités, livres) ; les textes qu'elles font |
| `preset`, `days_count` | une habitude : `tefilot`, `chema-al-hamita`, `tsedaka`, `chmirat-halachon`, `limoud` (un temps d'étude, **nouveau**), `custom` (« Avec mes mots ») ; `tefilin` et `birkat-hamazon` ne partent plus (la création ne les propose plus) ; ses jours dans la semaine |
| `cycle` | une lecture du calendrier : `tehilim-week`, `tehilim-month`, `parasha` ; `parasha-aliyot` (**nouvelle valeur**), le chnei mikra une montée par jour |
| `text_id` | un texte du jour ; `texts_count` dit combien ont été pris d'un coup (un événement par texte) |
| `source` | **nouvelle propriété** : `daily_page`, un texte ajouté depuis la page de la lecture du jour (« Modifier ma liste ») ; absente, l'objectif vient de la page de création |

### `parcours_objective_paused`, `parcours_objective_removed` (nouveaux)

`kind`, et pour la pause `paused` (vrai à la pause, faux à la reprise).
Au retrait, `source` (**nouvelle propriété**) vaut `daily_page` pour un texte
retiré de la page de la lecture du jour ; absente, l'objectif est rangé
depuis ses réglages.

### `parcours_program_updated` (nouveau)

Un programme modifié : `field` vaut `end` ou `rhythm` (le pas repart
d'aujourd'hui).

### `parcours_light_unlocked` (nouveau)

Une lumière de la série gagnée (la bougie, la lanterne... voir
`services/parcours/lights.ts`) : le record vient de franchir un palier, et
sa feuille monte. Une fois par palier et par appareil ; rien quand le record
saute de plusieurs jours d'un coup (le compte relu sur un nouvel appareil).

| Propriété | Valeurs |
| --- | --- |
| `light` | `candle`, `lantern`, `menorah`, `lighthouse`, `moon`, `sun`, `stars`, `galaxy`, `supernova`, `quasar`, `first-light` |
| `days` | le palier franchi, en jours d'affilée : 3, 7, 14, 21, 30, 50, 75, 100, 150, 250, 365 |
| `streak` | la série en cours |

### `parcours_lights_opened` (nouveau)

« Mes lumières » ouverte. `source` : `parcours` (la lumière de Mon parcours,
touchée), `profile` (la lumière du profil, touchée : sur le rond dans l'app,
dans le bandeau sur le site),
`celebration` (« Voir mes lumières », depuis la feuille d'une lumière
gagnée).

### `parcours_caught_up` (nouveau)

Un retard rattrapé.

| Propriété | Valeurs |
| --- | --- |
| `option` | `week`, `remaining`, `oneDay`, `pushEnd`, `done` |
| `behind` | les unités de retard |
| `remember` | vrai si l'on a choisi de faire ainsi sans demander |
| `source` | `objective` (la feuille « Rattraper » d'un programme), `home_deck_swipe`, `home_wallet_swipe` ou `home_sheet` (la carte « Rattraper » de l'accueil, dite faite : `option` vaut alors `done`) |

### Ce que deviennent ceux de la lecture du jour

La page `/bibliotheque/lecture-du-jour` avait laissé place à Ma journée,
elle-même retirée depuis ; elle est revenue, nourrie par Mon parcours. Ce
qu'elle envoyait continue quand l'écran continue :

- `daily_reading_viewed` et `daily_reading_marked_read` : voir plus haut ;
- `reminder_settings_opened`, `reminder_enabled`, `reminder_enable_failed`,
  `reminder_disabled`, `reminder_disable_failed` : la cloche des rappels,
  avec les mêmes propriétés, au bas de Mon parcours ;
- `daily_reading_configured` (composer la liste), `daily_reading_tab_switched`
  (« Aujourd'hui » et « Cette semaine ») et `daily_reading_offline_prompt` (la
  modale d'un texte ajouté sans être téléchargé) n'ont plus d'écran, et ne
  partent plus. On compose désormais par `parcours_objective_created` et
  `parcours_objective_removed` (`kind` `text` ou `cycle`), et les textes
  absents de l'appareil se proposent par le bandeau de Mon parcours
  (`offline_download_started`, `scope` `parcours`).
