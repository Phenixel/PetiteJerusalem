/**
 * Ce qui s'affiche dans l'écran du téléphone : une capture, une séquence
 * de captures (un geste filmé image par image), une page entière qui
 * défile, ou deux écrans enchaînés.
 */
import type { ReactNode } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, tween } from "../anim.ts";
import { APP_H, SCREEN_W } from "./Phone.tsx";

export const capture = (name: string) => staticFile(`captures/${name}`);

export function Shot({ src, y = 0 }: { src: string; y?: number }) {
  return (
    <Img
      src={capture(src)}
      style={{ position: "absolute", left: 0, top: -y, width: SCREEN_W, display: "block" }}
    />
  );
}

/**
 * Une séquence filmée : `frames` liste les captures, `at` l'image de la
 * vidéo où chacune prend la place de la précédente.
 */
export function Seq({ frames, at }: { frames: string[]; at: number[] }) {
  const frame = useCurrentFrame();
  let index = 0;
  for (let i = 0; i < at.length; i++) if (frame >= at[i]) index = i;
  return (
    <>
      {/* Toutes chargées d'avance, une seule visible : pas de trou au rendu. */}
      {frames.map((f, i) => (
        <Img
          key={f}
          src={capture(f)}
          style={{ position: "absolute", left: 0, top: 0, width: SCREEN_W, opacity: i === index ? 1 : 0 }}
        />
      ))}
    </>
  );
}

/** Numérote une séquence : seqFrames("night-kotel", 0, 12) → night-kotel-00.jpg… */
export const seqFrames = (name: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${name}-${String(from + i).padStart(2, "0")}.jpg`);

/** Le haut de la barre d'onglets de l'app (bouton rond compris), en points. */
const TABBAR_TOP = 738;

/**
 * Une page entière (capture fullPage, sans ses éléments fixes) qui défile
 * de `fromY` à `toY` points. `chrome` est une capture ordinaire de la même
 * page : sa barre d'onglets est reposée par-dessus, immobile.
 */
export function Scroll({ src, chrome, fromY, toY, start, end }: { src: string; chrome: string; fromY: number; toY: number; start: number; end: number }) {
  const frame = useCurrentFrame();
  const y = tween(frame, start, end, fromY, toY);
  return (
    <>
      <Shot src={src} y={y} />
      <div style={{ position: "absolute", left: 0, right: 0, top: TABBAR_TOP, bottom: 0, overflow: "hidden" }}>
        <Shot src={chrome} y={TABBAR_TOP} />
      </div>
    </>
  );
}

/**
 * L'écran du dessus s'ouvre en cercle depuis un point (le bouton rond des
 * horaires, par exemple), comme dans l'app.
 */
export function CircleReveal({
  under,
  over,
  cx,
  cy,
  start,
  duration = 12,
}: {
  under: ReactNode;
  over: ReactNode;
  cx: number;
  cy: number;
  start: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const r = tween(frame, start, start + duration, 0, 1000);
  return (
    <>
      {under}
      <div style={{ position: "absolute", inset: 0, clipPath: `circle(${r}px at ${cx}px ${cy}px)` }}>{over}</div>
    </>
  );
}

/** Deux écrans, le second glisse par-dessus depuis la droite (navigation). */
export function Push({ from, to, start, duration = 9 }: { from: ReactNode; to: ReactNode; start: number; duration?: number }) {
  const frame = useCurrentFrame();
  const p = tween(frame, start, start + duration, 0, 1);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${-p * 30}%)` }}>{from}</div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${(1 - p) * 100}%)`,
          boxShadow: p > 0 && p < 1 ? "-10px 0 30px rgba(0,0,0,0.15)" : undefined,
        }}
      >
        {to}
      </div>
    </>
  );
}

/** Un écran posé par-dessus en fondu, à `start`. */
export function Fade({ children, start, duration = 4 }: { children: ReactNode; start: number; duration?: number }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [start, start + duration], [0, 1], clamp);
  return <div style={{ position: "absolute", inset: 0, opacity: o }}>{children}</div>;
}

/** Hauteur de l'écran de l'app, pour les calculs de défilement. */
export const VIEW_H = APP_H;
