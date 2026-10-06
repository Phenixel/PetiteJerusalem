/**
 * La bibliothèque : les livres qui sortent de l'étagère, un psaume en
 * hébreu, sa phonétique, le texte agrandi, le défilement au double appui,
 * et tout le corpus téléchargé pour l'avion.
 */
import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, clamp, springAt } from "../anim.ts";
import { Phone, SCREEN_W } from "../components/Phone.tsx";
import { Push, Scroll, Shot, capture } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { SANS, SHADOW_POP, palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

const BOOKS: [string, number, number][] = [
  // nom, x, y (dans la vidéo)
  ["Tehilim", 190, 640],
  ["Michna", 880, 760],
  ["Talmud", 160, 980],
  ["Tanakh", 900, 1080],
  ["Sidour", 200, 1330],
  ["Brahot", 880, 1420],
];

/** Un avion de ligne, dessiné à plat. */
function Plane({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

export function BibliothequeFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = palette(spec.look);
  const phon = center(zone("emerald-tehilim-23:phonetique"));
  const plus = center(zone("emerald-tehilim-23:plus"));
  const pill = zone("emerald-tehilim-23-defilement:pill");
  const download = center(zone("emerald-bibliotheque:download"));

  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: -8 }],
    [B(1.2), { width: 560, y: 1300 }],
    [m("list") - B(0.5), { width: 560, y: 1300 }],
    [m("list") + B(0.5), {}],
    [m("reader") + B(1), { ry: 10 }],
    [m("phonetiqueTap") - B(0.5), { width: 820, y: 1500 }],
    [m("grand") + B(1), { width: 820, y: 1500 }],
    [m("doubleTap"), { ry: -10 }],
    [m("offlineTap") - B(0.5), { ry: 0 }],
    [m("offline") + B(1), { width: 560, y: 1340, rz: 4 }],
  ]);

  const reader = (() => {
    if (frame >= m("doubleTap")) {
      return <Scroll src="emerald-tehilim-119-full.jpg" chrome="emerald-tehilim-23.jpg" fromY={0} toY={1500} start={m("scroll")} end={m("offlineTap") - B(1.2)} />;
    }
    if (frame >= m("grand")) return <Shot src="emerald-tehilim-23-grand.jpg" />;
    if (frame >= m("phonetique")) return <Shot src="emerald-tehilim-23-phonetique.jpg" />;
    return <Shot src="emerald-tehilim-23.jpg" />;
  })();

  const screen = (() => {
    if (frame >= m("offlineTap") - B(1)) return <Shot src="emerald-bibliotheque.jpg" />;
    if (frame >= m("reader")) return <Push from={<Shot src="emerald-tehilim.jpg" />} to={reader} start={m("reader")} />;
    if (frame >= m("list")) return <Push from={<Shot src="emerald-bibliotheque.jpg" />} to={<Shot src="emerald-tehilim.jpg" />} start={m("list")} />;
    return <Shot src="emerald-bibliotheque.jpg" />;
  })();

  // La pastille « Défilement » prise sur la capture, posée sur la page qui défile.
  const pillOn = frame >= m("scroll") && frame < m("offlineTap") - B(1);
  const offlineP = springAt(frame, fps, m("offline"), { damping: 10, stiffness: 160 });

  return (
    <Stage look={spec.look}>
      {/* Les livres de l'étagère s'envolent autour du téléphone. */}
      {BOOKS.map(([name, x, y], i) => {
        const at = m("books") + i * 4;
        const p = springAt(frame, fps, at, { damping: 11, stiffness: 180 });
        const leave = interpolate(frame, [m("list") - 6, m("list") + 4], [0, 1], clamp);
        if (frame < at) return null;
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: x - 140,
              top: y - 40 - leave * 120,
              width: 280,
              display: "flex",
              justifyContent: "center",
              transform: `scale(${p * (1 - leave)}) rotate(${(i % 2 ? 1 : -1) * (6 - 4 * p)}deg)`,
              zIndex: 6,
            }}
          >
            <Pill text={name} start={at} bg={i % 2 ? pal.secondary : pal.primary} size={42} />
          </div>
        );
      })}
      <Phone pose={pose} screenBg={pal.bg}>
        {screen}
        {pillOn ? (
          <div style={{ position: "absolute", left: pill.x - 4, top: pill.y - 4, width: pill.w + 8, height: pill.h + 8, overflow: "hidden", borderRadius: 999 }}>
            <Img
              src={capture("emerald-tehilim-23-defilement-00.jpg")}
              style={{ position: "absolute", left: -(pill.x - 4), top: -(pill.y - 4), width: SCREEN_W }}
            />
          </div>
        ) : null}
        <Tap x={phon.x} y={phon.y} at={m("phonetiqueTap")} />
        <Tap x={plus.x} y={plus.y} at={m("plusTap")} />
        <Tap x={plus.x} y={plus.y} at={m("plusTap") + 6} />
        <Tap x={195} y={520} at={m("doubleTap")} />
        <Tap x={195} y={520} at={m("doubleTap") + 5} />
        <Tap x={download.x} y={download.y} at={m("offlineTap")} />
      </Phone>
      {frame >= m("offline") ? (
        <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "26px 44px",
              borderRadius: 999,
              background: pal.primary,
              color: "#fff",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 44,
              boxShadow: SHADOW_POP,
              transform: `scale(${offlineP}) translateX(${(1 - offlineP) * -300}px)`,
            }}
          >
            <div style={{ transform: `rotate(${45 + (1 - offlineP) * 40}deg)` }}>
              <Plane size={58} color="#fff" />
            </div>
            Tout est hors ligne
          </div>
        </div>
      ) : null}
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("list") - 10, lines: ["Une bibliothèque", "*entière*"] },
          { at: m("list"), out: m("reader") - 6, lines: ["Le bon livre", "*en un geste*"] },
          { at: m("reader"), out: m("phonetiqueTap") - 8, lines: ["L'hébreu,", "*bien lisible*"] },
          { at: m("phonetiqueTap"), out: m("plusTap") - 8, lines: ["Ou en", "*phonétique*"], plate: true },
          { at: m("plusTap"), out: m("doubleTap") - 8, lines: ["À votre", "*taille*"], plate: true },
          { at: m("doubleTap"), out: m("offlineTap") - 8, lines: ["Double appui\u00a0:", "*il défile seul*"] },
          { at: m("offlineTap"), lines: ["Même", "*en avion*"] },
        ]}
      />
    </Stage>
  );
}
