# Petite Jérusalem

Repository conventions, to follow in everything written here: code, comments,
interface strings, content, documentation, commit messages and pull requests.

## Language

The repository is written in **English**: README, documentation, code
comments, commit messages, pull request titles and descriptions.

- New comments and documentation are in English. Some older comments and
  identifiers are still in French: when you edit a passage, translate the
  French comments you touch; do not rewrite unrelated files just to
  translate them (it pollutes the diff).
- Code identifiers follow the file they live in: English for technical
  names, the transliterated Hebrew or French of the liturgical domain where
  the file already uses it (`chiour`, `paracha`, `parcours`...). Do not
  rename an existing identifier, Firestore field, i18n key, route or CLI
  flag (`--confirmer`, `--emulateur`) only to translate it: published apps
  and scripts still read them.
- The product itself stays trilingual: the interface (`src/locales/`), the
  release notes and team announcements are written in French, English and
  Hebrew.
- Doc file names are kept as they are (`docs/notes-de-version.md`,
  `docs/chaine-perpetuelle.md`...): links, workflows and scripts point to
  them.

## Commits

### Message format: Conventional Commits

Every commit message (and every pull request title) follows
[Conventional Commits](https://www.conventionalcommits.org/), in English:

```
<type>(<scope>): <short summary in the imperative, lower case, no period>

<optional body: what changes and why, wrapped at 72 columns>
```

Examples: `feat(library): add halakha books as cards`,
`fix(sharing): keep the reservation when the session link is reopened`,
`docs(readme): explain the project with screenshots`.

| Type | When |
| --- | --- |
| `feat` | A new feature or visible behavior. |
| `fix` | A bug fix. |
| `docs` | Documentation only. |
| `style` | Formatting, no change in behavior. |
| `refactor` | Code change that neither fixes a bug nor adds a feature. |
| `perf` | A performance improvement. |
| `test` | Adding or fixing tests. |
| `build` | Build system, dependencies, native bundle. |
| `ci` | GitHub Actions workflows and CI scripts. |
| `chore` | Maintenance that fits nowhere else. |
| `revert` | Reverting an earlier commit. |

The **scope** names the part of the project the change touches, in lower
case: a feature area (`library`, `sharing`, `reading`, `zmanim`, `calendar`,
`parcours`, `chiourim`, `perpetual-chain`, `announcements`, `support`,
`profile`, `home`, `auth`, `admin`, `studio`, `widgets`, `watch`, `seo`,
`i18n`, `tracking`) or a technical one (`functions`, `firestore`, `android`,
`ios`, `native`, `texts`, `scripts`, `deps`, `readme`, `design`). Pick the
closest existing scope rather than inventing a new one; when a change spans
several areas, name the main one. A breaking change carries `!` after the
scope (`feat(texts)!: ...`) and a `BREAKING CHANGE:` footer.

### Author

A commit belongs to the repository owner, not to Claude: author and committer
are `Phenixel <yonathancardoso@outlook.fr>`. Before committing, set the
repository identity (`git config user.name "Phenixel"` and
`git config user.email "yonathancardoso@outlook.fr"`) or pass `--author`.
Claude only appears as a co-author, through the `Co-Authored-By` line.

## Typography

**Never a long dash.** Neither the em dash (U+2014) nor the en dash (U+2013).
Nowhere: not in comments, translated strings, content, documentation or
commit messages. A test enforces it (`src/__tests__/typography.test.ts`); the
check fails if one is left.

What to write instead, depending on what the dash was doing:

| The dash was used to          | Write instead                    |
| ----------------------------- | -------------------------------- |
| introduce an explanation      | a colon (`:`)                    |
| set off an aside              | commas, or parentheses           |
| join two clauses              | a semicolon (`;`)                |
| give a range                  | "from 12 to 14"                  |
| open an enumeration           | a real list                      |

The hyphen (`-`) of course stays in compound words, and imported corpora
(`public/texts/`, Sefaria texts) keep the punctuation of their source: that
is not our writing.

The French of the interface needs its non-breaking spaces: U+202F before `!`,
`?` and `;`, U+00A0 before `:` and inside « » quotes. A test enforces it too
(`src/__tests__/frenchTypography.test.ts`). The same rule applies to every
French text we publish (release notes, announcements).

## Appearance

The look of the site and the app follows `docs/design.md`: colors of the three
themes, radii (sharp surfaces, round controls), fonts (Playfair Display for
headings, Manrope for the rest), and what is not used, starting with
gradients. Every new design decision is added there.

## Release notes

"Write the patch note" ("Rédige la note de patch") is enough: the procedure
(what changed since the last tag, three-language format, 500 characters per
language, new features then fixes, check with
`scripts/check-release-notes.mjs`) is in `docs/notes-de-version.md`, to be
followed to the letter. The notes themselves stay in French, English and
Hebrew.

## Back office without the interface

Publishing an announcement (new feature, incident, question), closing an
incident, publishing or adding a chiour, creating an author and their studio
link, moderating a session, reading and answering user messages: everything
goes through `node scripts/admin.mjs`, without the `/admin` pages. Full
manual in `docs/backoffice-cli.md`.

- Always run first **without** `--confirmer` (dry run), show what will be
  written, then run again with `--confirmer`.
- The default target is **production**; `--emulateur` for the local
  emulators.
- **Never `--notifier` without the owner's explicit agreement**: a
  notification goes to every phone and cannot be taken back.
- An announcement text follows the typography above (no long dash,
  non-breaking spaces in French); English and Hebrew are optional.
- Credentials: locally, the machine's ADC (if it has expired, the script
  says so; it is up to the owner to run
  `gcloud auth application-default login`, account admin@phenixel.fr). In a
  cloud session, the environment's `PJ_ADMIN_SERVICE_ACCOUNT` key; if the
  script says firebase-admin is missing, run `npm ci --prefix functions`.
- Release notes become an announcement on their own when the GitHub release
  is published (`.github/workflows/release-info.yml`).
