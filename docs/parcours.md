# Mon parcours

Mon parcours ("My journey") is what you set yourself to keep up, and what
you have kept up: finishing a text by a date, a habit, the month's
Tehilim, the week's paracha, a text reread every day. The former daily
reading has been folded into it: its texts and its calendar readings are
objectives like any other.

This document explains how it is built. The design is in `docs/design.md`
("Mon parcours: the wall is built in stones, and only it" and the
following sections), audience tracking in `docs/tracking-plan.md`
(« Mon parcours »).

## The pages

| Address                           | What you find there                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `/`                               | home: the lamp, the day's deck, the wallet, the shelf (`components/parcours/home/`)           |
| `/parcours`                       | the streak, the wall of the last five weeks, the shelf, the habits                            |
| `/parcours/journee`               | the address of Ma journée ("My day"), removed: it leads to home                               |
| `/parcours/mur`                   | the whole wall                                                                                |
| `/parcours/nouveau`               | new objective, on a single page; once created, it lands on `/parcours`                        |
| `/parcours/objectif/:id`          | a program (its portion, how far behind it is, its week), or the settings of another objective |
| `/parcours/objectif/:id/reglages` | the settings of a program                                                                     |
| `/bibliotheque/lecture-du-jour`   | the daily reading: the day's texts, one after the other; their list is put together there     |

In the app, everything opens **without an account** and offline. The site
requires an account: it has no device on which to keep the tracking.

A reading opened from the journey carries `?objectif=`: the reader then
shows, at the bottom of the text, the day's task to check off
(`ReaderTaskCard.vue`).

## The model

`src/services/parcours/`, without Vue:

| File                                       | Role                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `model.ts`                                 | the objectives (program, habit, cycle, daily text) and the days                                 |
| `texts.ts`                                 | what a program can finish and what it counts, based on `src/datas/parcoursUnits.json`           |
| `plan.ts`                                  | each day's or week's portion, falling behind, catching up, getting ahead, resuming              |
| `aliyot.ts`                                | chnei mikra aliya by aliya: one per day, what is still owed                                     |
| `schedule.ts`                              | a day's tasks, a day's state on the wall, the streak                                            |
| `calendar.ts`                              | rest days (Chabbat, holidays, in Israel or in the diaspora), the week's aliyot                  |
| `moments.ts`                               | the present moment, the order of the home deck                                                  |
| `actions.ts`, `create.ts`                  | what you change, what you create                                                                |
| `merge.ts`                                 | merging two copies                                                                              |
| `deviceStore.ts`, `cloud.ts`, `account.ts` | the device, the account, what passes from one to the other                                      |
| `legacyDailyReading.ts`                    | the former daily reading                                                                        |
| `entries.ts`                               | the texts a task has you read (offline download)                                                |
| `tracking.ts`                              | audience tracking shared by several screens                                                     |
| `occasions.ts`                             | the deck's occasion cards marked done (the moon, the 'Omer, 'Hanouka, a service), on the device |
| `reminders.ts`                             | the reminders of the day: the point of the day of a task, the hour of a point, what rings    |

`composables/useParcours.ts` brings it all together for the pages: a single
shared state, started on first use (anyone who never opens the journey
loads nothing).

**A day** changes at 'hatsot of the night, not at midnight: between
midnight and 'hatsot (around 1:40 in a Paris summer), the deck, the tasks
and the streak are still the previous evening's, so Arvit or the bedtime
Chema said at 0:30 count for that evening and are not owed again before
the next night. When 'hatsot falls before midnight on the device's clock
(a winter night in Paris), the day changes at midnight (`dayOfInstant` in
`days.ts`, read by `useParcours`; held by `parcoursSchedule.test.ts`, « the
day of an instant »).

**A day** (`DayLog`) keeps what is done (`done`), the units read per
program (`units`), what is set aside (`skipped`) and the time of the last
write (`at`). **An objective** keeps its own time (`updatedAt`); once
removed, it remains as a tombstone (`deletedAt`): past days keep their
stone, and another device learns that it is gone.

**A program** keeps its texts and its total number of units; its position
is deduced from the days. Its pace restarts from a base (`base`: a day and
a position) when you change its date or its rhythm. Catching up adds units
to slots (`extra`), « Déjà fait » ("Already done") moves the position
forward (`credit`).

**The units** (michnayot, sides of a daf, chapters, psalms) come from
`src/datas/parcoursUnits.json`, which `scripts/parcours-units.mjs` writes
from `public/texts/`; `--check` verifies that it is up to date
(`parcoursUnits.test.ts`). A text corrected without this file following
would shift every portion after it.

## Storage

**The device is the foundation.** Everything lives in `localStorage` (key
`pj-parcours`), mirrored in Capacitor Preferences in the app, which the
system does not clear along with the webview storage:
`{ data, owner, dirty }`. Without an account, this is complete; switching
devices without an account loses the tracking, and the Mon parcours page
says so.

