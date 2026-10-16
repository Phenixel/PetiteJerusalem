# The perpetual Tehilim chain

Many people create a Tehilim chain for someone who is ill or has passed
away and cannot find 150 readers. The perpetual chain answers them: a chain
that is always open, that everyone moves forward, and that starts again
from the first Tehilim as soon as the last one is read. You do not create
anything there: you entrust a name to it.

The screens are in the proposal's canvas (sharing home, chain page,
« Proposer un nom » ("Propose a name") dialog, reading, session creation);
their appearance rules are in `docs/design.md`, "The perpetual chain".

## What the reader sees

- **On the sharing home page**, the chain has its card at the top, below
  the create button (`PerpetualChainCard`), a frame like the other chains.
  It says for how many people we are reading, without naming them. It does
  not appear in « Sessions en cours » ("Ongoing sessions"): it is not
  repeated there.
- **On its page**, the same as a session's (`DetailSession`), with three
  differences: the header says « Lecture continue » ("Continuous reading")
  and the round number instead of the deadline and the creator; the round
  counter (`PerpetualStatsCard`); the list of names we are reading for
  (`PrayerNamesCard`). The draw, the progress bar, reserving without an
  account and the list of 150 Tehilim are those of any chain.
- **In the reader**, below the reservation of a Tehilim from the chain:
  « Vous lisez pour » ("You are reading for"), and the names in two groups,
  refoua chelema and leilouy nichmat (`PrayerNamesLine`).
- **When creating a session**, as soon as the Tehilim type is chosen, a
  discreet line also offers to entrust the name to it (`?proposer=1` opens
  the dialog on arrival). It does not promise any number of readers.

## Names

Proposing a name requires an account: that is what lets you come back to
extend, correct or remove it. Without an account, the invitation to sign in
(`SignupPromptModal`, `prayer_name` variant).

A name is composed the way it is said: « David ben Sarah », « Rivka bat
Léa »; man or woman decides the middle word. It carries the intention:
refoua chelema, or leilouy nichmat. Two ways of being read:

| Name                                      | Read                                                                            | Fields                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| Without a date (refoua, or deceased)      | 30 days, extendable in one gesture (« Prolonger », "Extend")                    | `expiresAt`                                 |
| Leilouy nichmat with the date of death    | Every year, the week before the Hebrew anniversary, up to the day itself       | `deathDay`, `deathMonth`, `expiresAt: null` |

The date is placed in the year by the calendar rules
(`services/hebrewOccasions`): a death in Adar comes back in Adar II in a
leap year, a 30 'Hechvan or Kislev comes back on the 29th in years when the
month has only 29 days. The window is the one the home page uses for
calendar dates (7 days, `ANNIVERSARY_WINDOW_DAYS`).

An expired name, or a deceased person outside their week, is no longer
read; its author finds it below the list (« Vos noms qui ne sont pas lus en
ce moment », "Your names not being read right now") to extend or remove it.
An account holds ten names at most (`MAX_NAMES_PER_OWNER`); a first name,
40 characters. The banned-terms filter applies, as it does to guest names.

### Without a network

Writing a name (adding, correcting, extending, removing it) requires the
server. Firestore's persistent cache only returns once the write is
confirmed: without a guard, the dialog stayed frozen, with no message, and
the write went out on its own when the network came back, hence a
duplicate if you had retried in the meantime. `prayerNameService`
therefore reuses the countermeasure from `userPreferencesService`
(`OfflineWriteError`):

- **device offline** (`navigator.onLine` false): nothing goes out, the
  dialog says so (`errors.prayerNameOffline`) and keeps what was typed. In
  practice, the chain page then gives way to « Connexion impossible »
  ("Unable to connect"); the guard covers the moment when the event has not
  arrived yet;
- **device that thinks it is online, server silent**: the dialog returns
  control after ten seconds (`SERVER_ACK_TIMEOUT_MS`) and says the request
  will go out on its own (`errors.prayerNamePending`). Firestore cannot
  cancel a write: it stays queued. An addition retried during this time
  picks up the in-flight write instead of starting a second one, and when
  it lands, the name joins the list like an ordinary addition. It is only
  announced once, even if retried before landing, and the dialog only
  closes when it lands if it is still showing that input.

