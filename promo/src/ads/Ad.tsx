/**
 * Series 3: the ads of version 4.0. Series 1's frame and pace (src/Promo.tsx),
 * one feature per video, then « Mais aussi… » and eight more at one beat
 * each, dressed in the 4.0 colors and ending on the designer's logo and the
 * stores (src/v4/parts.tsx, EndCardV4).
 *
 * The 4.0 presentation (src/v4/Update.tsx) explains the update calmly; these
 * sell it, one change at a time, at series 1's speed.
 */
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { B, springAt, tween } from "../anim.ts";
import { StoneWall, Wipe } from "../components/Backgrounds.tsx";
import { DISPLAY, SANS } from "../theme.ts";
import { FPS } from "../timeline.ts";
import { videoTimeline, type VideoSpec } from "../videos.ts";
import { V4 } from "../v4/palette.ts";
import { BreakV4, EndCardV4, MontageV4 } from "../v4/parts.tsx";
import { STRINGS } from "../v4/strings.ts";
import { AD_SHOTS, type AdShot } from "./shots.ts";

export type AdHookLine = { text: string; beat: number; accent?: boolean };

export type AdFeatureProps = {
  /** A marked beat of the feature section, in frames from its start. */
  m: (name: string) => number;
};

/** A camera shake that dies down after each hit. */
function shake(frame: number, hits: number[], amp = 14) {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 10) continue;
    const k = Math.exp(-t / 3) * amp;
    x += (random(`ax${h}-${t}`) - 0.5) * 2 * k;
    y += (random(`ay${h}-${t}`) - 0.5) * 2 * k;
  }
  return `translate(${x}px, ${y}px)`;
}

/**
 * The hook, series 1's: on the pastel orange, a question or a promise struck
 * line by line on the beats, the last line in the night ink; then the pill
 * that says it comes with 4.0.
 */
function HookAd({ lines, beats }: { lines: AdHookLine[]; beats: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hits = lines.map((l) => B(l.beat));
  const end = B(beats);
  const exit = tween(frame, end - 6, end, 0, 1);
  const pillAt = B(2.2);
  const pill = springAt(frame, fps, pillAt, { damping: 11, stiffness: 220 });
  return (
    <AbsoluteFill style={{ transform: shake(frame, hits) }}>
      <StoneWall bg={V4.orange} onColor drift={1.2} seed="ad-hook" />
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", padding: "0 70px", transform: `scale(${1 + exit * 0.6})`, opacity: 1 - exit }}
      >
        {lines.map((line, i) => {
          if (frame < hits[i]) return null;
          const p = springAt(frame, fps, hits[i], { damping: 11, stiffness: 220, mass: 0.6 });
          return (
            <div
              key={i}
              style={{
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: line.text.length > 14 ? 118 : 150,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: line.accent ? V4.night : V4.onOrange,
                fontStyle: line.accent ? "italic" : undefined,
                textAlign: "center",
                transform: `scale(${2.2 - 1.2 * p}) rotate(${(1 - p) * -5}deg)`,
                opacity: Math.min(1, p * 3),
              }}
            >
              {line.text}
            </div>
          );
        })}
        <div style={{ height: 50 }} />
        <div
          style={{
            padding: "14px 36px",
            borderRadius: 999,
            background: V4.night,
            color: "#ffffff",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 40,
            transform: `scale(${frame < pillAt ? 0 : pill})`,
          }}
        >
          Nouveau dans la{" "}
          <span style={{ fontFamily: DISPLAY, fontStyle: "italic", color: V4.orange }}>4.0</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const FR = STRINGS.fr;

export function Ad({ spec, hook, Feature }: { spec: VideoSpec; hook: AdHookLine[]; Feature: ComponentType<AdFeatureProps> }) {
  const timeline = videoTimeline(spec);
  const at = (kind: string) => timeline.sections.find((s) => s.kind === kind)!;
  const seq = (kind: string) => ({ from: B(at(kind).from), durationInFrames: B(at(kind).beats) });
  const m = (name: string) => {
    const mark = spec.marks[name];
    if (!mark) throw new Error(`Unknown mark: ${name}`);
    return B(mark.beat);
  };
  const items = (spec.adMontage ?? []).map((id: AdShot) => AD_SHOTS[id]);
  return (
    // Lining figures: Playfair's old-style ones make « 4.0 » read « 4.o ».
    <AbsoluteFill style={{ background: V4.bg, fontVariantNumeric: "lining-nums" }}>
      <Audio src={staticFile(`music/${spec.id}.wav`)} />
      <Sequence {...seq("hook")}>
        <HookAd lines={hook} beats={at("hook").beats} />
      </Sequence>
      <Sequence {...seq("feature")}>
        <StoneWall bg={V4.bg} drift={0.6} seed={`ad-${spec.id}`} />
        <Feature m={m} />
      </Sequence>
      <Sequence {...seq("break")}>
        <BreakV4 strings={{ ...FR, also: ["Mais", "aussi"] }} />
      </Sequence>
      <Sequence {...seq("montage")}>
        <MontageV4 items={items} tag="Mais aussi" beats={1} />
      </Sequence>
      <Sequence from={B(at("end").from)} durationInFrames={B(at("end").beats) + Math.round(timeline.tail * FPS)}>
        <EndCardV4 kind="promo" strings={FR} length={B(at("end").beats)} />
      </Sequence>
      <Wipe at={B(at("feature").from)} color={V4.blue} />
      <Wipe at={B(at("end").from)} color={V4.orange} />
    </AbsoluteFill>
  );
}
