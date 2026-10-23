/**
 * The advertisement (`pub`): the frame of the 4.0 video (the music, the five
 * sections on the grid), with its own content. The opening strikes three
 * verbs and builds the logo; the feature section tells one day in motion
 * design (scenes.tsx); « Pour de vrai… » breaks; the montage shows the real
 * screens; the end card gives the stores, without the version.
 */
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { B } from "../anim.ts";
import { Wipe } from "../components/Backgrounds.tsx";
import { FPS } from "../timeline.ts";
import { videoTimeline, type VideoSpec } from "../videos.ts";
import { V4 } from "../v4/palette.ts";
import { BreakV4, EndCardV4, MontageV4 } from "../v4/parts.tsx";
import { STRINGS } from "../v4/strings.ts";
import { C } from "./art.tsx";
import type { AdPlan } from "./plan.ts";
import { AdHook, SCENES } from "./scenes.tsx";

/** The 4.0 words, but the break that leads to the real screens. */
const WORDS = { ...STRINGS.fr, also: ["Pour", "de vrai"] as [string, string] };

export function Ad({ spec, plan }: { spec: VideoSpec; plan: AdPlan }) {
  const timeline = videoTimeline(spec);
  const at = (k: string) => timeline.sections.find((s) => s.kind === k)!;
  const seq = (k: string) => ({ from: B(at(k).from), durationInFrames: B(at(k).beats) });
  let from = 0;
  // A color sweeps each change of scene, as the two big cuts.
  const sweeps: { at: number; color: string }[] = [];
  const scenes = plan.scenes.map((scene, i) => {
    if (i > 0) sweeps.push({ at: B(at("feature").from + from), color: i % 2 ? C.orange : C.blue });
    const start = from;
    from += scene.beats;
    const Scene = SCENES[scene.id];
    const m = (name: string) => {
      const mark = scene.marks[name];
      if (!mark) throw new Error(`Unknown mark: ${scene.id}.${name}`);
      return B(mark.beat);
    };
    return (
      <Sequence key={scene.id} from={B(at("feature").from + start)} durationInFrames={B(scene.beats)}>
        <Scene m={m} len={B(scene.beats)} />
      </Sequence>
    );
  });
  return (
    <AbsoluteFill style={{ background: C.cream, fontVariantNumeric: "lining-nums" }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <AdHook beats={at("hook").beats} />
      </Sequence>
      {scenes}
      <Sequence {...seq("break")}>
        <BreakV4 strings={WORDS} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <MontageV4 items={plan.montage} tag="Dans l'app" />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        <EndCardV4 kind="promo" strings={WORDS} length={B(at("end").beats)} version={false} />
      </Sequence>
      <Wipe at={B(at("feature").from)} color={V4.blue} />
      {sweeps.map((sweep) => (
        <Wipe key={sweep.at} at={sweep.at} color={sweep.color} />
      ))}
      <Wipe at={B(at("end").from)} color={V4.orange} />
    </AbsoluteFill>
  );
}
