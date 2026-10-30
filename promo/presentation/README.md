# The presentation in isometric 3D

A vertical video (1080 x 1920, 86 seconds, French) that says what the app is
for: sharing a reading, turning the phone into a place of study, the whole
prayer in one place, setting goals, keeping them, and seeing the month and
the year at a glance. Unlike the other promo videos (Remotion, `../src/`),
it is made with [HyperFrames](https://hyperframes.heygen.com) (HTML rendered
to video) and narrated.

The idea (`STORYLINES.md`): the app's name taken literally. A small
Jerusalem in isometric stone, built from the logo's own pieces (the wall,
the tower, the orange dome, the cypresses, the open blue book, the star),
rises out of a phone lying on the page's cream; the camera then flies from
district to district, one per use of the app, and the real screens rise
out of the world, facing the viewer, when they prove what the voice says.
`SPEC.md` holds the numbers: colors, type, motion, every shot by the second.

| Seconds | Chapter     | What happens                                                                 |
| ------- | ----------- | ---------------------------------------------------------------------------- |
| 0-11    | `ouverture` | the city rises out of the phone, the star lands, the logo and the name       |
| 11-26   | `partage`   | readers around a book, the session screen, the parts handed out and checked, the bar to the siyoum |
| 26-39   | `etude`     | the shelf of the library, each book lifted as it is named, the library and a class |
| 39-49.5 | `priere`    | back over the city: the Sidour on the moment, the times, the sun crossing Cha'harit, Min'ha, Arvit, night, the candles |
| 49.5-62.5 | `objectifs` | three plinths (a tractate by a date, the daily Tehilim, a habit), the home page, the reminder, the card swiped |
| 62.5-77 | `suivi`     | the wall of Mon parcours, a stone a day, the month, the year; the streak's lights; Mon parcours |
| 77-86   | `fin`       | flight back to the city, the logo, « Gratuite, sans publicité », Android and iPhone |

## Files

| Path                         | What                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| `index.html`                 | the root: fonts, the app's tokens, the phone that carries a screen, the audio |
| `compositions/monde.html`    | the isometric world, one Three.js scene for the whole film, drawn from time alone |
| `compositions/<chapter>.html`| what comes over the world in each chapter: the real screens, the logo, the end card |
| `compositions/sous-titres.html` | the captions, generated: edit `scripts/sous-titres.mjs`                  |
| `scripts/lignes.mjs`         | the narration, sentence by sentence, as written and as spoken               |
| `voix.json`, `mots.json`     | where each sentence and each word falls (generated, versioned to be read)   |
| `assets/gsap.min.js`, `assets/three.min.js` | GSAP 3.14.2 and Three.js r159 (MIT), loaded locally: a render never fetches |

## Make it again

```bash
cd promo && npm ci            # Fontsource, Tone.js, Playwright
cd presentation
npm run assets                # screens, logo and fonts, from the repository
npm run voix                  # narration, word timings, captions
npm run musique               # the music bed and the picture's sounds
npm run check                 # HyperFrames: lint, runtime, layout, contrast
npm run render                # renders/presentation.mp4, about 15 minutes
```

`npm run dev` opens the HyperFrames Studio to review and adjust a frame.

- **The screens are the app's.** The store listing screenshots
  (`store-assets/screenshots/fr-FR`) and three screens cut out of the
  published 4.0 video (`public/videos/nouveautes-4.0-fr.mp4`: the Sidour, the
  home page at 106 days, Mon parcours), which films the app on its demo
  data. Nothing in a phone is redrawn; only the world around it is.
- **The voice is Kokoro** (`hyperframes tts`, the French voice `ff_siwis`,
  on the machine, slowed to 0.92). Google's voices (Cloud Text-to-Speech or
  Gemini) need an API key the session did not have. Words the phonemizer
  misreads are respelled for the voice only (`dit` in `scripts/lignes.mjs`:
  « Mishna », « Arvite », « Chaharite »). With a key, the sentences can be
  voiced again and `npm run voix` rebuilds the timings and the captions.
- **The word timings are measured, not transcribed.** No speech model can be
  downloaded here: each clause boundary is placed on the pause the voice
  really makes, and words share a clause by their syllables
  (`scripts/mots.mjs`).
- **The music** is composed by the promo videos' own engine
  (`../scripts/music-engine.js`), at the 4.0 video's style, with no sample
  and no royalties; its sounds fall on the picture's actions
  (`scripts/musique.mjs`).
