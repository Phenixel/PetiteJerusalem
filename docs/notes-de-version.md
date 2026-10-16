# Release notes

The procedure to follow when asked to « rédige la note de patch » ("write
the patch note"), or the release notes, the changelog, the "What's new" of
a version. CLAUDE.md points here.

The note comes from the description of the GitHub release for the `vX.Y.Z`
tag: the CI sends each section to the language of the same name, on the
Play Store (fr-FR, en-US, iw-IL) and on the App Store (fr-FR, en-US, he).
See `docs/android-ci-cd.md`, section « Notes de version en trois langues ».
The same text becomes a « Mise à jour » ("Update") information item in the
app and on the site when the release is published
(`.github/workflows/release-info.yml`, see `docs/backoffice-cli.md`).

The expected result is ONE block of text ready to paste, with nothing left
for the repository owner to do but copy it.

## 1. Find what changed

1. `git fetch --tags origin main`, then the latest app version tag:
   `git tag -l 'v*' --sort=-v:refname | head -1` (`web-v*` tags do not
   count, they only publish the site).
2. The PRs merged since: `git log --first-parent --format='%h %s' <tag>..origin/main`,
   then, for each one, the body of the commits from the merged branch
   (`git log --no-merges --format='%s%n%b' <merge>^1..<merge>^2`). The
   commit message says what the person sees; that is where to read.
3. Keep only what a user of the app or the site notices. Leave out: CI,
   workflows, listing screenshots, tests, documentation, code cleanup,
   audience tracking, error reporting, refactorings with no visible effect.
4. If needed, reread the last two or three GitHub releases for the tone.

## 2. Write

Three sections, in this order, under these exact headings. In each, two
blocks: what's new, then fixes. An empty block is omitted.

```markdown
## Français
Nouveautés
- …

Corrections
- …

## English
What's new
- …

Fixes
- …

## עברית
חדש
- …

תיקונים
- …
```

- **Short.** The Play Store cuts at 500 characters per language (bullets
  and headings included): aim for 3 or 4 new features and as many fixes at
  most, one short sentence each, the most important first. If everything
  does not fit, group items (« Sidour : quatre lectures corrigées ») or
  remove the least visible one; never truncate a sentence.
- **From the user's point of view**, in the present tense: what they now
  see or can do, not how it is done. No PR number, no file name, no
  technical jargon.
- **The three languages say the same thing**, in the same order. The
  English and the Hebrew are real translations, not a summary.
- **Interface labels** are the app's in each language: take them from
  `src/locales/fr.ts`, `en.ts` and `he.ts` (names of tabs, profile groups,
  buttons).
- **Liturgical terms**: in French, the repository's spelling (Cha'harit,
  Min'ha, Arvit, 'Hol haMoed, Tehilim, Sidour, Hochanot, Chabbat); in
  English, the common transliteration (Shacharit, Mincha, Arvit, Chol
  HaMoed, Tehilim, Siddur, Hoshanot, Shabbat); in Hebrew, the Hebrew word
  (שחרית, חול המועד, תהילים, סידור, הושענות, שבת). A quotation in Hebrew
  stays in Hebrew in all three languages.
- **Typography**: never a long dash (repository rule, see CLAUDE.md),
  guillemets « » in French and " " in English and Hebrew, straight
  apostrophe. No emoji: App Store Connect rejects them.

## 3. Check

Write the note in a working file (the session's scratchpad), then:

```sh
node scripts/check-release-notes.mjs <fichier>
```

It prints the length of each language and fails on a missing language, a
text longer than 500 characters, a long dash or an emoji. Rework until
« note prête » ("note ready").

## 4. Deliver

- The complete text, in a single markdown code block, ready to paste.
- Below the block, in one line: the length of each language (the checker's
  output), and the proposed next version number (latest tag, patch + 1,
  unless the changes call for more).
- The reminder: create the GitHub release with this text BEFORE pushing the
  tag, since the CI reads the description at tag time.
- Publish nothing yourself (no release, no tag) unless asked.
