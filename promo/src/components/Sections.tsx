/**
 * Les temps communs à toutes les vidéos : l'accroche, la coupure « Mais
 * aussi… », le montage rapide des autres fonctionnalités. Chacun compte ses
 * images depuis son propre début (il vit dans une <Sequence>).
 */
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { B, FPB, clamp, springAt, tween } from "../anim.ts";
import { DISPLAY, SANS, STONE, THEMES, palette, type Look } from "../theme.ts";
import { StoneWall } from "./Backgrounds.tsx";
import { Phone } from "./Phone.tsx";
import { Shot } from "./Screens.tsx";

/** Secousse de caméra qui s'amortit après chaque frappe. */
function shake(frame: number, hits: number[], amp = 14) {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const t = frame - h;
    if (t < 0 || t > 10) continue;
    const k = Math.exp(-t / 3) * amp;
    x += (random(`sx${h}-${t}`) - 0.5) * 2 * k;
    y += (random(`sy${h}-${t}`) - 0.5) * 2 * k;
  }
  return `translate(${x}px, ${y}px)`;
}

/**
 * L'accroche : sur l'aplat de la couleur du thème, une question ou une
 * promesse, ligne après ligne, chaque ligne frappée sur un temps.
 */
export function Hook({ lines, look, beats }: { lines: { text: string; beat: number; accent?: boolean }[]; look: Look; beats: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { primary } = THEMES[look.theme];
  const hits = lines.map((l) => B(l.beat));
  const end = B(beats);
  // La dernière demi-mesure, tout zoome vers l'écran suivant.
  const exit = tween(frame, end - 6, end, 0, 1);
  return (
    <AbsoluteFill style={{ transform: shake(frame, hits) }}>
      <StoneWall bg={primary} onColor drift={1.2} seed="accroche" />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 70px",
          transform: `scale(${1 + exit * 0.6})`,
          opacity: 1 - exit,
        }}
      >
        {lines.map((line, i) => {
          const p = springAt(frame, fps, hits[i], { damping: 11, stiffness: 220, mass: 0.6 });
          if (frame < hits[i]) return <div key={i} style={{ height: 0 }} />;
          return (
            <div
              key={i}
              style={{
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: line.text.length > 14 ? 118 : 150,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                color: line.accent ? STONE.night : "#ffffff",
                fontStyle: line.accent ? "italic" : undefined,
                textAlign: "center",
                transform: `scale(${2.2 - 1.2 * p}) rotate(${(1 - p) * -5}deg)`,
                opacity: Math.min(1, p * 3),
              }}
            >
              {line.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** La coupure : la musique s'arrête, « Mais aussi… » tombe sur le noir. */
export function Break({ look }: { look: Look }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { primary } = THEMES[look.theme];
  const half = Math.round(FPB / 2);
  const p1 = springAt(frame, fps, 0, { damping: 10, stiffness: 240, mass: 0.5 });
  const p2 = springAt(frame, fps, half, { damping: 10, stiffness: 240, mass: 0.5 });
  const dots = Math.min(3, Math.max(0, Math.floor((frame - half) / 4)));
  return (
    <AbsoluteFill style={{ background: STONE.night, transform: shake(frame, [0, half], 18) }}>
      <StoneWall bg={STONE.night} dark drift={0.3} seed="coupure" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + frame * 0.006})` }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 200,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            transform: `scale(${2 - p1})`,
            opacity: Math.min(1, p1 * 3),
          }}
        >
          Mais
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: 200,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: primary,
            transform: `scale(${2 - p2})`,
            opacity: frame < half ? 0 : Math.min(1, p2 * 3),
          }}
        >
          aussi{"…".slice(0, dots > 0 ? 1 : 0)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export type MontageItem = { label: string; src: string; look: Look };

/**
 * Le montage : une fonctionnalité par temps, chacune entrant autrement
 * (glissée, tombée, zoomée, retournée), sur sa couleur.
 */
export function Montage({ items, accent }: { items: MontageItem[]; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = Math.min(items.length - 1, Math.floor(frame / FPB));
  const item = items[k];
  const t = frame - k * FPB;
  const pal = palette(item.look);
  // Fond : la couleur du thème de l'écran, ou la nuit, ou la pierre.
  const backs = [pal.primary, STONE.night, STONE.beige, pal.primary];
  const bg = backs[k % backs.length];
  const onLight = bg === STONE.beige;
  const p = springAt(frame, fps, k * FPB, { damping: 13, stiffness: 210, mass: 0.6 });
  const style = k % 4;
  let x = 540;
  let y = 1210;
  let width = 600;
  let rz = k % 2 ? 5 : -5;
  let ry = 0;
  if (style === 0) {
    x = 540 + (1 - p) * 1100;
    rz += (1 - p) * 20;
  } else if (style === 1) {
    y = 1210 - (1 - p) * 1700;
    rz -= (1 - p) * 14;
  } else if (style === 2) {
    width = 600 + (1 - p) * 1400;
  } else {
    ry = (1 - p) * 85;
  }
  // Une légère poussée sur la durée du plan : rien n'est jamais figé.
  width *= 1 + t * 0.004;
  const labelP = springAt(frame, fps, k * FPB + 2, { damping: 12, stiffness: 220 });
  const tagP = springAt(frame, fps, 0, { damping: 12, stiffness: 200 });
  return (
    <AbsoluteFill style={{ background: bg }}>
      <StoneWall bg={bg} dark={bg === STONE.night} onColor={bg === pal.primary} drift={2} seed={`montage-${k}`} />
      <Phone pose={{ x, y, width, rz, ry }} dark={item.look.dark} screenBg={pal.bg}>
        <Shot src={item.src} />
      </Phone>
      <div
        style={{
          position: "absolute",
          top: 190,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${tagP})`,
        }}
      >
        <div
          style={{
            padding: "14px 34px",
            borderRadius: 999,
            background: onLight ? STONE.ink : "#ffffff",
            color: onLight ? STONE.beige : bg === STONE.night ? STONE.night : pal.primary,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 36,
          }}
        >
          Mais aussi {k + 1}/{items.length}
        </div>
      </div>
      <div
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
          letterSpacing: "-0.025em",
          color: onLight ? STONE.ink : "#ffffff",
          transform: `translateY(${(1 - labelP) * 60}px) scale(${0.85 + 0.15 * labelP})`,
          opacity: Math.min(1, labelP * 2),
        }}
      >
        {item.label}
      </div>
      {/* Un éclair d'accent à chaque coupe. */}
      <AbsoluteFill style={{ background: accent, opacity: interpolate(t, [0, 3], [0.55, 0], clamp) }} />
    </AbsoluteFill>
  );
}