## Data

The chain is an ordinary session, `sessions/chaine-perpetuelle` (its slug
is the same), created by `node scripts/admin.mjs chaine:creer`. On top of
the fields of any session:

| Field                   | Written by              | Role                                                    |
| ----------------------- | ----------------------- | ------------------------------------------------------- |
| `perpetual: true`       | `chaine:creer`          | What sets it apart.                                     |
| `slotCount`             | `chaine:creer`          | The slots in a round (150): what the function counts.   |
| `cycle`                 | creation, then function | The current round, starting at 1.                       |
| `completedCycles`       | function                | Rounds completed since opening.                         |
| `cycleStartedAt`        | creation, then function | Start of the current round.                             |
| `lastCycleStartedAt`    | function                | Start of the last completed round.                      |
| `lastCycleEndedAt`      | function                | Its end.                                                |
| `lastCycleParticipants` | function                | Its distinct readers (accounts and guests).             |

Names live in `sessions/chaine-perpetuelle/names/{id}`: `ownerId`,
`gender` (`male`, `female`), `firstName`, `motherName`, `kind` (`refoua`,
`leilouy`), `createdAt`, `updatedAt`, `expiresAt`, and for a dated
deceased person `deathDay` (1 to 30) and `deathMonth` (hebcal month, Adar
stored as `ADAR_I`).

### Firestore rules

- Names: public read; creation by an account, in its own name (`ownerId`),
  on a `perpetual` session only; update and deletion by their author,
  deletion also by the admin. The fields are closed and bounded
  (`validPrayerName`): either an expiry of 31 days at most, or a dated
  leilouy nichmat without expiry.
- Session: readers only write the reservations array there, as everywhere
  else. The `perpetual` flag, `slotCount` and the counter are reserved for
  `chaine:creer` and the Cloud Function (admin SDK): no account sets them
  when creating a session or changes them on its own
  (`perpetualFields`). Without this, any session carrying `perpetual`
  would take the chain's card on the home page and escape being hidden on
  the third report.

## The end of a round

`onPerpetualSessionUpdated` (`functions/src/perpetualChain.ts`) fires on
every session write and immediately exits for those that are not
perpetual. When every slot has a reservation marked read
(`isRoundComplete`, `functions/src/perpetualRound.ts`), it clears the
reservations and advances the counter (`nextRound`), in a transaction that
rereads the session: its own write, or a retry, never counts the same round
twice. Without a valid `slotCount`, the round never ends: better a chain
that does not restart than a chain emptied by mistake. Only the chain's
slots count: the catalog's Tehilim, from `PERPETUAL_FIRST_TEXT_ID` (103) to
102 + `slotCount`. The rules let anyone add reservations; a hundred and
fifty made-up identifiers, marked read, used to finish the round in two
writes. Tests: `perpetualChain.test.ts` (« ne compte que les places de la
chaîne », « suit le catalogue »).