**The account carries everything from one device to another.** The
`parcours/{uid}` document holds two tables, `objectives` and `days`; each
change is written to it entry by entry (`setDoc` with `mergeFields`), never
the whole document, so as not to overwrite what another device wrote. The
Firestore rules (`match /parcours/{userId}`) open the document only to its
owner, and bound the keys and the size of the tables.

**Never write based on a copy you have not reread.** On sign-in, when the
network comes back and when returning to the screen after five minutes, the
account is reread from the server (not from the cache), merged with the
device (`mergeParcours`: entry by entry, the most recent wins, unknown
kinds of objectives are kept as is), then whatever differs is sent. A write
that fails remains pending (`dirty`) and is sent again after the next
reread.

**A shared device**: on sign-in, the device pours into the account what
belongs to nobody, or to this account; if it was tracking another account,
only what was done since that account signed out (`account.ts`,
`owner.leftAt`). On sign-out, everything stays on the device.

**Deleting the account** also erases `parcours/{uid}`
(`authService.deleteAccount`, `accountDeletion.test.ts`).

## The former daily reading

It lived in `userPreferences/{uid}`: `dailyReadingIds`,
`dailyReadingOptions`, `dailyReadingProgress`. App versions already
installed still read and write them, as does the evening reminder
(`functions/src/dailyReminder.ts`). Mon parcours takes them over without
replacing them (`legacyDailyReading.ts`):

- **on sign-in**, each text becomes a `daily-text-<id>` objective, the
  day's Tehilim `daily-tehilim`, the paracha `daily-parasha`: identifiers
  derived from them, the same on every device, which do not get
  duplicated. What was read today is checked off there. The former lists
  only ever add;
- **on each change**, Mon parcours rewrites these fields from its own data
  (`legacyProjection`), the lists and the day each on its own side, only if
  they change.

The **Tehilim of the week** (`cycle-tehilim-week`, from Sunday to Chabbat)
are new: they have no place in the former daily reading, and the
projection ignores them.

The **chnei mikra aliya by aliya** is the paracha (`daily-parasha`) with
`split: "aliyot"`: one card per day, one aliya from Sunday to Thursday, the
sixth and seventh on Friday (fourteen aliyot over six days for a double
paracha); a forgotten aliya stays due the next day, and whatever remains on
Friday is read on Chabbat (`aliyot.ts`). The card opens the chnei mikra
page narrowed to its aliyot (`?montees=3-4`). For the former daily reading,
the week counts as read when the Friday or Chabbat card is
(`parashaProgress.completed`). The field is optional: without it, the
paracha is read over the week, as before.

**Aliyot can also be checked off one by one**, in any order, on the chnei
mikra page: « Marquer comme lue » at the end of each aliya in the text, and
a bar at the top of the page that counts them (seven, fourteen for a double
paracha; `useChneiMikraChecks`). No new field: a check is an entry of `done`, on the
day it is set, under the name `aliya:3` (the 3rd aliya of the week, counted
from 1). An earlier version ignores it, and keeps it when rewriting the day
(it reads `done` back in full, whereas an unknown field of a `DayLog` was lost
on reading back, see `parseDay`). A check for another week is written on the
closest day of that week: the Chabbat of a past week, the Sunday of the
paracha that opens on Saturday evening. It works with or without a goal, on
the device and in the account, like the rest of the parcours.

With the « une montée par jour » ("one aliya a day") chnei mikra, checks and
cards are one and the same (`aliyot.ts`):

- a day's card starts from the first missing aliya, checked neither by a card
  nor one by one (the previous days);
- it is done when all its aliyot are checked, even without having been
  checked itself; unchecking it unchecks those aliyot;
- a checked card checks its aliyot and the earlier ones in the list;
  unchecking one of them undoes the card, and its other aliyot stay checked
  one by one, on the same day;
- the week is read (`parashaProgress.completed`) when all its aliyot are.

The whole week (the cycle without `split`) is not tied to it: its card says
« lue cette semaine » ("read this week"), the page's bar says where you stand.

The checks of version 3.10.11 lived on the device only
(`pj-chnei-mikra-aliyot`, by week, « texte:début »): when the text is opened,
the week's checks move once into Mon parcours and leave that storage
(`takeLegacyChecks`).

