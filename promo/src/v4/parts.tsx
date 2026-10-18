/**
 * The building blocks of the version 4.0 video, in the first series'
 * language (src/components/Sections.tsx, Brand.tsx): an opening struck line
 * by line on the theme color, « Et aussi… » falling on the night, a montage
 * where each screen comes in its own way, the end card where the logo
 * builds; plus what 4.0 needs, the before and after tab bars.
 *
 * Calmer than the first series, as befits a presentation: no camera shake
 * beyond the opening's strikes, no scrolling bands, no echoes. In the colors
 * of 4.0 (palette.ts): white on the pastel orange, as in the app.
 */
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { B, FPB, clamp, springAt, tween } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { Logo } from "../components/Brand.tsx";
import { Phone } from "../components/Phone.tsx";
import { SCREEN_W } from "../components/Phone.tsx";
import { capture, Shot } from "../components/Screens.tsx";
import { KineticTitle } from "../components/Text.tsx";
import { DISPLAY, SANS, SHADOW_POP } from "../theme.ts";
import type { Zone } from "../zones.ts";
import { V4 } from "./palette.ts";
import type { V4Strings } from "./strings.ts";

/** The captions' colors on the 4.0 background: the ink, the orange ink for the accent. */
export const CAPTION_COLORS = { ink: V4.text, accent: V4.ink, plate: V4.bg };

/** A gentle shake on each strike, fading in a few frames (the opening only). */
function shake(frame: number, hits: number[], amp = 9) {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 10) continue;
    const k = Math.exp(-t / 3) * amp;
    x += (random(`v4x${h}-${t}`) - 0.5) * 2 * k;
    y += (random(`v4y${h}-${t}`) - 0.5) * 2 * k;
  }
  return `translate(${x}px, ${y}px)`;
}

// --- The opening -------------------------------------------------------------------------

/**
 * On the orange, the lines struck one per beat, the last one, « 4.0 », much
 * bigger; then a quieter line says what follows. The last half bar, it all
 * zooms toward the next screen, as in the first series.
 */
export function HookV4({ strings, beats }: { strings: V4Strings; beats: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hits = [0, 1.1, 2.4].map(B);
  const subAt = B(4.6);
  const end = B(beats);
  const exit = tween(frame, end - 6, end, 0, 1);
  const last = strings.hook.length - 1;
  return (
    <AbsoluteFill style={{ transform: shake(frame, hits) }}>
      <StoneWall bg={V4.orange} onColor drift={1} seed="v4-hook" />
      <AbsoluteFill
        dir={strings.dir}
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 70px",
          transform: `scale(${1 + exit * 0.6})`,
          opacity: 1 - exit,
        }}
      >
        {strings.hook.map((text, i) => {
          if (frame < hits[i]) return <div key={i} style={{ height: 0 }} />;
          const p = springAt(frame, fps, hits[i], { damping: 11, stiffness: 220, mass: 0.6 });
          const big = i === last;
          return (
            <div
              key={i}
              style={{
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: big ? 330 : text.length > 12 ? 118 : 140,
                lineHeight: big ? 1 : 1.06,
                letterSpacing: strings.dir ? undefined : "-0.03em",
                color: V4.onOrange,
                fontStyle: big ? "italic" : undefined,
                fontVariantNumeric: "lining-nums",
                textAlign: "center",
                transform: `scale(${2.2 - 1.2 * p}) rotate(${(1 - p) * -5}deg)`,
                opacity: Math.min(1, p * 3),
              }}
            >
              {text}
            </div>
          );
        })}
        <div style={{ height: 30 }} />
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 52,
            color: V4.onOrange,
            opacity: interpolate(frame, [subAt, subAt + 8], [0, 1], clamp),
            transform: `translateY(${tween(frame, subAt, subAt + 10, 24, 0)}px)`,
          }}
        >
          {strings.hookSub}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// --- The before and after tab bars ---------------------------------------------------------

/** One area of a capture (in app points), drawn `width` wide. */
export function Crop({ src, zone, width }: { src: string; zone: Zone; width: number }) {
  const s = width / zone.w;
  return (
    <div style={{ position: "relative", width, height: zone.h * s, overflow: "hidden" }}>
      <Img src={capture(src)} style={{ position: "absolute", left: -zone.x * s, top: -zone.y * s, width: SCREEN_W * s }} />
    </div>
  );
}

