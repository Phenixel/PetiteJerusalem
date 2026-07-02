# Petite Jérusalem — design system conventions

Petite Jérusalem is a Torah-study sharing platform (French/English/Hebrew). The UI
is built with **Tailwind CSS v4**, styled entirely with utility classes generated
from a small `@theme` token set. There is **no custom component CSS and no class
map** — you style by composing Tailwind utilities, using the brand tokens below.
Dark mode is class-based (`darkMode: 'selector'`): a `.dark` class on the root
element activates every `dark:` variant.

## Brand tokens → utilities

The `@theme` block (`src/assets/main.css`) defines these custom properties; Tailwind
v4 turns each into utilities. **Prefer these named utilities over raw hex.**

| Token | Value | Utilities | Use for |
|---|---|---|---|
| `--color-primary` | `#1D6FDB` blue | `bg-primary` `text-primary` `border-primary` `from-primary` | primary actions, links, active state, accents |
| `--color-secondary` | `#06B6D4` cyan | `bg-secondary` `text-secondary` `to-secondary` | gradient partner to primary |
| `--color-accent` | `#ff6b6b` coral | `bg-accent` `text-accent` | occasional highlight (defined; used sparingly) |
| `--color-accent-secondary` | `#ee5a24` | `bg-accent-secondary` | deep coral pair |
| `--color-bg-beige` | `#f4f1ea` | `bg-bg-beige` | the app's default page background (light mode) |
| `--color-bg-secondary` | `#f8f9fa` | `bg-bg-secondary` | subtle raised surfaces |
| `--color-text-primary` | `#333333` | `text-text-primary` | body text |
| `--color-text-secondary` | `#666666` | `text-text-secondary` | muted / secondary text |
| `--font-sans` | Inter → system | `font-sans` (default) | all UI text |
| `--font-serif` | Georgia | `font-serif` | occasional editorial text |
| `--font-hebrew` | Frank Ruhl Libre → Noto Serif Hebrew | `font-hebrew` | **all Hebrew text**, set `dir="rtl"` |
| `--radius-sm/md/lg` | 8 / 16 / 24px | `rounded-sm` `rounded-md` `rounded-lg` | cards use `rounded-lg`/`rounded-2xl` |

Note the two "primary" families are distinct: **`text-primary` = brand blue** (an
accent), while **`text-text-primary` = the dark-gray body color**. Likewise
`text-secondary` (cyan) vs `text-text-secondary` (muted gray). Don't confuse them.

## Signature patterns (used throughout the real app)

- **Brand gradient** — the recurring hero/CTA treatment:
  `bg-gradient-to-r from-primary to-secondary` (for text, add
  `bg-clip-text text-transparent`).
- **Glass cards** — the dominant surface style:
  `bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60` and in dark
  mode `dark:bg-gray-800/60 dark:border-gray-700`. Hover lift:
  `transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`.
- **Quiet buttons** — `bg-black/5 border border-black/10 rounded-xl hover:bg-black/10`,
  dark `dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/15`.
- **Hebrew** — wrap in `font-hebrew` with `dir="rtl"`; Hebrew reading text runs large
  (~`text-2xl`+) with generous line-height.

## Dark mode

Semantic dark tokens are **not** in `@theme`. Dark mode is expressed with `dark:`
variants over Tailwind's built-in gray scale (`dark:bg-gray-900`,
`dark:text-gray-100`, `dark:border-gray-700`) plus `dark:bg-primary` for accents.
The page background flips from `bg-bg-beige` to gray-900 via the root `.dark` class.
Always pair a light utility with its `dark:` counterpart on surfaces, borders, and text.

## Idiomatic snippet

```html
<!-- On-brand card, light + dark -->
<article
  class="rounded-2xl border border-white/60 bg-white/80 p-6 backdrop-blur-sm
         transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
         dark:border-gray-700 dark:bg-gray-800/60">
  <h3 class="text-lg font-semibold text-text-primary dark:text-white">Titre</h3>
  <p class="mt-1 text-text-secondary dark:text-gray-300">Texte secondaire.</p>
  <p class="mt-3 font-hebrew text-2xl" dir="rtl">בְּרֵאשִׁית בָּרָא</p>
  <button
    class="mt-4 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 py-2.5
           font-semibold text-white transition-all hover:opacity-90">
    Partager
  </button>
</article>
```

## Where the truth lives

The single source of truth for tokens is `src/assets/main.css` (the `@theme`
block, mirrored in `.design-sync/tokens/tokens.css`). Fonts load from Google Fonts
(`Frank Ruhl Libre`, `Noto Serif Hebrew`) via `index.html`; `Inter` falls back to
the system sans stack. There is no component stylesheet to read — the styling
vocabulary is Tailwind utilities plus the tokens above.