The page that sees everything read says so (« Tour terminé ! », "Round
complete!"), then rereads the chain until it sees the next round
(`waitForNextRound`, `services/perpetualChain`): five attempts,
increasingly spaced out, about forty seconds in all
(`NEXT_ROUND_RETRY_DELAYS_MS`). The function usually responds within a
second, but a cold start can take several seconds: a single reload, five
seconds later, used to leave the page frozen without a draw card. The wait
is bounded, and stops when you leave the page.

The reader does the same. « Un autre Téhilim » ("Another Tehilim") draws
from the copy of the chain loaded when the text was opened; when it has no
free slot left, it rereads the chain before saying there is nothing left.
If the round there is entirely read (the reader has just read the last
Tehilim), it says so and waits for the next round in the same way, then
draws from that one.

## A reserved slot holds for one day

On an ordinary chain, the creator frees a slot that was reserved and then
forgotten. Nobody owns the perpetual chain: a single abandoned slot would
stop the round at 149 out of 150, for good. The same function therefore
gives an expiry to every unread reservation that does not have one
(`withHoldExpiry`, 24 hours, `PERPETUAL_HOLD_MS`). This is the expiry the
app already knows for the draw (`expiresAt`): once passed, the reservation
is ignored by every display and gives its slot to the next one, in
versions already installed as in this one, and whichever version made the
reservation. A draw keeps its time, which the app pushes back as long as
you are reading; a read slot no longer has an expiry. The chain page says
so in one line (`perpetual.holdNote`). An expiry further out than that day
(set by hand by a client), or one that cannot be read as a date, is brought
back to one day: otherwise it held the slot forever. Test: « ramène à un
jour une échéance plus lointaine, ou illisible ».

An expiry therefore no longer designates a draw, on this chain. When you
leave the reader without reading, it only gives back what it drew itself,
never a slot reserved by hand (`e2e/firebase/perpetualDraw.spec.ts`).

The rule counts one slot per text: it only holds for single-section texts,
which the 150 Tehilim are. `chaine:creer` refuses a catalog that would
change this fact.

## Read right away

On this chain, nothing is reserved for later: you pick your Tehilim and
read them right away (`readsRightAway`, `services/sessionBatchReading.ts`).
Reserving for later is what left slots waiting a day, and the round with
them.

- **The list says « Choisir »** ("Pick") instead of « Réserver », and the
  bar « Lire maintenant » ("Read now"). It takes the psalms and opens them
  at once on « Mes Téhilim » (`/share-reading/session/:slug/lecture`), the
  page where they are read one after the other and checked off. The guest
  form is gone: reading needs no name, a guest reads anonymously, as with
  the draw.
- **A picked psalm holds for an hour** (`READ_NOW_TTL_MS`, the draw's hour),
  not the day: its reservation carries `expiresAt` from the start, which
  the Cloud Function leaves as is (it only gives a day to a reservation
  without an expiry, and brings back a longer one). The reading page pushes
  that hour back while it is open (`needsRenewal`: unread, less than half
  an hour left), on a timer and when coming back to the page; a longer hold
  is never shortened. Leaving the page releases nothing on its own: the
  hour does it.
- The chain's line says so (`perpetual.holdNote`). The progress bar counts
  « En lecture » ("Being read") instead of « Réservés », and the draw card
  no longer speaks of a reservation.

Versions already installed still reserve as before: their reservations get
the day from the Cloud Function, and this version reads them like any
other. Tests: `src/__tests__/sessionBatchReading.test.ts` (« the perpetual
chain reads right away »), `e2e/firebase/perpetualChain.spec.ts` (« on n'y
réserve pas : les Téhilim choisis s'ouvrent aussitôt, même sans nom »).

## Compatibility

An app installed before this version reads the chain as an ordinary
Tehilim session: it shows it in the list, with its distant deadline
(January 1, 2100, `PERPETUAL_DATE_LIMIT`), and reserves in it as anywhere
else. Nothing it reads has disappeared; it ignores the new fields and the
names.

## Moderation

Names are public content written by users (App Store rule 1.2, see
`docs/moderation.md`): term filter on input, reporting through the chain's
« Signaler » ("Report") button (the details name the name; you can report
another one afterwards, and the creator, the team, is not blocked by it),
removal by the admin (`node scripts/admin.mjs chaine:noms`, then
`chaine:retirer-nom <id>`). The chain itself is not hidden automatically
on the third report: three accounts would be enough to remove it for
everyone, whereas a report there targets a name.

## What is enforced by a test

`src/__tests__/prayerNameOffline.test.ts`: a name is not written offline,
control returns when the server is silent, and a retried addition is only
written once. `src/__tests__/prayerNameLateLanding.test.ts`: the mounted
dialog, when an addition that was in flight lands.

`src/__tests__/perpetualChain.test.ts`: the form of a name (ben, bat),
when a name is read (expiry, anniversary week, crossing from one year to
the next), the order of the list, the counter, the end-of-round rule and
the reset, the expiry of a reserved slot, the bounded wait for the next
round (`waitForNextRound`), the document written by `chaine:creer`, and the
presence of the `perpetual.*` texts in all three languages.

`e2e/firebase/perpetualChain.spec.ts`, against the emulators: the card,
the names (an addition on a silent network only lands once), the end of a
round (the page and the reader wait for the next round when the function
is slow), and the Firestore rules (a name is only written in one's own
name and on the chain; the chain's flag and counter cannot be written from
an account).
