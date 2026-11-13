/**
 * Le doigt, dessiné dans l'écran du téléphone (points de l'app) : un appui
 * qui laisse une onde, ou un glissé d'un point à un autre. Même idée que
 * MockTouch dans l'app : un disque clair, pas une main.
 */
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, tween } from "../anim.ts";

const DOT = 46;

function Dot({ x, y, scale, opacity }: { x: number; y: number; scale: number; opacity: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x - DOT / 2,
        top: y - DOT / 2,
        width: DOT,
        height: DOT,
        borderRadius: DOT,
        background: "rgba(255,255,255,0.55)",
        boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 6px 18px rgba(0,0,0,0.25)",
        transform: `scale(${scale})`,
        opacity,
      }}
    />
  );
}

/** Un appui à `at` : le doigt descend, presse, repart en laissant une onde. */
export function Tap({ x, y, at, color = "#ffffff" }: { x: number; y: number; at: number; color?: string }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -8 || t > 22) return null;
  const scale = interpolate(t, [-8, 0, 4, 12], [1.6, 0.85, 1, 1.2], clamp);
  const opacity = interpolate(t, [-8, -3, 8, 14], [0, 1, 1, 0], clamp);
  const ring = interpolate(t, [0, 18], [0.4, 2.6], clamp);
  const ringO = interpolate(t, [0, 18], [0.8, 0], clamp);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - DOT / 2,
          top: y - DOT / 2,
          width: DOT,
          height: DOT,
          borderRadius: DOT,
          border: `3px solid ${color}`,
          transform: `scale(${ring})`,
          opacity: t >= 0 ? ringO : 0,
        }}
      />
      <Dot x={x} y={y} scale={scale} opacity={opacity} />
    </>
  );
}

/** Un glissé de (x0, y0) à (x1, y1), entre `start` et `end`. */
export function Swipe({ x0, y0, x1, y1, start, end }: { x0: number; y0: number; x1: number; y1: number; start: number; end: number }) {
  const frame = useCurrentFrame();
  if (frame < start - 6 || frame > end + 8) return null;
  const x = tween(frame, start, end, x0, x1);
  const y = tween(frame, start, end, y0, y1);
  const opacity = interpolate(frame, [start - 6, start, end, end + 8], [0, 1, 1, 0], clamp);
  const scale = interpolate(frame, [start - 6, start], [1.5, 0.9], clamp);
  return <Dot x={x} y={y} scale={scale} opacity={opacity} />;
}

/** Un cadre de la couleur du thème qui respire autour d'une zone (points de l'app). */
export function Spotlight({
  x,
  y,
  w,
  h,
  start,
  end,
  color,
  radius = 10,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
  color: string;
  radius?: number;
}) {
  const frame = useCurrentFrame();
  if (frame < start || frame > end + 6) return null;
  const inP = tween(frame, start, start + 7, 0, 1);
  const outO = interpolate(frame, [end, end + 6], [1, 0], clamp);
  const breathe = 1 + Math.sin((frame - start) / 5) * 0.012;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 6,
        top: y - 6,
        width: w + 12,
        height: h + 12,
        borderRadius: radius + 6,
        border: `4px solid ${color}`,
        opacity: inP * outO,
        transform: `scale(${(1.15 - 0.15 * inP) * breathe})`,
      }}
    />
  );
}
