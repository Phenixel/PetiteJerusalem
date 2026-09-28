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
- **Rien ne part sans consentement** (ePrivacy/RGPD). Avant l'accord, les
  événements attendent dans une file bornée et sont rejoués au chargement.
- **Toute nouvelle propriété est documentée ici**, dans la section de son
  événement.

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
