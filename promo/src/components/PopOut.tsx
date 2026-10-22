/**
 * Une carte de l'écran qui sort du téléphone : la zone de la capture se
 * détache, grandit et vient flotter devant, avec l'ombre de la maison, puis
 * retourne à sa place. Le téléphone doit être à plat pendant ce temps.
 */
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, springAt } from "../anim.ts";
import { SHADOW_POP } from "../theme.ts";
import type { Zone } from "../zones.ts";
import { screenToCanvas, type PhonePose } from "./Phone.tsx";
import { SCREEN_W } from "./Phone.tsx";
import { capture } from "./Screens.tsx";

export function PopOut({
  src,
  zone,
  pose,
  start,
  end,
  to,
  tilt = -3,
}: {
  src: string;
  zone: Zone;
  pose: PhonePose;
  start: number;
  end: number;
  /** Centre et largeur d'arrivée, dans la vidéo. */
  to: { x: number; y: number; width: number };
  tilt?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start || frame > end + 14) return null;
  const from = screenToCanvas(pose, zone.x + zone.w / 2, zone.y + zone.h / 2);
  const fromW = zone.w * from.s;
  const p = springAt(frame, fps, start, { damping: 13, stiffness: 140 }) - springAt(frame, fps, end, { damping: 16, stiffness: 160 });
  const x = interpolate(p, [0, 1], [from.x, to.x]);
  const y = interpolate(p, [0, 1], [from.y, to.y]);
  const w = interpolate(p, [0, 1], [fromW, to.width]);
  const k = w / zone.w;
  const shadow = interpolate(p, [0, 0.3], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - (zone.h * k) / 2,
        width: w,
        height: zone.h * k,
        overflow: "hidden",
        borderRadius: 6 * k,
        boxShadow: shadow > 0 ? SHADOW_POP : undefined,
        transform: `rotate(${tilt * p}deg)`,
        zIndex: 5,
      }}
    >
      <Img src={capture(src)} style={{ position: "absolute", left: -zone.x * k, top: -zone.y * k, width: SCREEN_W * k }} />
    </div>
  );
}
