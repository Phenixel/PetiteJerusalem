/**
 * Les effets de la série 2. Plus de mouvement que la première, mais rien
 * qui empêche de lire : un sous-titre reste posé tant que dure son plan,
 * sur une plaque qui le détache de ce qui bouge derrière.
 *
 * - Subtitle : la phrase du plan, mot après mot, l'accent dans un aplat de
 *   la couleur du thème qui se remplit au passage ;
 * - StoneMosaic : la transition maison, des pierres qui se posent en vague
 *   puis repartent ;
 * - FlipClock, Counter : l'heure à volets, le nombre qui défile ;
 * - Marquee : un bandeau incliné qui fait défiler des mots ;
 * - Shine : le reflet qui passe sur la vitre du téléphone ;
 * - TextWindow : un mot géant dont les lettres laissent voir l'app ;
 * - BeatBump : une respiration de la scène sur chaque temps.
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { FPB, clamp, springAt, tween } from "../anim.ts";
import { DISPLAY, SANS, SHADOW_POP, palette, type Look } from "../theme.ts";
import { capture } from "./Screens.tsx";
import { parse } from "./Text.tsx";

// --- Subtitle -------------------------------------------------------------------

/**
 * Les morceaux d'une ligne : chaque mot ordinaire seul, et les mots d'accent
 * qui se suivent réunis en un seul aplat (« *au bon moment* » est une
 * pastille, pas trois).
 */
function segments(line: string) {
  const out: { text: string; accent: boolean }[] = [];
  for (const word of parse(line)) {
    const last = out[out.length - 1];
    if (word.accent && last?.accent) last.text += ` ${word.text}`;
    else out.push({ ...word });
  }
  return out;
}

