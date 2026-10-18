/**
 * Les horaires du jour : le bouton rond qui ouvre la page en cercle, le
 * prochain horaire, le rappel posé d'un glissé, la notification qui sonne,
 * puis d'autres villes du monde, une par temps.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { B, springAt } from "../anim.ts";
import { Notification } from "../components/Brand.tsx";
import { Phone } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { CircleReveal, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Spotlight, Swipe, Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

export function HorairesFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = palette(spec.look);
  const fab = center(zone("sunset-accueil:fab"));
  const next = zone("sunset-horaires:next");
  const where = zone("sunset-horaires:position");
  const row = zone("sunset-horaires-swipe:row");
  const rowY = row.y + row.h / 2;

  const swipeEnd = m("swipe") + B(2.4);
  // Le zoom sur la ligne tirée : la ligne au milieu de l'écran.
  const zoomW = 1000;
  const zoomY = 1150 - (47 + rowY - 847 / 2) * (zoomW / 416);
  const cities = [m("jerusalem"), m("newYork"), m("montreal")];
  const punch = cities.reduce((acc, c) => acc + Math.max(0, 1 - Math.abs(frame - c) / 5) * 30, 0);

  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 34, rz: -10 }],
    [B(1.2), {}],
    [m("position"), {}],
    [m("position") + B(1), { ry: -14, x: 560 }],
    [m("swipe") - B(0.6), { ry: -10, x: 560 }],
    [m("swipe") - B(0.2), { width: zoomW, y: zoomY }],
    [swipeEnd + B(0.4), { width: zoomW, y: zoomY }],
    [m("toast") + B(0.8), { rz: 3 }],
    [m("notif") + B(1), { rz: 0 }],
    [m("jerusalem") - B(0.5), { ry: 10, x: 520 }],
    [m("montreal") + B(1.5), { ry: -8, x: 560, width: 640 }],
  ]);
  pose.width += punch;

  // L'écran des horaires, plan par plan.
  const zmanim = (() => {
    if (frame >= m("montreal")) return <Shot src="sunset-horaires-montreal.jpg" />;
    if (frame >= m("newYork")) return <Shot src="sunset-horaires-new-york.jpg" />;
    if (frame >= m("jerusalem")) return <Shot src="sunset-horaires-jerusalem.jpg" />;
    if (frame >= m("swipe") - B(0.25)) {
      const drag = seqFrames("sunset-horaires-swipe", 0, 11);
      const settle = seqFrames("sunset-horaires-swipe", 12, 18);
      const dragAt = drag.map((_, i) => m("swipe") + Math.round((i * (swipeEnd - m("swipe"))) / (drag.length - 1)));
      const settleAt = settle.map((_, i) => m("toast") + i * 3);
      return <Seq frames={[...drag, ...settle]} at={[...dragAt, ...settleAt]} />;
    }
    return <Shot src="sunset-horaires.jpg" />;
  })();

  return (
    <Stage look={spec.look}>
      <Phone pose={pose} screenBg={pal.bg}>
        <CircleReveal
          under={<Shot src="sunset-accueil.jpg" />}
          over={zmanim}
          cx={fab.x}
          cy={fab.y}
          start={m("zmanim")}
          duration={11}
        />
        <Tap x={fab.x} y={fab.y} at={m("fab")} />
        <Spotlight {...where} start={m("position") + 2} end={m("swipe") - B(1)} color={pal.primary} radius={18} />
        <Swipe x0={row.x + row.w - 40} y0={rowY} x1={row.x + row.w - 300} y1={rowY} start={m("swipe")} end={swipeEnd} />
        <Notification title="Michéyakir" body={"Dans 15 minutes, à 06:53."} start={m("notif")} end={m("jerusalem") - 4} />
      </Phone>
      <PopOut
        src="sunset-horaires.jpg"
        zone={next}
        pose={pose}
        start={m("zmanim") + 14}
        end={m("position") - 6}
        to={{ x: 540, y: 1180, width: 900 }}
      />
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("position") - 8, lines: ["Les horaires", "*du jour*"] },
          { at: m("position"), out: m("swipe") - 16, lines: ["Calculés pour", "*votre position*"] },
          { at: m("swipe"), out: m("notif") - 8, lines: ["Un geste,", "*un rappel*"], plate: true },
          { at: m("notif"), out: m("jerusalem") - 8, lines: ["Il sonne", "*au bon moment*"] },
          { at: m("jerusalem"), lines: ["Partout", "*dans le monde*"] },
        ]}
      />
      {[
        ["Jérusalem", m("jerusalem"), m("newYork")],
        ["New York", m("newYork"), m("montreal")],
        ["Montréal", m("montreal"), B(24)],
      ].map(([name, from, to]) =>
        frame >= (from as number) && frame < (to as number) ? (
          <div key={name as string} style={{ position: "absolute", top: 500, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <Pill text={name as string} start={from as number} bg={pal.primary} size={44} />
          </div>
        ) : null,
      )}
      {/* Le rappel posé, en grand, hors du téléphone. */}
      {frame >= m("toast") && frame < m("notif") ? (
        <div
          style={{
            position: "absolute",
            top: 520,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${springAt(frame, fps, m("toast"), { damping: 10, stiffness: 200 })})`,
          }}
        >
          <Pill text="Rappel posé, 15 min avant" start={m("toast")} bg={pal.primary} size={40} />
        </div>
      ) : null}
    </Stage>
  );
}
