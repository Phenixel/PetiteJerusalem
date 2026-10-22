/**
 * The frame of the version 4.0 video: the music, then the five sections on
 * the grid, as in the first series (src/Promo.tsx). The opening strikes
 * « 4.0 » on the orange; the feature section strings the chapters of the
 * cut (plan.ts), the phone going from one to the next on the same stone
 * wall; « Et aussi » breaks; the montage passes twelve more changes; the end
 * card builds the logo. Color wipes sweep the two big cuts.
 *
 * `kind`: `app` ends on a good discovery and holds its last image (the
 * video the app plays); `promo` ends on the stores and fades (the same
 * video, for the networks).
 */
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { B } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { Wipe } from "../components/Backgrounds.tsx";
import { FPS } from "../timeline.ts";
import { videoTimeline, type VideoSpec } from "../videos.ts";
import { CHAPTERS } from "./chapters.tsx";
import { V4 } from "./palette.ts";
import { BreakV4, EndCardV4, HookV4, MontageV4, type MontageItemV4 } from "./parts.tsx";
import type { CutPlan, MontageShot } from "./plan.ts";
import { STRINGS, type Locale } from "./strings.ts";

/** The capture of a montage shot, when it is not named after it (shots-v4.mjs). */
const MONTAGE_SHOTS: Partial<Record<MontageShot, string>> = {
  sidourAjouts: "sidour-ajouts",
  // The compass locked on the Kotel, its dial full.
  boussole: "boussole-17",
};

export function Update({ spec, plan, locale, kind }: { spec: VideoSpec; plan: CutPlan; locale: Locale; kind: "promo" | "app" }) {
  const strings = STRINGS[locale];
  const timeline = videoTimeline(spec);
  const at = (k: string) => timeline.sections.find((s) => s.kind === k)!;
  const seq = (k: string) => ({ from: B(at(k).from), durationInFrames: B(at(k).beats) });
  const items: MontageItemV4[] = plan.montage.map((id) => ({ label: strings.montage[id], src: `${locale}-${MONTAGE_SHOTS[id] ?? id}.jpg` }));
  let from = 0;
  const chapters = plan.chapters.map((chapter) => {
    const start = from;
    from += chapter.beats;
    const Chapter = CHAPTERS[chapter.id];
    const m = (name: string) => {
      const mark = chapter.marks[name];
      if (!mark) throw new Error(`Unknown mark: ${chapter.id}.${name}`);
      return B(mark.beat);
    };
    return (
      <Sequence key={chapter.id} from={B(at("feature").from + start)} durationInFrames={B(chapter.beats)}>
        <Chapter loc={locale} strings={strings} plan={chapter} m={m} len={B(chapter.beats)} />
      </Sequence>
    );
  });
  return (
    // Lining figures: Playfair's default old-style ones make « 4.0 » read « 4.o ».
    <AbsoluteFill style={{ background: V4.bg, fontVariantNumeric: "lining-nums" }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <HookV4 strings={strings} beats={at("hook").beats} />
      </Sequence>
      {/* One wall for the whole feature, so it does not jump from chapter to chapter. */}
      <Sequence {...seq("feature")}>
        <StoneWall bg={V4.bg} drift={0.4} seed="v4-feature" />
      </Sequence>
      {chapters}
      <Sequence {...seq("break")}>
        <BreakV4 strings={strings} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <MontageV4 items={items} tag={strings.also.join(" ")} dir={strings.dir} />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        <EndCardV4 kind={kind} strings={strings} length={B(at("end").beats)} />
      </Sequence>
      <Wipe at={B(at("feature").from)} color={V4.blue} />
      <Wipe at={B(at("end").from)} color={V4.orange} />
    </AbsoluteFill>
  );
}
