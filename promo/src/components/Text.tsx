/**
 * La typographie animée. Les titres en Playfair Display, mot par mot, qui
 * montent d'un masque ; les étiquettes en Manrope, en pastilles rondes
 * (les commandes de l'app sont rondes, les surfaces franches).
 *
 * Dans un titre, un mot écrit *ainsi* prend la couleur d'accent.
 */
import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, springAt } from "../anim.ts";
import { DISPLAY, SANS } from "../theme.ts";

type Word = { text: string; accent: boolean };

function parse(line: string): Word[] {
  // L'accent peut couvrir plusieurs mots : « *au bon moment* ».
  let accent = false;
  return line
    .split(" ")
    .filter(Boolean)
    .map((raw) => {
      let text = raw;
      if (text.startsWith("*")) {
        accent = true;
        text = text.slice(1);
      }
      const closes = text.endsWith("*");
      if (closes) text = text.slice(0, -1);
      const word = { text, accent };
      if (closes) accent = false;
      return word;
    });
}

export function KineticTitle({
  lines,
  start,
  out,
  color,
  accent,
  size = 96,
  stagger = 3,
  align = "center",
  style,
  font = DISPLAY,
  weight = 700,
}: {
  lines: string[];
  start: number;
  /** Image où le titre repart vers le haut ; absent, il reste. */
  out?: number;
  color: string;
  accent?: string;
  size?: number;
  stagger?: number;
  align?: "center" | "left";
  style?: CSSProperties;
  font?: string;
  weight?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let index = 0;
  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: font === DISPLAY ? "-0.02em" : "-0.01em",
        color,
        textAlign: align,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.26 }}>
          {parse(line).map((word) => {
            const i = index++;
            const p = springAt(frame, fps, start + i * stagger, { damping: 15, stiffness: 170 });
            const leave = out === undefined ? 0 : interpolate(frame, [out + i * 1.5, out + i * 1.5 + 7], [0, 1], clamp);
            const y = (1 - p) * 110 - leave * 110;
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.06em 0.04em 0.14em", margin: "-0.06em -0.04em -0.14em" }}>
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${y}%) rotate(${(1 - p) * 6}deg)`,
                    color: word.accent ? accent ?? color : color,
                    fontStyle: word.accent && font === DISPLAY ? "italic" : undefined,
                  }}
                >
                  {word.text}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Une pastille ronde, qui naît d'un ressort. */
export function Pill({
  text,
  start,
  out,
  bg,
  color = "#ffffff",
  size = 34,
  icon,
}: {
  text: string;
  start: number;
  out?: number;
  bg: string;
  color?: string;
  size?: number;
  icon?: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, start, { damping: 11, stiffness: 200 });
  const leave = out === undefined ? 0 : interpolate(frame, [out, out + 6], [0, 1], clamp);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        padding: `${size * 0.42}px ${size * 0.9}px`,
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: size,
        transform: `scale(${p * (1 - leave)})`,
        opacity: Math.min(1, p * 2) * (1 - leave),
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {text}
    </div>
  );
}

/** Une ligne de texte courant qui apparaît en fondu montant. */
export function Line({ text, start, color, size = 40, weight = 600, style }: { text: string; start: number; color: string; size?: number; weight?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [start, start + 8], [0, 1], clamp);
  const y = interpolate(frame, [start, start + 10], [24, 0], clamp);
  return (
    <div style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, color, opacity: o, transform: `translateY(${y}px)`, ...style }}>{text}</div>
  );
}
