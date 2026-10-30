# Review

## Creative calls

- The first cut (a presentation: the world as a backdrop, real screens in a
  phone held upright, two-line captions on cream) was set aside by the
  owner: it read like the house's earlier videos. This cut is an ad, built
  as one world with its own sound design (storyline A in `STORYLINES.md`;
  B, « the day of a phone », and C, « a board game », were not built).
- The phone is the frame of the whole film: the dive at 4.2 s, the giant
  phone revealed at the end, and the color waves on its screen in between.
- The real screens stay, as phones standing on the islands and turning with
  the camera; the titles carry the words instead of full captions.
- The wall of Mon parcours is built Sunday at the bottom, Chabbat on top,
  the reverse of the app's 2D wall, so no stone hangs in the air
  (`docs/design.md`).

## Measured, looked at, not checked

- `npx hyperframes check`: no error. Kept on purpose: `canvas_content_at_edge`
  (the world is full bleed), `composition_file_too_large` on `monde.html`
  (one scene for one continuous world), `timeline_track_too_dense` on the
  chapters (four or five titles each).
- Looked at: every shot of `SPEC.md` (QA line), the seams between chapters,
  and the review sheets (`snapshot --review`).
- The voice, the music and the sounds were **measured, not heard**: levels
  (`npx hyperframes audio`), and each effect placed on its measured peak.
  The word timings are estimated from the voice's pauses and the syllables,
  not transcribed: a title can lead or trail its word by a few tenths.
- Nobody checked the Kokoro pronunciation by ear; the respellings
  (« Téhilim », « Mishna », « Talmoude », « sioum », « aïfone ») were chosen
  from the phonemizer's output.

## Weakest shots, and what more time would change

- The arrivals: for half a second after each flight the island is still
  empty (study, goals, the wall) before things drop in; landing the first
  object as the camera arrives would remove the gap.
- The year: the wall rushes in while the camera pulls back, but at that
  distance the stones blur into a strip; a short hold on the full wall with
  its 52 weeks would read better.
- The end: at the final distance the islands are specks on the giant
  phone; a slower pull-back, or fewer, bigger islands, would let them read.
- The voice: Kokoro's single French voice is clear but flat; a Google voice
  (Flow, Gemini) needs the owner's account or a key.
