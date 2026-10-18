# Tracking plan (PostHog)

What the app and the website send to PostHog, and why. The project is
`Petite Jerusalem` (EU region). The code lives in
`src/services/analyticsService.ts`.

## The rules

- **No existing event is ever renamed or removed.** The analyses and funnels
  already built rely on them; a name that changes silently breaks data
  continuity. We add, we don't replace. When a property is badly named, the
  right one is set **next to** the old one, and both are sent together while
  the analyses switch over.
- **Convention**: `snake_case`, past-tense verb (`session_created`,
  `calendar_viewed`). Properties too.
- **Tracking only runs in production**: the public website
  (`petite-jerusalem.fr`) or the native app. Not `npm run dev`, not
  `npm run preview`, not the Firebase preview channels (see
  `isTrackedSurface`). `localStorage.setItem('ph_debug', '1')` forces loading
  anywhere to check an instrumentation; events are then sent with
  `env: 'preview'` and are excluded from every analysis.
- **Nothing is sent without consent** (ePrivacy/GDPR). Before any answer,
  events wait in a bounded queue and are replayed on load; during a refusal,
  nothing is kept there, and consent given afterwards only sends what follows.
  A new consent, even in a session that follows a refusal, restores capture
  (posthog-js keeps the refusal and would read it again). Enforced by
  `src/__tests__/analyticsConsent.test.ts`.
- **Every new property is documented here**, in its event's section.
- **No email address in a tracked URL.** PostHog records the address of every
  page (`$current_url`, `$referrer`, their `$initial_*`, and the session's
  entry address, `$session_entry_url`, attached to every event) and the replay
  shows it: personal data is never passed as a URL parameter. The invitation
  to create an account passes the invitee's address through the navigation
  state; `before_send` additionally strips any `email` parameter from the
  URLs it sends (`withoutPersonalParams`, enforced by
  `src/__tests__/analyticsPersonalParams.test.ts`).

## Properties carried by every event

Set by `register()` and by `before_send`, including on the automatic
`$exception` and `$pageview` events.

| Property        | Values                  | What it is for                                   |
| --------------- | ----------------------- | ------------------------------------------------ |
| `env`           | `production`, `preview` | Filtering out what doesn't come from real prod.  |
| `app_platform`  | `web`, `ios`, `android` | Separating the website from the two apps.        |
| `app_version`   | `v3.10.6`...            | Tying a bug to a release.                        |
| `replay_cohort` | `web`, `on`, `off`      | Measuring the cost of session replay in the app. |
| `is_logged_in`  | boolean                 | Segmenting anonymous / signed in.                |
| `locale`        | `fr`, `en`, `he`        | Segmenting by language.                          |

In the app, the `https://localhost` origin of the Capacitor webview is
rewritten as `app://ios` / `app://android`: `$current_url` therefore stays
readable and does carry the route, on `$exception` events as on everything
else.

## Calendar and holiday pages

### `calendar_viewed` (existing)

Set when `/calendrier` and `/calendrier/<fete>` open.

| Property   | Values                                               | Status         |
| ---------- | ---------------------------------------------------- | -------------- |
| `festival` | the holiday's French slug, or `null` on the hub page | existing, kept |
| `holiday`  | the same value                                       | **new**        |

`holiday` duplicates `festival` without replacing it: it is the name used by
the conversion events below, so the two can be crossed without any special
handling. `festival` stays so as not to break ongoing analyses.

### `calendar_cta_clicked` (new)

A departure from a holiday page. It measures what these pages bring in: they
are the site's leading source of traffic, and of the 231 visitors who came
from a search engine over thirty days, only 3% had opened a second page.

| Property   | Values                                                        |
| ---------- | ------------------------------------------------------------- |
| `holiday`  | the holiday's French slug (`souccot`, `yom-kippour`...)       |
| `cta_type` | `internal_link`, `app_store`, `play_store`                    |
| `target`   | the target path for an internal link, the store key otherwise |

### `app_download_clicked` (existing)

| Property  | Values                                           | Status   |
| --------- | ------------------------------------------------ | -------- |
| `store`   | `apple`, `android`                               | existing |
| `offered` | number of stores offered                         | existing |
| `source`  | `calendar_festival`, `reading_menu`... or `null` | **new**  |

The download button lives in several places; without `source`, the event did
not say which one pays off.

### `date_converter_opened` (new)

Opening the date converter, from the calendar's « Convertir une date »
("Convert a date") button (`DateConverterModal.vue`).

| Property | Values                                              |
| -------- | --------------------------------------------------- |
| `source` | `calendar_button` (the only entry point, as of now) |

### `date_converted` (new)

A converter tool actually used: set on the person's first adjustment, once
per tool and per opening. On every digit changed, the event would no longer
say anything.

| Property | Values                                              |
| -------- | --------------------------------------------------- |
| `tool`   | `hebrew_to_civil`, `civil_to_hebrew`, `bar_mitzvah` |

Neither the date nor the year: a date of birth identifies a person.

## First-launch introduction

The native app's introduction (`OnboardingFlow.vue`). It went from six pages
to five, consent included, in September 2026, and « Passer » ("Skip") is now
offered only on the last one, the gestures page: over the previous 90 days,
69 of the 148 endings were a « Passer », 55 of them on the first or second
page after consent. `app_version` separates the two versions to measure the
effect.

### `onboarding_started` (existing)

| Property | Values                                                     |
| -------- | ---------------------------------------------------------- |
| `steps`  | number of pages: 5, or 4 if consent has already been given |

### `onboarding_step_viewed` (existing)

| Property | Values                                                     | Status                           |
| -------- | ---------------------------------------------------------- | -------------------------------- |
| `step`   | `consent`, `settings`, `offline`, `essentials`, `gestures` | `essentials`, `gestures` **new** |
| `index`  | the page's position, starting at 0                         | existing                         |

`daily`, `library` and `zmanim` are no longer sent: these three pages are
merged into `essentials`, and the `library` gestures have their own page,
`gestures`.

### `onboarding_finished` (existing)

| Property              | Values                                 | Status          |
| --------------------- | -------------------------------------- | --------------- |
| `via`                 | `finish`, `skip`, `escape`, `daily`    | `daily` **new** |
| `step`                | the page where the introduction ended  | existing        |
| `wants_daily_reading` | true when it ends on the daily reading | existing        |

