# Bundled fonts

These TrueType fonts are used by the `ogImage` Cloud Function to render
per-session Open Graph cards (`src/ogCard.ts`, laid out by
`src/ogCardSvg.ts`). They are the fonts of the designer's share banners, and
they are bundled (rather than fetched at runtime) so image generation has no
network dependency.

| File | Family | Used for | Source |
|------|--------|----------|--------|
| `PlayfairDisplay-Regular.ttf` | Playfair Display | the label in small capitals | Google Fonts |
| `Manrope-Medium.ttf` | Manrope | the session name and the call to join | Google Fonts: a static weight 500 instance of the variable font, latin and latin-ext merged |
| `NotoSansHebrew-Bold.ttf` | Noto Sans Hebrew | a session name in Hebrew | Google Noto Fonts |

The card's background (`../assets/session-card.png`) is the designer's banner
without its tagline, taken from the banner's PSD.

**License:** SIL Open Font License, Version 1.1 (OFL-1.1), for all three.
See <https://openfontlicense.org>. The OFL permits bundling and
redistribution with the software.
