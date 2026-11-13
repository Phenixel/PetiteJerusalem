# Nous écrire: messages and replies

The site and the app include a form (« Écrivez-nous », "Write to us") and a
page, « Nous écrire » ("Write to us", `/contact`), where everyone finds the
messages they have sent and the team's replies. On the team's side,
messages arrive in the backoffice (`/admin/messages`), where they are
sorted and answered; the reply shows up for the person, in the app or on
the site, with a notification when their phone allows it.

Until October 2026, each message became a row in the Notion database
« Formulaire de support »: you could only reply to those who had left an
email. Messages no longer go to Notion; the older ones remain there.

## Who can write, and read the replies

- **In the app, with or without an account.** On the first message, the
  app draws a random key (32 bytes) and keeps it on the phone (page storage
  and native preferences, in duplicate: losing the key means losing access
  to the replies). The device's messages are read back with it; the server
  only keeps its SHA-256 hash. When signed in, you also read those of the
  account.
- **On the site, with an account**, replies show up in the profile.
- **On the site without an account, you can also write**, but nothing links
  the message to the person: our reply cannot show up on their side. The
  dialog says so at the top, offers to sign in (keeping what was already
  written, a flagged text passage for example, reopened on the « Nous
  écrire » page on return: `stashFeedbackPrefill`, in `useFeedback.ts`),
  and reminds below the contact field that without an email or phone
  number, we will not be able to reply. The message still arrives in the
  backoffice, marked « Ni compte, ni appareil, ni contact » ("No account,
  no device, no contact") if it left nothing. The « Nous écrire » page
  remains reserved for accounts on the site.
- **App versions from before threads** keep sending without a key: their
  message arrives in the backoffice, but only an email reply can reach the
  person (if they left a contact).

## What goes with a message

What the person writes:

- what it is about: a new idea, a bug, an error (in a text, a time, a
  translation) or something else, with a free-text field in that last
  case;
- details (required);
- an email or a phone number, only if they check « Me répondre aussi par
  email ou par téléphone » ("Also reply to me by email or phone").

What the app attaches on its own, and announces below the form:

- the medium: website or app;
- the platform: web, iOS or Android;
- the version: that of the installed binary in the app (« 1.4.2 (37) »,
  version and build), that of the bundle on the site;
- the language, which is that of the reply notification;
- the page the message was sent from (`/lire/tehilim`), useful for a bug;
- in the app, the device key, and its notification token if it already has
  permission (it is never requested here).

The signed-in account is recognized by the Cloud Function (its ID, its name
and its email, so as to be able to write to it).

## Where the form opens

- the « Nous écrire » page (`/contact`), « Nouveau message » ("New
  message") button; you reach it from the profile (« Nous écrire » row in
  the app, profile shortcut on the site);
- on the site, the « Nous écrire » link in the footer;
- at the bottom of the home page, site and app, a discreet line below the
  dedication;
- from a text passage (« Signaler une erreur », "Report an error"), already
  prefilled;
- the « Répondre » ("Reply") button of a question-type information item.

A single dialog (`src/components/FeedbackModal.vue`), mounted in App.vue on
first opening; `useFeedback.ts` holds the shared state that opens it.

## A thread, and its statuses

Each message opens a thread, a `support/{id}` document in Firestore:

| Field                                | Content                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `kind`, `otherKind`                  | the kind (`idea`, `bug`, `error`, `other`) and the free-text detail             |
| `messages`                           | `{ from: "user" \| "team", text, at }`, the first one is the original message   |
| `status`                             | `new`, `in_progress`, `answered` or `done` (below)                              |
| `note`                               | the team's note, never shown to the person                                      |
| `contact`                            | the email or phone number left, empty otherwise                                 |
| `support`, `platform`, `version`     | what the app attached                                                           |
| `locale`, `page`                     | the language and the page the message was sent from                             |
| `uid`, `accountEmail`, `accountName` | the signed-in account, `null` without an account                                |
| `guestKeyHash`                       | the hash of the device key, `null` on the site                                  |
| `pushTokens`                         | the device's notification tokens (five at most)                                 |
| `lastFrom`, `unreadByUser`           | who wrote last; a reply the person has not read yet                             |
| `createdAt`, `updatedAt`             | arrival, and the last message                                                   |

The statuses mirror the columns of the Notion database:

- **À traiter** ("To do", `new`): a message that arrived, or a follow-up
  from the person;
- **En cours** ("In progress", `in_progress`): the team is handling it; a
  follow-up leaves it there;
- **Répondu** ("Answered", `answered`): set by the team's reply;
- **Terminé** ("Done", `done`): set by hand, or by « Répondre et terminer »
  ("Reply and close").

A follow-up from the person puts the thread back to "to do" (unless it is
in progress); a thread holds 60 messages at most, beyond which the person
opens another one.

## The unread replies badge

In the app, a team reply not yet read is counted as a badge on the profile
tab of the bottom bar (`BottomTabBar.vue`), and on the « Nous écrire » row
of the profile. The count is shared (`composables/useSupportUnread.ts`):
reread when an account arrives and each time the app comes back to the
foreground, only if an account is signed in or the device has already
written (otherwise, no call to the server); opening the thread lowers it
right away. On the site, the profile's « Nous écrire » shortcut carries the
same count.

## The backoffice

`/admin/messages` lists the threads: by default what is not done (to do
first, then in progress, most recent first), with a filter by status, one
by kind, and a search across texts, contacts and versions. A « Relance »
("Follow-up") badge marks a thread where the person wrote after the first
time. The menu tab shows the number of messages to do, and the dashboard
recalls them under « À traiter ».

A thread's page (`/admin/messages/:id`) shows the conversation, the reply
to write, and alongside it the status, the kind (an « Autre » ("Other")
that was a bug can be reclassified), what the app attached (the page opens
in one click) and the team's note. Below the reply, a line says where it
will arrive: in the app with a notification, in the app without a
notification, by email only, or nowhere. « Répondre par email » ("Reply by
email") opens the mail client, with the reply in progress already written
and the message quoted, to the contact left or the account's email.

The same work can be done from the command line: `support:liste`,
`support:voir`, `support:repondre`, `support:statut` (see
`docs/backoffice-cli.md`).

## The path of a message, and of a reply

1. `src/services/feedbackService.ts` completes the message (medium,
   platform, version, language, page, device key and token), then calls
   the `submitFeedback` callable.
2. `functions/src/feedback.ts` validates (`functions/src/support.ts`),
   rate-limits submissions per IP address (ten per ten minutes) and creates
   the thread.
3. The « Nous écrire » page rereads the threads through
   `listSupportThreads` (the account, and the device key) and shows them as
   cards, without marking anything read. A card opens the thread page
   (`/contact/:id`, `SupportThreadPage.vue`), a messaging view: the header
   (back, subject, kind and state, « Détails » ("Details")), the thread,
   and the compose bar pinned at the bottom, full screen in the app. Below
   the last message, a line says where things stand (« Bien reçu, nous
   vous répondrons ici », « Nous vous avons répondu »…). « Détails » shows
   what the person sent (kind, date, from what, page concerned, contact
   left or « aucun ») and how the reply reaches them (notification in the
   app, profile badge on the site).
   Opening it marks that thread read (`markRead` carries its ID). A
   follow-up goes through `replySupportThread`, which checks that the
   thread does belong to the caller.
4. The team replies from the backoffice (direct write, restricted to the
   admin by the rules) or the CLI. The `onSupportThreadWritten` Cloud
   Function sees the added reply and sends a notification to the thread's
   devices and to those of the account (`userPreferences/{uid}.fcmTokens`),
   in the thread's language; tapping it opens the thread page. A change of
   status or note sends nothing.

The Firestore rules close `support` to everyone except the admin: the
person only reads their threads through the callables, which withhold the
team's note, the hashes and the tokens. Deleting one's account erases
one's threads (`forgetSupportThreads`, called by
`authService.deleteAccount`).

What the tests enforce (`src/__tests__/support.test.ts`): a submission from
a version predating threads is still accepted; a thread can only be read
back by its account or its device key, without the note; only a team reply
triggers a notification; the backoffice ordering puts what is waiting for
the team first.

## Setup

Nothing to configure outside the repository: no key, no secret. Just
deploy the rules and the functions:

```bash
firebase deploy --only firestore:rules,functions:submitFeedback,functions:listSupportThreads,functions:replySupportThread,functions:forgetSupportThreads,functions:onSupportThreadWritten --project petite-jerusalem-dev
```

Reply notifications have the same prerequisites as reading reminders (APNs
key, see `docs/app-native.md`). The `NOTION_API_KEY` secret is no longer
used; it can be deleted from Cloud Functions once the deployment is done.

## The « Tout se passe bien ? » nudge

The site also asks the question on its own, to those who have used the app
a bit: a small card at the bottom of the home page, with two answers,
« Tout va bien » ("All good") and « J'ai quelque chose à dire » ("I have
something to say", which opens the form).

- "Used a bit": the app was opened on three distinct days. The days are
  recorded on the device at startup (`recordUsageDay`, in App.vue).
- On the home page only, so never during a reading, and only when nothing
  else demands attention: no introduction, no open dialog, consent already
  chosen, no chiour currently playing. It waits four seconds after arriving
  on the home page.
- It goes quiet for good as soon as it is answered. Without an answer, it
  comes back one week later at the earliest, three times at most.

The rule and its memory are in `src/services/feedbackNudge.ts` (tested in
`src/__tests__/feedbackNudge.test.ts`), the card in
`src/components/FeedbackNudge.vue`.
