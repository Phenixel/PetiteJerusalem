# Bundled fonts

These TrueType fonts are used by the `ogImage` Cloud Function to render
per-session Open Graph cards (`src/ogCard.ts`). They are bundled (rather than
fetched at runtime) so image generation has no network dependency.

| File | Family | Source |
|------|--------|--------|
| `NotoSans-Regular.ttf` | Noto Sans | Google Noto Fonts |
| `NotoSans-Bold.ttf` | Noto Sans | Google Noto Fonts |
| `NotoSansHebrew-Bold.ttf` | Noto Sans Hebrew | Google Noto Fonts |

**License:** SIL Open Font License, Version 1.1 (OFL-1.1).
Copyright © Google LLC. See <https://openfontlicense.org> and
<https://github.com/notofonts/noto-fonts>. The OFL permits bundling and
redistribution with the software.
