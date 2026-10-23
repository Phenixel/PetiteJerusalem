/**
 * The drawings of the advertisement: flat shapes in the colors of the logo
 * and the banners, no gradient (docs/design.md, "What we do not use"), the
 * app's own icons (src/components/icons/registry.ts, the same drawings as in
 * the app), the logo's pieces for the skyline. Each one is a function of the
 * frame: the same image at every render.
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, interpolateColors, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ICONS } from "../../../src/components/icons/registry.ts";
import { clamp, springAt, tween } from "../anim.ts";
import { KineticTitle } from "../components/Text.tsx";
import { DISPLAY, SANS, SHADOW_POP } from "../theme.ts";
import { BRAND, V4 } from "../v4/palette.ts";

/** The colors: the banners' cream, orange, blue and near black; the hours of the sky, flat. */
export const C = {
  cream: BRAND.bg,
  orange: BRAND.orange,
  blue: BRAND.blue,
  ink: BRAND.title,
  deep: V4.ink,
  soft: V4.textSoft,
  white: "#ffffff",
  night: "#17213B",
  dawn: "#FFD7B3",
  day: "#DCECFA",
  dusk: "#FFC48E",
  stone: "#F1E6D6",
  line: "rgba(30, 27, 24, 0.12)",
};

/** The readers of the chain: six colors that hold apart. */
export const READERS = ["#FEA547", "#539EE2", "#3FA36B", "#8B6BD6", "#E46C8C", "#2BA7A0"];

/** The library's bindings (docs/design.md, "The library shelf"). */
export const BINDINGS = [
  { name: "Tehilim", color: "#96604a" },
  { name: "Michna", color: "#7d6a4c" },
  { name: "Talmud", color: "#6d5743" },
  { name: "Tanakh", color: "#84483f" },
  { name: "Moussar", color: "#86622f" },
  { name: "Halakha", color: "#5e4535" },
];

export const HEBREW = '"Frank Ruhl Libre", serif';

/** An icon of the app, by its name in the registry. */
export function Icon({ name, size, color, stroke = 2, style }: { name: string; size: number; color: string; stroke?: number; style?: CSSProperties }) {
  const def = (ICONS as Record<string, { body: string; filled?: boolean }>)[name];
  if (!def) throw new Error(`Unknown icon: ${name}`);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={def.filled ? color : "none"}
      stroke={def.filled ? "none" : color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flex: "none", ...style }}
      dangerouslySetInnerHTML={{ __html: def.body }}
    />
  );
}

/** The sky: a flat color that turns from one hour to the next. */
export function Sky({ keys }: { keys: [number, string][] }) {
  const frame = useCurrentFrame();
  const color =
    keys.length === 1
      ? keys[0][1]
      : interpolateColors(
          frame,
          keys.map((k) => k[0]),
          keys.map((k) => k[1]),
        );
  return <AbsoluteFill style={{ background: color }} />;
}

/** The night's stars: dots that twinkle, a few of the logo's stars among them. */
export function NightStars({ opacity, seed = "stars", top = 0, bottom = 1300 }: { opacity: number; seed?: string; top?: number; bottom?: number }) {
  const frame = useCurrentFrame();
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity }}>
      {Array.from({ length: 46 }, (_, i) => {
        const x = random(`${seed}x${i}`) * 1080;
        const y = top + random(`${seed}y${i}`) * (bottom - top);
        const s = 3 + random(`${seed}s${i}`) * 5;
        const tw = 0.5 + 0.5 * Math.sin(frame / (7 + random(`${seed}t${i}`) * 9) + i);
        if (i % 9 === 0) {
          return (
            <Img
              key={i}
              src={staticFile(`brand/star-${i % 2 ? "orange" : "blue"}.png`)}
              style={{ position: "absolute", left: x, top: y, width: 34 + s * 4, height: 34 + s * 4, opacity: 0.6 + 0.4 * tw }}
            />
          );
        }
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s, background: C.cream, opacity: 0.35 + 0.65 * tw }} />;
      })}
    </AbsoluteFill>
  );
}

/** A title in the 4.0 manner, words rising one by one, the accent in italics. */
export function Title({ lines, at, out, dark = false, size = 96, top = 150 }: { lines: string[]; at: number; out?: number; dark?: boolean; size?: number; top?: number }) {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 16)) return null;
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top }}>
      <KineticTitle lines={lines} start={at} out={out} color={dark ? C.cream : C.ink} accent={dark ? C.orange : C.deep} size={size} stagger={2} />
    </div>
  );
}

/** Something that pops in on a spring at `at`, and leaves at `out`. */
export function Pop({ at, out, children, style, from = 0 }: { at: number; out?: number; children: ReactNode; style?: CSSProperties; from?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, at, { damping: 11, stiffness: 190 });
  const leave = out === undefined ? 0 : tween(frame, out, out + 8, 0, 1);
  if (frame < at) return null;
  return <div style={{ position: "absolute", transform: `scale(${from + (1 - from) * p * (1 - leave)})`, opacity: Math.min(1, p * 2) * (1 - leave), ...style }}>{children}</div>;
}

