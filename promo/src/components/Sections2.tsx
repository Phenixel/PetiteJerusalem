/**
 * Les temps communs de la série 2 : l'accroche, le montage à deux temps par
 * plan (le temps de lire), le carton de fin avec son appel à télécharger.
 * Comme la série 1, chacun compte ses images depuis son propre début.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { B, FPB, clamp, springAt, tween } from "../anim.ts";
import { DISPLAY, SANS, SHADOW_POP, STONE, THEMES, palette, type Look } from "../theme.ts";
import { StoneWall } from "./Backgrounds.tsx";
import { Logo } from "./Brand.tsx";
import { Marquee, Shine } from "./Fx.tsx";
import { Phone, type PhonePose } from "./Phone.tsx";
import { Shot } from "./Screens.tsx";
import { KineticTitle } from "./Text.tsx";

/** Les fonctionnalités, pour les bandeaux défilants. */
export const FEATURE_WORDS = [
  "Horaires du jour",
  "Tehilim à plusieurs",
  "Sidour",
  "Calendrier des fêtes",
  "Lecture du jour",
  "Hors ligne",
  "Chiourim",
  "Boussole du Kotel",
];

function shake(frame: number, hits: number[], amp = 16) {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 10) continue;
    const k = Math.exp(-t / 3) * amp;
    x += (random(`hx${h}-${t}`) - 0.5) * 2 * k;
    y += (random(`hy${h}-${t}`) - 0.5) * 2 * k;
    r += (random(`hr${h}-${t}`) - 0.5) * k * 0.08;
  }
  return `translate(${x}px, ${y}px) rotate(${r}deg)`;
}

/**
 * Un téléphone en mouvement rapide, suivi de deux échos plus pâles aux
 * positions des images précédentes : le flou de bougé, sans le coût d'un
 * vrai flou.
 */
export function EchoPhone({ pose, prev, dark, screenBg, children }: { pose: PhonePose; prev: PhonePose[]; dark?: boolean; screenBg: string; children: ReactNode }) {
  return (
    <>
      {prev.map((p, i) => {
        const moved = Math.hypot(p.x - pose.x, p.y - pose.y) + Math.abs((p.width ?? 0) - pose.width) / 2;
        if (moved < 25) return null;
        return (
          <Phone key={i} pose={{ ...p, opacity: 0.22 / (i + 1) }} dark={dark} screenBg={screenBg}>
            {children}
          </Phone>
        );
      })}
      <Phone pose={pose} dark={dark} screenBg={screenBg}>
        {children}
      </Phone>
    </>
  );
}

