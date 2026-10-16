# Contributing guide

Thank you for your interest in **Petite Jérusalem**. Any help improving this
platform for the community is welcome.

## How to contribute

### Report a bug

Found a bug? Let us know. Two ways:

1. **GitHub issues**: open an issue describing what you did, what you
   expected and what actually happened.
2. **Support form**: from the website (the « Nous écrire » / "Write to us"
   link in the footer or at the bottom of the home page) or the app (About
   tab of the profile). The message arrives with the device, the platform
   and the version, which helps reproduce it.

### Suggest an improvement

A feature idea?

- Open an issue on GitHub to discuss it before coding.
- Or use the support form of the site or the app ("Write to us") to send
  your ideas.

### Open a pull request

1. **Fork** the project.
2. Create a branch for your feature
   (`git checkout -b feat/my-new-feature`).
3. Make your changes.
4. Check that the code is clean and the tests pass:
   ```bash
   npm run verify
   ```
   `verify` runs the type-check, `npm run lint` (ESLint, with automatic
   fixes) and the Vitest unit tests. It is exactly what CI runs on every PR.
5. Commit your changes with a
   [Conventional Commits](https://www.conventionalcommits.org/) message, in
   English, with a scope naming the area you touch:
   ```bash
   git commit -m "feat(library): add a search filter by book"
   git commit -m "fix(sharing): keep the reservation after a reload"
   ```
   Types and scopes are listed in [CLAUDE.md](CLAUDE.md#commits). The pull
   request title follows the same format.
6. Push your branch (`git push origin feat/my-new-feature`).
7. Open a pull request against the main repository.

## Repository conventions

They are written in [CLAUDE.md](CLAUDE.md) and apply to everything written
here: code, comments, interface strings, content, documentation, commit
messages and pull requests.

- **English** for comments, documentation, commit messages and pull
  requests. Identifiers follow the file they live in: English for technical
  names, the transliterated terms of the liturgical domain where the file
  already uses them. The interface stays trilingual (French, English,
  Hebrew).
- **Conventional Commits** for every commit message:
  `type(scope): summary`.
- **Never a long dash**: neither em dash (U+2014) nor en dash (U+2013),
  anywhere. Depending on the case, write a colon, a comma, parentheses, a
  semicolon, "from 12 to 14" for a range, or a real list. The test
  `src/__tests__/typography.test.ts` scans every tracked file and fails if
  one is left.
- **Non-breaking spaces** in the French of the interface: U+202F before `!`,
  `?` and `;`, U+00A0 before `:` and inside « » quotes. The test
  `src/__tests__/frenchTypography.test.ts` checks it on `src/locales/fr`.

## Code standards

- **TypeScript**: strong typing, avoid `any` as much as possible.
- **Vue 3**: Composition API with `<script setup>`.
- **Style**: the project uses `eslint` and `prettier`. Run `npm run lint`
  and `npm run format` before committing. Note that `npm run format` only
  formats `src/` (`prettier --write src/`): scripts, configuration and
  documentation are left alone.
- **CSS**: **TailwindCSS** utility classes as much as possible.

## Guard tests

Beyond functional tests, several unit tests enforce repository rules and make
CI fail for reasons that do not show in the diff: a long dash in a comment,
an i18n key used but missing from `fr`, a static import that pulls Firestore
into the initial bundle, a widget added on a single platform, a text fixed
without `public/texts/manifest.json` following... They are listed, with what
each one expects, in [docs/tests.md](docs/tests.md). Read that page before
searching for long why a PR is red.

## Important

This project is meant for community, **non-commercial** use. By contributing,
you agree that your code becomes part of the project under the
**CC BY-NC 4.0** license.