**Getting ahead**: a completed portion offers « Lire la suite » ("Read
on"), the portion of the next slot (`nextPortion`), marked as read today at
the bottom of the reading (`?avance=1`). Portions keep their size; the end
comes sooner. **Pausing** a program pushes its end back by as many days as
the pause lasted, on resuming (`resumeProgram`).

The **widgets and the watch** take the daily reading from the device, with
or without an account (`widgetService`); an account that the device has not
yet taken over keeps the one from its profile.

The **evening reminder** of the server (`functions/src/dailyReminder.ts`)
only counts the daily texts and the calendar readings: it reads the
profile and knows nothing about programs or habits. Since the reminders of
the day, the app no longer sets it; installed versions that still do keep
it working (see below).

## Reminders

« Les heures de ma journée » ("The hours of my day"), opened by the alarm
clock of Mon parcours (screens in `docs/design.md`, « Reminders of the
day »). In the app only, with or without an account.

- **Seven points can ring**: the six of the day thread (`wake`,
  `chaharit`, `noon`, `minha`, `arvit`, `bedtime`) and the day's summary
  (`day`). Each has an hour, **fixed** (bedtime at 00:00) or **tied to a
  zman** with an offset in minutes (Min'ha 20 minutes before the chkia),
  computed each day by `zmanimService` for the place of the zmanim. A fixed
  hour before 04:00 belongs to the night of the day that ends.
- **The point of a task** (`taskSlot`): its office for the three tefilot;
  the anchor chosen on the thread (habits, programs); otherwise its moment
  (morning with Cha'harit, afternoon with Min'ha, evening with Arvit,
  bedtime with bedtime). A habit of the whole day (tsedaka, garder sa
  langue) has none, and neither has a task of the week (the paracha, a
  weekly program): only the summary names them.
- **What rings**: a point names what is left to do there, neither done nor
  set aside (« Pas aujourd'hui »). Nothing left, nothing rings. The summary
  names what is left of the whole day, except what a later reminder of the
  same day will name.
- **On the phone**: `ParcoursReminderScheduler.vue` (mounted at the root of
  the app, since only a component can name the goals) makes the plan, and
  `parcoursReminderService` schedules it with
  `@capacitor/local-notifications` (ids from 42 000 000, Android channel
  `pj-parcours`). Three days ahead, redone at each change of the settings,
  of the journey (a task checked removes it from today's reminder), of the
  place, of the opinion or of the language, and at each return to the
  foreground. At most 20 pending, and the zmanim reminders 36: together
  under the 64 iOS keeps. A touch opens the home page.
- **Kept on the device** (`pj_parcours_reminders`, `useParcoursReminders`),
  like the zmanim reminders: a notification is scheduled by the phone that
  receives it, from the place chosen there.
- **The evening reminder of the server is carried over** once per device
  (`migrateServerReminder`): its fixed hour becomes the summary, its call
  before the chkia the Min'ha point (the default of Min'ha is that same
  call, 20 minutes before), then the server stops it
  (`pushReminderEnabled: false`, the token stays for the answers of the
  support). Only with the permission of notifications already granted:
  otherwise the server's reminder is left as it is rather than lost. The
  fields stay read by `functions/src/dailyReminder.ts` for versions
  already installed.
- The **hours do not move the deck**: the order of the home page and the
  opening of a service keep their rules (`moments.ts`, `useOfficeTimes`).

## Tests

| Test                            | What it enforces                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parcoursUnits.test.ts`         | program units follow `public/texts/` (safeguard, see `docs/tests.md`)                                                                                        |
| `parcoursPlan.test.ts`          | the portions, falling behind, the five catch-up modes, getting ahead, resuming after a pause                                                                 |
| `parcoursAliyot.test.ts`        | chnei mikra: one aliya per day, a forgotten one comes back the next day, Chabbat finishes; aliyot checked one by one make up the card, a card checks its own |
| `chneiMikraChecks.test.ts`      | the checks of version 3.10.11, taken over once from the device                                                                                               |
| `parcoursSchedule.test.ts`      | the day changing at 'hatsot of the night; a day's tasks, the wall, the streak (Chabbat and « Pas aujourd'hui » do not break it)                              |
| `parcoursCalendar.test.ts`      | rest days, moments, the order of the deck                                                                                                                    |
| `parcoursMerge.test.ts`         | merging two copies                                                                                                                                           |
| `parcoursSync.test.ts`          | without an account, with an account, a shared device                                                                                                         |
| `parcoursCloud.test.ts`         | the account write sends no `undefined` field (Firestore would reject the whole write)                                                                        |
| `parcoursLegacyDaily.test.ts`   | the former daily reading, taken over and kept up to date                                                                                                     |
| `parcoursDeck.test.ts`          | the home deck: the order, prayer service times, catching up, the 'Omer card, the service of the hour without the habit                                       |
| `parcoursEntries.test.ts`       | the texts to download for the day                                                                                                                            |
| `parcoursReminders.test.ts`     | the reminders of the day: the point of a task, the hour tied to a zman, nothing rings for nothing, the share of pending notifications                         |
| `parcoursTracking.test.ts`      | shared tracking, and the daily reading events that continue                                                                                                  |
| `widgetDailyParcours.test.ts`   | the widgets' daily reading, without an account                                                                                                               |
| `e2e/firebase/parcours.spec.ts` | a daily text picked, checked off, and tracked by the account (emulators)                                                                                     |
