# The shape loop

A 14 second motion loop for Instagram stories and WhatsApp statuses. One
shape goes through the gestures of a shared reading, from « Réserver » to
the siyoum, and comes back to its first frame. It has no cut and no
explanatory text: the only words are the ones the interface itself would
show, plus the signature.

Unlike the series in `../README.md`, nothing here is a screenshot: the whole
loop is drawn in Canvas 2D by a single file, `shape-loop.html`. That file
has no dependency (the two fonts are embedded) and also works as a preview:
open it in a browser to play, pause or scrub, with ← → for one frame and
Shift for half a second.

## Render

```sh
cd promo
node scripts/render-loop.mjs --check             # purity and loop seam, must print OK
node scripts/render-loop.mjs --contact out/c     # contact sheets around each key time
node scripts/render-loop.mjs --frames 0,480 out/f
node scripts/render-loop.mjs --video             # out/loop-story.mp4, out/loop-whatsapp.mp4
```

| File                    | For                 | Format                                           |
| ----------------------- | ------------------- | ------------------------------------------------ |
| `out/loop-story.mp4`    | Instagram story     | H.264 High 4.2, 1080×1920, 60 fps, CRF 14        |
| `out/loop-whatsapp.mp4` | WhatsApp status     | H.264 High 4.0, 1080×1920, 30 fps, 6 Mbit/s cap  |

The WhatsApp file keeps one frame out of two of the same render, without
resampling: WhatsApp recompresses statuses hard, and a light 30 fps file
comes out of it better than a 60 fps one.

## Render contract

- `window.renderAt(t)` draws the frame at `t` seconds. It is a pure function
  of `t`: no `Math.random`, no clock, and `requestAnimationFrame` only
  schedules the preview. The waveform heights come from a seeded generator
  (mulberry32, seed 23).
- Frame `n` is `renderAt(n / 60)`. Motion blur averages 4 samples spread
  over half a frame (a 180 degree shutter): over a full frame, the 4 copies
  showed as separate ghosts on the fastest moves.
- Time is folded with `t - 14 * floor(t / 14)`.
- Each property is a sum of closed-form spring step responses, one per key,
  **plus the steps of the previous cycle**. The steps of a cycle add up to
  zero, so the value at 14 s is the value at 0 s, position and speed alike:
  the seam is exact by construction. `--check` verifies it (frames at 0, 14
  and 28 s identical, two calls at the same `t` identical).

## Look

Only the three colours given for this loop: `#F4F1EA` (the stone beige of
the app), `#111111` and the accent `#FF5B1F`. The accent is brighter than
the app's Sunset orange (`#DE4F17`); that was the owner's choice for this
loop. No gradient, no shadow.

- **The colour changes are drawn by the shape, never blended.** The shape is
  drawn on its own layer: base colour first, then, in `source-atop`, an
  accent patch and an ink disk whose geometry is animated. The base colour
  only switches while a patch fully hides it, and the « Réserver » label
  takes its colour from the patch (ink inside, stone outside), so even the
  text is recoloured by the shape.
- Fonts from `docs/design.md`: Playfair Display 700 (with lining figures,
  `lnum`: by default the « 3 » of « 23 » drops below the line), Manrope 700.
  Text sizes are on the 8 px grid: 56, 64, 48 px in the shape, 48 and 32 px
  for the signature.
- Story safe zones: 256 px at the top (progress bar, avatar), 384 px at the
  bottom (reply field). The shape is centred at y = 896, in the middle of
  the 256 to 1536 band; the signature sits at y = 1440 and 1496.

## Motion

| Spring  | Damping ratio | Settles (2 %) | Natural frequency | Overshoot |
| ------- | ------------- | ------------- | ----------------- | --------- |
| Shape   | 0.72          | 0.35 s        | 15.87 rad/s       | 3.8 %     |
| Camera  | 1 (critical)  | 0.6 s         | 9.72 rad/s        | none      |

- Every start falls on the 0.5 s grid; a spring started on a tick has
  settled before the next one (0.3 % left at +0.5 s, carried smoothly into
  the next step). Child elements are staggered by 40 ms.
- A content change inside the shape is a 12 px blur and a fade in 0.15 s.
- The camera only follows the shape (a 0.96 zoom on the chart); it never
  moves on its own.

## Storyboard

| Time (s)       | Frames      | State                                                                 | Main movement                                                          |
| -------------- | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0.0 to 0.5     | 0 to 29     | Button « Réserver », accent, 488×152, with the tagline                | none                                                                   |
| 0.5 to 1.0     | 30 to 59    | Press                                                                 | scale 1 to 0.94; the tagline leaves                                    |
| 1.0 to 2.0     | 60 to 119   | Loader: accent circle 152, ink arc of 270°, one turn in 0.75 s       | width 488 to 152                                                       |
| 2.0 to 3.0     | 120 to 179  | Check, accent, 12 px stroke                                           | an ink disk grows from the centre and covers the accent                |
| 3.0 to 4.5     | 180 to 269  | Chiour player 896×256: play, « Tehilim 23 », waveform                 | the circle opens into the card; at 3.5 the playback runs (linear)      |
| 4.5 to 5.0     | 270 to 299  | Slider 896×64                                                         | the card flattens; the played part of the wave becomes the fill        |
| 5.0 to 6.0     | 300 to 359  | Drag                                                                  | knob from 35 % to 80 %                                                 |
| 6.0 to 7.0     | 360 to 419  | Toggle 280×152, off, a bell in the knob (the reminder)                | the track closes in; the fill goes under the knob                      |
| 7.0 to 8.0     | 420 to 479  | Toggle on                                                             | knob to the right, the accent stretches behind it                      |
| 8.0 to 9.5     | 480 to 569  | Chart: the wall of Mon parcours, 896×640                              | the card grows, the wall rises stone by stone; today's stone is last  |
| 9.5 to 11.5    | 570 to 689  | Toast « Siyoum · 150/150 », 544×128, 352 px below the centre         | the card shrinks and drops in one move; the wall settles               |
| 11.5 to 12.0   | 690 to 719  | Back to the button, ink, the accent dot on the left                   | the toast rises and becomes the pill                                   |
| 12.0 to 12.5   | 720 to 749  | Recolouring                                                           | the dot grows over the whole button, the label turns ink with it       |
| 12.5 to 14.0   | 750 to 839  | Button at rest, the tagline back                                      | none; frame 839 runs into frame 0                                      |

The signature « Petite Jérusalem » never moves. « Gratuite, sans publicité »
shows on the rest, from 12.5 s to 0.5 s of the next loop: a story plays only
once, and its last frames act as the end card.