/** L'accroche : des lignes frappées sur les temps, sur la couleur du thème, avec un bandeau. */
export function Hook2({ lines, look, beats }: { lines: { text: string; beat: number; accent?: boolean }[]; look: Look; beats: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { primary, secondary } = THEMES[look.theme];
  const hits = lines.map((l) => B(l.beat));
  const end = B(beats);
  const zoom = 1 + frame * 0.004;
  return (
    <AbsoluteFill style={{ transform: shake(frame, hits) }}>
      <StoneWall bg={primary} onColor drift={2} seed="accroche2" />
      <Marquee words={FEATURE_WORDS} y={150} bg={secondary} color="#ffffff" angle={-5} speed={9} size={38} />
      <Marquee words={[...FEATURE_WORDS].reverse()} y={1640} bg={STONE.night} color="#ffffff" angle={-5} speed={-7} size={38} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 60px", transform: `scale(${zoom})` }}>
        {lines.map((line, i) => {
          if (frame < hits[i]) return null;
          const p = springAt(frame, fps, hits[i], { damping: 10, stiffness: 240, mass: 0.6 });
          const flash = interpolate(frame - hits[i], [0, 3], [1, 0], clamp);
          return (
            <div
              key={i}
              style={{
                position: "relative",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: line.text.length > 13 ? 124 : 158,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: line.accent ? STONE.night : "#ffffff",
                fontStyle: line.accent ? "italic" : undefined,
                textAlign: "center",
                transform: `scale(${2.4 - 1.4 * p}) rotate(${(1 - p) * (i % 2 ? 6 : -6)}deg)`,
                opacity: Math.min(1, p * 3),
                textShadow: flash > 0 ? `0 0 0 ${secondary}` : undefined,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#ffffff", opacity: hits.reduce((o, h) => Math.max(o, interpolate(frame - h, [0, 3], [0.35, 0], clamp)), 0) }} />
      <AbsoluteFill style={{ background: primary, opacity: tween(frame, end - 3, end, 0, 1) }} />
    </AbsoluteFill>
  );
}

export type MontageItem2 = { label: string; src: string; look: Look; focus?: { x: number; y: number } };

/**
 * Le montage de la série 2 : deux temps par plan. Le premier, le téléphone
 * entre en trombe ; le second, la caméra plonge sur un détail. L'étiquette
 * reste posée tout du long.
 */
export function Montage2({ items, accent }: { items: MontageItem2[]; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = 2 * FPB;
  const k = Math.min(items.length - 1, Math.floor(frame / step));
  const item = items[k];
  const t = frame - k * step;
  const pal = palette(item.look);
  const backs = [pal.primary, STONE.night, pal.primary, STONE.beige];
  const bg = backs[k % backs.length];
  const onLight = bg === STONE.beige;
  const poseAt = (f: number): PhonePose => {
    const p = springAt(f, fps, k * step, { damping: 14, stiffness: 200, mass: 0.6 });
    const punch = springAt(f, fps, k * step + FPB, { damping: 15, stiffness: 160 });
    const dir = k % 2 ? -1 : 1;
    const focus = item.focus ?? { x: 195, y: 300 };
    const width = 640 * (1 + punch * 0.55);
    // En plongeant, le point d'intérêt de l'écran vient au centre.
    const s = width / 416;
    return {
      x: 540 + (1 - p) * 1300 * dir - punch * (focus.x - 195) * s,
      y: 1250 + (1 - p) * 200 - punch * (focus.y + 47 - 423) * s * 0.85,
      width,
      rz: (1 - p) * 25 * dir + (k % 2 ? 3 : -3) * (1 - punch),
      ry: (1 - p) * -30 * dir,
    };
  };
  const pose = poseAt(frame);
  const labelP = springAt(frame, fps, k * step + 2, { damping: 12, stiffness: 220 });
  return (
    <AbsoluteFill style={{ background: bg }}>
      <StoneWall bg={bg} dark={bg === STONE.night} onColor={bg === pal.primary} drift={3} seed={`m2-${k}`} />
      <EchoPhone pose={pose} prev={[poseAt(frame - 1), poseAt(frame - 2)]} dark={item.look.dark} screenBg={pal.bg}>
        <Shot src={item.src} />
        <Shine at={k * step + 4} />
      </EchoPhone>
      <div style={{ position: "absolute", top: 200, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 10 }}>
        <div
          style={{
            padding: "12px 30px",
            borderRadius: 999,
            background: onLight ? STONE.ink : "#ffffff",
            color: onLight ? STONE.beige : bg === STONE.night ? STONE.night : pal.primary,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 34,
          }}
        >
          Mais aussi · {k + 1}/{items.length}
        </div>
        <div
          style={{
            padding: "10px 34px 18px",
            background: onLight ? STONE.surface : bg === STONE.night ? STONE.nightSurface : "#ffffff",
            boxShadow: SHADOW_POP,
            borderRadius: 6,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: item.label.length > 22 ? 74 : 88,
            letterSpacing: "-0.02em",
            color: bg === STONE.night ? "#ffffff" : STONE.ink,
            textAlign: "center",
            maxWidth: 960,
            transform: `scale(${0.7 + 0.3 * labelP}) rotate(${(1 - labelP) * -4}deg)`,
            opacity: Math.min(1, labelP * 2),
          }}
        >
          {item.label}
        </div>
      </div>
      <AbsoluteFill style={{ background: accent, opacity: interpolate(t, [0, 3], [0.6, 0], clamp) }} />
    </AbsoluteFill>
  );
}

/** Le carton de fin : le logo, le nom, l'appel à télécharger, les stores, deux bandeaux. */
export function EndCard2({ look, length }: { look: Look; length: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { primary, secondary } = THEMES[look.theme];
  const build = tween(frame, 0, 22, 0, 1);
  const logoP = springAt(frame, fps, 0, { damping: 12, stiffness: 120 });
  const fadeOut = interpolate(frame, [length - 4, length + 26], [1, 0], clamp);
  const cta = springAt(frame, fps, 18, { damping: 9, stiffness: 200 });
  const bounce = Math.abs(Math.sin((frame - 18) / 5)) * 14;
  const store = (label: string, at: number) => (
    <div
      style={{
        padding: "20px 40px",
        borderRadius: 999,
        background: STONE.ink,
        color: STONE.beige,
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
      <StoneWall bg={STONE.beige} drift={0.5} seed="fin2" />
      <Marquee words={FEATURE_WORDS} y={150} bg={primary} color="#ffffff" angle={-4} speed={8} size={36} />
      <Marquee words={[...FEATURE_WORDS].reverse()} y={1620} bg={secondary} color="#ffffff" angle={-4} speed={-8} size={36} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + frame * 0.0008})` }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * logoP})` }}>
          <Logo size={250} build={build} />
        </div>
        <KineticTitle lines={["Petite Jérusalem"]} start={6} color={STONE.ink} size={100} stagger={4} />
        <div style={{ height: 34 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "26px 50px",
            borderRadius: 999,
            background: primary,
            color: "#ffffff",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 48,
            boxShadow: SHADOW_POP,
            transform: `scale(${cta})`,
          }}
        >
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `translateY(${frame > 18 ? bounce - 7 : 0}px)` }}>
            <path d="M12 3v13M6 11l6 6 6-6M4 21h16" />
          </svg>
          Téléchargez-la, c'est gratuit
        </div>
        <div style={{ height: 30 }} />
        <div style={{ display: "flex", gap: 24 }}>
          {store("App Store", 26)}
          {store("Google Play", 30)}
        </div>
        <div style={{ height: 30 }} />
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: STONE.inkSoft, opacity: interpolate(frame, [32, 42], [0, 1], clamp) }}>
          Sans publicité · sans compte obligatoire
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * L'éventail : trois téléphones côte à côte, celui du milieu devant, les
 * deux autres tournés vers lui. Ils montent l'un après l'autre à `start`.
 */
export function Fan({
  items,
  start,
  cx = 540,
  cy = 1260,
  width = 470,
  spread = 1,
  turn = 0,
}: {
  items: { src: string; look: Look }[];
  start: number;
  cx?: number;
  cy?: number;
  width?: number;
  /** 0 : les trois empilés ; 1 : l'éventail ouvert. */
  spread?: number;
  /** Rotation d'ensemble autour de l'axe vertical, en degrés. */
  turn?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const order = [0, 2, 1]; // les côtés d'abord, le milieu par-dessus
  return (
    <>
      {order.map((i) => {
        const item = items[i];
        const d = i - 1;
        const p = springAt(frame, fps, start + i * 3, { damping: 13, stiffness: 150 });
        const pal = palette(item.look);
        return (
          <Phone
            key={i}
            pose={{
              x: cx + d * spread * 330 + Math.sin((turn * Math.PI) / 180) * 120 * (d === 0 ? 1 : 0),
              y: cy + (1 - p) * 1500 + Math.abs(d) * 60 * spread,
              width: width * (d === 0 ? 1 : 0.86),
              ry: -d * 26 * spread + turn,
              rz: d * 5 * spread,
            }}
            dark={item.look.dark}
            screenBg={pal.bg}
          >
            <Shot src={item.src} />
            <Shine at={start + 12 + i * 4} />
          </Phone>
        );
      })}
    </>
  );
}
