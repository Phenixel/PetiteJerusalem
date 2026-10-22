/**
 * Les fonds. Le mur de pierre (les assises de pierre de Jérusalem, en
 * aplats à peine plus clairs ou plus sombres que le fond, comme
 * StoneWallBackground dans l'app), et le volet de couleur qui balaie
 * l'écran d'une scène à l'autre. Aucun dégradé.
 */
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { tween } from "../anim.ts";

const COURSE_H = 132;
const GAP = 8;

export function StoneWall({
  bg,
  dark = false,
  onColor = false,
  drift = 0.6,
  seed = "mur",
}: {
  bg: string;
  dark?: boolean;
  /** Sur un aplat de couleur du thème : des pierres à peine marquées. */
  onColor?: boolean;
  drift?: number;
  seed?: string;
}) {
  const frame = useCurrentFrame();
  const rows = Math.ceil(2200 / COURSE_H) + 2;
  const shift = (frame * drift) % COURSE_H;
  const tone = (r: number) => {
    const v = random(`${seed}-${r}`);
    if (onColor) return v < 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
    if (dark) return v < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.045)";
    return v < 0.33 ? "rgba(90,70,30,0.035)" : v < 0.66 ? "rgba(255,255,255,0.35)" : "rgba(90,70,30,0.06)";
  };
  const joint = onColor ? "rgba(0,0,0,0.08)" : dark ? "rgba(0,0,0,0.25)" : "rgba(90,70,30,0.07)";
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -200, top: -COURSE_H * 2 - shift, width: 1500, background: joint }}>
        {Array.from({ length: rows }, (_, r) => {
          let x = -random(`${seed}-off-${r}`) * 260;
          const blocks = [];
          let b = 0;
          while (x < 1500) {
            const w = 200 + random(`${seed}-${r}-${b}`) * 240;
            blocks.push(
              <div
                key={b}
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  width: w - GAP,
                  height: COURSE_H - GAP,
                  background: bg,
                  borderRadius: 4,
                }}
              >
                <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: tone(r * 100 + b) }} />
              </div>,
            );
            x += w;
            b++;
          }
          return (
            <div key={r} style={{ position: "relative", height: COURSE_H }}>
              {blocks}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Le volet : un aplat de couleur qui entre en biais, couvre l'écran puis
 * ressort de l'autre côté. `at` est l'instant où il couvre tout (la coupe).
 */
export function Wipe({ at, color, len = 7, angle = 18 }: { at: number; color: string; len?: number; angle?: number }) {
  const frame = useCurrentFrame();
  if (frame < at - len || frame > at + len) return null;
  const skew = Math.tan((angle * Math.PI) / 180) * 1920;
  const lead = tween(frame, at - len, at, -skew - 100, 1180);
  const tail = tween(frame, at, at + len, -skew - 100, 1180 + skew);
  return (
    <AbsoluteFill style={{ zIndex: 50, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          clipPath: `polygon(${tail}px 0, ${lead + skew}px 0, ${lead}px 1920px, ${tail - skew}px 1920px)`,
        }}
      />
    </AbsoluteFill>
  );
}
