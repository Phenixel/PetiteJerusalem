# Promotional videos

Short vertical videos (1080×1920) to make the native app known on TikTok,
Instagram Reels, YouTube Shorts and WhatsApp statuses, and the "what's new"
video the app plays once after an update. Nothing in them is made up: every
screen is a screenshot of the app itself, launched as the "native app" on
demo data, and every gesture (pulling a prayer time row, checking a psalm,
swiping a card, setting a text aside) was really played, frame by frame.

| Series | What                                                      | Filmed on | Output                          |
| ------ | --------------------------------------------------------- | --------- | ------------------------------- |
| 1      | six videos of 23 seconds, one part of the app each        | 3.10      | `out/<id>.mp4`                  |
| 2      | six stories of 31 seconds                                 | 3.10      | `out/s2-<id>.mp4`               |
| 4      | version 4.0: one presentation, in the app and the networks | 4.0       | `out/<id>.mp4`, `../public/videos/` |
| 3D     | an ad in isometric 3D, narrated (HyperFrames)              | 4.0       | `presentation/renders/`         |

## Version 4.0

The biggest update of the app, presented in one video of about a hundred
seconds, in series 1's language (a phone held calmly, two-line captions,
real gestures, what must be read coming out of the screen), slowed down:
a presentation rather than an ad. A first cut in series 2's manner
(scrolling bands, echoes, stone mosaic, captions on plates) was set aside.
It opens and ends in the language of the designer's logo and share
banners: the cream, the stars in orange and blue, « בס״ד · פטיט ירושלים »
in orange, the name in capitals, and the logo itself in motion: cut into
its pieces when the video renders (`src/v4/LogoMotion.tsx`), it builds
itself, the book opening, the wall, the tower and the dome rising, the
star falling (`public/brand/`, copied from the app's `assets/brand/`).

| Video           | Language              | Ending                                      | Where it goes                         |
| --------------- | --------------------- | ------------------------------------------- | ------------------------------------- |
| `nouveautes-fr` | French                | « Bonne découverte ! », where to watch again | the app, once after the update        |
| `nouveautes-en` | English               | the same                                    | the app                               |
| `nouveautes-he` | Hebrew, right to left | the same; no translation chapter            | the app                               |
| `v4`            | French                | « Gratuite, sans publicité », the stores     | the networks: the same video otherwise |

| Chapter        | What it shows                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `bars`         | the 3.10 tab bar, then today's; Bibliothèque and Chiourim lead to Étude, Sidour is new          |
| `etude`        | Étude: Bibliothèque, Chiourim, Partage, the pill sliding from tab to tab                        |
| `sidour`       | the Sidour tab touched; its card of the moment comes out of the screen, then opens Cha'harit    |
| `calme`        | the Android app: the quiet modes come down from the top, « Ne pas déranger » touched           |
| `moment`       | the time of the moment, a pill with its sky, out of the screen; touched, the cycle of the day    |
| `fin`          | the end of Cha'harit pushed up: the line grows into « Cha'harit : c'est fait »                   |
| `accueil`      | the 3.10 home page beside today's; a card swiped « C'est fait »; the blocks to move              |
| `parcours`     | the lamp touched; the streak and its galaxy out of the screen; the wall; a new goal             |
| `daf`          | « Page »: the Vilna page out of the screen, Rachi and Tossafot around the gemara                 |
| `progress`     | Cha'harit's reading bar slid with a finger, its titles riding the line, out of the screen        |
| `translation`  | the translation under the Hebrew, with the AI notice in French (not in the Hebrew video)        |
| `commentaries` | a passage touched, its sheet, then its commentaries out of the screen                           |
| `table`        | « Mettre de côté »: the page flies into its book in the bar, a second one, the table            |
| `audio`        | a class plays, its bar out of the screen, then the full-screen player                           |
| `contact`      | the badge on the profile, « Nous écrire », the team's answer out of the screen                  |

The closing montage passes twelve more changes: Halakha and Moussar, the
reader's Tikoun, chnei mikra aliyah by aliyah, one bookmark per book, the
chain's Tehilim in one go, Nichmat 40, Nichmat kol 'hai in the Sidour, the
compass that fills facing the Kotel, the Sidour's search, the reminders of
the day, the pinned books of the home page, the higher contrast mode.

The quiet modes are the Android app's: the captures play the phone's
plugin (`android` in `scripts/captures.mjs`), and the demo data hold a
Nichmat 40 chain on its tenth day (`scripts/demo-server.mjs`).

The in-app copies (720×1280, about 7 MB for a hundred seconds, their index at
the front so they start before fully arriving, and a poster) are written by
`npm run render` into the app's `public/videos/`, served by the site and left
out of the native bundle. The app reads them under the same names
(`appFile` in `src/videos.ts`, `src/composables/useWhatsNew.ts`); see
`docs/design.md`, "What's new plays once, after the update".

### Before and after

The `bars` chapter films the 3.10 tab bar on the 3.10 app itself. Prepare
a copy of the app at that tag, once, and hand it to the demo server:

```bash
git worktree add ../pj-v3 v3.10.11
(cd ../pj-v3 && npm ci)
PROMO_BEFORE_DIR=$PWD/../pj-v3 npm run captures   # from promo/
```

The demo server then also serves that app on port 5275, on the same
emulators and demo account.

## The isometric ad

A narrated ad of the whole app in 68 seconds, in isometric 3D, made to look
like none of the videos above: the camera dives into a phone, flies over an
archipelago of islands (the little Jerusalem, sharing, study, prayer, goals,
the wall of Mon parcours) floating over its screen, and flies back out at
the end. It is a separate HyperFrames project, with its own README:
[`presentation/`](presentation/README.md). It reuses this folder's music
engine and fonts, and the app's screens from the store listing and the 4.0
video.

## Series 1 and 2

Filmed on 3.10, their shots (`scripts/shots.mjs`, `--set v3`) name the
screens of that time (the « Bibliothèque » tab, « Ma lecture quotidienne »):
they can only be filmed again on a copy of the app at tag v3.10.11.

| Video             | What it shows                                                          | Look              |
| ----------------- | ---------------------------------------------------------------------- | ----------------- |
| `horaires`        | the circle opening, the reminder set with a swipe, the notification    | sunset            |
| `partage`         | a Tehilim chain, three psalms reserved, the QR code, the siyoum        | ocean             |
| `bibliotheque`    | the books, the Hebrew, the phonetics, auto-scroll, offline             | emerald           |
| `sidour`          | Cha'harit and its time, the menu, the Kotel compass, the parchment     | sunset, dark      |
| `calendrier`      | the holidays, 'Hanoukah, one's own dates, the converter                | ocean, dark       |
| `lecture-du-jour` | the home card, the list, the reminder, the day checked                 | emerald           |

Series 2 tells instead of presenting: a situation, a moment of the day, a
ranking. 31 seconds, more movement (phones rushing in with their trail,
fans, stone mosaics, a split-flap clock, counters, scrolling bands), and
still time to read: each sentence stays for its whole shot, on a plate, and
the final montage goes to two beats per feature.

| Video      | The story                                                                      | Music      |
| ---------- | ------------------------------------------------------------------------------ | ---------- |
| `refoua`   | « Un proche est malade »: the chain typed, sent, reserved, up to 150/150         | cinematic  |
| `journee`  | six hours of a day, from dawn to the bedtime Chema, the app turning dark         | half-time  |
| `secrets`  | « 3 gestes que personne ne connaît »: swipe, double tap, the Kotel               | half-time  |
| `chiffres` | 0 €, 0 ads, then 150 Tehilim, 62 Michna tractates, 40 of the Talmud…              | mizrahi    |
| `fetes`    | the app dressed for the holidays: Hanouka, Pourim, Pessah, Souccot, Roch Hachana  | mizrahi    |
| `langues`  | français, English, עברית: the same app, Hebrew from right to left                | mizrahi    |

## The chain

1. **Captures** (`npm run captures`): `scripts/demo-server.mjs` starts the
   Firebase emulators, creates the demo account and data (the same as the
   store screenshots, plus personal dates) and launches Vite;
   `scripts/captures.mjs` opens the app in Chromium, with a home-made
   Capacitor platform like `scripts/store-screenshots.mjs`, and plays the
   shots of `scripts/shots-v4.mjs` (or `scripts/shots.mjs`, `--set v3`).
   For 4.0, each shot is filmed in French, English and Hebrew, on a
   Thursday morning (a frozen clock), and the demo account gets a Mon
   parcours of more than a hundred days (`scripts/demo-parcours.mjs`, built
   with the app's own functions). The « Nous écrire » thread and the class
   audio answer from the capture script: the Cloud Functions do not run in
   the demo, and nothing reaches production. Output: `public/captures/*.jpg`
   (not versioned) and `public/captures/marks.json` (versioned), the areas
   located on screen (a button, a card) where the edit places a finger or a
   zoom.
2. **Music** (`npm run music`): `scripts/music-engine.js` composes each
   track in Chromium, offline with Web Audio and Tone.js. No sample and no
   licensed piece: electronic pop in the freygish mode, a darbuka in
   maqsoum, plucked strings in the manner of a kanun, and the sound effects
   (whooshes, taps, impacts) placed on the picture's gestures. Normalized to
   -14 LUFS, the networks' level. Output: `public/music/<id>.wav` (not
   versioned).
3. **Render** (`npm run render`): Remotion renders each composition in H.264
   and AAC into `out/<id>.mp4` (not versioned), then the in-app copies.
   Composes the missing music first. Last, `scripts/chapters.mjs` writes
   where each passage of the in-app videos starts
   (`src/content/help/whatsNewChapters.json` of the app): the help center's
   page of the version plays the video from a passage, and answers its
   questions (`docs/help-center.md`, "Answering for a version"). A new
   chapter in `src/v4/plan.ts` needs its questions there: the app's checks
   fail until they are written.

`npm run studio` opens the Remotion studio, to review a video frame by frame
and adjust a beat.

```bash
cd promo
npm ci
npm run captures                 # about 15 minutes for 4.0, emulators included
npm run render -- --series 4     # the four 4.0 files, about 15 minutes
npm run render -- --only v4      # the networks' ending alone
```

Requirements: those of `npm run store:screenshots` (firebase CLI, JDK 21),
ports 8470, 8471, 5274 (and 5275 for the "before" shots) free, `npm ci` done
at the root. In a cloud session, `PROMO_CHROMIUM` points to Playwright's
Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` for the
captures and the music, `…/chromium_headless_shell-1194/chrome-linux/headless_shell`
for the render) instead of downloading one.

## The edit

Everything is set on a musical grid of 120 beats per minute, at 30 frames
per second: a beat lasts 15 frames. `src/timeline.ts` defines it,
`src/videos.ts` fills it for each video, and the same grid serves picture
and sound:

| Section   | Beats (series 1) | What happens there                                    |
| --------- | ---------------- | ----------------------------------------------------- |
| `hook`    | 4                | the question or the promise, one line struck per beat |
| `feature` | 24               | the feature, on the phone                             |
| `break`   | 2                | the music cuts, « Mais aussi… » falls on the black    |
| `montage` | 8                | eight other features, one beat each                   |
| `end`     | 6                | the logo builds, « Gratuit, sans publicité », stores  |

A scene's gestures are **marked beats** (`marks` in `src/videos.ts`): the
scene places a tap, a cut, a card leaving the screen there; the music places
the sound named next to it. Moving a gesture means changing a number, and
picture and sound follow.

Series 2 follows the `src/Story.tsx` template: `hook` 4 beats, `feature`
36, `break` 2, `montage` 12 (six shots of two beats), `end` 8. Its scenes
live in `src/scenes2`, its effects in `src/components/Fx.tsx` and
`src/components/Sections2.tsx`, and its music picks a genre (`genre`,
`drops` in `src/videos.ts`): the drums change, a piano carries the chords,
the music stutters before each drop and stops like a tape on « Mais
aussi… ».

Version 4.0 follows `src/v4/Update.tsx`, series 1's frame (`src/Promo.tsx`)
with its feature section strung into chapters. Its cut is data
(`src/v4/plan.ts`): chapters, their length and their marked beats, from which
`src/videos.ts` derives the grid and the music's sounds; the chapters live in
`src/v4/chapters.tsx`, its building blocks (the opening, the before and after
bars, the montage, the end card) in `src/v4/parts.tsx`, its words in the
three languages in `src/v4/strings.ts`. A section always holds whole bars
(four beats): the music lays its chords bar by bar, and a bar running into
the next section collides with it.

To add a video: an entry in `VIDEOS` (`src/videos.ts`), a scene, its hook in
`src/Root.tsx` (series 1 and 2) or its chapters in `src/v4/plan.ts`, and the
shots it is missing in `scripts/shots-v4.mjs`.

## The look

The videos follow `docs/design.md` (section "The promotional videos"): the
colors of the themes (for 4.0, white on the pastel orange as in the app, and
the colors of the designer's logo and banners at the opening and the end),
the stone wall, Playfair Display for titles and Manrope for the rest
(embedded from Fontsource, no network request at render time), flat colors
and never a gradient, the French non-breaking spaces.

## Licenses

- **Remotion** is free for an individual or a company of up to three
  people, which Phenixel is; beyond that, a company license is due
  (<https://www.remotion.dev/license>).
- **Tone.js** (MIT), **Playfair Display**, **Manrope**, **Frank Ruhl
  Libre** and **Heebo** (SIL OFL).
- The music is composed by the script: it belongs to the project, with no
  royalties to pay, and matches no piece a network's rights detection could
  recognize.