type BarSide = { src: string; bar: Zone };

/** A small round label above something, in the first series' Pill manner. */
function Label({ text, at, x, y, dark, dir }: { text: string; at: number; x: number; y: number; dark: boolean; dir?: "rtl" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, at, { damping: 11, stiffness: 200 });
  return (
    <div dir={dir} style={{ position: "absolute", left: x - 300, width: 600, top: y, display: "flex", justifyContent: "center", transform: `scale(${p})`, opacity: Math.min(1, p * 2) }}>
      <div
        style={{
          padding: "12px 32px",
          borderRadius: 999,
          background: dark ? V4.text : V4.orange,
          // A small label: white on the pastel orange is for large words only.
          color: dark ? V4.bg : V4.text,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 40,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * The 3.10 tab bar, then today's below it; arrows lead from the former
 * Bibliothèque and Chiourim to Étude, and Sidour gets a « Nouveau » tag.
 * Positions come from the marks of each language's captures, so the arrows
 * follow the mirrored bar in Hebrew. `at` gives the frames where each step
 * comes; `out`, where the bars leave for the phone.
 */
export function TabBars({
  before,
  after,
  from,
  to,
  fresh,
  strings,
  at,
  out,
}: {
  before: BarSide;
  after: BarSide;
  from: Zone[];
  to: Zone;
  fresh: Zone;
  strings: V4Strings;
  at: { old: number; now: number; arrows: number[]; fresh: number };
  out: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1000;
  const s = W / before.bar.w;
  const left = (1080 - W) / 2;
  const topBefore = 760;
  const topAfter = 1230;
  const hBefore = before.bar.h * s;
  const pOld = springAt(frame, fps, at.old, { damping: 14, stiffness: 150 });
  const pNow = springAt(frame, fps, at.now, { damping: 14, stiffness: 150 });
  const leave = tween(frame, out, out + 10, 0, 1);
  const center = (z: Zone, bar: Zone, top: number) => ({ x: left + (z.x + z.w / 2 - bar.x) * s, y: top + (z.y + z.h / 2 - bar.y) * s });
  const target = center(to, after.bar, topAfter);
  const freshC = center(fresh, after.bar, topAfter);
  const tag = springAt(frame, fps, at.fresh, { damping: 10, stiffness: 200 });
  const bar = (side: BarSide, top: number, p: number, from: number, faded: number) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: SHADOW_POP,
        transform: `translateY(${(1 - p) * from}px)`,
        opacity: Math.min(1, p * 2) * (1 - faded * 0.3),
      }}
    >
      <Crop src={side.src} zone={side.bar} width={W} />
    </div>
  );
  return (
    <AbsoluteFill style={{ transform: `translateY(${leave * 1400}px)`, opacity: 1 - leave }}>
      <Label text={strings.before} at={at.old + 6} x={540} y={topBefore - 100} dark dir={strings.dir} />
      {bar(before, topBefore, pOld, -500, tween(frame, at.now + 6, at.now + 20, 0, 1))}
      <Label text={strings.after} at={at.now + 6} x={540} y={topAfter - 100} dark={false} dir={strings.dir} />
      {bar(after, topAfter, pNow, 700, 0)}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="v4-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={V4.ink} />
          </marker>
        </defs>
        {from.map((z, i) => {
          const a = center(z, before.bar, topBefore);
          const start = { x: a.x, y: topBefore + hBefore + 10 };
          const end = { x: target.x + (a.x < target.x ? -34 : 34), y: topAfter - 16 };
          const d = `M ${start.x} ${start.y} C ${start.x} ${start.y + 170}, ${end.x} ${end.y - 210}, ${end.x} ${end.y}`;
          const draw = tween(frame, at.arrows[i], at.arrows[i] + 14, 0, 1);
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={V4.ink}
              strokeWidth={9}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - draw}
              markerEnd={draw > 0.95 ? "url(#v4-arrow)" : undefined}
              opacity={draw > 0 ? 1 : 0}
            />
          );
        })}
        <circle cx={freshC.x} cy={freshC.y} r={86 + Math.sin(frame / 6) * 3} fill="none" stroke={V4.blue} strokeWidth={8} opacity={tag} />
      </svg>
      <div style={{ position: "absolute", left: freshC.x - 150, width: 300, top: topAfter + after.bar.h * s + 26, display: "flex", justifyContent: "center", transform: `scale(${tag})` }}>
        <div style={{ padding: "10px 28px", borderRadius: 999, background: V4.blue, color: "#ffffff", fontFamily: SANS, fontWeight: 800, fontSize: 38 }}>
          {strings.newTag}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// --- The break -------------------------------------------------------------------------

/** « Et aussi… » on the night: the first word, then the second in orange, on the half beat. */
export function BreakV4({ strings }: { strings: V4Strings }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const half = Math.round(FPB / 2);
  const p1 = springAt(frame, fps, 0, { damping: 10, stiffness: 240, mass: 0.5 });
  const p2 = springAt(frame, fps, half, { damping: 10, stiffness: 240, mass: 0.5 });
  const dots = frame - half > 4 ? "…" : "";
  const word = (text: string, p: number, color: string, italic: boolean, hidden: boolean) => (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontStyle: italic ? "italic" : undefined,
        fontSize: 200,
        lineHeight: 1.05,
        letterSpacing: strings.dir ? undefined : "-0.03em",
        color,
        transform: `scale(${2 - p})`,
        opacity: hidden ? 0 : Math.min(1, p * 3),
      }}
    >
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: V4.night }}>
      <StoneWall bg={V4.night} dark drift={0.3} seed="v4-break" />
      <AbsoluteFill dir={strings.dir} style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + frame * 0.004})` }}>
        {word(strings.also[0], p1, "#ffffff", false, false)}
        {word(`${strings.also[1]}${dots}`, p2, V4.orange, true, frame < half)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// --- The montage -------------------------------------------------------------------------

export type MontageItemV4 = { label: string; src: string };

/**
 * One more change every two beats (the first series gave one), each phone
 * coming in its own way: slid in, dropped, zoomed, turned. Backgrounds
 * alternate the orange, the night, the page and the blue.
 */
export function MontageV4({ items, tag, dir }: { items: MontageItemV4[]; tag: string; dir?: "rtl" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = 2 * FPB;
  const k = Math.min(items.length - 1, Math.floor(frame / step));
  const item = items[k];
  const t = frame - k * step;
  const backs = [V4.orange, V4.night, V4.bg, V4.blue];
  const bg = backs[k % backs.length];
  // The small pill is dark on the page and on the pastel orange (white in
  // small type would not read there), white on the night and the blue.
  const darkPill = bg === V4.bg || bg === V4.orange;
  const text = bg === V4.bg ? V4.text : "#ffffff";
  const p = springAt(frame, fps, k * step, { damping: 13, stiffness: 180, mass: 0.6 });
  const style = k % 4;
  let x = 540;
  let y = 1240;
  let width = 600;
  let rz = k % 2 ? 4 : -4;
  let ry = 0;
  if (style === 0) {
    x = 540 + (1 - p) * 1100;
    rz += (1 - p) * 18;
  } else if (style === 1) {
    y = 1240 - (1 - p) * 1700;
    rz -= (1 - p) * 12;
  } else if (style === 2) {
    width = 600 + (1 - p) * 1300;
  } else {
    ry = (1 - p) * 80;
  }
  // A slight push over the shot: nothing ever stands still.
  width *= 1 + t * 0.002;
  const labelP = springAt(frame, fps, k * step + 3, { damping: 12, stiffness: 200 });
  const tagP = springAt(frame, fps, 0, { damping: 12, stiffness: 200 });
  return (
    <AbsoluteFill style={{ background: bg }}>
      <StoneWall bg={bg} dark={bg === V4.night} onColor={bg === V4.orange || bg === V4.blue} drift={1.2} seed={`v4-montage-${k}`} />
      <Phone pose={{ x, y, width, rz, ry }} screenBg={V4.bg}>
        <Shot src={item.src} />
      </Phone>
      <div dir={dir} style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${tagP})` }}>
        <div
          style={{
            padding: "14px 34px",
            borderRadius: 999,
            background: darkPill ? V4.text : "#ffffff",
            color: darkPill ? V4.bg : bg,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 36,
          }}
        >
          {tag} · {k + 1}/{items.length}
        </div>
      </div>
      <div
        dir={dir}
        style={{
          position: "absolute",
          top: 290,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: item.label.length > 22 ? 82 : 96,
          lineHeight: 1.04,
          letterSpacing: dir ? undefined : "-0.025em",
          color: text,
          transform: `translateY(${(1 - labelP) * 60}px) scale(${0.85 + 0.15 * labelP})`,
          opacity: Math.min(1, labelP * 2),
        }}
      >
        {item.label}
      </div>
      {/* A flash of accent at each cut. */}
      <AbsoluteFill style={{ background: V4.orange, opacity: interpolate(t, [0, 3], [0.45, 0], clamp) }} />
    </AbsoluteFill>
  );
}

