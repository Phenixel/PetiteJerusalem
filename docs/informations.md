# Team information

A way to talk to users without publishing an update: a new feature, a
version's release notes, an ongoing incident, a question or a poll.
Everything is written from the backoffice and shows up right away in the
app and on the site.

Each kind has its own purpose, and therefore its own way of leaving the
home page:

| Kind                              | Why                                                       | Leaves the home page                                                                  |
| --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Mise à jour ("Update")            | tell those who have just updated what changed             | once read                                                                             |
| Incident                          | warn about a problem before the fix arrives               | when it is marked resolved, or on a device that has the version that fixes it         |
| Question                          | ask users for their opinion, with a poll if needed        | once read, after a week; a poll, once answered or closed (one month at most)          |
| Nouveauté ("New feature")         | introduce a feature                                       | once read, after a week                                                               |

In every case, the information item stays in the list (`/informations`).

## Publishing

1. Sign in with the admin account, open **Backoffice → Informations**
   (`/admin/informations`), then **Nouvelle information** ("New
   information").
2. Choose the kind:
   - **Nouveauté**: a feature to discover;
   - **Mise à jour**: a version's release notes, with its number
     (`3.11.0`);
   - **Incident**: a known problem, which stays at the top of the home
     page as long as it is not marked « résolu » ("resolved"). If it is
     solved by an update, enter the version that fixes it (« Corrigé dans
     la version », "Fixed in version", `3.11.1`, always in the form
     X.Y.Z): devices that have it no longer see it, those that do not see
     it until they update. As long as the app has not read its own
     version, it keeps the incident as ongoing;
   - **Question**: the announcement ends with a « Répondre » ("Reply")
     button, which opens the support form already prefilled; the answer
     arrives in the backoffice messages (`/admin/messages`), like the
     others. **Ajouter un sondage** ("Add a poll") turns it into a choice
     to check (see "Polls" below).
3. Write the title and the text in French. English and Hebrew are
   optional: without a translation, those readers see the French.
4. A link, optional: an app page (`/bibliotheque/sidour`) or an external
   address (`https://…`), with the button text. An information item is
   read by all installed versions: the link targets an address the oldest
   ones know. `/bibliotheque/sidour` opens the Sidour everywhere (recent
   versions redirect it to `/sidour`); `/sidour` alone leads to a
   page-not-found in an app that is not yet up to date.
5. Check **Publié** ("Published"), and **Envoyer une notification** ("Send
   a notification") if one should go out. A confirmation reminds you: a
   sent notification cannot be taken back.

Correcting a published announcement does not resend it and does not bump
it up: its publication date is set at first publication. To close an
incident, reopen the announcement, check « Incident résolu » ("Incident
resolved"), save.

## Without the interface

Everything above can also be done from the command line, by Claude, by the
CI or by hand: `node scripts/admin.mjs info:creer …` (see
`docs/backoffice-cli.md`). Release notes automatically become a « Mise à
jour » information item when the GitHub release is published.

## What users see

- **The Informations page** (`/informations`), from most recent to oldest,
  with a « Nouveau » ("New") badge on what was published since the last
  visit. You reach it from the site footer and the « À propos » ("About")
  tab of the profile in the app; the home page now only leads there
  through its card, when there is something.
- **A card on the home page**, only when there is something:
  - an announcement not yet read shows there **as a preview** (its kind,
    the title and the start of the text, « Lire la suite » ("Read more")),
    for one month at most;
  - once read, a new feature or a question stays **for a week as a single
    line**; a release note, on the other hand, leaves the home page;
  - an ongoing incident takes precedence over everything and stays until
    it is marked resolved; once read, it shrinks to a single line and lets
    the latest unread new feature show as a preview below it. Once
    resolved, it does not come back to the home page, even if never read;
  - an incident that carries the version of its fix only shows where that
    version is missing: once the update is done, it leaves the home page
    and is no longer « Nouveau », read or not. In the list, it reads
    « Résolu », with « Corrigé dans la version… ». The site, always at the
    latest version, never highlights it;
  - an open poll stays as a single line once read, as long as the device
    has not answered it (« Sondage : votre avis compte », "Poll: your
    opinion matters"), for one month at most. Once answered or closed, it
    leaves the home page.
- **A notification** in the app, which opens the announcement.

"Already seen" is remembered on the device (`pj_announcements_seen`),
without an account. On the very first launch, only announcements from the
last fourteen days count as new.

A version's release notes are only announced on the app's home page once
that version is installed: published during store review, they would
describe what the app does not do yet. They remain visible in the list,
without a « Nouveau » badge as long as the version is not there. A note
seen in the list before installation becomes new again once the version is
installed: the device remembers the version of its last visit
(`pj_announcements_seen_version`), and a note for a more recent version,
now installed, is new whatever its date. Opened on its own (from the home
page or a notification) with its version installed, it moves this marker
up to its version: it is read, without waiting for a visit to the list.
Tests: `announcements.test.ts` (« une note de version vue avant son
installation ») and `announcementsSeenVersion.test.ts`.

Tests: `announcements.test.ts` (« un incident corrigé par une version »,
« une note de version lue », « un sondage sur l'accueil »).

## Polls

A question can carry a poll: from two to eight choices, each with its
label (French required, English and Hebrew optional) and, if needed, an
image. A single choice to check, or several (« Plusieurs choix permis »,
"Multiple choices allowed"). « Sondage clos » ("Poll closed") stops voting:
the choices remain readable, with the device's choice marked.

- **Without an account.** Each device votes under an identifier drawn at
  random and kept on the device (`pj_poll_voter`); its answers are also
  remembered there (`pj_poll_votes`). A new vote replaces the previous one.
  Nothing identifies the person. The downside: anyone who clears their
  storage, or votes from the app and then from the site, counts twice. It
  is an opinion poll, not an election.
- **The answers** can be read in the backoffice, below the information
  item's preview, or through `node scripts/admin.mjs info:resultats <id>`.
  They are not shown to users.
- **Do not change the meaning of a choice** that has already received
  answers: votes designate the choice by its identifier, they stay
  attached to it. Fixing a typo, yes; replacing « Bleu » with « Vert », no
  (remove the choice and add another one).
- **Images** go into Storage, under `announcements/{id}/`, 5 MB at most.
  The whole folder goes away with the information item, replaced images
  included; until then, a replaced image stays online. An image uploaded
  for an information item that was never saved also stays.

## Versions already installed

An information item is read by all app versions that know about them
(since 3.10.9), each with its own code. What is added here is added under
fields that published versions ignore without displaying anything wrong:

| Addition                       | Version that knows it          | Older version                                                                          |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------- |
| Release note read              | the one that brings this rule  | keeps it for a week as a single line                                                   |
| `fixedIn` of an incident       | the one that brings this rule  | shows the incident until « résolu »                                                    |
| `poll` of a question           | the one that brings this rule  | reads the question, with « Répondre » and a « Voter » ("Vote") button to the site      |

Two consequences:

- **An incident fixed by a version** works everywhere as soon as that
  version is later than the one that brings the rule: older devices do not
  have it, they must see the incident, and they do. For a fix already
  published before it (the tahanoun, fixed in 3.10.11), up-to-date devices
  would still see it: mark it resolved.
- **A poll** receives, if its link is empty, a « Voter » button to
  `https://petite-jerusalem.fr/sondage/{id}` (`pollPageUrl`). This address
  is outside the app links (`BROWSER_ONLY_PATHS`,
  `scripts/lib/app-links.mjs`): it opens in the browser, where the site is
  always at the latest version. Under `/informations`, it would have
  reopened the app itself, on a page without the choices. Versions that
  know about polls do not show this button (`visibleLink`). A link chosen
  by hand is kept: old versions will then not be able to vote. Tests:
  `announcements.test.ts` (« le lien de la page de vote »),
  `appLinks.test.ts`.

## How it works

| Piece                      | Where                                                      |
| -------------------------- | ---------------------------------------------------------- |
| Data                       | Firestore, `announcements` collection                      |
| Votes                      | `announcements/{id}/votes/{appareil}`                      |
| Choice images              | Storage, `announcements/{id}/`                             |
| Rules                      | public read of published announcements, admin write        |
| Index                      | `published` + `publishedAt` (`firestore.indexes.json`)     |
| Sending notifications      | `functions/src/announcements.ts` (`onAnnouncementWritten`) |
| App subscription           | `src/services/announcementTopics.ts`                       |
| Logic (new, home page)     | `src/services/announcements.ts`, tested                    |
| Vote                       | `AnnouncementPoll.vue`, `useAnnouncements.answerPoll`      |

Notifications go through **FCM channels** (topics), one per language:
`announcements-fr`, `announcements-en`, `announcements-he`. The app
subscribes to the one for its language at each launch and at each language
change; the function publishes one message per channel. No token to store,
no account required. The function sets `notifiedAt` in a transaction
before sending: an announcement only goes out once, even if the trigger is
replayed.

Everyone is subscribed by default; the « Informations de l'équipe » ("Team
information") toggle in the profile's Notifications tab cuts the
subscription. The system displays nothing without notification
permission, which is only requested on a user gesture: the toggle, or the
« Me prévenir » ("Notify me") button on the Informations page.

The rules for a vote (`firestore.rules`): the poll is published and open,
the choices are its own (`poll.optionIds`, set at save time by the
backoffice and the CLI, `pollToStore`), a single one unless the poll is
multiple-choice, and the time is the server's. Nobody reads the votes back,
except the admin who counts them.

The vote goes through Firestore Lite, in the app too: the full SDK queues
an offline write and only returns once the server acknowledges it. Lite
fails immediately, and the screen says so.

## Good to know

- **One app version is needed, once**, for devices to subscribe to the
  channels. Before it, announcements can be read in the app (the page and
  the banner come with the same code), but no notification arrives.
- **Emulators**: FCM is not emulated. An announcement published with the
  notification checked in `npm run dev:local` would trigger a real send
  from the functions emulator: test with the box unchecked.
- The website does not receive notifications; it has the page and the
  banner.