export function Subtitle({
  lines,
  start,
  end,
  look,
  top = 220,
  size = 84,
  dir,
  accent,
}: {
  /** « rtl » pour une phrase en hébreu. */
  dir?: "rtl";
  /** La couleur de l'aplat d'accent, quand ce n'est pas celle du thème (une fête). */
  accent?: string;
  lines: string[];
  start: number;
  /** Image où la phrase s'en va ; absente, elle reste. */
  end?: number;
  look: Look;
  top?: number;
  size?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start - 1 || (end !== undefined && frame > end + 12)) return null;
  const pal = { ...palette(look), ...(accent ? { primary: accent } : {}) };
  let index = 0;
  return (
    <div dir={dir} style={{ position: "absolute", top, left: 40, right: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zIndex: 20 }}>
      {lines.map((line, li) => {
        const lineAt = start + li * 4;
        const plate = springAt(frame, fps, lineAt, { damping: 16, stiffness: 220 });
        const leave = end === undefined ? 0 : tween(frame, end + li * 2, end + li * 2 + 8, 0, 1);
        return (
          <div
            key={li}
            style={{
              position: "relative",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              columnGap: size * 0.24,
              padding: `${size * 0.12}px ${size * 0.34}px ${size * 0.18}px`,
              transform: `translateY(${leave * -80}px)`,
              opacity: 1 - leave,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: pal.surface,
                borderRadius: 6,
                boxShadow: SHADOW_POP,
                transform: `scaleX(${plate})`,
              }}
            />
            {segments(line).map((word) => {
              const i = index++;
              const at = lineAt + 2 + i * 2;
              const p = springAt(frame, fps, at, { damping: 11, stiffness: 260, mass: 0.5 });
              // L'aplat de l'accent se remplit dans le sens de la lecture.
              const fill = tween(frame, at, at + 9, 0, 100);
              return (
                <span
                  key={i}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontStyle: word.accent ? "italic" : undefined,
                    fontSize: size,
                    lineHeight: 1.12,
                    letterSpacing: "-0.02em",
                    color: word.accent ? "#ffffff" : pal.ink,
                    padding: word.accent ? `0 ${size * 0.16}px` : undefined,
                    whiteSpace: "nowrap",
                    transform: `translateY(${(1 - p) * 30}px) scale(${0.7 + 0.3 * p})`,
                    opacity: Math.min(1, p * 2),
                  }}
                >
                  {word.accent ? (
                    <span
                      style={{
                        position: "absolute",
                        inset: `${size * 0.06}px 0 ${size * 0.04}px`,
                        background: pal.primary,
                        borderRadius: 4,
                        clipPath: dir === "rtl" ? `inset(0 0 0 ${100 - fill}%)` : `inset(0 ${100 - fill}% 0 0)`,
                        zIndex: -1,
                      }}
                    />
                  ) : null}
                  <span style={{ position: "relative", color: word.accent && fill < 50 ? pal.primary : undefined }}>{word.text}</span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// --- StoneMosaic ---------------------------------------------------------------

/**
 * Des pierres de la couleur `color` se posent en vague diagonale jusqu'à
 * couvrir l'écran à `at`, puis repartent dans le même ordre : la coupe se
 * fait dessous.
 */
export function StoneMosaic({ at, color, joint = "rgba(0,0,0,0.18)", len = 9, seed = "mosaique" }: { at: number; color: string; joint?: string; len?: number; seed?: string }) {
  const frame = useCurrentFrame();
  if (frame < at - len - 6 || frame > at + len + 6) return null;
  const H = 160;
  const rows = Math.ceil(1920 / H) + 1;
  const blocks: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    let x = -random(`${seed}-o${r}`) * 200;
    let b = 0;
    while (x < 1080) {
      const w = 220 + random(`${seed}-${r}-${b}`) * 200;
      const cx = x + w / 2;
      const delay = ((cx / 1080) * 0.5 + (r / rows) * 0.5) * 6;
      const pin = interpolate(frame, [at - len - 6 + delay, at - len + 2 + delay], [0, 1], clamp);
      const pout = interpolate(frame, [at + delay * 0.8, at + 8 + delay * 0.8], [0, 1], clamp);
      const scale = pin * (1 - pout);
      if (scale > 0) {
        blocks.push(
          <div
            key={`${r}-${b}`}
            style={{
              position: "absolute",
              left: x - 2,
              top: r * H - 2,
              width: w + 4,
              height: H + 4,
              background: joint,
              transform: `scale(${scale}) rotate(${(1 - scale) * (random(`${seed}-r${r}-${b}`) - 0.5) * 30}deg)`,
            }}
          >
            <div style={{ position: "absolute", inset: 4, background: color, borderRadius: 4 }} />
          </div>,
        );
      }
      x += w;
      b++;
    }
  }
  return <AbsoluteFill style={{ zIndex: 60, overflow: "hidden" }}>{blocks}</AbsoluteFill>;
}

// --- FlipClock -----------------------------------------------------------------

function FlipDigit({ from, to, at, size, bg, ink }: { from: string; to: string; at: number; size: number; bg: string; ink: string }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  const card = (ch: string, style: CSSProperties) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: size * 0.08,
        background: bg,
        color: ink,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        lineHeight: `${size * 1.3}px`,
        textAlign: "center",
        backfaceVisibility: "hidden",
        ...style,
      }}
    >
      {ch}
    </div>
  );
  const flipping = from !== to && t >= 0 && t < 8;
  return (
    <div style={{ position: "relative", width: size * 0.72, height: size * 1.3, perspective: 600 }}>
      {flipping ? (
        <>
          {card(from, { transform: `rotateX(${interpolate(t, [0, 4], [0, -90], clamp)}deg)`, opacity: t < 4 ? 1 : 0 })}
          {card(to, { transform: `rotateX(${interpolate(t, [4, 8], [90, 0], clamp)}deg)`, opacity: t >= 4 ? 1 : 0 })}
        </>
      ) : (
        card(t < 0 ? from : to, {})
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, background: "rgba(0,0,0,0.35)" }} />
    </div>
  );
}

/** L'heure à volets : `times` donne, image après image, l'heure affichée. */
export function FlipClock({ times, size = 150, bg, ink }: { times: { at: number; value: string }[]; size?: number; bg: string; ink: string }) {
  const frame = useCurrentFrame();
  let k = 0;
  for (let i = 0; i < times.length; i++) if (frame >= times[i].at) k = i;
  const current = times[k];
  const previous = times[Math.max(0, k - 1)];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.08 }}>
      {current.value.split("").map((ch, i) =>
        ch === ":" ? (
          <div key={i} style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, color: bg, lineHeight: 1 }}>
            :
          </div>
        ) : (
          <FlipDigit key={i} from={previous.value[i]} to={ch} at={current.at} size={size} bg={bg} ink={ink} />
        ),
      )}
    </div>
  );
}

