/**
 * The building blocks of the version 4.0 videos: the opening with its
 * giant « 4.0 », a chapter's phone, the before and after tab bars, the
 * « Et aussi » break, the closing montage and the end cards (one calling to
 * update, for the networks; one wishing a good discovery, in the app).
 *
 * Same house as the earlier series (flat colors, stone wall, Playfair and
 * Manrope), in the colors of 4.0 (palette.ts): brown on the light orange,
 * never white.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { B, FPB, clamp, springAt, tween } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { Logo } from "../components/Brand.tsx";
import { Marquee, Shine, Subtitle } from "../components/Fx.tsx";
import { SCREEN_W, STATUS_H, type PhonePose } from "../components/Phone.tsx";
import { capture, Shot } from "../components/Screens.tsx";
import { EchoPhone } from "../components/Sections2.tsx";
import { KineticTitle } from "../components/Text.tsx";
import { DISPLAY, SANS, SHADOW_POP } from "../theme.ts";
import type { Zone } from "../zones.ts";
import { LOOK_V4, SUBTITLE_V4, V4 } from "./palette.ts";
import type { V4Strings } from "./strings.ts";

const PHONE_W = SCREEN_W + 26;
const PHONE_H = STATUS_H + 800 + 26;

/** Shakes the frame on each hit, fading in a few frames. */
function shake(frame: number, hits: number[], amp = 14) {
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

/**
 * The phone pose that brings a point of the app screen (sx, sy, in points)
 * to (cx, cy) of the video, the phone being `width` wide.
 */
export function focusPose(sx: number, sy: number, width: number, cx = 540, cy = 1150): PhonePose {
  const s = width / PHONE_W;
  return { x: cx - (sx - SCREEN_W / 2) * s, y: cy - (STATUS_H + sy - PHONE_H / 2) * s, width };
}

export const REST_V4: PhonePose = { x: 540, y: 1250, width: 640 };

/** Interpolates between key poses [frame, pose], eased; missing fields come from REST_V4. */
export function posesAt(frame: number, keys: [number, Partial<PhonePose>][]): PhonePose {
  const fields: (keyof PhonePose)[] = ["x", "y", "width", "rx", "ry", "rz"];
  const full = keys.map(([f, p]) => [f, { ...REST_V4, rx: 0, ry: 0, rz: 0, ...p }] as const);
  const out = { opacity: 1 } as PhonePose;
  for (const field of fields) {
    out[field] = interpolate(
      frame,
      full.map(([f]) => f),
      full.map(([, p]) => p[field] as number),
      { ...clamp, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
    );
  }
  return out;
}

// --- A chapter -------------------------------------------------------------------

export type SubtitleCue = { text: string; from: number; to?: number };

/**
 * A chapter: the stone wall, its sentence on a plate at the top, and the
 * phone, which comes in fast from one side (with its echoes), then follows
 * `poses` (frames from the chapter's start). `children` is the screen.
 */
export function Chapter({
  subtitles,
  strings,
  side = 1,
  poses = [],
  children,
  overlay,
  bare = false,
}: {
  subtitles: SubtitleCue[];
  strings: V4Strings;
  side?: 1 | -1;
  poses?: [number, Partial<PhonePose>][];
  children?: ReactNode;
  overlay?: ReactNode;
  /** Only the sentence, over a scene of its own (the tab bars). */
  bare?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const poseOf = (f: number): PhonePose => {
    const p = springAt(f, fps, 0, { damping: 15, stiffness: 190, mass: 0.6 });
    const base = posesAt(f, poses.length ? poses : [[0, {}]]);
    return {
      ...base,
      x: base.x + (1 - p) * 1250 * side,
      y: base.y + (1 - p) * 120,
      rz: (base.rz ?? 0) + (1 - p) * 18 * side,
      ry: (base.ry ?? 0) + (1 - p) * -24 * side,
    };
  };
  return (
    <AbsoluteFill>
      {bare ? null : (
        <>
          <StoneWall bg={V4.bg} drift={0.5} seed={`v4-${subtitles[0]?.text}`} />
          <EchoPhone pose={poseOf(frame)} prev={[poseOf(frame - 1), poseOf(frame - 2)]} screenBg={V4.bg}>
            {children}
            <Shine at={6} />
          </EchoPhone>
        </>
      )}
      {overlay}
      {subtitles.map((s, i) => (
        <Subtitle key={i} lines={[s.text]} start={s.from} end={s.to} look={LOOK_V4} top={190} size={strings.dir ? 80 : 72} dir={strings.dir} {...SUBTITLE_V4} />
      ))}
    </AbsoluteFill>
  );
}

// --- Crops of a capture ----------------------------------------------------------------

/** One area of a capture (in app points), drawn `width` wide. */
export function Crop({ src, zone, width, radius = 0 }: { src: string; zone: Zone; width: number; radius?: number }) {
  const s = width / zone.w;
  return (
    <div style={{ position: "relative", width, height: zone.h * s, overflow: "hidden", borderRadius: radius }}>
      <Img src={capture(src)} style={{ position: "absolute", left: -zone.x * s, top: -zone.y * s, width: SCREEN_W * s }} />
    </div>
  );
}

// --- The tab bars, before and after ----------------------------------------------------

type BarSide = { src: string; bar: Zone };

/**
 * The 3.10 tab bar, then today's below it; arrows lead from the former
 * Bibliothèque and Chiourim to Étude, and Sidour gets a « Nouveau » tag.
 * Positions come from the marks of each language's captures, so the
 * arrows follow the mirrored bar in Hebrew. `at` gives the frames where
 * today's bar comes in, each arrow draws, and the tag appears.
 */
export function TabBars({
  before,
  after,
  from,
  to,
  fresh,
  strings,
  at,
}: {
  before: BarSide;
  after: BarSide;
  /** Centers (app points) of the old tabs whose content moved. */
  from: Zone[];
  /** Center of the tab they moved to. */
  to: Zone;
  /** The new tab. */
  fresh: Zone;
  strings: V4Strings;
  at: { after: number; arrows: number[]; fresh: number };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1000;
  const s = W / before.bar.w;
  const left = (1080 - W) / 2;
  const topBefore = 760;
  const topAfter = 1220;
  const hBefore = before.bar.h * s;
  const pBefore = springAt(frame, fps, 2, { damping: 14, stiffness: 170 });
  const pAfter = springAt(frame, fps, at.after, { damping: 14, stiffness: 170 });
  const center = (z: Zone, bar: Zone, top: number) => ({ x: left + (z.x + z.w / 2 - bar.x) * s, y: top + (z.y + z.h / 2 - bar.y) * s });
  const target = center(to, after.bar, topAfter);
  const tag = springAt(frame, fps, at.fresh, { damping: 9, stiffness: 220 });
  const freshC = center(fresh, after.bar, topAfter);
  const label = (text: string, top: number, at: number, dark: boolean) => {
    const p = springAt(frame, fps, at, { damping: 12, stiffness: 220 });
    return (
      <div
        dir={strings.dir}
        style={{
          position: "absolute",
          top,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${p})`,
        }}
      >
        <div
          style={{
            padding: "10px 30px",
            borderRadius: 999,
            background: dark ? V4.text : V4.orange,
            color: dark ? V4.bg : V4.onOrange,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 40,
          }}
        >
          {text}
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <StoneWall bg={V4.bg} drift={0.4} seed="v4-bars" />
      {label(strings.before, topBefore - 110, 4, true)}
      <div
        style={{
          position: "absolute",
          left,
          top: topBefore,
          boxShadow: SHADOW_POP,
          borderRadius: 26,
          overflow: "hidden",
          transform: `translateY(${(1 - pBefore) * -400}px) scale(${1 - 0.04 * tween(frame, at.after, at.after + 15, 0, 1)})`,
          opacity: Math.min(1, pBefore * 2) * interpolate(frame, [at.after + 8, at.after + 23], [1, 0.75], clamp),
          filter: `grayscale(${tween(frame, at.after + 8, at.after + 23, 0, 0.55)})`,
        }}
      >
        <Crop src={before.src} zone={before.bar} width={W} />
      </div>
      {label(strings.after, topAfter - 110, at.after + 3, false)}
      <div
        style={{
          position: "absolute",
          left,
          top: topAfter,
          boxShadow: SHADOW_POP,
          borderRadius: 26,
          overflow: "hidden",
          transform: `translateY(${(1 - pAfter) * 700}px)`,
          opacity: Math.min(1, pAfter * 2),
        }}
      >
        <Crop src={after.src} zone={after.bar} width={W} />
      </div>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="v4-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={V4.ink} />
          </marker>
        </defs>
        {from.map((z, i) => {
          const a = center(z, before.bar, topBefore);
          const start = { x: a.x, y: topBefore + hBefore + 8 };
          const end = { x: target.x + (i === 0 ? -36 : 36) * (a.x < target.x ? 1 : -1), y: topAfter - 14 };
          const bend = (start.x + end.x) / 2 + (i === 0 ? -60 : 60);
          const d = `M ${start.x} ${start.y} C ${bend} ${start.y + 160}, ${end.x} ${end.y - 200}, ${end.x} ${end.y}`;
          const draw = tween(frame, at.arrows[i], at.arrows[i] + 12, 0, 1);
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
        {/* A ring that breathes around the new tab. */}
        <circle
          cx={freshC.x}
          cy={freshC.y}
          r={86 + Math.sin(frame / 5) * 4}
          fill="none"
          stroke={V4.blue}
          strokeWidth={8}
          opacity={tag}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: freshC.x - 140,
          width: 280,
          top: topAfter + after.bar.h * s + 24,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${tag})`,
        }}
      >
        <div style={{ padding: "10px 26px", borderRadius: 999, background: V4.blue, color: "#ffffff", fontFamily: SANS, fontWeight: 800, fontSize: 36 }}>
          {strings.newTag}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// --- The opening -----------------------------------------------------------------------

/**
 * The opening on the orange: lines struck on the beats, then a giant
 * « 4.0 » stamped on a brown plate at `stamp` (in beats), with two bands of
 * the new features.
 */
export function HookV4({ lines, stamp, words, dir }: { lines: string[]; stamp: number; words: string[]; dir?: "rtl" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hits = [...lines.map((_, i) => B(i * (stamp / lines.length))), B(stamp)];
  const stampAt = B(stamp);
  const ps = springAt(frame, fps, stampAt, { damping: 9, stiffness: 200, mass: 0.7 });
  return (
    <AbsoluteFill style={{ transform: shake(frame, hits) }}>
      <StoneWall bg={V4.orange} onColor drift={2} seed="v4-hook" />
      <Marquee words={words} y={150} bg={V4.blue} color="#ffffff" angle={-5} speed={9} size={38} />
      <Marquee words={[...words].reverse()} y={1640} bg={V4.onOrange} color={V4.bg} angle={-5} speed={-7} size={38} />
      <AbsoluteFill dir={dir} style={{ alignItems: "center", justifyContent: "center", padding: "0 60px", transform: `scale(${1 + frame * 0.003})` }}>
        {lines.map((line, i) => {
          const at = hits[i];
          if (frame < at) return null;
          const p = springAt(frame, fps, at, { damping: 10, stiffness: 240, mass: 0.6 });
          const leave = tween(frame, stampAt - 2, stampAt + 6, 0, 1);
          return (
            <div
              key={i}
              style={{
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: line.length > 12 ? 128 : 156,
                lineHeight: 1.04,
                letterSpacing: dir ? undefined : "-0.03em",
                color: V4.onOrange,
                textAlign: "center",
                transform: `scale(${(2.4 - 1.4 * p) * (1 - leave * 0.4)}) rotate(${(1 - p) * (i % 2 ? 6 : -6)}deg) translateY(${leave * -260}px)`,
                opacity: Math.min(1, p * 3) * (1 - leave * 0.85),
              }}
            >
              {line}
            </div>
          );
        })}
      </AbsoluteFill>
      {frame >= stampAt ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              padding: "10px 70px 30px",
              background: V4.onOrange,
              borderRadius: 18,
              boxShadow: SHADOW_POP,
              transform: `scale(${3 - 2 * ps}) rotate(${(1 - ps) * -12}deg)`,
              opacity: Math.min(1, ps * 3),
            }}
          >
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 380, lineHeight: 1, color: V4.orange, letterSpacing: "-0.04em", fontVariantNumeric: "lining-nums" }}>
              4.0
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: "#ffffff", opacity: hits.reduce((o, h) => Math.max(o, interpolate(frame - h, [0, 3], [0.35, 0], clamp)), 0) }} />
    </AbsoluteFill>
  );
}

// --- The break -------------------------------------------------------------------------

/** « Et aussi… » on the night: the first word, then the second in orange, on the half beat. */
export function BreakV4({ words, dir }: { words: [string, string]; dir?: "rtl" }) {
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
        fontSize: 190,
        lineHeight: 1.05,
        letterSpacing: dir ? undefined : "-0.03em",
        color,
        transform: `scale(${2 - p})`,
        opacity: hidden ? 0 : Math.min(1, p * 3),
      }}
    >
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: V4.night, transform: shake(frame, [0, half], 18) }}>
      <StoneWall bg={V4.night} dark drift={0.3} seed="v4-break" />
      <AbsoluteFill dir={dir} style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + frame * 0.006})` }}>
        {word(words[0], p1, "#ffffff", false, false)}
        {word(`${words[1]}${dots}`, p2, V4.orange, true, frame < half)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// --- The closing montage ---------------------------------------------------------------

export type MontageItemV4 = { label: string; src: string; focus?: { x: number; y: number } };

/**
 * Two beats per shot: the phone rushes in, then the camera dives on a
 * detail. Backgrounds alternate the orange (brown text), the night, the
 * blue and the page background.
 */
export function MontageV4({ items, count, dir }: { items: MontageItemV4[]; count: string; dir?: "rtl" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = 2 * FPB;
  const k = Math.min(items.length - 1, Math.floor(frame / step));
  const item = items[k];
  const t = frame - k * step;
  const backs = [V4.orange, V4.night, V4.blue, V4.bg];
  const bg = backs[k % backs.length];
  const pill = { [V4.orange]: [V4.onOrange, V4.orange], [V4.night]: ["#ffffff", V4.night], [V4.blue]: ["#ffffff", V4.blue], [V4.bg]: [V4.text, V4.bg] }[bg]!;
  const poseAt = (f: number): PhonePose => {
    const p = springAt(f, fps, k * step, { damping: 14, stiffness: 200, mass: 0.6 });
    const punch = springAt(f, fps, k * step + FPB, { damping: 15, stiffness: 160 });
    const side = k % 2 ? -1 : 1;
    const focus = item.focus ?? { x: 195, y: 300 };
    const width = 640 * (1 + punch * 0.5);
    const s = width / PHONE_W;
    return {
      x: 540 + (1 - p) * 1300 * side - punch * (focus.x - 195) * s,
      y: 1260 + (1 - p) * 200 - punch * (focus.y + 47 - 423) * s * 0.8,
      width,
      rz: (1 - p) * 25 * side + (k % 2 ? 3 : -3) * (1 - punch),
      ry: (1 - p) * -30 * side,
    };
  };
  const labelP = springAt(frame, fps, k * step + 2, { damping: 12, stiffness: 220 });
  return (
    <AbsoluteFill style={{ background: bg }}>
      <StoneWall bg={bg} dark={bg === V4.night} onColor={bg !== V4.bg && bg !== V4.night} drift={3} seed={`v4m-${k}`} />
      <EchoPhone pose={poseAt(frame)} prev={[poseAt(frame - 1), poseAt(frame - 2)]} screenBg={V4.bg}>
        <Shot src={item.src} />
        <Shine at={k * step + 4} />
      </EchoPhone>
      <div dir={dir} style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 10 }}>
        <div style={{ padding: "12px 30px", borderRadius: 999, background: pill[0], color: pill[1], fontFamily: SANS, fontWeight: 800, fontSize: 34 }}>
          {count} · {k + 1}/{items.length}
        </div>
        <div
          style={{
            padding: "10px 34px 18px",
            background: bg === V4.night ? V4.nightSurface : V4.surface,
            boxShadow: SHADOW_POP,
            borderRadius: 6,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: item.label.length > 22 ? 70 : 84,
            letterSpacing: dir ? undefined : "-0.02em",
            color: bg === V4.night ? "#ffffff" : V4.text,
            textAlign: "center",
            maxWidth: 980,
            transform: `scale(${0.7 + 0.3 * labelP}) rotate(${(1 - labelP) * -4}deg)`,
            opacity: Math.min(1, labelP * 2),
          }}
        >
          {item.label}
        </div>
      </div>
      <AbsoluteFill style={{ background: V4.orange, opacity: interpolate(t, [0, 3], [0.5, 0], clamp) }} />
    </AbsoluteFill>
  );
}

// --- The end cards ---------------------------------------------------------------------

const FEATURES_FR = ["Mon parcours", "La page du daf", "Le Talmud en français", "Rachi et Tossafot", "La table d'étude", "Les cours en plein écran", "Halakha et Moussar", "Nous écrire"];
export const FEATURE_WORDS_V4 = FEATURES_FR;

/**
 * The end's background and bands. `fade`: the networks' video fades out; the
 * in-app one holds its last image, under « C'est parti » ("Let's go").
 */
function EndFrame({ children, length, words, fade = true }: { children: ReactNode; length: number; words: string[]; fade?: boolean }) {
  const frame = useCurrentFrame();
  const fadeOut = fade ? interpolate(frame, [length - 4, length + 26], [1, 0], clamp) : 1;
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <StoneWall bg={V4.bg} drift={0.5} seed="v4-end" />
      <Marquee words={words} y={150} bg={V4.orange} color={V4.onOrange} angle={-4} speed={8} size={36} />
      <Marquee words={[...words].reverse()} y={1620} bg={V4.blue} color="#ffffff" angle={-4} speed={-8} size={36} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + frame * 0.0008})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function Badge40({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, at, { damping: 9, stiffness: 200 });
  return (
    <div style={{ padding: "4px 34px 14px", borderRadius: 14, background: V4.onOrange, transform: `scale(${p}) rotate(${(1 - p) * 10 - 4}deg)`, boxShadow: SHADOW_POP }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 1, color: V4.orange, fontVariantNumeric: "lining-nums" }}>4.0</div>
    </div>
  );
}

/** For the networks: the logo, the name, « 4.0 », the call to update, the stores. */
export function EndPromoV4({ length }: { length: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const build = tween(frame, 0, 22, 0, 1);
  const logoP = springAt(frame, fps, 0, { damping: 12, stiffness: 120 });
  const cta = springAt(frame, fps, 20, { damping: 9, stiffness: 200 });
  const bounce = Math.abs(Math.sin((frame - 20) / 5)) * 14;
  const store = (label: string, at: number) => (
    <div
      style={{
        padding: "18px 38px",
        borderRadius: 999,
        background: V4.text,
        color: V4.bg,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 38,
        transform: `scale(${springAt(frame, fps, at, { damping: 12, stiffness: 190 })})`,
      }}
    >
      {label}
    </div>
  );
  return (
    <EndFrame length={length} words={FEATURE_WORDS_V4}>
      <div style={{ transform: `scale(${0.6 + 0.4 * logoP})` }}>
        <Logo size={220} build={build} />
      </div>
      <KineticTitle lines={["Petite Jérusalem"]} start={6} color={V4.text} size={96} stagger={4} />
      <div style={{ height: 20 }} />
      <Badge40 at={12} />
      <div style={{ height: 40 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "24px 48px",
          borderRadius: 999,
          background: V4.orange,
          color: V4.onOrange,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 48,
          boxShadow: SHADOW_POP,
          transform: `scale(${cta})`,
        }}
      >
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={V4.onOrange} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `translateY(${frame > 20 ? bounce - 7 : 0}px)` }}>
          <path d="M12 3v13M6 11l6 6 6-6M4 21h16" />
        </svg>
        Disponible maintenant
      </div>
      <div style={{ height: 26 }} />
      <div style={{ display: "flex", gap: 24 }}>
        {store("App Store", 28)}
        {store("Google Play", 32)}
      </div>
      <div style={{ height: 28 }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: V4.textSoft, opacity: interpolate(frame, [34, 44], [0, 1], clamp) }}>
        Gratuite · sans publicité · sans compte obligatoire
      </div>
    </EndFrame>
  );
}

/** In the app: the logo, « 4.0 », a good discovery, and where to watch it again. */
export function EndAppV4({ length, strings, words }: { length: number; strings: V4Strings; words: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const build = tween(frame, 0, 22, 0, 1);
  const logoP = springAt(frame, fps, 0, { damping: 12, stiffness: 120 });
  return (
    <EndFrame length={length} words={words} fade={false}>
      <div style={{ transform: `scale(${0.6 + 0.4 * logoP})` }}>
        <Logo size={240} build={build} />
      </div>
      <Badge40 at={8} />
      <div style={{ height: 36 }} />
      <div dir={strings.dir}>
        <KineticTitle lines={[strings.end.title]} start={14} color={V4.text} size={strings.end.title.length > 18 ? 92 : 108} stagger={4} />
      </div>
      <div style={{ height: 30 }} />
      <div
        dir={strings.dir}
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 42,
          color: V4.text,
          opacity: interpolate(frame, [26, 36], [0, 1], clamp),
          transform: `translateY(${tween(frame, 26, 38, 20, 0)}px)`,
        }}
      >
        {strings.end.replay}
      </div>
    </EndFrame>
  );
}
