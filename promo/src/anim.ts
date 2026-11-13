/** Petits outils d'animation, communs à toutes les scènes. */
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { framesPerBeat } from "./timeline.ts";

export const BPM = 120;
export const FPB = framesPerBeat(BPM);

/** Un nombre de temps en images. */
export const B = (beats: number) => Math.round(beats * FPB);

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Ressort qui démarre à `start` (en images) ; 0 avant, 1 une fois posé. */
export function useSpring(start: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160, mass: 0.7, ...config } });
}

export function springAt(frame: number, fps: number, start: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  return spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 160, mass: 0.7, ...config } });
}

/** Interpolation adoucie entre deux images, bornée. */
export function tween(frame: number, from: number, to: number, a: number, b: number, easing = Easing.bezier(0.22, 1, 0.36, 1)) {
  return interpolate(frame, [from, to], [a, b], { ...clamp, easing });
}

/** Rebond sur le temps : 1 au temps, qui retombe à 0 en `len` images. */
export function beatPulse(frame: number, len = 8) {
  const inBeat = frame % FPB;
  return interpolate(inBeat, [0, len], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
}