// --- Counter -------------------------------------------------------------------

/** Un nombre qui défile jusqu'à sa valeur, puis frappe. */
export function Counter({ value, start, duration = 18, size, color, suffix = "" }: { value: number; start: number; duration?: number; size: number; color: string; suffix?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(tween(frame, start, start + duration, 0, value));
  const hit = springAt(frame, fps, start + duration, { damping: 8, stiffness: 300 });
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.04em",
        color,
        fontVariantNumeric: "lining-nums tabular-nums",
        transform: `scale(${frame >= start + duration ? 1 + 0.12 * (1 - hit) : 1})`,
        opacity: frame < start ? 0 : 1,
      }}
    >
      {n}
      {suffix}
    </div>
  );
}

// --- Marquee ---------------------------------------------------------------------

/** Un bandeau incliné, de la couleur `bg`, où défilent des mots. */
export function Marquee({ words, y, bg, color, angle = -6, speed = 6, size = 44 }: { words: string[]; y: number; bg: string; color: string; angle?: number; speed?: number; size?: number }) {
  const frame = useCurrentFrame();
  const copy = (k: number) => (
    <div key={k} style={{ display: "flex", flex: "none" }}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.6, paddingRight: size * 0.6 }}>
          {w}
          <span style={{ width: size * 0.22, height: size * 0.22, background: color, transform: "rotate(45deg)", display: "inline-block" }} />
        </span>
      ))}
    </div>
  );
  // Deux copies côte à côte : décaler de 50 % ramène au départ, sans couture.
  const shift = ((frame * speed) / 30) % 50;
  return (
    <div
      style={{
        position: "absolute",
        left: -200,
        right: -200,
        top: y,
        transform: `rotate(${angle}deg)`,
        background: bg,
        color,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        padding: `${size * 0.35}px 0`,
        overflow: "hidden",
        whiteSpace: "nowrap",
        zIndex: 8,
      }}
    >
      <div style={{ display: "inline-flex", transform: `translateX(-${shift}%)` }}>
        {copy(0)}
        {copy(1)}
      </div>
    </div>
  );
}

// --- Shine -----------------------------------------------------------------------

/** Le reflet d'une vitre : une bande claire qui traverse l'écran à `at`. */
export function Shine({ at, duration = 14 }: { at: number; duration?: number }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + duration) return null;
  const x = tween(frame, at, at + duration, -300, 700);
  return (
    <div
      style={{
        position: "absolute",
        top: -200,
        bottom: -200,
        left: x,
        width: 90,
        background: "rgba(255,255,255,0.22)",
        transform: "rotate(18deg)",
        zIndex: 30,
      }}
    />
  );
}

// --- TextWindow ------------------------------------------------------------------

/** Un mot géant dont les lettres laissent voir une capture de l'app. */
export function TextWindow({
  text,
  src,
  size,
  start,
  stroke,
  panY = [0, 0],
  duration = 30,
}: {
  text: string;
  src: string;
  size: number;
  start: number;
  /** Le contour des lettres : sans lui, une capture claire sur un fond clair ne se voit pas. */
  stroke: string;
  panY?: [number, number];
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, start, { damping: 14, stiffness: 120 });
  const y = tween(frame, start, start + duration, panY[0], panY[1]);
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: "-0.05em",
        textAlign: "center",
        color: "transparent",
        backgroundImage: `url(${capture(src)})`,
        backgroundSize: "100% auto",
        backgroundPosition: `50% ${y}%`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextStroke: `${size * 0.018}px ${stroke}`,
        filter: `drop-shadow(0 ${size * 0.02}px 0 ${stroke})`,
        transform: `scale(${1.6 - 0.6 * p})`,
        opacity: Math.min(1, p * 2),
      }}
    >
      {text}
    </div>
  );
}

// --- BeatBump --------------------------------------------------------------------

/** Toute la scène respire d'un poil sur chaque temps. */
export function BeatBump({ children, amount = 0.012, from = 0 }: { children: ReactNode; amount?: number; from?: number }) {
  const frame = useCurrentFrame();
  const t = (frame - from) % FPB;
  const k = frame < from ? 0 : interpolate(t, [0, 6], [1, 0], clamp);
  return <AbsoluteFill style={{ transform: `scale(${1 + amount * k})` }}>{children}</AbsoluteFill>;
}
