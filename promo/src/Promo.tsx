/**
 * L'ossature d'une vidéo : la musique, puis les cinq temps posés sur la
 * grille. La scène propre à chaque vidéo (la « feature ») est fournie par
 * son fichier dans src/scenes.
 */
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { B } from "./anim.ts";
import { EndCard } from "./components/Brand.tsx";
import { Wipe } from "./components/Backgrounds.tsx";
import { Break, Hook, Montage } from "./components/Sections.tsx";
import { STONE, THEMES } from "./theme.ts";
import { FPS } from "./timeline.ts";
import { MONTAGE, videoTimeline, type VideoSpec } from "./videos.ts";

export type FeatureProps = { spec: VideoSpec; m: (name: string) => number };

export type HookLine = { text: string; beat: number; accent?: boolean };

export function Promo({ spec, hook, Feature }: { spec: VideoSpec; hook: HookLine[]; Feature: ComponentType<FeatureProps> }) {
  const timeline = videoTimeline(spec);
  const at = (kind: string) => timeline.sections.find((s) => s.kind === kind)!;
  const { primary, secondary } = THEMES[spec.look.theme];
  // Temps marqué → image, depuis le début de la feature.
  const m = (name: string) => {
    const mark = spec.marks[name];
    if (!mark) throw new Error(`Temps inconnu : ${name}`);
    return B(mark.beat);
  };
  const seq = (kind: string, extra = 0) => ({ from: B(at(kind).from), durationInFrames: B(at(kind).beats) + extra });
  return (
    <AbsoluteFill style={{ background: STONE.beige }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <Hook lines={hook} look={spec.look} beats={at("hook").beats} />
      </Sequence>
      <Sequence {...seq("feature")}>
        <Feature spec={spec} m={m} />
      </Sequence>
      <Sequence {...seq("break")}>
        <Break look={spec.look} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <Montage items={spec.montage.map((id) => MONTAGE[id])} accent={secondary} />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        <EndCard primary={primary} start={0} length={B(at("end").beats)} />
      </Sequence>
      {/* Les volets des grandes coupes. */}
      <Wipe at={B(at("feature").from)} color={secondary} />
      <Wipe at={B(at("end").from)} color={primary} />
    </AbsoluteFill>
  );
}
