/**
 * « Un proche est malade. Que faire ? » : une histoire en cinq temps. Les
 * Tehilim de la guérison, une chaîne créée en quelques secondes (le titre
 * se tape sous nos yeux), envoyée aux proches, réservée psaume par psaume,
 * jusqu'aux 150 lus.
 */
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, clamp, springAt, tween } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { Confetti } from "../components/Confetti.tsx";
import { BeatBump, Counter, Shine, StoneMosaic, Subtitle } from "../components/Fx.tsx";
import { Phone } from "../components/Phone.tsx";
import { Push, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { EchoPhone } from "../components/Sections2.tsx";
import { poseAt } from "../components/Stage.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { DISPLAY, PROGRESS, SANS, SHADOW_POP, STONE, palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

const PEOPLE = ["David", "Rivka", "Yossef", "Esther", "Moché", "Hanna", "Elie", "Noa"];

export function RefouaFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = palette(spec.look);
  const submit = center(zone("ocean-nouvelle-chaine:submit"));
  const cta = center(zone("ocean-intention-refoua:cta"));

  const pose = (f: number) =>
    poseAt(f, [
      [0, { y: 2700, rx: 30, rz: -8 }],
      [B(1.2), { y: 1320, width: 620 }],
      [m("cree") - B(0.5), { y: 1320, width: 620, ry: -8 }],
      [m("cree") + B(0.5), { y: 1430, width: 820, ry: 0 }],
      [m("envoi") - B(0.5), { y: 1430, width: 820 }],
      [m("envoi") + B(0.5), { y: 1420, width: 560, rz: 3 }],
      [m("reserve") - B(0.5), { y: 1420, width: 560 }],
      [m("reserve") + B(0.5), { y: 1520, width: 520, x: 300, ry: 18, rz: -4 }],
      [m("siyoum") - B(0.5), { y: 1520, width: 520, x: 300, ry: 18 }],
      [m("siyoum") + B(0.6), { y: 2900, width: 520, x: 300, rz: 20 }],
    ]);
  const p0 = pose(frame);

  const screen = (() => {
    if (frame >= m("reserve")) return <Shot src="ocean-session.jpg" />;
    if (frame >= m("envoi")) return <Shot src="ocean-nouvelle-chaine-18.jpg" />;
    if (frame >= m("cree")) {
      const typing = seqFrames("ocean-nouvelle-chaine", 0, 12);
      const t0 = m("cree") + B(0.5);
      const t1 = m("cree") + B(3);
      const at = typing.map((_, i) => t0 + Math.round((i * (t1 - t0)) / (typing.length - 1)));
      const rest = seqFrames("ocean-nouvelle-chaine", 13, 17);
      const restAt = [t1 + 4, t1 + 12, t1 + 18, t1 + 26, t1 + 34];
      return <Seq frames={[...typing, ...rest]} at={[...at, ...restAt]} />;
    }
    return <Push from={<Shot src="ocean-intention-refoua.jpg" />} to={<Shot src="ocean-nouvelle-chaine-00.jpg" />} start={m("cree") - 6} />;
  })();

  // Les proches : des pastilles qui naissent en arc au-dessus du téléphone,
  // reliées au lien envoyé, puis cochées quand ils réservent.
  const people = PEOPLE.map((name, i) => {
    const appear = m("envoi") + B(1) + i * 3;
    const p = springAt(frame, fps, appear, { damping: 11, stiffness: 200 });
    const ang = Math.PI * (0.08 + (0.84 * i) / (PEOPLE.length - 1));
    const inReserve = frame >= m("reserve");
    const rx = inReserve ? 760 + (i % 2) * 150 : 540 - Math.cos(ang) * 420;
    const ry = inReserve ? 650 + Math.floor(i / 2) * 160 : 860 - Math.sin(ang) * 230;
    const move = springAt(frame, fps, m("reserve") + i * 2, { damping: 14, stiffness: 140 });
    const x = inReserve ? interpolate(move, [0, 1], [540 - Math.cos(ang) * 420, rx]) : rx;
    const y = inReserve ? interpolate(move, [0, 1], [860 - Math.sin(ang) * 230, ry]) : ry;
    const checked = frame >= m("reserve") + B(1) + i * 4;
    const leave = tween(frame, m("siyoum") - 6, m("siyoum") + 4, 0, 1);
    if (frame < appear) return null;
    return (
      <div
        key={name}
        style={{
          position: "absolute",
          left: x - 60,
          top: y - 60,
          width: 120,
          height: 120,
          borderRadius: 999,
          background: checked ? PROGRESS.read : i % 2 ? pal.primary : pal.secondary,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 54,
          boxShadow: SHADOW_POP,
          transform: `scale(${p * (1 - leave)})`,
          zIndex: 12,
        }}
      >
        {checked ? "✓" : name[0]}
        <div style={{ position: "absolute", top: 126, fontSize: 26, fontWeight: 700, color: pal.ink, whiteSpace: "nowrap" }}>{name}</div>
      </div>
    );
  });

  const reserved = Math.round(tween(frame, m("reserve") + B(1), m("siyoum") - B(0.5), 0, 150));
  const read = Math.round(tween(frame, m("siyoum"), m("siyoum") + B(3), 0, 150));
  const full = m("siyoum") + B(3);
  const fullHit = springAt(frame, fps, full, { damping: 8, stiffness: 240 });

  return (
    <>
      <StoneWall bg={pal.bg} drift={0.8} seed="refoua" />
      <BeatBump from={m("envoi")}>
        <EchoPhone pose={p0} prev={[pose(frame - 1), pose(frame - 2)]} screenBg={pal.bg}>
          {screen}
          <Shine at={B(1.4)} />
          <Shine at={m("envoi") + 4} />
          <Tap x={cta.x} y={cta.y} at={m("cree") - 10} />
          <Tap x={submit.x} y={submit.y} at={m("envoi") - 6} />
        </EchoPhone>
        {people}
        {frame >= m("reserve") && frame < m("siyoum") ? (
          <div
            style={{
              position: "absolute",
              left: 600,
              top: 1300,
              width: 420,
              padding: "26px 30px",
              background: pal.surface,
              borderRadius: 8,
              boxShadow: SHADOW_POP,
              fontFamily: SANS,
              transform: `scale(${springAt(frame, fps, m("reserve") + 6, { damping: 13, stiffness: 160 })})`,
              zIndex: 13,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 700, color: pal.inkSoft }}>Psaumes réservés</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 110, fontWeight: 800, color: PROGRESS.reservedInk, lineHeight: 1.05 }}>{reserved}</div>
            <div style={{ height: 16, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ width: `${(reserved / 150) * 100}%`, height: "100%", background: PROGRESS.reserved }} />
            </div>
          </div>
        ) : null}
        {frame >= m("siyoum") ? (
          <div style={{ position: "absolute", top: 760, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Counter value={150} start={m("siyoum")} duration={B(3)} size={240} color={PROGRESS.read} suffix="/150" />
            <div
              style={{
                marginTop: 30,
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontStyle: "italic",
                fontSize: 96,
                color: pal.primary,
                opacity: interpolate(frame, [full, full + 6], [0, 1], clamp),
                transform: `scale(${interpolate(fullHit, [0, 1], [1.8, 1])})`,
              }}
            >
              Refoua chelema
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: pal.inkSoft, marginTop: 16, opacity: interpolate(frame, [full + 6, full + 14], [0, 1], clamp) }}>
              {`${read} psaumes lus, en un jour`}
            </div>
          </div>
        ) : null}
      </BeatBump>
      <Confetti x={540} y={1000} at={full} colors={[pal.primary, pal.secondary, PROGRESS.read, "#C79A3B"]} count={90} />
      <Subtitle lines={["Les Tehilim", "*de la guérison*"]} start={6} end={m("cree") - 10} look={spec.look} />
      <Subtitle lines={["Une chaîne de lecture,", "*en 30 secondes*"]} start={m("cree")} end={m("envoi") - 10} look={spec.look} />
      <Subtitle lines={["Envoyez le lien", "*à vos proches*"]} start={m("envoi")} end={m("reserve") - 10} look={spec.look} />
      <Subtitle lines={["Chacun réserve", "*ses psaumes*"]} start={m("reserve")} end={m("siyoum") - 10} look={spec.look} />
      <Subtitle lines={["Et les 150", "*sont lus*"]} start={m("siyoum")} look={spec.look} />
      <StoneMosaic at={m("siyoum")} color={STONE.night} joint="rgba(255,255,255,0.08)" seed="r-siyoum" />
    </>
  );
}
