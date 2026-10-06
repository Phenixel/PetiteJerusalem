/**
 * Une gerbe de confettis : des aplats (rectangles, ronds) lancés d'un point,
 * qui retombent en tournant. Calculés image par image, sans état : le même
 * rendu à chaque passage.
 */
import { random, useCurrentFrame } from "remotion";

export function Confetti({ x, y, at, colors, count = 70 }: { x: number; y: number; at: number; colors: string[]; count?: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 70) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (random(`a${i}`) - 0.5) * Math.PI * 1.5;
        const speed = 28 + random(`v${i}`) * 34;
        const drag = Math.pow(0.93, t);
        const dist = (speed * (1 - drag)) / (1 - 0.93);
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist + 0.9 * t * t * 0.5;
        const spin = (random(`s${i}`) - 0.5) * 40 * t;
        const w = 14 + random(`w${i}`) * 16;
        const round = random(`r${i}`) < 0.3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: w,
              height: round ? w : w * 0.45,
              borderRadius: round ? w : 2,
              background: colors[i % colors.length],
              transform: `rotate(${spin}deg) scaleX(${Math.cos((t + i) / 3)})`,
              opacity: t > 55 ? (70 - t) / 15 : 1,
              zIndex: 9,
            }}
          />
        );
      })}
    </>
  );
}
