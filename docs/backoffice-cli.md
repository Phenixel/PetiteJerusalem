# The command-line backoffice

`scripts/admin.mjs` does what the `/admin` pages do, without the interface:
publish an information item, close an incident, add or publish a chiour,
create an author and their studio link, moderate a session, reply to a
user's message. It writes exactly
what the interface would write (same fields, same refusals), and serves three
purposes:

- **Claude**, when asked "add an information item for the release", "publish
  Rav X's chiourim", "close the incident";
- **the CI**, which turns each release note into an information item
  (`.github/workflows/release-info.yml`);
- **by hand**, from a terminal.

```bash
node scripts/admin.mjs aide
```

(or `npm run admin -- aide`)

## The safeguards

- **Nothing is written without `--confirmer`.** Without it, a command that
  writes describes what it would do (« [essai, production] Créer
  l'information… ») and stops. Read the dry run, then run it again with
  `--confirmer`.
- **A notification is only sent with `--notifier`.** Never by default, nor
  from the CI. The dry run spells it out: « UNE NOTIFICATION PARTIRA vers
  tous les appareils abonnés » ("A NOTIFICATION WILL BE SENT to all
  subscribed devices"). It is sent only once, at the moment the information
  item becomes published with the box checked (the Cloud Function
  `onAnnouncementWritten`).
- **The target is production** (`petite-jerusalem-dev`, which hosts the
  public site despite its name). `--emulateur` targets the emulators of
  `npm run dev:local`; careful, even there, `--notifier` would send a real
  notification (FCM is not emulated).
- Each written document records who wrote it: `updatedVia`
  (`cli (utilisateur@machine)` or `ci (…)`).

## Access

The script goes through the Firebase admin SDK (the one from functions: run
`npm ci --prefix functions` if it is missing), with Google's Application
Default Credentials (ADC). It is therefore not subject to the Firestore
rules: the account is what counts.

- **Locally**, once (the token eventually expires, the script says so):

  ```bash
  gcloud auth application-default login
  ```

  and pick **admin@phenixel.fr** in the browser. The machine's gcloud has
  another default account, without access to the project: it is indeed the
  ADC that needs renewing, not `gcloud auth login`.

- **In CI**, the `FIREBASE_SERVICE_ACCOUNT` service account set up by
  `google-github-actions/auth`. It needs `roles/datastore.user` to write to
  Firestore (see `docs/firebase-ci-cd.md`).

### In a Claude Code cloud session

A cloud session (claude.ai/code) runs on a remote machine, without the
workstation's gcloud: it authenticates with a **service account key**,
passed in the `PJ_ADMIN_SERVICE_ACCOUNT` variable (the key's JSON, as is or
base64-encoded). The default network of cloud environments ("Trusted")
already allows `*.googleapis.com`: nothing to open.

Setup, once, by the project owner:

1. A dedicated service account, with rights limited to what the script does
   (Firestore documents, bucket files; no rules, no functions, no IAM):

   ```bash
   gcloud iam service-accounts create claude-backoffice --project petite-jerusalem-dev --account=admin@phenixel.fr --display-name "Backoffice (sessions cloud de Claude)"
   gcloud projects add-iam-policy-binding petite-jerusalem-dev --account=admin@phenixel.fr --member="serviceAccount:claude-backoffice@petite-jerusalem-dev.iam.gserviceaccount.com" --role="roles/datastore.user"
   gcloud storage buckets add-iam-policy-binding gs://petite-jerusalem-dev.firebasestorage.app --account=admin@phenixel.fr --member="serviceAccount:claude-backoffice@petite-jerusalem-dev.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"
   gcloud iam service-accounts keys create ~/claude-backoffice.json --iam-account claude-backoffice@petite-jerusalem-dev.iam.gserviceaccount.com --account=admin@phenixel.fr
   base64 -i ~/claude-backoffice.json | tr -d '\n' | pbcopy
   ```

   `--account=admin@phenixel.fr`: the workstation's gcloud has another
   default account, without access to the project (it would ask for its
   password). If admin@phenixel.fr is not in `gcloud auth list`, run
   `gcloud auth login admin@phenixel.fr` first.

   Done on 2026-09-29: the `claude-backoffice` account exists, with these two
   roles. For a new key, only the last command needs to be run again.

2. In claude.ai/code, in the repository's environment settings, **environment
   variables**: a line `PJ_ADMIN_SERVICE_ACCOUNT=` followed by what was just
   copied. Then delete `~/claude-backoffice.json` from the workstation.

3. Optional, in the environment's **setup script**, so as not to wait for
   the installation in every session and to measure the duration of audio
   files:

   ```bash
   npm ci --prefix functions
   apt-get install -y ffmpeg
   ```

   Without it, the session runs `npm ci --prefix functions` when the script
   asks for it, and `chiour:ajouter` requires `--duree <secondes>`.

Good to know:

- the variable is readable by anyone who uses this cloud environment: it
  grants write access to the production Firestore and bucket. To cut it off
  at any time:
  `gcloud iam service-accounts keys list --iam-account claude-backoffice@petite-jerusalem-dev.iam.gserviceaccount.com`,
  then `gcloud iam service-accounts keys delete <id> --iam-account …`;
- the safeguards do not change (`--confirmer`, `--notifier`);
- a cloud session does not have `gh`: `info:depuis-release --tag` reads the
  release there through GitHub's public API (the repository is public), with
  `curl`, which goes through the session's network relay, with nothing to
  configure (Node's `fetch` would ignore it and run into GitHub's anonymous
  quota for a shared address). It can, however, neither create a release nor
  push a tag (its `git push` only targets its working branch): versions are
  published from the workstation.

## The commands

All of them accept `--confirmer`, `--emulateur` and `--json` (output readable
by a script, for example to find an identifier).

### Status

| Command | What it does                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `etat`  | What « À traiter » ("To do") shows in the backoffice: chiourim to review, without an author, reported sessions, ongoing incident, drafts, authors without a studio link, messages to handle. |

### Information items (`announcements` collection, see `docs/informations.md`)

| Command               | What it does                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `info:liste`          | All information items, drafts included, most recent first, with their identifier.                                                          |
| `info:voir <id>`      | One information item in full.                                                                                                              |
| `info:creer`          | New information item (options below). Draft unless `--publier`.                                                                            |
| `info:modifier <id>`  | Changes what is passed as an option, keeps the rest. `--publier` / `--depublier`, `--resolu` / `--en-cours`.                               |
| `info:resoudre <id>`  | Closes an incident: it leaves the home page.                                                                                               |
| `info:resultats <id>` | The answers to a poll: the number of devices per choice, and in total.                                                                     |
| `info:supprimer <id>` | Deletes permanently, along with its poll's images.                                                                                         |
| `info:depuis-release` | A tag's release note as a « Mise à jour » ("Update") information item (`--tag vX.Y.Z`, or `--version X.Y.Z --fichier note.md`). See below. |

Options of an information item:

- `--type`: `nouveaute`, `mise-a-jour`, `incident` or `question`;
- `--titre`, `--texte` (or `--texte-fichier note.md`, `-` for standard
  input): the French, required;
- `--titre-en`, `--texte-en`, `--titre-he`, `--texte-he`: the translations,
  optional (without them, these readers see the French);
- `--lien /page` or `--lien https://…`, `--lien-texte`: the button;
- `--version X.Y.Z`: for an update, the version described (the app only
  announces it once that version is installed);
- `--corrige-dans X.Y.Z`: for an incident, the version that fixes it
  (devices that have it no longer see it on the home page, the others see it
  until they update);
- `--choix "Libellé"`, once per choice (from 2 to 8): a question becomes a
  poll. An image is given after a bar, an https address or a local file
  (uploaded to Storage): `--choix "Bleu|bleu.jpg"`. `--choix-en` and
  `--choix-he`, in the same order, translate the labels.
  `--choix-multiples` (or `--choix-unique`) allows checking several
  choices; `--sondage-clos` (or `--sondage-ouvert`) stops the voting;
  `--sans-sondage` removes the poll. With `info:modifier`, `--choix` options
  replace the whole list; a choice whose French label does not change keeps
  its votes, its image and its translations. `--choix-en` or `--choix-he`
  alone translate the existing choices, in order;
- `--publier`, `--notifier`;
- `--date AAAA-MM-JJ` (or an ISO date): the publication date, instead of
  now, to backfill a history. Refused in the future, and never with
  `--notifier`: a history is not notified. Also applies to
  `info:depuis-release`.

The text follows the repository's typography: no long dash, and French
non-breaking spaces (U+202F before ! ? ;, U+00A0 before : and inside « »).

### Chiourim

| Command                    | What it does                                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chiour:liste`             | `--filtre brouillons\|publies\|sans-auteur\|sans-serie\|sans-livre`, `--auteur <id>`, `--recherche …`. The first word of each line is the slug.                                                                                                                                            |
| `chiour:voir <slug>`       | One chiour in full (series, categories, audio).                                                                                                                                                                                                                                            |
| `chiour:publier <slug>…`   | Publishes one or more chiourim (authors' uploads arrive as drafts).                                                                                                                                                                                                                        |
| `chiour:depublier <slug>…` | Removes them from the app.                                                                                                                                                                                                                                                                 |
| `chiour:modifier <slug>`   | `--titre`, `--description`, `--auteur <id>`, `--serie <id>` or `--sans-serie`, `--episode N`, `--categories a,b`, `--niveau`, `--livre <id>` (or `aucun`), `--chapitre N` (or `aucun`), `--publier` / `--depublier`.                                                                       |
| `chiour:ajouter <fichier>` | Adds a chiour with its audio (mp3, m4a, wav, ogg, aac), like an author's studio: `--titre`, `--auteur <id>` required; `--description`, `--categories`, `--serie`, `--episode`, `--niveau`, `--publier`. Duration measured by `ffprobe` if it is installed, otherwise `--duree <secondes>`. |

### The book of a chiour

A class can state the library book it studies, and its chapter: it is then
shown next to the text, and the text next to the class (see
`src/services/chiourTexte.ts`). The book is named by its identifier in
`src/datas/textStudies.json`, which `livre:liste` looks up:

| Command                     | What it does                                                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `livre:liste --recherche …` | The books whose name contains the term, whatever its spelling (accents, apostrophes and spaces ignored; "Vayetse" finds Vayetze, "Chaar Habitahon" finds Chaar Habita'hon), with their identifier and their book. |

Then `--livre <id>` and `--chapitre N` on `chiour:modifier` or
`chiour:ajouter`. The chapter is counted the way the library counts it:

- a text over several pages: its page number (the chapter of a tractate; 0
  for the introduction of a gate of 'Hovot Halévavot, then the chapter
  number; the topic number of the Pélé Yoets across the whole book);
- a single-page text: the rank of the block (the chapter of a book of the
  Prophets, the aliyah of a paracha);
- a psalm or a tefila: no chapter.

Changing the book forgets the old one's chapter; `--livre aucun` removes
both.

### Authors and series

| Command                        | What it does                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `auteur:liste`                 | The authors, their published and draft chiourim, whether they have an active studio link. |
| `auteur:voir <id>`             | An author and their series (identifiers to pass to `--serie`).                            |
| `auteur:creer "Nom"`           | Creates the author and their studio link, displayed only once: pass it on to the author.  |
| `auteur:lien <id>`             | New studio link; the old one stops working.                                               |
| `serie:creer <auteurId> "Nom"` | Creates a series for this author.                                                         |

### Sessions (moderation)

| Command                  | What it does                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `session:signalements`   | The reported sessions and the reason for each open report.                          |
| `session:masquer <id>`   | Removes a session from public view.                                                 |
| `session:demasquer <id>` | Makes it public again and resolves its open reports (the counter starts from zero). |

### Nous écrire ("Write to us") (`support` collection, see `docs/feedback.md`)

| Command                        | What it does                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `support:liste`                | The messages, what awaits the team first. `--filtre ouverts` (default), `a-traiter`, `en-cours`, `repondus`, `termines` or `tous`. |
| `support:voir <id>`            | One message in full: who, from what, the team's note, and each message in the thread.                                              |
| `support:repondre <id>`        | Adds the reply (`--texte` or `--texte-fichier`); the thread becomes "replied", or "closed" with `--clore`.                         |
| `support:statut <id> <statut>` | `a-traiter`, `en-cours`, `repondu` or `termine`.                                                                                   |

A reply shows up in the person's app or on the site, and the Cloud Function
`onSupportThreadWritten` alerts their devices: a notification to them alone,
not a broadcast, hence the absence of `--notifier`. The dry run (without
`--confirmer`) says where the reply will arrive; a message sent without an
account from a version predating threads can only receive an email.

### Perpetual chain (see `docs/chaine-perpetuelle.md`)

| Command                   | What it does                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `chaine:creer`            | Creates the perpetual Tehilim chain (`sessions/chaine-perpetuelle`), only once; refuses if it already exists.         |
| `chaine:noms`             | Its round, its completed rounds, and each name with its identifier, its intention, its deadline or date, its account. |
| `chaine:retirer-nom <id>` | Removes a name (reported, or at its author's request).                                                                |

## Release notes, automatically

When a `vX.Y.Z` release is published on GitHub (or its text corrected),
`.github/workflows/release-info.yml` runs:

```bash
node scripts/admin.mjs info:depuis-release --tag vX.Y.Z --confirmer
```

The release text (the same as the stores', three sections, see
`docs/notes-de-version.md`) becomes the `release-vX.Y.Z` information item,
published, **without a notification**, titled « Version X.Y.Z : les
nouveautés » ("Version X.Y.Z: what's new") in each language present. A
corrected release updates the information item without changing its date. A
release without text does not create one. To catch it up by hand: Actions
tab, « Information de version », with the tag; or the same command from a
terminal.

The history of the 3.x versions was backfilled this way on 2026-09-29, each
note at its release date (`info:depuis-release --tag vX.Y.Z --date …`),
skipping releases without text, those that repeated a previous version's
text, and the « Correction de bugs mineurs. » ("Minor bug fixes.") ones.

To also notify about a version (rarely: the app already announces the note
once the version is installed):

```bash
node scripts/admin.mjs info:modifier release-vX.Y.Z --notifier --confirmer
```

## Examples

```bash
# Announce a new feature, with a button to the page
node scripts/admin.mjs info:creer --type nouveaute \
  --titre "Les Hochanot sont dans le sidour" \
  --texte "Tout Souccot, les Hochanot du jour s'affichent dans l'office du matin." \
  --lien /bibliotheque/sidour --lien-texte "Ouvrir le sidour" --publier
# … read the dry run, then run again with --confirmer

# Warn about an incident, then close it
node scripts/admin.mjs info:creer --type incident --titre "…" --texte "…" --publier --confirmer
node scripts/admin.mjs info:liste
node scripts/admin.mjs info:resoudre <id> --confirmer

# Review then publish the authors' uploads
node scripts/admin.mjs chiour:liste --filtre brouillons
node scripts/admin.mjs chiour:publier <slug> <slug> --confirmer

# Add a recorded class
node scripts/admin.mjs auteur:voir <auteurId>
node scripts/admin.mjs chiour:ajouter ~/cours.mp3 --titre "…" --auteur <auteurId> \
  --serie <serieId> --episode 4 --categories "Michna" --confirmer

# Attach a class to chapter 4 of the Chaar Habita'hon
node scripts/admin.mjs livre:liste --recherche bitahon
node scripts/admin.mjs chiour:modifier <slug> --livre 404 --chapitre 4 --confirmer
```

## Evolving the script

The pure part (validation, formatting, release notes) lives in
`scripts/lib/backoffice.mjs`, covered by `src/__tests__/backofficeCli.test.ts`.
A rule changed in the backoffice (an information item field, the studio
upload in `functions/src/studio.ts`) must be carried over here, otherwise the
two paths would write different documents.