/** A round label: an icon, a name, a value, as the app's chips. */
export function Chip({ icon, name, value, color = C.ink, bg = C.white, size = 32 }: { icon?: string; name: string; value?: string; color?: string; bg?: string; size?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.42}px ${size * 0.75}px`,
        borderRadius: 999,
        background: bg,
        boxShadow: "0 8px 26px rgb(30 26 18 / 0.16)",
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: size,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {icon ? <Icon name={icon} size={size * 1.15} color={C.deep} /> : null}
      <span>{name}</span>
      {value ? <span style={{ fontWeight: 800, color: C.deep, fontVariantNumeric: "tabular-nums" }}>{value}</span> : null}
    </div>
  );
}

/** A phone's silhouette, drawn: the frame, its screen, what is on it. */
export function PhoneShape({ width, children, screen = C.cream }: { width: number; children?: ReactNode; screen?: string }) {
  const h = width * 2.05;
  return (
    <div style={{ position: "relative", width, height: h, borderRadius: width * 0.16, background: C.ink, boxShadow: SHADOW_POP }}>
      <div
        style={{
          position: "absolute",
          inset: width * 0.045,
          borderRadius: width * 0.12,
          background: screen,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
      <div style={{ position: "absolute", left: "50%", top: width * 0.075, width: width * 0.3, height: width * 0.07, marginLeft: -width * 0.15, borderRadius: 99, background: C.ink }} />
    </div>
  );
}

/** Sound waves on both sides of a point: three arcs that leave and fade, while `on`. */
export function Waves({ x, y, on, color, spread = 1 }: { x: number; y: number; on: boolean; color: string; spread?: number }) {
  const frame = useCurrentFrame();
  if (!on) return null;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "visible" }}>
      {[0, 1, 2].map((k) => {
        const t = ((frame + k * 7) % 21) / 21;
        const r = (70 + t * 120) * spread;
        return [-1, 1].map((side) => (
          <path
            key={`${k}${side}`}
            d={`M ${x + side * r * Math.cos(0.6)} ${y - r * Math.sin(0.6)} A ${r} ${r} 0 0 ${side > 0 ? 1 : 0} ${x + side * r * Math.cos(0.6)} ${y + r * Math.sin(0.6)}`}
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            opacity={1 - t}
          />
        ));
      })}
    </svg>
  );
}

/** A round toggle, off then on at `at`: the quick settings of the phone. */
export function Toggle({ icon, label, at, size = 170 }: { icon: string; label: string; at: number; size?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = frame >= at;
  const hit = springAt(frame, fps, at, { damping: 9, stiffness: 260 });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: size + 60 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size,
          display: "grid",
          placeItems: "center",
          background: on ? C.orange : C.white,
          boxShadow: "0 10px 30px rgb(30 26 18 / 0.15)",
          transform: `scale(${on ? 1 + 0.18 * (1 - hit) : 1})`,
        }}
      >
        <Icon name={icon} size={size * 0.46} color={on ? C.white : C.ink} />
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.ink, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

/**
 * The Sidour, drawn: its brown binding and gold rules; `open` from 0 to 1
 * turns its cover around the spine onto the left, and shows the morning's
 * page on the right.
 */
export function SidourBook({ open, width, lines, seen }: { open: number; width: number; lines: string[]; seen: (i: number) => number }) {
  const h = width * 1.36;
  const cover = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "4px 14px 14px 4px",
        background: "#a06a3c",
        boxShadow: "0 18px 50px rgb(30 26 18 / 0.3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", inset: 24, border: "3px solid #E7C27A", borderRadius: 8 }} />
      <div style={{ position: "absolute", inset: 34, border: "1.5px solid #E7C27A", borderRadius: 6 }} />
      <div style={{ fontFamily: HEBREW, fontWeight: 700, fontSize: width * 0.26, color: "#F2D28F" }}>סידור</div>
      <div style={{ position: "absolute", right: width * 0.16, top: -6, width: 22, height: h * 0.32, background: "#C8443A", clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)" }} />
    </div>
  );
  const page = (side: "left" | "right", content: ReactNode) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#FFFDF8",
        borderRadius: side === "left" ? "14px 2px 2px 14px" : "2px 14px 14px 2px",
        boxShadow: "0 18px 50px rgb(30 26 18 / 0.22)",
        overflow: "hidden",
      }}
    >
      {content}
    </div>
  );
  const flip = open < 0.5 ? 1 - open * 2 : open * 2 - 1;
  return (
    <div style={{ position: "relative", width: width * 2, height: h }}>
      {/* The right page: the morning's text, line after line. */}
      <div style={{ position: "absolute", left: width, top: 0, width, height: h, opacity: open > 0.05 ? 1 : 0 }}>
        {page(
          "right",
          <div dir="rtl" style={{ padding: `${width * 0.12}px ${width * 0.1}px`, display: "flex", flexDirection: "column", gap: width * 0.05 }}>
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  fontFamily: HEBREW,
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: i === 0 ? width * 0.13 : width * 0.072,
                  color: i === 0 ? C.deep : C.ink,
                  textAlign: i === 0 ? "center" : "right",
                  opacity: seen(i),
                  transform: `translateY(${(1 - seen(i)) * 20}px)`,
                }}
              >
                {line}
              </div>
            ))}
          </div>,
        )}
      </div>
      {/* The cover turning on the spine, then the left page it leaves. */}
      {open < 0.5 ? (
        <div style={{ position: "absolute", left: width, top: 0, width, height: h, transformOrigin: "0 50%", transform: `scaleX(${flip})` }}>{cover}</div>
      ) : (
        <div style={{ position: "absolute", left: 0, top: 0, width, height: h, transformOrigin: "100% 50%", transform: `scaleX(${flip})` }}>
          {page(
            "left",
            <div style={{ padding: `${width * 0.16}px ${width * 0.1}px`, display: "flex", flexDirection: "column", gap: width * 0.06 }}>
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} style={{ height: width * 0.03, borderRadius: 99, background: C.line, width: `${70 + random(`l${i}`) * 30}%`, alignSelf: "flex-end" }} />
              ))}
            </div>,
          )}
        </div>
      )}
    </div>
  );
}

/** A volume of the library standing on the shelf, its binding, its rules, its title. */
export function Volume({ name, color, width, height }: { name: string; color: string; width: number; height: number }) {
  return (
    <div style={{ position: "relative", width, height, background: color, borderRadius: "3px 6px 6px 3px", boxShadow: "0 10px 26px rgb(30 26 18 / 0.25)" }}>
      <div style={{ position: "absolute", left: 10, right: 14, top: height * 0.16, height: 4, background: "#EBD9B8" }} />
      <div style={{ position: "absolute", left: 10, right: 14, top: height * 0.16 + 9, height: 2, background: "#EBD9B8" }} />
      <div style={{ position: "absolute", left: 10, right: 14, bottom: height * 0.16, height: 4, background: "#EBD9B8" }} />
      <div style={{ position: "absolute", left: 10, right: 14, bottom: height * 0.16 + 9, height: 2, background: "#EBD9B8" }} />
      <div style={{ position: "absolute", right: 0, top: 6, bottom: 6, width: 7, background: "#F4EADB", borderRadius: 2 }} />
      <div
        style={{
          position: "absolute",
          left: 6,
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: width * 0.2,
          color: "#F4E6CC",
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** Lines of text standing for a passage: bars of random lengths, `count` of them. */
export function TextLines({ count, width, height = 12, gap = 12, seed, color = C.line, rtl = true, shown = 1 }: { count: number; width: number; height?: number; gap?: number; seed: string; color?: string; rtl?: boolean; shown?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width, alignItems: rtl ? "flex-end" : "flex-start" }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 99,
            background: color,
            width: `${(i === count - 1 ? 45 : 82) + random(`${seed}${i}`) * 18}%`,
            opacity: interpolate(shown * count - i, [0, 1], [0, 1], clamp),
          }}
        />
      ))}
    </div>
  );
}

/** A spiral of dots turning: the galaxy, Mon parcours' light after a hundred days. */
export function Galaxy({ size, turn, grow }: { size: number; turn: number; grow: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, transform: `rotate(${turn}deg) scale(${grow})` }}>
      {Array.from({ length: 70 }, (_, i) => {
        const arm = i % 2;
        const t = Math.floor(i / 2) / 35;
        const a = t * Math.PI * 3.2 + arm * Math.PI;
        const r = t * size * 0.46;
        const s = 6 + (1 - t) * 14;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: size / 2 + Math.cos(a) * r - s / 2,
              top: size / 2 + Math.sin(a) * r * 0.62 - s / 2,
              width: s,
              height: s,
              borderRadius: s,
              background: i % 3 === 0 ? C.orange : i % 3 === 1 ? "#8B6BD6" : C.blue,
              opacity: 0.55 + 0.45 * (1 - t),
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: size / 2 - size * 0.09, top: size / 2 - size * 0.09, width: size * 0.18, height: size * 0.18, borderRadius: size, background: "#FFF1D6" }} />
    </div>
  );
}

/** A flame that breathes: the oil lamp of a first day. */
export function Flame({ size, frame }: { size: number; frame: number }) {
  const breathe = 1 + 0.06 * Math.sin(frame / 4) + 0.04 * Math.sin(frame / 9);
  return (
    <div style={{ position: "relative", width: size, height: size * 1.5, transform: `scale(${breathe})`, transformOrigin: "50% 100%" }}>
      <div style={{ position: "absolute", inset: 0, background: C.orange, borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%" }} />
      <div style={{ position: "absolute", left: "26%", right: "26%", top: "38%", bottom: 0, background: "#FFE2A8", borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%" }} />
    </div>
  );
}
