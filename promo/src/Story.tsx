/**
 * L'ossature de la série 2 (« les histoires ») : 31 secondes, une accroche,
 * une histoire de 36 temps racontée en chapitres, la coupure « Mais
 * aussi… », six autres fonctionnalités à deux temps chacune (le temps de
 * lire), et l'appel à télécharger. Les coupes de section passent par la
 * mosaïque de pierres.
 */
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { B } from "./anim.ts";
import { StoneMosaic } from "./components/Fx.tsx";
import { Break } from "./components/Sections.tsx";
import { EndCard2, Hook2, Montage2, type MontageItem2 } from "./components/Sections2.tsx";
import type { FeatureProps, HookLine } from "./Promo.tsx";
import { STONE, THEMES } from "./theme.ts";
import { FPS } from "./timeline.ts";
import { MONTAGE, videoTimeline, type MontageId, type VideoSpec } from "./videos.ts";
import { center, zone } from "./zones.ts";

/** Où plonge la caméra dans chaque écran du montage (points de l'app). */
const FOCUS: Partial<Record<MontageId, () => { x: number; y: number }>> = {
  horaires: () => center(zone("sunset-horaires:next")),
  rappel: () => center(zone("sunset-horaires-swipe:row")),
  partage: () => ({ x: 195, y: 560 }),
  bibliotheque: () => ({ x: 195, y: 330 }),
  sidour: () => center(zone("night-chaharit:horaire")),
  kotel: () => ({ x: 195, y: 330 }),
  calendrier: () => ({ x: 195, y: 320 }),
  mesdates: () => ({ x: 195, y: 330 }),
  lecture: () => ({ x: 195, y: 220 }),
  chiourim: () => ({ x: 195, y: 330 }),
  talmud: () => ({ x: 195, y: 420 }),
  sombre: () => ({ x: 195, y: 200 }),
};

export function Story({ spec, hook, Feature }: { spec: VideoSpec; hook: HookLine[]; Feature: ComponentType<FeatureProps> }) {
  const timeline = videoTimeline(spec);
  const at = (kind: string) => timeline.sections.find((s) => s.kind === kind)!;
  const { primary, secondary } = THEMES[spec.look.theme];
  const m = (name: string) => {
    const mark = spec.marks[name];
    if (!mark) throw new Error(`Temps inconnu : ${name}`);
    return B(mark.beat);
  };
  const seq = (kind: string) => ({ from: B(at(kind).from), durationInFrames: B(at(kind).beats) });
  const items: MontageItem2[] = spec.montage.map((id) => ({ ...MONTAGE[id], focus: FOCUS[id]?.() }));
  return (
    // Chiffres alignés : ceux de Playfair, par défaut, font du zéro un « o ».
    <AbsoluteFill style={{ background: STONE.beige, fontVariantNumeric: "lining-nums" }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <Hook2 lines={hook} look={spec.look} beats={at("hook").beats} />
      </Sequence>
      <Sequence {...seq("feature")}>
        <Feature spec={spec} m={m} />
      </Sequence>
      <Sequence {...seq("break")}>
        <Break look={spec.look} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <Montage2 items={items} accent={secondary} />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        <EndCard2 look={spec.look} length={B(at("end").beats)} />
      </Sequence>
      <StoneMosaic at={B(at("feature").from)} color={secondary} seed="m-feature" />
      <StoneMosaic at={B(at("end").from)} color={primary} seed="m-fin" />
    </AbsoluteFill>
  );
}
