# Session moderation (App Store requirements)

For any app whose content is written by users (guideline 1.2), Apple requires
a complete moderation system. Reading-sharing sessions (title, description,
guest names) fall under it. Here is what is in place and how to use it.

## What the user sees

- **Banned-terms filter**: session titles and descriptions, usernames at
  sign-up and guest names are rejected if they contain a term from the list
  `src/datas/bannedWords.ts` (word-by-word comparison, insensitive to
  accents/case and to "leet" digits such as `m3rde`). To extend the list: add
  the word in lowercase without accents to that file.
- **« Signaler » ("Report") button** on a session's page (visible to everyone
  except the creator, guests included): reason + optional details. A device
  can report a session only once (stored locally), except for the perpetual
  chain (see below).
- **Blocking a creator** (checkbox in the report modal): their sessions
  disappear from the lists on this device; unblocking is possible from the
  session's page. Not offered on the perpetual chain.
- **Hidden session**: the public sees a « Session masquée » ("Hidden session")
  screen; the creator still sees their session, with an explanatory banner
  and a « Masquée » ("Hidden") badge in « Créées par moi » ("Created by me").

## Automatic hiding

The Cloud Function `onSessionReported` (`functions/src/moderation.ts`) fires
on every document created in `reports`:

1. it recounts the session's **open** reports, per distinct person (uid or
   local guest identifier);
2. it denormalizes that counter into `sessions.{id}.reportsCount`;
3. from **3 distinct reporters** on, it sets `hidden: true`
   (`hiddenReason: "reports"`), and the session disappears from the public
   app until the admin steps in.

## The perpetual chain

The names entrusted to the perpetual chain (`docs/chaine-perpetuelle.md`) are
public content: the banned-terms filter applies to the first name and to the
mother's name, and only an account can submit one. A reported name (through
the chain's « Signaler » button, whose reason names it) is removed from the
command line: `node scripts/admin.mjs chaine:noms`, then
`chaine:retirer-nom <id>`.

On the chain, reporting follows this nature (`moderationService`, held by
`src/__tests__/reportPerpetualChain.test.ts` and
`e2e/firebase/perpetualChain.spec.ts`):

- **one can report again** (`isReportLocked`): the chain receives names
  endlessly, and each report targets one of them; the button does not turn
  off after the first. The dialog says so, and its details field asks for the
  targeted name;
- **blocking the creator is not offered** (`canBlockCreator`): its creator is
  the team (`petite-jerusalem`), and the checkbox removed the whole chain
  from the device. A block set earlier no longer hides it
  (`isBlockedForViewer`), neither on its page nor on the sharing home page.
  To remove a name, the way is a report, then removal by the admin.

Ordinary sessions do not change: one report per device, the block checkbox,
hiding at the third reporter.

The chain is **not hidden automatically** at the third report
(`onSessionReported` skips it): three accounts would be enough to take it away
from everyone, whereas a report on it targets a single name. The
`reportsCount` counter rises as elsewhere, and `session:signalements` lists
it.

## Backoffice

`/admin/sessions` (the « Sessions » tab of the backoffice):

- list of all sessions, reported and hidden ones first, with filters
  (Toutes / Signalées / Masquées, i.e. All / Reported / Hidden) and search;
- details of the open reports (reason, details, date), resolvable one by
  one;
- **Masquer / Démasquer** (Hide / Unhide): unhiding also resolves the open
  reports and resets the counter to zero (otherwise the next report would
  hide the session again immediately);
- **Modifier** (Edit: fix a problematic title/description without hiding)
  and **Supprimer** (Delete: the session and its reports, re-read at the
  moment of deletion; otherwise a report that arrived after the page loaded
  was left orphaned, counted by the dashboard badge with no row to handle it;
  held by `src/__tests__/adminDeleteSessionReports.test.ts`).

## Security (Firestore rules)

- The creator cannot touch the moderation fields of their session
  (`hidden`, `hiddenAt`, `hiddenReason`, `reportsCount`): only the admin and
  the Cloud Function (admin SDK) can.
- A hidden session no longer accepts bookings, nor writes to the bookings it
  holds. Attaching guest bookings at sign-in therefore skips it, and a
  rejected session does not block the following ones (test:
  `guestMigrationHidden.test.ts`).
- `reports`: creation open to everyone but strictly bounded (enforced fields,
  reason from a closed list, existing target session, reporter identity
  consistent with authentication); reading and handling reserved to the
  admin.
- Social previews (`socialPreview`, `ogImage`) no longer serve hidden
  sessions.
- A slug taken over by another session does not give it the original's
  links: the rules cannot compare two documents, so it is the read
  (`firestoreService.getSessionBySlug`) that decides, in favor of the
  perpetual chain (its `perpetual` flag is reserved to the admin; an
  identifier, on the other hand, can be chosen), otherwise of the oldest one.
  The social preview follows the same rule (`functions/src/sessionSlug.ts`).
  Test: `sessionSlugCollision.test.ts`. A backdated copy still wins over an
  ordinary session: the creation date comes from the client, and only slug
  uniqueness rules would close that case.
- A session's fields are bounded by `validSessionFields` (title 300,
  description 5000, slug 200). The creation form and the edit dialog carry
  the same `maxlength`, and the slug is cut at the last whole word before 180
  characters (`truncateSlug`), which leaves room for a duplicate suffix. A
  long title used to be rejected with a generic message. Held by
  `src/__tests__/sessionLongTitle.test.ts`.

## Terms of use and contact

For user content, Apple also requires terms that the user accepts (with zero
tolerance stated for abusive content) and a published means of contact:

- **`/conditions-utilisation`** (fr/en/he, `src/content/seoPages.ts`):
  publishing rules, zero-tolerance clause, description of
  reporting/hiding/blocking, commitment to review reports within 24 h.
  Linked from the footer, and from the sign-in page
  (« En vous connectant ou en créant un compte, vous acceptez… », "By signing
  in or creating an account, you accept...").
- **Contact**: contact@phenixel.fr, published on the terms, the legal notice,
  the About page and the privacy policy.

## Sign in with Apple

« Se connecter avec Apple » ("Sign in with Apple") is in place (mandatory as
soon as a Google login is offered, guideline 4.8), shown on iOS only. Account
deletion (guideline 5.1.1(v)) handles recent re-authentication for all three
account types: password, Google and Apple.

Console prerequisites: enable the **Apple** provider in Firebase
Authentication, and the **Sign in with Apple** capability on the App ID in the
Apple Developer Portal.

## Deployment

The system touches three surfaces, Firestore rules (reports, moderation
fields), the Cloud Function `onSessionReported` and the web app, and **a
`vX.Y.Z` tag deploys all three**, with no manual step. That was not always
the case: for a long time the CI service account was only allowed to publish
the site, and the rules had to be pushed by hand after each change. The
permissions that unblocked it are recorded in
[docs/firebase-ci-cd.md](firebase-ci-cd.md).

To deploy one surface outside a release (urgent fix to a rule, iterating on
the function):

```bash
firebase deploy --only firestore:rules   # new rules (reports, moderation fields)
firebase deploy --only functions         # onSessionReported (auto hiding)
npm run build && firebase deploy --only hosting   # app (reporting UI, backoffice)
```