// --- The end cards -------------------------------------------------------------------------

function VersionPill({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, at, { damping: 11, stiffness: 200 });
  return (
    <div
      style={{
        padding: "10px 34px 14px",
        borderRadius: 999,
        background: V4.orange,
        color: V4.onOrange,
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: 64,
        lineHeight: 1,
        fontVariantNumeric: "lining-nums",
        transform: `scale(${p})`,
      }}
    >
      4.0
    </div>
  );
}

/**
 * The end, as in the first series: the logo builds piece by piece, the
 * name, the version; then, in the app, a good discovery and where to watch
 * it again (the last image holds under « C'est parti »); for the networks,
 * the promise and the stores, then a fade.
 */
export function EndCardV4({ kind, strings, length }: { kind: "app" | "promo"; strings: V4Strings; length: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const build = tween(frame, 0, 22, 0, 1);
  const logoP = springAt(frame, fps, 0, { damping: 12, stiffness: 120 });
  const fadeOut = kind === "promo" ? interpolate(frame, [length - 4, length + 26], [1, 0], clamp) : 1;
  const zoom = 1 + frame * 0.0009;
  const store = (label: string, at: number) => (
    <div
      style={{
        padding: "20px 40px",
        borderRadius: 999,
        background: V4.text,
        color: V4.bg,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 40,
        transform: `scale(${springAt(frame, fps, at, { damping: 12, stiffness: 190 })})`,
      }}
    >
      {label}
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <StoneWall bg={V4.bg} drift={0.4} seed="v4-end" />
      <AbsoluteFill dir={strings.dir} style={{ alignItems: "center", justifyContent: "center", transform: `scale(${zoom})` }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * logoP})`, marginBottom: 10 }}>
          <Logo size={280} build={build} />
        </div>
        {/* The name is Latin: its words keep their order in the Hebrew video. */}
        <div dir="ltr">
          <KineticTitle lines={["Petite Jérusalem"]} start={8} color={V4.text} size={104} stagger={4} />
        </div>
        <div style={{ height: 22 }} />
        <VersionPill at={14} />
        <div style={{ height: 50 }} />
        {kind === "app" ? (
          <>
            <KineticTitle lines={[strings.end.title]} start={20} color={V4.ink} size={strings.end.title.length > 18 ? 74 : 84} stagger={3} dir={strings.dir} />
            <div style={{ height: 30 }} />
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 40,
                color: V4.textSoft,
                opacity: interpolate(frame, [32, 42], [0, 1], clamp),
              }}
            >
              {strings.end.replay}
            </div>
          </>
        ) : (
          <>
            <KineticTitle lines={["Gratuite, sans publicité"]} start={20} color={V4.ink} size={50} font={SANS} weight={700} stagger={2} />
            <div style={{ height: 60 }} />
            <div style={{ display: "flex", gap: 24 }}>
              {store("App Store", 28)}
              {store("Google Play", 32)}
            </div>
            <div style={{ height: 40 }} />
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: V4.textSoft, opacity: interpolate(frame, [36, 46], [0, 1], clamp) }}>
              petite-jerusalem.fr
            </div>
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
