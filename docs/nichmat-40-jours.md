# Nichmat 40

A custom kept for a recovery, a match, children, or in memory of someone:
forty people each say Nichmat kol 'hai every day, for forty days. Nichmat 40
is a shared reading built for it: forty places, forty days, and each reader
ticks the days they said it.

The text itself is the library's Nichmat page
(`/bibliotheque/sidour/nichmat-kol-hai`, entry 686 of
`src/datas/textStudies.json`, built by `scripts/build-brahot.mjs` from the
Shabbat Pesukei dezimra of the Siddur Edot HaMizrach). Said on its own, it
runs up to Yichtaba'h, without the closing blessing of Yichtaba'h: that
blessing ends the Pesukei dezimra of the service and is not said outside it.

## What the reader sees

- **When creating a session**, « Nichmat 40 » is one of the types. It has no
  books to choose and no deadline: the creator chooses when the forty days
  begin, on a chosen day, or « Dès que les 40 places sont prises » ("As soon
  as the 40 places are taken"), the day after the fortieth place is taken.
- **On its page** (`NichmatChain` in `DetailSession`), instead of the list of
  texts:
  - where the forty days stand: waiting for its readers, starting on a given
    day, day 12 of 40, or over; with a bar of the places taken while it
    fills, then of the readings ticked out of those due so far;
  - the reader's place, once taken: « J'ai dit Nichmat aujourd'hui » ("I said
    Nishmat today"), « Lire Nichmat » ("Read Nishmat"), which opens the
    library page, and the forty days, today's and the earlier ones tickable
    (a forgotten day is caught up), the later ones not yet;
  - « Prendre une place » ("Take a place") for whoever has none: the first
    free place, with a name for a guest, as for any reservation;
  - the readers, by place, with the days each has read.
- **In « Je participe »** ("I'm taking part"), the chain says which day of
  the forty it is, and today's reading is ticked from there.
- **The header and the card** give the forty days (« Du 16 octobre au 24
  novembre », "From October 16 to November 24") where an ordinary chain gives
  its deadline; a chain waiting for its readers says so.

One place per reader: whoever holds a place is not offered another. The
creator can still assign places to people who have no phone, from the
management page, where each place reads « Place 12 ».

A reader gives up their place as long as they have not ticked any day. After
that, only the creator frees it (the management page): a reader who drops
out is replaced, and their ticked days go with the place.

## Data

A Nichmat 40 chain is an ordinary session of type `Nichmat`. On top of the
fields of any session:

| Field            | Written by                 | Role                                                    |
| ---------------- | -------------------------- | ------------------------------------------------------- |
| `startDay`       | creation, or creator's app | First of the forty days (YYYY-MM-DD).                   |
| `startsWhenFull` | creation                   | The forty days begin the day after the fortieth place.  |
| `dateLimit`      | creation, creator's app    | The last of the forty days; a year away while it waits. |

Everything readers write lives in `reservations`, in two kinds of entries:

| Entry    | `textStudyId` | `section` | Identity            | `isCompleted` |
| -------- | ------------- | --------- | ------------------- | ------------- |
| Place    | `686`         | 1 to 40   | the reader's        | not read      |
| Day read | `686/<day>`   | the place | none: see the place | `true`        |

Ticking a day adds its entry, unticking removes it: the rules accept one
entry more or one less, as for any reservation. Freeing a place from the
management page also removes its day reads (`deleteReservations`), so that
whoever takes it next starts afresh.

### The start of a chain that waits for its readers

It is the day after the fortieth place was taken, **in Jerusalem**: read in
each reader's time zone, a place taken at 23:30 in Paris would not start the
forty days the same day for everyone. Readers cannot write anything but the
reservations, so nobody records it at that moment: everyone computes it from
the places (`startDayOf`). The creator's app records it (`startDay`, and the
deadline that follows) the next time the creator opens the chain or its
management page (`recordNichmatStart`): from then on, a place freed and taken
again no longer moves the forty days.

Days are calendar days (YYYY-MM-DD): day 1 is `startDay` on every device,
and today is the reader's own day.

## Compatibility with published versions

Published versions of the app know nothing of Nichmat 40. They show the
chain with its deadline (the last of the forty days, or a year away while it
waits), and nothing to reserve: their catalog has no text of type `Nichmat`.

Day reads are entries of their own rather than a field of the place: a
published version, when a guest signs in, rewrites that guest's reservations
with the fields it knows, and would drop such a field. Entries are kept as
they are, and a day read carries no identity, so that a published version's
« Je participe » does not list forty days as forty texts. Such a version
lists the place itself, under its catalog number; unticking it there changes
nothing (a place's `isCompleted` is not read).

## Tests

- `src/__tests__/nichmatChain.test.ts`: places and day reads, the start
  (chosen, once full, in Jerusalem, kept once recorded), the forty days and
  what can be ticked, progress, and the writes (tick, untick, a place freed
  with its days).
- `firestore.rules` bounds `startDay` (a YYYY-MM-DD day) and
  `startsWhenFull` (a boolean) in `validSessionFields`.

Tracking: `docs/tracking-plan.md`, « Nichmat 40 ».
