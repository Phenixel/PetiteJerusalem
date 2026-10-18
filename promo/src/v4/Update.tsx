/**
 * The frame of the version 4.0 videos: the music, then the five sections on
 * the grid. The opening stamps « 4.0 »; the feature section strings the
 * chapters of the cut (plan.ts) one after the other, the phone coming in
 * from alternate sides; « Et aussi » breaks; the montage passes six more
 * changes, two beats each; the end calls to update (`promo`) or wishes a
 * good discovery (`app`). Section cuts go through the stone mosaic.
 */
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { B } from "../anim.ts";
import { StoneMosaic } from "../components/Fx.tsx";
import { FPS } from "../timeline.ts";
import { videoTimeline, type VideoSpec } from "../videos.ts";
import { CHAPTERS } from "./chapters.tsx";
import { V4 } from "./palette.ts";
import { BreakV4, EndAppV4, EndPromoV4, FEATURE_WORDS_V4, HookV4, MontageV4, type MontageItemV4 } from "./parts.tsx";
import type { CutPlan, MontageShot } from "./plan.ts";
import { STRINGS, type Locale } from "./strings.ts";

/** Where the camera dives in each montage screen (app points). */
const FOCUS: Record<MontageShot, { x: number; y: number }> = {
  halakha: { x: 195, y: 280 },
  moussar: { x: 195, y: 330 },
  tikoun: { x: 195, y: 420 },
  chnei: { x: 195, y: 400 },
  signet: { x: 195, y: 320 },
  tehilim: { x: 195, y: 300 },
  sidour: { x: 195, y: 220 },
  contact: { x: 195, y: 470 },
};

const MONTAGE_SRC: Record<MontageShot, string> = {
  halakha: "halakha",
  moussar: "moussar",
  tikoun: "tikoun",
  chnei: "chnei",
  signet: "signet",
  tehilim: "tehilim",
  sidour: "sidour",
  contact: "contact-01",
};

export function Update({ spec, plan, locale, kind }: { spec: VideoSpec; plan: CutPlan; locale: Locale; kind: "promo" | "app" }) {
  const strings = STRINGS[locale];
  const timeline = videoTimeline(spec);
  const at = (k: string) => timeline.sections.find((s) => s.kind === k)!;
  const seq = (k: string) => ({ from: B(at(k).from), durationInFrames: B(at(k).beats) });
  const words = kind === "promo" ? FEATURE_WORDS_V4 : Object.values(strings.montage);
  const items: MontageItemV4[] = plan.montage.map((id) => ({
    label: strings.montage[id],
    src: `${locale}-${MONTAGE_SRC[id]}.jpg`,
    focus: FOCUS[id],
  }));
  let from = 0;
  const chapters = plan.chapters.map((chapter, i) => {
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
        <Chapter loc={locale} strings={strings} plan={chapter} m={m} len={B(chapter.beats)} side={i % 2 ? -1 : 1} />
      </Sequence>
    );
  });
  return (
    // Lining figures: Playfair's default old-style ones make « 4.0 » read « 4.o ».
    <AbsoluteFill style={{ background: V4.bg, fontVariantNumeric: "lining-nums" }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <HookV4
          lines={kind === "promo" ? strings.promoHook : strings.welcome}
          stamp={kind === "promo" ? 2.2 : 1.6}
          words={words}
          dir={strings.dir}
        />
      </Sequence>
      {chapters}
      <Sequence {...seq("break")}>
        <BreakV4 words={strings.also} dir={strings.dir} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <MontageV4 items={items} count={strings.alsoCount} dir={strings.dir} />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        {kind === "promo" ? <EndPromoV4 length={B(at("end").beats)} /> : <EndAppV4 length={B(at("end").beats)} strings={strings} words={words} />}
      </Sequence>
      <StoneMosaic at={B(at("feature").from)} color={V4.orange} seed="v4-m-feature" />
      <StoneMosaic at={B(at("end").from)} color={V4.blue} seed="v4-m-end" />
    </AbsoluteFill>
  );
}