`daily`: the « Composer ma lecture du jour » ("Build my daily reading")
button on the `essentials` page, which ends the introduction and leads there.
`skip` and `escape` are now only sent from `gestures`, the only page that can
be skipped. `wants_daily_reading` keeps its meaning (the introduction leads to
the daily reading); it now equals `via = daily`.

### `onboarding_offline_download_started`, `onboarding_offline_download_finished` (existing)

Unchanged: choosing the texts to take along is still a page of the
introduction (51 downloads started over the same period).

## What's new in 4.0 (October 2026)

The video the app plays once after the update (`WhatsNewVideo.vue`, see
`docs/design.md`, "What's new plays once, after the update"). Does it reach
those who update, and do they watch it to the end?

### `whats_new_video_started` (new)

The video started playing.

| Property  | Values                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------- |
| `version` | the version whose video plays: `4.0`                                                           |
| `source`  | `launch` (the first launch after the update), `profile` (« Revoir les nouveautés »), `link` (`?nouveautes`) |
| `muted`   | true when the system refused the sound without a touch, and the video plays muted             |

### `whats_new_video_closed` (new)

The video left the screen.

| Property          | Values                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `version`         | as above                                                                                            |
| `source`          | as above                                                                                            |
| `via`             | `close` (« Fermer »), `done` (« C'est parti », at the end), `back` (Android back, Escape), `error` (it did not load) |
| `watched_seconds` | the furthest point reached, in seconds                                                              |
| `completed`       | true when the video was played to the end                                                           |

`via` `error` with `source` `launch` is not seen by anyone: the screen only
shows once the video can play, and the video is offered again at a later
launch.

## Profile

The website and the app do not have the same profile (see docs/design.md,
"The app profile is a list, not a menu"): a side menu on the
website, a list of rows and sub-pages in the app. Both send the same events,
with the same values; `app_platform` separates them.

### `profile_tab_opened` (existing)

On the website, a menu tab; in the app, arriving on a sub-page
(`/profile/<section>`), including through a back navigation or a direct link.

| Property | Values                                                                                               | Status         |
| -------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| `tab`    | `my-info`, `security`, `appearance`, `preferences`, `notifications`, `about`                         | existing, kept |
| `tab`    | `language` (app only: language has its own sub-page there; on the website, it is under `appearance`) | **new value**  |

`notifications` and `about` only came from the app. `about` is no longer sent
there: what it opened (information pages, support, cookies) now appears as
rows on the profile page itself, with no sub-page to count.

### `profile_shortcut_clicked` (existing)

A profile shortcut to something that used to live there: `shortcut` is
`parcours` (Mon parcours, **new value**, which replaces `daily_reading` since
the daily reading lives there), `my_sessions`, or `support` (« Nous écrire »,
"Write to us", **new value**, website only), on the website as in the app
(the « Mes lectures » group). In the app, the Mon parcours row (which now
shows the day) sends it, with or without an account; on the website, the
« Mon parcours » link in the profile banner, and the menu row, which stays.

## Reading the tefila

### `hazara_opened` (new)

The « 'Hazara » button, at the end of an 'Amida that the 'hazan repeats: it
goes back to the start of the 'Amida, with the 'hazan's passages expanded
(see docs/design.md, "The 'hazara starts again from the beginning of the 'Amida"). No
property of its own: `$current_url` gives the service. It tells whether the
button is found, and whether it serves the communal service rather than
praying alone.

## Library

### `moadim_now_opened` (new, no longer sent)

The panel shown at the top of the sidour during a holiday
(`MoadimNowBanner`), which leads to the holiday's texts in Moadim. It tells
whether people look for these texts from the sidour.

No longer sent since the Sidour page (October 2026, see "Sidour and Study"):
the sidour list disappeared along with its panel, and the holiday's texts
rise to the top of the page on their own. The name stays reserved, and its
past data keeps its meaning.

| Property   | Values                                                   | Status  |
| ---------- | -------------------------------------------------------- | ------- |
| `source`   | `library_sidour`                                         | **new** |
| `festival` | the holiday's book, `Souccot`, `Yamim Noraim`, `Hanouka` | **new** |

### `sidour_brahot_opened` (new, no longer sent)

The « Vous cherchez le Birkat Hamazon ou une autre brakha ? » ("Looking for
Birkat Hamazon or another brakha?") link, at the top of the sidour
(`SidourBrahotLink`), which leads to the book of Brahot. It tells how many
readers come looking for Birkat Hamazon or a brakha in the sidour.

No longer sent since the Sidour page (October 2026): the brahot are there in
the same list as the services. The name stays reserved.

| Property     | Values                                         | Status  |
| ------------ | ---------------------------------------------- | ------- |
| `source`     | `library_sidour`                               | **new** |
| `had_search` | boolean: a search had been typed in the sidour | **new** |

### `chnei_mikra_aliya_toggled` (new)

An aliya checked or unchecked on the chnei mikra page
(`/bibliotheque/chnei-mikra`, `useChneiMikraChecks`). It tells whether the
checkbox is used, and how far into the week the reading goes.

| Property  | Values                                                                                                      | Status    |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| `done`    | true if the aliya has just been checked, false if unchecked                                                 | **new**   |
| `text_id` | the paracha's text (a double paracha has two)                                                               | **new**   |
| `aliya`   | the aliya, as the text names it (`1re montée`, `2e montée`...)                                              | **new**   |
| `source`  | `text` (the checkbox in the text), `list` (the week's list, above the text); absent before the list: `text` | **added** |

## Sidour and Study (October 2026)

The app's bottom bar becomes Home, Sidour, Times, Study, Profile (see
`docs/design.md`, "The Sidour opens on the moment"). Nothing is renamed or
removed: two events are added for the new page, and a few properties gain one
more value.

### `sidour_viewed` (new)

Arriving on the Sidour page (`/sidour`). It tells what the "right now" card
was offering at that moment: the denominator of `sidour_text_opened`, and a
way to see whether people come to the Sidour at service times.

| Property | Values                                                                                                                                                                                                                                                                                                                                     | Status  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `hero`   | `chaharit`, `minha`, `arvit` (the service whose time it is), `next_chaharit`, `next_minha`, `next_arvit` (the upcoming one, between two time windows), `hanouka`, `slihot`, `halevana` (the blessing of the moon, on the nights it is said), `feast` (between two services, the current holiday's text; `feast` says which one), or `null` | **new** |
| `feast`  | the holiday whose texts rise to the top: `tichri`, `souccot`, `hanouka`, or `null`                                                                                                                                                                                                                                                         | **new** |

### `sidour_text_opened` (new)

A text opened from the Sidour page. It tells whether the "right now" card is
used, and what people look for in the list.

| Property  | Values                                                                                                                                                        | Status  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `text`    | the text, `corpus/slug` (`sidour/chaharit`, `brahot/birkat-hamazon`...)                                                                                       | **new** |
| `source`  | `hero` (the "right now" card), `extra` (the row below it, on a special evening: the service or the havdala), `list` (the list)                                | **new** |
| `section` | for `list`, the group: `offices`, `soir`, `brahot`, `occasions`, `vie`, `fetes`, or the holiday at the top (`tichri`, `souccot`, `hanouka`); `null` otherwise | **new** |
| `feast`   | as on `sidour_viewed`                                                                                                                                         | **new** |

### The tools: `kotel_compass_opened`, `tefilin_mirror_opened` (existing), `naanouim_compass_opened` (existing, one more property)

The Sidour page carries a row of tools (see `docs/design.md`, « Les outils du
Sidour »): they keep their events, which say where they are opened from. The
denominator of openings from the Sidour is `sidour_viewed`.

| Event                     | Property | Values                                                                              | Status                             |
| ------------------------- | -------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `kotel_compass_opened`    | `source` | `title` (the passage title), `menu` (the reading menu), `sidour` (the row of tools) | `sidour` **new**                   |
| `tefilin_mirror_opened`   | `source` | `title`, `menu`, `sidour`                                                           | `sidour` **new**                   |
| `naanouim_compass_opened` | `source` | `title` (the title of the loulav brahot), `rubric` (a Hallel instruction), `sidour` | **new**: the event had no property |

### `kotel_compass_calibration_opened` (new)

Tapping « Calibrer » ("Calibrate") under the Kotel compass (see
`docs/design.md`, « La boussole se demande en l'ouvrant, dit sa précision, et
se tient à plat »). Compared with `kotel_compass_opened`, it tells how many
people doubt the arrow; `accuracy` tells whether the displayed accuracy is
what pushed them to it.

| Property   | Values                                                                                                                                            | Status  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `accuracy` | the accuracy displayed at the moment of the tap: `high`, `medium`, `low`, or `unknown` when the device doesn't provide it (Chrome on the website) | **new** |

### Values added to existing properties

| Event                                                                               | Property | Added value     | What it tells                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | -------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `library_tab_switched`                                                              | `tab`    | `chiourim`      | the Study tabs are three: `reading` (the library), `chiourim`, `sharing`. The event keeps its original name.                                                                  |
| `text_opened`                                                                       | `entry`  | `sidour`        | the reading opens from the Sidour page (`services/readingEntry.ts`).                                                                                                          |
| `tehilim_day_opened`                                                                | `source` | `library_today` | from « Aujourd'hui » ("Today"), at the bottom of the library.                                                                                                                 |
| `chnei_mikra_opened`                                                                | `source` | `library_today` | same.                                                                                                                                                                         |
| `offline_download_started`, `offline_download_completed`, `offline_download_failed` | `scope`  | `parcours`      | the day's texts, downloaded from Mon parcours (app; Ma journée, where they used to be downloaded from, has been removed); the former daily reading page sent `daily_reading`. |
| `offline_download_completed`                                                        | `scope`  | `feast`         | the holiday's texts, downloaded on their own when they rise to the top of the Sidour (app); `tab` then carries the holiday (`tichri`, `souccot`, `hanouka`).                  |

`library_corpus_opened` now only carries the study corpora (`tehilim`,
`michna`, `talmud`, `tanakh`): the liturgy lists lead to the Sidour.
`library_search_result_opened` can carry a liturgy `corpus` (`Sidour`,
`Brahot`, `Moadim`): these are the results filed under « Dans le Sidour »
("In the Sidour"). `offline_download_started`, `offline_download_completed`
and `offline_download_deleted` sent by the « Hors ligne » ("Offline") row
keep `tab: Tout`, for the whole of Study. Its trash button also frees the
Sidour texts downloaded separately (those of a holiday, old copies of the
brahot): `books_count` counts them with the rest.

`offline_download_delete_failed` (existing, never documented) is sent when
the deletion fails, from the « Hors ligne » row as from a book page. Same
properties as `offline_download_deleted` (`scope`, `tab`, `books_count`),
plus `error_message`, the error message.

Downloading the holiday's texts (`scope: feast`) only happens online, and one
at a time: when offline, it waits for a later visit instead of sending an
empty batch.

## Perpetual Tehilim chain

The chain that is always open, and the names entrusted to it (see
`docs/chaine-perpetuelle.md`). No name is ever sent in an event: they are
people, sick or deceased; only the actions are measured.

### `perpetual_chain_opened` (new)

Entering the chain through its two doors: the card at the top of the sharing
page, and the row that offers it when creating a Tehilim session. It tells
whether the chain draws people from the home page, and whether the creation
row diverts toward it those who were looking for readers.

| Property | Values                      | Status  |
| -------- | --------------------------- | ------- |
| `source` | `share_home`, `new_session` | **new** |

### `prayer_name_form_opened` (new)

« Proposer un nom » ("Suggest a name"), or one of the reader's names tapped
to edit it. Without an account, the dialog does not open: the invitation to
sign in replaces it (`signup_prompt_shown`, variant `prayer_name`). It is the
denominator of `prayer_name_saved`.

| Property           | Values                        | Status  |
| ------------------ | ----------------------------- | ------- |
| `session_id`       | the chain's identifier        | **new** |
| `mode`             | `add`, `edit`                 | **new** |
| `source`           | `session_page`, `new_session` | **new** |
| `is_authenticated` | boolean                       | **new** |

### `prayer_name_saved` (new)

A name added, corrected or extended. Extensions tell whether people come back
to their names after thirty days.

| Property         | Values                          | Status  |
| ---------------- | ------------------------------- | ------- |
| `session_id`     | the chain's identifier          | **new** |
| `action`         | `added`, `updated`, `renewed`   | **new** |
| `kind`           | `refoua`, `leilouy`             | **new** |
| `has_death_date` | boolean (dated leilouy nichmat) | **new** |

### `prayer_name_removed` (new)

A name removed by its author (a recovery, a mistake).

| Property     | Values                 | Status  |
| ------------ | ---------------------- | ------- |
| `session_id` | the chain's identifier | **new** |
| `kind`       | `refoua`, `leilouy`    | **new** |

### `signup_prompt_shown`, `signup_prompt_clicked` (existing)

One more value for `variant`: `prayer_name`, the invitation to sign in shown
in front of « Proposer un nom ».

## October 2026 additions

The following additions respond to the usage audit
(`docs/audit-usage-posthog-2026-10.md`, section 5): nothing is renamed or
removed there, every new property is set next to the old ones.

### Dead clicks (`$dead_click`, new)

Enabled in the SDK (`capture_dead_clicks`, `analyticsService.ts`): a tap that
changes nothing on screen (no scroll, no selection, no DOM change). They show
what people take for a control that isn't one, or a control that doesn't
respond. The reading text bodies are excluded through the `ph-no-deadclick`
class (`TextReadingPage.vue`): people tap there without asking for anything
(double tap to scroll, reading with a finger).

### Offline library: `offline_download_completed` (existing)

One more property on the batch (`scope: all`, « Tout télécharger »,
"Download all"):

| Property       | Values                                  | Status         |
| -------------- | --------------------------------------- | -------------- |
| `books_count`  | the books actually brought back         | existing, kept |
| `books_failed` | the books lost along the way, usually 0 | **new**        |

`books_failed` has the same name as on
`onboarding_offline_download_finished`, which already set it. It becomes
useful now that a failure no longer stops the batch: `offline_download_failed`
is sent for each missed book, then the batch runs to the end and
`offline_download_completed` says what is missing. Both events therefore
follow each other within a single batch, which did not happen before. The
batch still stops, without `offline_download_completed`, when the following
books would all fail: offline at the first failure, storage permission denied
(Android 10 and below), or three failures in a row (storage full, site
unreachable). See `composables/useBookDownload.ts` and
`src/__tests__/offlineDownloadAll.test.ts`.

### Reading: `text_opened` (existing)

| Property | Values                                                                                                                                                                            | Status                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `source` | `library`, `session`                                                                                                                                                              | existing, kept                                           |
| `entry`  | `search`, `resume`, `push`, `home`, `library`, `sidour`, `daily_reading`, `parcours`, `chnei_mikra`, `tehilim_day`, `reading`, `zmanim`, `calendar`, `session`, `direct`, `other` | **new**; `parcours` (from a Mon parcours page) **added** |

`entry` tells where the reader comes from (`services/readingEntry.ts`): a hint
left just before navigation when the URL cannot tell (a search result,
« Reprendre ma lecture », "Resume my reading", a notification, a text reopened
from the study table, `table`, **new value**), otherwise the previous page.
`reading`: from another text (next psalm, next service); `direct`: without a
previous page (widget, shared link, search engine, reloaded page).

### Reading: `page_form_toggled` (new)

The reader switches a guemara to the layout of the Vilna page, or a paracha
to that of the Sefer Torah, or back (toolbar or reading menu button,
`TextReadingPage.vue`, see `docs/design.md`, « Un texte se lit aussi dans la
forme de sa page »). It tells whether the layout is found, and for which
corpus it is used. Only sent when the saved choice changes: switching to
phonetics and back does not touch it.

| Property  | Values                                                     | Status  |
| --------- | ---------------------------------------------------------- | ------- |
| `enabled` | `true` (the layout is shown), `false` (back to the Hebrew) | **new** |
| `form`    | `daf` (Vilna page), `scroll` (Sefer Torah)                 | **new** |
| `text_id` | the text's id in the catalog (`textStudies.json`)          | **new** |

### Reading: `commentaries_opened`, `commentaries_closed` (new)

The commentaries on a passage (Rachi, Tossafot, Bartenura, Tossefot Yom Tov,
see `docs/design.md`, « Les commentaires d'un passage s'ouvrent depuis sa
bulle, puis suivent la lecture »): `commentaries_opened` is sent when the
« Commentaires » ("Commentaries") row of the bubble opens the study panel,
`commentaries_closed` when it is closed (close button, Escape, back, change of
text). The second tells whether the panel serves a single passage or the
study of a whole daf. `corpus` says which one: a guemara (`talmud`), a
paracha (`torah`), a michna (`mishna`), a verse of the Neviim, the Ketouvim
or a psalm (`tanakh`), a seif of the Choulhan Aroukh (`halakha`, value added
with the Halakha shelf).

| Event                 | Property          | Values                                                                                | Status  |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------- | ------- |
| `commentaries_opened` | `corpus`          | `talmud`, `torah`, `mishna`, `tanakh` (Neviim, Ketouvim), `halakha` (Choulhan Aroukh) | **new** |
| `commentaries_opened` | `text_id`         | the text's id in the catalog                                                          | **new** |
| `commentaries_opened` | `count`           | the number of commentaries on the passage                                             | **new** |
| `commentaries_closed` | `passages_viewed` | the passages seen in the panel, including the one it was opened on                    | **new** |

`passage_action` (existing) gains one more value for `action`:
`commentaries`, the tap on the bubble's row.

### Reading: `commentaries_resized` (new)

On a wide screen, the commentaries column is adjusted by dragging its left
edge (or with the keyboard, through the arrow keys); a double tap on the edge
restores its original width. The event is sent at the end of the gesture,
once, and tells whether the default width suits people who study.

| Event                  | Property         | Values                                               | Status  |
| ---------------------- | ---------------- | ---------------------------------------------------- | ------- |
| `commentaries_resized` | `width`          | the chosen width, in pixels; `null` when it is reset | **new** |
| `commentaries_resized` | `viewport_width` | the window width, in pixels                          | **new** |

### Reading: automatic scrolling (`auto_scroll_*`, existing)

`auto_scroll_started`, `auto_scroll_stopped` and `auto_scroll_speed_changed`
(`composables/useAutoScroll.ts`) carried the speed under its name (`speed`).
Since the speed is set in twenty notches instead of four speeds (see
`docs/design.md`, "The scroll pill is its own stop"), the notch is sent
**alongside**, and `speed` keeps its meaning: it is the named speed closest to
the notch, the only one previous versions knew. Analyses already built on
`speed` remain correct.

`auto_scroll_speed_changed` is no longer sent at each notch but once, when the
slider stays still for 800 ms: a drag from one end to the other crosses twenty
notches. It is therefore also sent when `speed` does not change (from 7 to 9,
both « moyen », "medium"), and not at all when returning to the starting
notch.

| Event                       | Property                | Values                                                                           | Status         |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------- | -------------- |
| all three                   | `speed`                 | `slow`, `medium`, `fast`, `veryFast` (the closest to the notch)                  | existing, kept |
| all three                   | `speed_level`           | the notch, from 1 to 20 (`slow` = 1, `medium` = 6, `fast` = 13, `veryFast` = 20) | **new**        |
| `auto_scroll_speed_changed` | `previous_speed`        | the named speed closest to the notch left                                        | existing, kept |
| `auto_scroll_speed_changed` | `previous_speed_level`  | the notch left, from 1 to 20                                                     | **new**        |
| `auto_scroll_speed_changed` | `running`               | boolean: set during a scroll                                                     | existing, kept |
| `auto_scroll_stopped`       | `reason`, `duration_ms` | `user`, `bottom`, `leave`; duration in ms                                        | existing, kept |

### The study table

Texts set aside to switch from one to the other (docs/design.md, « Des
textes mis de côté, sur la table »). All **new**.

#### `text_set_aside`

A text placed on the table.

| Property           | Values                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `text_id`          | the text's identifier in the catalog                                                                                                |
| `corpus`           | its shelf (`tanakh`, `talmud`, `moussar`, `halakha`...); never a Sidour text, which cannot be placed on the table                   |
| `texts_count`      | the number of texts on the table once this one is placed                                                                            |
| `from`             | `header` (the button at the top of the text), `menu` (the reading menu), `table` (« Poser aussi », "Set aside too", from the panel) |
| `already_on_table` | the text was already there, it only saved its page (absent for `from: table`)                                                       |

#### `reading_table_opened`

The table panel opened from the bar (the arrow, the book of the text being
read, an upward swipe). `texts_count`: the texts placed.

#### `reading_table_text_opened`

A text reopened from the table: a book in the bar, or a row in the panel.
The `text_opened` that follows carries `entry: table`.

| Property      | Values                                                    |
| ------------- | --------------------------------------------------------- |
| `text_id`     | the text's identifier                                     |
| `corpus`      | its shelf                                                 |
| `texts_count` | the texts placed                                          |
| `was_open`    | it was the text already on screen (the panel just closes) |
| `from`        | `bar` (a book in the bar), `table` (a row in the panel)   |

#### `reading_table_text_removed`

A text put away with a close button. `text_id`, and `texts_count`: those
remaining.

#### `reading_table_library_opened`

« Retour à la bibliothèque » ("Back to the library"), tapped at the bottom of
the table. `texts_count`: the texts placed.

#### `reading_table_cleared`

« Tout ranger » ("Put everything away"), confirmed. `texts_count`: the texts
put away.

### Search

`library_search_used` and `chiourim_search_used` (existing) are still sent on
the first keystroke. Alongside them, the **settled** search
(`composables/useSearchTracking.ts`): the term hasn't changed for 1.2 s, a
result opens, or the page is left. Never the same term twice in a row, never
an empty term.

#### `library_search_performed` (new)

| Property        | Values                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `scope`         | `all` from the bookshelf, otherwise the shelf (`tehilim`, `sidour`...) |
| `query`         | the term, lowercased, whitespace collapsed, 40 characters at most      |
| `query_length`  | its length                                                             |
| `results_count` | the number of texts found                                              |

#### `library_search_result_opened` (new)

| Property  | Values                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| `scope`   | as above                                                                                     |
| `rank`    | the text's rank in the results as they are displayed (by shelf, then by book), starting at 1 |
| `corpus`  | the text's type (`Tehilim`, `Sidour`...)                                                     |
| `text_id` | its identifier in the catalog                                                                |

#### `chiourim_search_performed` (new)

`category` (the current filter), `query`, `query_length`, `results_count`,
as for the library.

### Times

#### `zmanim_day_changed` (new)

| Property       | Values                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `via`          | `arrow`, `picker` (the calendar under the date), `today` (« Revenir à aujourd'hui », "Back to today") |
| `offset_days`  | the gap with today after the change                                                                   |
| `arrow_streak` | the arrows tapped in a row, 0 outside the arrows                                                      |

On the third consecutive tap on an arrow, the `zmanim-date` tip is triggered
(see docs/design.md, "A tip plays out on the page, once").

#### `zmanim_location_requested` (existing)

| Property      | Values                                                                        | Status         |
| ------------- | ----------------------------------------------------------------------------- | -------------- |
| `granted`     | boolean                                                                       | existing, kept |
| `source`      | `sidour`, or absent on the times page                                         | existing, kept |
| `outcome`     | `granted`, `denied` (refused by the user), `unavailable` (no signal, timeout) | **new**        |
| `duration_ms` | the wait for the answer                                                       | **new**        |

### Sign-in

#### `login_viewed` (new)

| Property      | Values                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reason`      | what led there (`services/loginReason.ts`): `direct`, `daily_reading`, `parcours` (a Mon parcours page, on the website; **new value**), `share_reading`, `profile`, `admin`, `other` |
| `mode`        | `login` or `signup` on arrival                                                                                                                                                       |
| `last_method` | the device's last sign-in method: `google`, `apple`, `email`, or `null`                                                                                                              |

#### `email_auth_failed` (existing)

| Property      | Values                                                                               | Status                                              |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `mode`        | `login`, `signup`                                                                    | existing                                            |
| `reason`      | the Firebase code (`auth/...`), or `error`                                           | existing                                            |
| `reason`      | `password_mismatch` (the two passwords differ), `moderation` (display name rejected) | **new values**; until now they were sent as `error` |
| `last_method` | as in `login_viewed`                                                                 | **new**                                             |

#### `google_signin_clicked`, `apple_signin_clicked`, `*_signin_failed` (existing)

`attempt` (**new**): the attempt's rank since arriving on the screen. It tells
how many failures give way on the second attempt (Apple error 1000).

#### `login_help_clicked` (new)

The way out offered under an email error (docs/design.md, « L'écran de
connexion dit quoi faire »).

| Property | Values                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------- |
| `help`   | `signup` (create the account), `login` (sign in to it), `provider` (the button of the last method) |
| `reason` | the failure reason that offered it, as in `email_auth_failed.reason`                               |

#### `password_reset_opened` (new)

« Mot de passe oublié ? » ("Forgot password?") tapped under the password
field (docs/design.md, "The sign-in screen says what to do").

| Property      | Values                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `after_error` | the reason of the failure displayed at that moment, as in `email_auth_failed.reason` (`auth/invalid-credential` most often), or `null` |
| `last_method` | as in `login_viewed`                                                                                                                   |

#### `password_reset_requested` (new)

Sending the reset email. Neither the address, nor whether it has an account:
Firebase doesn't say, and an address without an account counts as `sent`.

| Property  | Values                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `outcome` | `sent`, `failed`                                                                                                                                             |
| `reason`  | the Firebase code of a failure (`auth/too-many-requests`, `auth/invalid-email`, `auth/network-request-failed`...), `error` without a code, `null` for `sent` |

#### `account_delete_failed` (existing)

| Property | Values                                                                                 | Status                                                      |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `reason` | `requires_recent_login`, `reauth_cancelled`, `error`                                   | existing                                                    |
| `reason` | `wrong_password`: the password entered in the confirmation (password account) is wrong | **new value**, along with the confirmation's password field |

After `account_deleted`, tracking is reset as on sign-out (`signed_out`): the
following events are anonymous again.

### Daily reading: `daily_reading_viewed` (new)

On arriving at the daily reading. Since Mon parcours, it was sent from Ma
journée ("My day"); with Ma journée removed, it is sent when the home page
wallet is expanded (the whole day, in plain view), along with
`parcours_wallet_opened`. It counts the whole day: texts, programs, habits
(see "Mon parcours" below). The `/bibliotheque/lecture-du-jour` page, now
back, also sends it on arrival; `source` (**new property**) says from where:
`wallet` (the home page wallet) or `page` (the daily reading).

| Property      | Values                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `state`       | `empty` (nothing planned), `in_progress`, `all_done`; `error` is no longer sent (nothing is loading) |
| `total_count` | the day's tasks (the week's tasks, such as the chnei mikra, and those set aside are not counted)     |
| `done_count`  | those already done                                                                                   |
| `source`      | `wallet` or `page`                                                                                   |

### Chains

#### `session_deadline_warned` (new)

The confirmation requested when the deadline falls tonight or tomorrow night
(`services/sessionDeadline.ts`).

| Property        | Values                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| `deadline_days` | 1 (tonight) or 2 (tomorrow night), the same calculation as `session_created.deadline_days` |
| `confirmed`     | true if the chain is created as is, false if the user goes back to the date                |

#### `share_modal_opened`, `share_channel_selected` (existing)

`trigger` (**new**): `button` (the Share button) or `after_create` (the
dialog that opens on its own right after a chain is created). It measures
what the second brings compared with the first.

#### Reading one's Tehilim at once (new)

The page « Mes Téhilim » of a Tehilim chain (see `docs/design.md`, « The
Tehilim of a chain are read one after the other »).

`session_batch_reading_opened`: the page opened from the chain.

| Property       | Values                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_id`   | the chain's identifier                                                                                                                                                                                  |
| `texts_count`  | the reader's psalms in the chain, read or not                                                                                                                                                           |
| `unread_count` | those still to read                                                                                                                                                                                     |
| `trigger`      | `button` (« Tout lire maintenant », beside « Mes réservations »), `prompt` (« Les lire maintenant ? ») or `after_pick` (« Lire maintenant » on the perpetual chain, which opens the page straight away) |
| `is_guest`     | boolean                                                                                                                                                                                                 |

`session_batch_reading_prompted`: the question asked right after a
reservation, once answered; its share of `accepted` tells whether it is
worth asking.

| Property       | Values                       |
| -------------- | ---------------------------- |
| `session_id`   | the chain's identifier       |
| `unread_count` | the psalms still to read     |
| `accepted`     | true for « Lire maintenant » |
| `is_guest`     | boolean                      |

`session_batch_reading_completed`: the last psalm of the page checked.

| Property      | Values                 |
| ------------- | ---------------------- |
| `session_id`  | the chain's identifier |
| `texts_count` | the psalms of the page |
| `is_guest`    | boolean                |

`section_marked_read` and `section_mark_read_failed` (existing): one more
value for `source`, `batch_reading`, a psalm checked on that page.

### My dates

`occasion_opened` (existing, the home page banner) is kept. Alongside it:

| Event                    | Properties                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `occasions_opened` (new) | `source` (`calendar_button`, `calendar_row`), `occasions_count` (the dates already entered)                                                                                                                                                        |
| `occasion_saved` (new)   | `kind` (`yahrzeit`, `birthday`, `other`), `is_new`, `on_account` (the date follows the account, or stays on the device), `date_entry` (**new**: `hebrew` for a date entered in Hebrew, `civil` for a date entered by its civil date and converted) |
| `occasion_removed` (new) | `kind`                                                                                                                                                                                                                                             |

Neither the name nor the date: they identify a person.

### Page not found: `not_found_viewed` (new)

`path`: the requested path, without the query string (it may carry an email
or a token). `$referrer` tells where the dead link came from.

### Tips: `feature_tip_shown`, `feature_tip_finished` (existing)

`tip` gets a **new value**, `zmanim-date`: the calendar under the date on the
times page; and four for the Mon parcours tutorial, `parcours-home`,
`parcours-page`, `parcours-create`, `parcours-program`, which are also sent
from the website.

### Team announcements: `announcement_poll_answered` (new)

A vote sent to a poll (see `docs/informations.md`), from the announcement
page, in the app or on the website.

| Property        | Values                                                           |
| --------------- | ---------------------------------------------------------------- |
| `id`            | the announcement's identifier                                    |
| `choices_count` | the number of options checked (1, except for multi-choice polls) |
| `changed`       | `true` if the device changes a vote already sent                 |

Not the choice itself: answers are counted in Firestore
(`announcements/{id}/votes`), and the backoffice displays them.

### Write to us: `support_reply_sent` (new)

The person follows up on one of their messages from the « Nous écrire » page
(`/contact`), in the app or on the website (see `docs/feedback.md`). The
first message is still `feedback_sent` (existing, unchanged).

| Property | Values                                                      |
| -------- | ----------------------------------------------------------- |
| `kind`   | the nature of the thread: `idea`, `bug`, `error` or `other` |

Not the text: it is in the thread, which only the backoffice reads.

## Audio classes: listening as a list, and the link to the texts

Classes are now listened to as in a listening app: a list becomes the
player's queue, the next episode plays automatically, a class already started
resumes where it was left off. And a class can name the library text it
studies (see `services/chiourTexte.ts`).

### `chiour_played` (existing, three more properties)

| Property                                          | Values                                                                                                                                                                 | Status         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `chiour_slug`, `chiour_title`, `duration_seconds` |                                                                                                                                                                        | existing, kept |
| `source`                                          | `chiour` (the class page), `serie`, `auteur`, `catalogue`, `reprise` (the « Reprendre l'écoute », "Resume listening", row), `texte` (the classes under a library text) | **new**        |
| `autoplay`                                        | true when the end of the previous class chained into it                                                                                                                | **new**        |
| `resumed`                                         | true when it resumes where it was left off                                                                                                                             | **new**        |

`source` is that of the action that started the queue: the classes it chains
keep it, and carry `autoplay`.

### `chiour_opened` (existing, one more property)

`texte_id` (**new**): the identifier of the text the class studies, `null` if
it has none.

### `chiour_text_opened` (new)

From a class, a series or the full-screen player to its text (« Lire le
texte », "Read the text").

| Property      | Values                                                |
| ------------- | ----------------------------------------------------- |
| `source`      | `chiour`, `serie`, `lecteur` (the full-screen player) |
| `chiour_slug` | the class, `null` from a series                       |
| `texte_id`    | the text's identifier in the catalog                  |
| `chapitre`    | the targeted chapter, `null` for the whole text       |

### `text_chiourim_shown` (new)

The « Cours sur ce chapitre » ("Classes on this chapter", or « sur ce
texte », "on this text") panel is displayed under a library text: the
denominator of listens started from a text (`chiour_played`, `source`
`texte`). Once per text and per chapter opened.

| Property         | Values                                     |
| ---------------- | ------------------------------------------ |
| `texte_id`       | the text's identifier                      |
| `chapitre`       | the open chapter, `null` on the whole text |
| `chiourim_count` | the text's classes                         |
| `chapter_count`  | those of the open chapter                  |

### `chiourim_filters_opened` (new)

The catalog's « Filtres » ("Filters") button opens its panel (topics,
rabbanim). `results_count`: the classes displayed on opening.
`chiourim_category_filtered` (existing) is still sent when a topic is chosen,
from this panel; `category` is `all` when it is removed.

### `chiourim_rav_filtered` (new)

A rav chosen (or removed) in the catalog filters.

| Property        | Values                                            |
| --------------- | ------------------------------------------------- |
| `auteur`        | the rav's name, `null` when the filter is removed |
| `results_count` | the classes displayed                             |

## Translations (October 2026)

The translation under the Hebrew (`composables/useTranslation.ts`,
`docs/traductions.md`): two new events, to know whether it is found, in which
language it is read, and therefore where to complete the French.

### `translation_toggled` (new)

The « Traduction » ("Translation") command in the toolbar, or the switch in
the reading settings.

| Property  | Values                                                                   |
| --------- | ------------------------------------------------------------------------ |
| `enabled` | `true` when turned on, `false` when turned off                           |
| `lang`    | the language of the open text's translation (`fr`, `en`), `null` if none |

### `translation_language_changed` (new)

Another language chosen in the reading settings, on a text translated into
both (the Tanakh, part of the Michna).

| Property | Values                           |
| -------- | -------------------------------- |
| `lang`   | the chosen language (`fr`, `en`) |

## Mon parcours

Programs, habits, calendar readings and daily texts, the day and the wall
(`/parcours`). The daily reading now lives there. Tracking that repeats from
one screen to another (checking, setting aside, arriving on the day) goes
through `src/services/parcours/tracking.ts`.

### `parcours_viewed` (new)

On arriving at Mon parcours ("My journey").

| Property           | Values                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| `objectives_count` | the current goals                                                         |
| `streak`           | the current streak, in days                                               |
| `signed_in`        | true with an account (without an account, everything stays on the device) |

### `parcours_wall_viewed` (new)

On arriving at the full wall. `weeks`: the columns shown.

### `parcours_day_opened` (new)

A day of the wall, opened to fill it in after the fact. `source`:
`parcours_wall` (the Mon parcours wall) or `parcours_full_wall` (the full
wall).

### `parcours_task_marked` (new)

A task checked or unchecked.

| Property   | Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `done`     | true when it is checked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `kind`     | `program`, `habit`, `cycle`, `text`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `source`   | from where: `home_deck_swipe` (the top card of the home page stack, swiped), `home_wallet_swipe` (a wallet card, swiped right or, to uncheck it, left), `home_sheet` (a card's sheet), `journee_row` (Ma journée, removed: no longer sent), `objective_swipe` (the day's or week's portion, swiped on a program page), `reader` (at the bottom of a reading opened from the parcours, the ring pulled up), `parcours_wall`, `parcours_full_wall` (a day of the wall), `daily_page` (**new value**: « Marquer comme lu », "Mark as read", on the daily reading page); the home page « Lecture du jour » ("Daily reading") card, swiped, sends one per text |
| `days_ago` | 0 today, 1 yesterday...: what gets checked after the fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

A task from the former daily reading (a daily text, a calendar reading),
checked on the same day, also sends `daily_reading_marked_read` (existing,
never documented), with its properties from that time: `marked`, `scope`
(`text`, `option` with `option: tehilim-jour`, `parasha_week`), `done_count`,
`total_count`, `all_done`, counted over the day.

### `parcours_task_skipped` (new)

« Pas aujourd'hui » ("Not today"), or its opposite. `skipped`, `kind`,
`source` (`home_sheet`, from a home page card's sheet; `journee` is no longer
sent: Ma journée only has "done" and "later" now).

### `parcours_task_postponed` (new)

« Plus tard » ("Later") on the home page: the card moves under the stack, for
the rest of the day. `kind` (the kind of goal, or `occasion`, `catch_up` for
an extra card), and `source`: `swipe` (the top card swiped left),
`wallet_swipe` (a wallet card swiped left), `sheet` (its sheet);
`journee_swipe` (a Ma journée row swiped left) is no longer sent, Ma journée
has been removed.

### `parcours_wallet_opened` (new)

The home page wallet, the day spread out. `source`: `swipe` (the stack pulled
down) or `day_bar` (the day bar tapped).

### `parcours_occasion_marked` (new)

An occasion card in the stack marked done, or undone: it doesn't count in the
day, the device remembers it.

| Property   | Values                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| `occasion` | `halevana` (the blessing of the moon), `omer` (the evening count), `hanouka` (the lighting) |
| `done`     | true when it is done                                                                        |
| `source`   | `home_deck_swipe`, `home_wallet_swipe`, `home_sheet` (as in `parcours_task_marked`)         |

`birkat_halevana_opened` and `omer_opened` (existing) are still sent with
`source: home` when their card is tapped in the stack, as when they were
banners.

### `home_card_clicked` (existing)

`card` gains one more value, `parcours_task`: a card from the deck or the
wallet tapped, which opens its page (the text, the service). It then carries
`kind` (**new property**), the kind of goal: `program`, `habit`, `cycle`,
`text`; or `occasion` (the moon, the 'Omer, 'Hanouka) and `catch_up`
(« Rattraper », "Catch up") for an extra card. `daily_reading` is no longer
sent: the daily reading card gave way to the deck.

### `home_block_moved`, `home_block_hidden`, `home_block_shown` (new)

The home page to one's liking (edit mode, on the home page itself): a block
moved, hidden, or restored. `block`: `horaires`, `volumes`, `portes`, `reprendre`, `dates`;
and for a move, `to`, its new position (0 right under the day's deck).
`home_card_clicked` also takes `card: resume`, the « Reprendre » ("Resume")
block. `card: announcements` is no longer sent: the announcements link left
the bottom of the home page (it remains in the website footer and in the
app's profile); an announcement's card, for its part, still sends
`announcement_opened`.

### `parcours_units_marked` (new)

The boxes of a portion, checked one by one on the page of a weekly program
(« Où j'en suis cette semaine », "Where I am this week"). `units`: the units
read today; `source`: `objective_cells`.

### `parcours_read_ahead` (new)

The rest of a program read ahead: the next portion, opened through « Lire la
suite » ("Read on", at the bottom of a completed portion, on the program
page, or the home page volume tapped once the day's portion is done) and
marked as read at the bottom of the reading.

| Property | Values                                  |
| -------- | --------------------------------------- |
| `corpus` | `michna`, `talmud`, `tanakh`, `tehilim` |
| `units`  | the units of the portion read ahead     |

### `parcours_objective_created` (new)

| Property                                         | Values                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                                           | `program`, `habit`, `cycle`, `text`                                                                                                                                                                                                                               |
| `corpus`, `rhythm`, `parts_count`, `texts_count` | a program: `michna`, `talmud`, `tanakh`, `tehilim`; `daily`, `weekdays`, `weekly`; the parts chosen (sedarim, tractates, books); the texts they make up                                                                                                           |
| `preset`, `days_count`                           | a habit: `tefilot`, `chema-al-hamita`, `tsedaka`, `chmirat-halachon`, `limoud` (a study time, **new**), `custom` (« Avec mes mots », "In my own words"); `tefilin` and `birkat-hamazon` are no longer sent (creation no longer offers them); its days in the week |
| `cycle`                                          | a calendar reading: `tehilim-week`, `tehilim-month`, `parasha`; `parasha-aliyot` (**new value**), the chnei mikra one aliya per day                                                                                                                               |
| `text_id`                                        | a daily text; `texts_count` tells how many were picked at once (one event per text)                                                                                                                                                                               |
| `source`                                         | **new property**: `daily_page`, a text added from the daily reading page (« Modifier ma liste », "Edit my list"); when absent, the goal comes from the creation page                                                                                              |

### `parcours_objective_paused`, `parcours_objective_removed` (new)

`kind`, and for the pause, `paused` (true when paused, false when resumed).
On removal, `source` (**new property**) is `daily_page` for a text removed
from the daily reading page; when absent, the goal was put away from its
settings.

### `parcours_program_updated` (new)

A program edited: `field` is `end` or `rhythm` (the pace restarts from
today).

### `parcours_light_unlocked` (new)

A streak light earned (the candle, the lantern... see
`services/parcours/lights.ts`): the record has just crossed a threshold, and
its sheet slides up. Once per threshold and per device; nothing when the
record jumps by several days at once (the count read again on a new device).

| Property | Values                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| `light`  | `candle`, `lantern`, `menorah`, `lighthouse`, `moon`, `sun`, `stars`, `galaxy`, `supernova`, `quasar`, `first-light` |
| `days`   | the threshold crossed, in consecutive days: 3, 7, 14, 21, 30, 50, 75, 100, 150, 250, 365                             |
| `streak` | the current streak                                                                                                   |

### `parcours_lights_opened` (new)

« Mes lumières » ("My lights") opened. `source`: `parcours` (the Mon parcours
light, tapped), `profile` (the profile light, tapped: on the circle in the
app, in the banner on the website), `celebration` (« Voir mes lumières »,
"See my lights", from the sheet of an earned light).

### `parcours_caught_up` (new)

A backlog caught up.

| Property   | Values                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `option`   | `week`, `remaining`, `oneDay`, `pushEnd`, `done`                                                                                                                               |
| `behind`   | the units behind                                                                                                                                                               |
| `remember` | true if the user chose to do it this way without being asked                                                                                                                   |
| `source`   | `objective` (a program's « Rattraper » sheet), `home_deck_swipe`, `home_wallet_swipe` or `home_sheet` (the home page « Rattraper » card, marked done: `option` is then `done`) |

### What becomes of the daily reading events

The `/bibliotheque/lecture-du-jour` page had given way to Ma journée, itself
removed since; it is back, fed by Mon parcours. What it sent continues when
the screen continues:

- `daily_reading_viewed` and `daily_reading_marked_read`: see above;
- `reminder_settings_opened`, `reminder_enabled`, `reminder_enable_failed`,
  `reminder_disabled`, `reminder_disable_failed`: the reminders bell, with
  the same properties, at the bottom of Mon parcours;
- `daily_reading_configured` (building the list), `daily_reading_tab_switched`
  (« Aujourd'hui » and « Cette semaine », "This week") and
  `daily_reading_offline_prompt` (the dialog for a text added without being
  downloaded) no longer have a screen, and are no longer sent. The list is
  now built through `parcours_objective_created` and
  `parcours_objective_removed` (`kind` `text` or `cycle`), and texts missing
  from the device are offered through the Mon parcours banner
  (`offline_download_started`, `scope` `parcours`).
