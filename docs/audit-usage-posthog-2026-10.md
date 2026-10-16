# PostHog usage audit (October 2026)

What users manage to do, what costs them effort, where they get lost and
where things break, based on thirty days of PostHog data (from September 2
to October 1, 2026). The last section says what the tracking lacks to see
better next time.

**Scope.** `env = production` events, with team accounts, testers and the
Google review account removed (the person's `user_type`). About 640 people:
428 on the site, 113 on iOS, 108 on Android. The figures come from one-off
queries, not definitions saved in PostHog; they are small, and should be
read as trends.

## 1. What they manage to do

- **Read.** This is the use that carries the app: 89 of the 112 iOS users
  and 70 of the 105 Android users open at least one text. A visit to a
  shelf section leads to a text in 66 to 90% of cases (sidour and brahot
  above 82%, tanakh and moadim the lowest, around 70%).
- **The new introduction delivers.** « Passer » ("Skip") ended 45% of
  introductions in the old version (62 out of 139), 18% in the new one (9
  out of 51); 86% go all the way through.
- **Prayer times**: seen by 67 iOS users and 48 Android users over thirty
  days, this is the second use.
- **Offline**: 95 app users downloaded texts, with 7 failures (see 4).
- **Google on Android**: 19 sign-ins for 23 people who try; the others
  canceled on their own.
- **Updates**: of 86 people to whom the banner offered a new version, 58
  installed it within the month.
- **App loyalty**: half of the users come back at least two days out of
  thirty, and 19 are there ten days or more. On the site, 374 visitors out
  of 419 come only one day.

## 2. What takes them effort

By order of impact.

### 2.1 Signing in by email: the wrong mode, and no forgotten password

Eleven people attempted an email sign-in (« Se connecter » ("Sign in")
mode); only four succeeded. On Android, none: 13 attempts, 13
`auth/invalid-credential`. Following each one:

- three had no account, switched to sign-up and succeeded;
- two switched to Google, where they had their account, and signed in
  there;
- two gave up, one of them after five tries.

Conversely, three people tried to sign up with an already registered
address (`auth/email-already-in-use`); one of them tried again six times
without ever switching to sign-in.

Firebase answers `invalid-credential` without saying whether the address
exists: the screen therefore cannot decide, but it can offer the three ways
out at the first error (« Pas encore de compte ? Créer un compte » ("No
account yet? Create an account"), « Inscrit avec Google ou Apple ? »
("Signed up with Google or Apple?"), « Mot de passe oublié ? » ("Forgot your
password?")), and switch to sign-in by itself on `email-already-in-use`.
**There is currently no forgotten-password flow at all** (`loginView.vue`,
`authService.ts`): someone who has really forgotten theirs has no way out.

### 2.2 The daily reading behind a sign-in wall

The daily reading requires an account: 24 sessions landed on `/login` with
`redirect=/bibliotheque/lecture-du-jour`, 13 signed in, **11 left without
even trying**. This is also where « Composer ma lecture du jour » ("Compose
my daily reading") at the end of the introduction leads: of 25 people who
chose that button, 9 ended up setting up a daily reading, only one marked
one as read. The introduction promises one thing and opens a sign-in screen
without saying why.

Leads: say on the sign-in screen what one gains when arriving there from the
daily reading, or let users compose the reading without an account (on the
device) and only offer the account to sync it.

Arrivals on `/login` without a redirect do better: 54 sign-ins for 84
sessions.

### 2.3 Times for another day: up to 37 taps on « Jour suivant »

The most frequent rage click in the whole product is on the day arrows of
`/horaires`, « Jour suivant » ("Next day") above all (12 people). It is not
a broken arrow: people look for a distant date (the next Chabbat, a
holiday) and get there day by day. Since the date picker arrived (September
17), 12 sessions tapped the arrow at least three times, 9 of them between 8
and 37 times; only two opened the picker. Over thirty days: 27 sessions (18
people), 4 with the picker.

The picker is hidden in the date title, which does not read as a button.
Leads: a calendar icon next to the date, and « Chabbat » and « Prochaine
fête » ("Next holiday") shortcuts.

### 2.4 Apple and Google on iOS

- **Apple**: 24 people, 18 sign-ins. Six got error 1000
  (`AuthorizationError`), which the screen presents as a device limitation
  (« indisponible », "unavailable"); yet two succeeded by retrying right
  away, one switched to Google, three gave up. Error 1000 is therefore not
  always final: the message should invite a retry before pointing to Google
  or email.
- **Google on iOS**: 12 people, 7 sign-ins, 4 failures followed by
  abandonment (Safari unavailable for two of them).

### 2.5 The calendar pages remain dead ends

This is the site's main entrance: 422 sessions start there over thirty days
(224 on `/calendrier`, 198 on a holiday page, almost all Yom Kippour),
mostly from a search engine. **Only 9 open a second page (2%).** What gets
clicked there: « Mes dates » ("My dates") (11 sessions, personal dates), the
next or previous year, « Fermer » ("Close").

`calendar_cta_clicked` (added on September 22) has not received anything
yet, but the holiday pages have only been viewed three times by a version
that sends it (the twenty other views since then came from a still-cached
site): it is too early to conclude; revisit after the next holiday that
brings traffic.

### 2.6 The library's global search rarely succeeds

Search launched from the shelf (`scope = all`): 16 sessions, only 3 open a
text within three minutes. Search within a section does better (about one
time in two). We do not know what was searched for (see 3.2); the replays do
not say either, since input is masked in them.

### 2.7 Small frictions

- **The active tab does nothing.** « Accueil » ("Home") tapped on the home
  page: 129 taps, 38 people. On iOS as on Android, tapping the tab you are
  on scrolls back to the top of the page; here nothing happens.
- **Geolocation.** When opening a service, Android denies the location for
  17 of the 40 people who see it requested (24 denials out of 200 requests);
  iOS almost never (7 out of 207). On iOS, « Utiliser ma position » ("Use my
  location") (sidour) and « Ma position » ("My location") (prayer times) are
  tapped repeatedly by 5 people: the button stays disabled during the
  lookup, with no other sign than a spinner.
- **Chiourim.** 157 people see the list, 61 open a lesson, 39 listen to it.
  The most chosen filter, Halakha (24 people), returns only one lesson;
  Paracha (16 people), four. This is a request for content more than an
  interface problem.
- **Auto-scroll**: one stop in six by the user happens less than three
  seconds after the start, which looks like an unintended double tap (the
  gesture that launches it).
- **Creating a chain**: 14 people start, 8 finish; 5 validation failures
  (the missing field was not yet named in the event, that is fixed).
- **Profile**: repeated taps on the email and username, displayed as fields
  even though they cannot be edited.

## 3. Navigation: oriented, or searching?

In the app, about 80% of sessions reach some content (text, prayer times,
lesson, chain...). About 4% wander: four pages or more without opening
anything. Three patterns recur:

1. **The tab tour** (home, library, chiourim, profile, home): mostly
   newcomers exploring, with no sign of being stuck.
2. **Back-and-forth between sections** (tanakh, moadim, talmud,
   tehilim..., with a return to the shelf in between): someone is looking
   for a text and does not know which section it is filed in. This is the
   case the global search should cover, and it is where it fails the most
   (2.6). In the middle of the holiday season, a « Textes de la fête »
   ("Texts for the holiday") shortcut on the shelf, like the box already
   placed at the top of the sidour, is a lead.
3. **Ping-pong with the daily reading** (home, daily reading, home, daily
   reading): the page does not hold attention, and we do not know what it
   displayed (empty, sign-in request?), for lack of an event (3.7).

On the site, navigation comes down to the calendar pages (2.5): people come
in, read, and leave.

## 4. Where it breaks

Error tracking is quiet: 109 exceptions in thirty days, from 28 people.

| Error                                                       | Who                              | Status                                                   |
| ----------------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `"LocalNotifications.then()" is not implemented`            | 64 exceptions, v3.10.0 only      | gone from later versions                                 |
| `AuthorizationError` 1000 (Apple)                           | 9 exceptions, all versions       | see 2.4: the message, not a native fix                   |
| `Unable to open Safari` (Google, iOS)                       | 4 exceptions, v3.7               | old versions                                             |
| Download denied (Android 10 permissions)                    | 1 person, v3.10.7                | fixed on October 1 (d50b58e), not yet released           |
| `section_mark_read_failed` (« Réservation introuvable », "Reservation not found", version conflict) | 3 people, site | to watch: a section marked read that is not             |
| Chunk served as `text/html` (deployment)                    | 2 people, site                   | reload already planned (`chunk_load_error`)              |

On the performance side, two signals:

- **Layout shifts (CLS)**: the 75th percentile is poor (above 0.25; good:
  below 0.1) on every page of the Android app, and close to 1 on half of
  them. On the desktop site, 39 measurements out of 60 are poor, including
  14 out of 19 for `/calendrier`, the entry page that matters for search.
  Part of it may come from CLS accumulating over an SPA session; check on a
  replay before spending time on it.
- **iOS measures nothing**: the WKWebView webview exposes neither LCP, nor
  CLS, nor INP. There is no iOS `$web_vitals`; only
  `perf_degraded_rendering` says anything about smoothness on iPhone.

Replays that illustrate these findings (kept for thirty days):

- [11 taps on « Jour suivant »](https://eu.posthog.com/project/233968/replay/01a0e8bd-7fe3-7561-befd-23eb7b5b00c8)
  (Android, September 28);
- [sign-up rejected three times (address already taken), sign-in rejected, then Google](https://eu.posthog.com/project/233968/replay/01a0e8c5-84b0-74b0-8360-a6da3d8c858d)
  (Android, September 28);
- global search with no text opened:
  [October 1](https://eu.posthog.com/project/233968/replay/01a0f884-4829-7822-b7a9-c6ee6d0ea915),
  [September 30](https://eu.posthog.com/project/233968/replay/01a0f0c2-273e-790a-8123-0502da1ac0f0).

## 5. What the tracking lacks

**Implemented on October 1, 2026** (same branch): 5.2 to 5.8, except three
points. `trigger` on auto-scroll is not needed: the double tap is its only
entry point, and `auto_scroll_stopped.duration_ms` already reveals the
unintended starts. `password_reset_requested` awaits the forgotten-password
flow, which does not exist yet. The address of app replays
(`https://localhost/`) still needs to be rewritten. Event details are in
`docs/tracking-plan.md`, "October 2026 additions" ("October 2026
additions"). Also remaining is 5.1, which is settled in PostHog rather than
in the code.

The tracking plan rules (`docs/tracking-plan.md`) apply to every addition:
nothing is renamed or deleted, a badly named property gets its replacement
alongside it, and every event or property added is documented there in the
same change.

### 5.1 The test account filter filters almost nothing

PostHog's filter ("Filter out internal and test users") relies on cohort
193531, which only keeps `@phenixel.fr` addresses: one person. It lets
through `contact.phenixel@gmail.com`, the tester and the review account,
which `user_type` can nonetheless recognize: **26% of the month's Android
events** (10,242 out of 39,505) come from these accounts. Any insight that
checks the filter is skewed on the Android side.

To do in the project settings (no code): define the cohort by
`user_type` ∈ {`internal`, `tester`, `google_review`}, and add
`env = production` to the test filters. What remains is the known case of
team devices before sign-in, which nothing allows to tag.

### 5.2 Search says neither what, nor how many, nor whether it helped

`library_search_used` fires on the first keystroke with only the scope;
`chiourim_search_used` with only the category. None of the questions in 2.6
can be answered. To add, debounced (once input has settled):

| Event                          | Properties                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `library_search_performed`     | `scope`, `query` (normalized, truncated to 40 characters), `query_length`, `results_count`       |
| `library_search_result_opened` | `scope`, `rank`, `corpus`, `text_id`                                                             |
| `chiourim_search_performed`    | `category`, `query`, `results_count`                                                             |

The query itself is useful (what people look for and do not find) and
low-risk: these are book names. A frequent `results_count = 0` on the same
term is exactly the list of texts to add.

### 5.3 Where reading comes from

`text_opened.source` only takes `library` or `session`: an open from
search, a home card, « Reprendre ma lecture » ("Resume my reading"), the
daily reading, a deep link, a notification or the next service are all
lumped together. To add alongside: `entry` (`corpus_list`, `search`,
`home_card`, `resume`, `daily_reading`, `next_tefila`, `deep_link`, `push`,
`widget`, `session`).

### 5.4 Times for another day

No event when the day changes: the findings in 2.3 come from autocaptured
clicks. To add: `zmanim_day_changed` with `via` (`arrow`, `picker`, `today`)
and `offset_days`. We will then know which dates people come looking for,
and whether a « Chabbat » shortcut reduces arrow use.

### 5.5 Why location fails

`zmanim_location_requested` only carries `granted`, whereas the code already
distinguishes denial (`denied`) from failure (`unavailable`). To add
alongside: `outcome` (`granted`, `denied`, `unavailable`) and `duration_ms`
(the wait that makes people tap the button repeatedly on iOS).

### 5.6 The sign-in flow

- `login_viewed` with `reason`: the feature that led there (daily reading,
  chains, profile, introduction, none). Today we guess it from the URL.
- `email_auth_failed`: `reason = error` hides the mismatched password
  confirmation; give it its own value (`password_mismatch`).
- `attempt` (the attempt's rank within the visit) on `*_signin_clicked` and
  `*_signin_failed`: it would tell how many Apple 1000 errors give way on
  the second try.
- `password_reset_requested` the day the flow exists.

### 5.7 What the daily reading shows

No arrival event on `/bibliotheque/lecture-du-jour`: we do not know what
those who leave right away see (3, pattern 3). To add:
`daily_reading_viewed` with `state` (`logged_out`, `empty`, `configured`),
`total_count` and `done_count`.

### 5.8 The rest

- **Dead clicks**: `capture_dead_clicks` is disabled in the project
  settings. Enabled, it would have flagged on its own the prayer times date
  title that is not taken for a button, or the profile fields.
- **Auto-scroll**: `trigger` (`double_tap`, `menu`) on
  `auto_scroll_started`, to separate intended starts from unintended double
  taps.
- **My dates**: it is the most clicked button on the calendar pages (2.5),
  and the window sends nothing (`occasion_opened` only fires from the home
  banner, and has received nothing in thirty days). To add:
  `occasions_opened` with `source`, `occasion_added` with `kind`; we will
  know whether this entry point creates regulars.
- **Page not found**: the 404 page sends nothing; `not_found_viewed` with
  `path` and `$referrer` would tell which links are dead.
- **App replays**: their `start_url` stays `https://localhost/` (the rewrite
  to `app://` only applies to events), which hampers filtering replays by
  page.
- **The tracking plan** only documents part of the events sent (calendar,
  introduction, profile, a few others): search, chains, sign-in and offline
  are not in it. Fill them in along with the additions above.

## 6. Three questions from the owner

### 6.1 The library: do people find what they are looking for?

Out of 724 app sessions that went through the library:

- **81% open a text**, in 5 to 8 seconds (median); the path shelf, section,
  text is enough in 68% of cases. 34 sessions needed five library pages or
  more.
- **19% open nothing**, but most only passed by the shelf (100 out of 120
  stop there, often to go elsewhere in the app). About forty sessions (6%)
  browse three pages or more without opening anything: these are the real
  unsuccessful searches.
- **A wrong text opened** (back to the list in under 15 seconds): 40% of
  Michna opens, 31% of Talmud, 25% of Tanakh, about 20% of Moadim and
  Slihot, versus 10% of the sidour and 9% of Tehilim.
- **Tehilim are browsed one by one**: 39% of opened psalms give way to the
  next one in under 15 seconds; 21 sequences of three psalms or more,
  including 4 of ten or more. Same pattern as the days in prayer times
  (2.3): people step forward toward a number.
- **Search is rarely used**: 5% of library sessions, 29 of the 176 app
  library users in a month, 9 from the shelf.

### 6.2 The other features

Distinct people over thirty days (about 217 in the app, 430 on the site),
and among them those who come back on another day.

| Feature                   | Site | App | Came back another day |
| ------------------------- | ---: | --: | --------------------: |
| Holiday calendar          |  308 |  30 |                    45 |
| Chiourim (list)           |    5 | 152 |                    49 |
| Prayer times              |   19 | 115 |                    42 |
| Chains (viewed)           |   30 |  59 |                    27 |
| Daily reading (page)      |    1 |  55 |                    17 |
| Chiour listened to        |    4 |  36 |                     5 |
| Kotel compass             |    0 |  18 |                     6 |
| Prayer time reminders     |    0 |  12 |                     1 |
| Chnei mikra               |    0 |  12 |                     1 |
| Tefilin mirror            |    0 |  11 |                     3 |
| Bookmarks                 |    1 |  10 |                     2 |
| Daily Tehilim             |    0 |   7 |                     0 |

- **Prayer times** are well used: half of the app's users, 17 of them on
  five days or more. Widgets and the watch send nothing: real usage is
  higher.
- The **calendar** lives on the site (search engine traffic); in the app,
  14% of users open it.
- The **daily reading**: 56 people saw the page, 24 composed it, 9 marked
  at least one reading, 5 completed at least one day (22 complete days in
  all).
- The **chiourim** attract (70% of app users open the list) but retain
  little: 17% listen to a lesson.

### 6.3 Reading chains

Read from Firestore (read-only) on October 1: 28 chains since February, 9
created since September 1.

- Of those 9: one filled (11 sections out of 11, within a few hours), one
  partially (18 psalms out of 150, all read), three at 2 sections, four
  empty.
- The last real success dates from August 24: 150 psalms out of 150
  reserved, 140 read, 14 participants.
- **No chain has been closed by its creator since July** (only one in the
  whole history): they end by expiring, even when full.
- **A chain fills up when it circulates**: the successful ones have from 6
  to 24 distinct visitors in PostHog, the empty ones never more than 2. The
  app's share button was only used for 6 chains in two months.
- 3 of the 9 recent chains had their deadline on the very day they were
  created; two stayed empty.
- Six chains created on the same day in July (Talmud and Michna, running
  until 2027) have zero or one reservation, and are still shown as in
  progress. The large Michna chains are 83 to 99% reserved but only 3 or 4%
  read: people reserve, they do not mark the reading.
