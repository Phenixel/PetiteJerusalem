# The ad in isometric 3D

A vertical ad (1080 x 1920, 68 seconds, French, narrated) for the app: what
it is for, told as a world. Unlike the other promo videos (Remotion,
`../src/`), it is made with [HyperFrames](https://hyperframes.heygen.com)
(HTML rendered to video), and it was asked to look like none of them.

The idea (`STORYLINES.md`): the camera dives into a phone; inside, its
screen is a colored ground where an archipelago of isometric islands
floats, one per use of the app, and at the end the camera flies back out
until the whole archipelago stands on that phone's screen. `SPEC.md` holds
the numbers: colors, type, motion, every shot by the second.

| Seconds   | Chapter     | What happens                                                                        |
| --------- | ----------- | ----------------------------------------------------------------------------------- |
| 0-4.2     | `ouverture` | a phone on the cream, « Et si votre téléphone devenait… une petite Jérusalem ? », the dive |
| 4.2-10    | `marque`    | the island rises out of the screen, the city drops in block by block, the star lands |
| 10-20.4   | `partage`   | readers walk in, the psalms fountain out of the book, each part flies, flips, the siyoum |
| 20.4-30.6 | `etude`     | a tower of books, the named ones slide out, a play button, a plane round the tower  |
| 30.6-38.4 | `priere`    | the Sidour opens, the sun crosses Cha'harit, Min'ha, Arvit, night, the candles      |
| 38.4-47.4 | `objectifs` | a walker hops the stones of the days, the flag, the bell, the giant check           |
| 47.4-58   | `suivi`     | the wall: the month, then the year; the streak's lights up to the galaxy, 106 days  |
| 58-68     | `fin`       | back out of the phone, the logo, « Gratuite, sans publicité », Android, iPhone      |

## Files

| Path                           | What                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `index.html`                   | the root: fonts, the app's tokens, the title styles, the music, voice and sounds |
| `compositions/monde.html`      | the isometric world, one Three.js scene for the whole film, drawn from time alone |
| `compositions/<chapter>.html`  | the kinetic titles of each chapter, and the end card                           |
| `scripts/lignes.mjs`           | the narration, line by line, as written and as spoken                          |
| `scripts/sons.mjs`             | every sound effect: the moment it hits, the sound, its volume                  |
| `voix.json`, `mots.json`       | where each line and each word falls (generated, versioned to be read)          |
| `assets/gsap.min.js`, `assets/three.min.js` | GSAP 3.14.2 and Three.js r159 (MIT), loaded locally: a render never fetches |

## Make it again

```bash
cd promo && npm ci            # Fontsource, Tone.js, Playwright
cd presentation
npm run assets                # screens, logo, fonts and sounds
npm run voix                  # narration, word timings, the audio tracks in index.html
npm run musique               # the music bed
npm run check                 # HyperFrames: lint, runtime, layout, contrast
npm run render                # renders/petite-jerusalem-iso.mp4 (about 20 minutes), sound at -14 LUFS
```

`npm run dev` opens the HyperFrames Studio to review and adjust a frame;
after editing `scripts/sons.mjs`, `npm run sons` places the sounds again.

- **The screens are the app's.** Five real screens stand in the world as
  phones facing the camera: two store listing screenshots
  (`store-assets/screenshots/fr-FR`) and three cut out of the published 4.0
  video (`public/videos/nouveautes-4.0-fr.mp4`), which films the app on its
  demo data. Only the world around them is drawn.
- **The voice is Kokoro** (`hyperframes tts`, the French voice `ff_siwis`,
  on the machine). Google's voices (Flow, Cloud Text-to-Speech, Gemini)
  need the owner's Google account or an API key, which the session did not
  have. Words the phonemizer misreads are respelled for the voice only
  (`dit` in `scripts/lignes.mjs`). Voiced again elsewhere, the lines go to
  `assets/voix/<id>.wav` and `npm run voix` rebuilds the timings.
- **The word timings are measured, not transcribed** (`scripts/mots.mjs`):
  no speech model can be downloaded here; each clause boundary is placed on
  the pause the voice really makes, and words share a clause by their
  syllables.
- **The music** is composed by the promo videos' own engine
  (`../scripts/music-engine.js`) in its « mizrahi » genre, with no sample and
  no royalties. If Playwright's own Chromium is missing, `PROMO_CHROMIUM`
  points to one, as in `../README.md`.
- **The sound effects** are the HyperFrames library's (Pixabay Content
  License: free for commercial use, no credit needed, not to be
  redistributed as files), copied by `npm run assets` and never versioned.
