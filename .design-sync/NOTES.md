# design-sync notes — Petite Jérusalem

Prepared 2026-07-02. Read this before the next sync.

## Two blockers hit on the first run

1. **This repo is a Vue 3 application, not a React component library.**
   Claude Design live-renders **React** from a compiled bundle
   (`window.<globalName>.*`). The `.vue` single-file components in
   `src/components/` and `src/views/` cannot render in that runtime, and they are
   app-specific (wired to Firebase, vue-router, vue-i18n) rather than reusable
   design-system primitives. So the component/preview-card pipeline does not apply
   here. The converter (`package-build.mjs`, esbuild + React) was **not** run.

2. **DesignSync could not authorize** in the environment where this was prepared
   (claude.ai/code headless). No Claude Design project was created and nothing was
   uploaded. The tool's own guidance for this case:

   > DesignSync needs design-system authorization, but /design-login requires an
   > interactive terminal and is not available in this environment. If this is
   > claude.ai/code, ask the user to use Claude Design's "Send to Claude Code Web"
   > (which seeds the project into the workspace) or to provide the project files
   > directly.

## What was produced instead (scope: tokens-only)

- `.design-sync/config.json` — `shape: package`, `scope: tokens-only`, no `projectId`.
- `.design-sync/tokens/tokens.css` — the Tailwind v4 `@theme` tokens, verbatim from
  `src/assets/main.css` (framework-agnostic CSS custom properties).
- `.design-sync/conventions.md` — the on-brand design guide (token→utility
  vocabulary, gradient/glass-card/dark-mode patterns). Human-editable; validated
  against real usage in the repo.

## To finish a real sync later

- Run `/design-sync` from an **interactive** Claude Code terminal (so
  `/design-login` can authorize), or use Claude Design's "Send to Claude Code Web".
- Decide the intended scope. Options:
  - **Tokens-only** (what's prepared here): upload `tokens.css` + a `styles.css`
    that `@import`s it, `conventions.md` as the README header, and Hebrew fonts.
    Gives the design agent on-brand color/typography without live components.
  - **Component sync**: would require porting the Vue components to React (a
    rewrite, diverging from the real source) — not recommended, and contrary to the
    skill's "ship what the customer built, never reimplement" principle.
- When the target project is created, record its id under `projectId` in
  `config.json` before any upload (the sync pin).

## Validated token facts (don't relearn these)

- `text-primary` = brand blue `#1D6FDB`; `text-text-primary` = body gray `#333`.
  Same split for `text-secondary` (cyan) vs `text-text-secondary` (gray). Easy to confuse.
- `bg-accent` / `text-accent` are defined in `@theme` but effectively unused (0 hits).
- Dark mode uses Tailwind's built-in gray/red/green scales + `dark:bg-primary`;
  there are no semantic dark tokens in `@theme`. Root `.dark` class drives it.
- Fonts: `Frank Ruhl Libre` + `Noto Serif Hebrew` from Google Fonts (`index.html`);
  `Inter` is named but not actually loaded (system fallback).
