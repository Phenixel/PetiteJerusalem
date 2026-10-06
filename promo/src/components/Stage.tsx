/**
 * La scène d'une fonctionnalité : le mur de pierre, les légendes en haut
 * (zone sûre des réseaux : rien d'important sous 1 500 px, l'interface de
 * TikTok et d'Instagram y pose ses boutons), le téléphone dessous, qui se
 * déplace d'une pose à l'autre.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, tween } from "../anim.ts";
import { SHADOW_POP, palette, type Look } from "../theme.ts";
import { StoneWall } from "./Backgrounds.tsx";
import type { PhonePose } from "./Phone.tsx";
import { KineticTitle } from "./Text.tsx";

/** La pose de repos : le téléphone sous la légende, qui sort par le bas. */
export const REST: PhonePose = { x: 540, y: 1270, width: 620 };

const EASE = Easing.bezier(0.65, 0, 0.35, 1);

/** Pose interpolée entre des images clés [image, pose]. */
export function poseAt(frame: number, keys: [number, Partial<PhonePose>][]): PhonePose {
  const fields: (keyof PhonePose)[] = ["x", "y", "width", "rx", "ry", "rz", "opacity"];
  const full = keys.map(([f, p]) => [f, { ...REST, rx: 0, ry: 0, rz: 0, opacity: 1, ...p }] as const);
  const out = {} as PhonePose;
  for (const field of fields) {
    out[field] = interpolate(
      frame,
      full.map(([f]) => f),
      full.map(([, p]) => p[field] as number),
      { ...clamp, easing: EASE },
    );
  }
  return out;
}

export type Caption = {
  at: number;
  out?: number;
  lines: string[];
  size?: number;
  /** Posée sur une plaque de pierre : quand le téléphone, zoomé, passe dessous. */
  plate?: boolean;
};

export function Captions({ items, look }: { items: Caption[]; look: Look }) {
  const frame = useCurrentFrame();
  const pal = palette(look);
  return (
    <>
      {items.map((c, i) => {
        if (frame < c.at - 2 || (c.out !== undefined && frame > c.out + 14)) return null;
        const plateIn = c.plate ? tween(frame, c.at - 2, c.at + 6, 0, 1) * (c.out === undefined ? 1 : tween(frame, c.out + 4, c.out + 12, 1, 0)) : 0;
        return (
          <div key={i} style={{ position: "absolute", top: 210, left: 0, right: 0, padding: "30px 60px 40px", zIndex: 10 }}>
            {c.plate ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: pal.bg,
                  boxShadow: SHADOW_POP,
                  transformOrigin: "top",
                  transform: `scaleY(${plateIn})`,
                }}
              />
            ) : null}
            <KineticTitle lines={c.lines} start={c.at} out={c.out} color={pal.ink} accent={pal.primary} size={c.size ?? 100} />
          </div>
        );
      })}
    </>
  );
}

export function Stage({ look, children }: { look: Look; children: ReactNode }) {
  const pal = palette(look);
  return (
    <AbsoluteFill>
      <StoneWall bg={pal.bg} dark={look.dark} />
      {children}
    </AbsoluteFill>
  );
}
