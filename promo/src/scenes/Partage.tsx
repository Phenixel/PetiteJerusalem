/**
 * Le partage de lecture : une chaîne de Tehilim, son avancement qui monte,
 * trois psaumes réservés d'un doigt, le lien et le QR code, puis le siyoum.
 */
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, clamp, springAt, tween } from "../anim.ts";
import { Phone } from "../components/Phone.tsx";
import { Fade, Scroll, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Confetti } from "../components/Confetti.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { DISPLAY, PROGRESS, SANS, SHADOW_POP, palette, type Look } from "../theme.ts";
import { center, zone } from "../zones.ts";

const TOTAL = 150;

/**
 * La carte d'avancement de la chaîne, redessinée en grand pour s'animer :
 * les compteurs défilent, la barre se remplit. `read` et `reserved` sont
 * des fonctions de l'image.
 */
function ProgressCard({ look, people, read, reserved, scale = 1 }: { look: Look; people: number; read: number; reserved: number; scale?: number }) {
  const pal = palette(look);
  const left = TOTAL - read - reserved;
  return (
    <div
      style={{
        width: 860,
        padding: "44px 48px 40px",
        borderRadius: 10,
        background: pal.surface,
        boxShadow: SHADOW_POP,
        fontFamily: SANS,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontSize: 84, fontWeight: 800, color: PROGRESS.read }}>{people}</span>
          <span style={{ fontSize: 36, fontWeight: 600, color: PROGRESS.readInk }}>Participent</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, color: pal.inkSoft }}>
          <span style={{ fontSize: 32 }}>Total</span>
          <span style={{ fontSize: 56, fontWeight: 800, color: pal.ink }}>{TOTAL}</span>
        </div>
      </div>
      <div style={{ marginTop: 26, height: 30, borderRadius: 999, background: look.dark ? "#374151" : "#e5e7eb", overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${(read / TOTAL) * 100}%`, background: PROGRESS.read }} />
        <div style={{ width: `${(reserved / TOTAL) * 100}%`, background: PROGRESS.reserved }} />
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 40, fontSize: 30, fontWeight: 600 }}>
        <span style={{ color: PROGRESS.readInk }}>● {Math.round(read)} lus</span>
        <span style={{ color: PROGRESS.reservedInk }}>● {Math.round(reserved)} réservés</span>
        <span style={{ color: pal.inkSoft }}>● {Math.round(left)} restants</span>
      </div>
    </div>
  );
}

export function PartageFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = palette(spec.look);
  const share = center(zone("ocean-session:share"));
  const boxes = [42, 43, 44].map((n) => zone(`ocean-session-reserver:box${n}`));
  const confirm = center(zone("ocean-session-reserver:confirm"));

  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: 8 }],
    [B(1.2), {}],
    [m("progress"), { ry: 0 }],
    [m("progress") + B(1), { y: 1500, width: 560, ry: 12, x: 600 }],
    [m("reserve") - B(0.5), { y: 1500, width: 560, ry: 12, x: 600 }],
    [m("reserve") + B(0.5), { ry: -6 }],
    [m("done") + B(1), { rz: -3, ry: 0 }],
    [m("share") + B(1), { rz: 0, width: 660, y: 1240 }],
    [m("siyoum"), { width: 660, y: 1240 }],
    // Le téléphone s'efface : le siyoum se joue sur la carte, en grand.
    [m("siyoum") + B(1), { y: 2900, width: 520, rz: 14 }],
  ]);

  // Les compteurs : d'abord l'état de la chaîne, puis le siyoum.
  const grow = tween(frame, m("progress") + 6, m("progress") + B(2.5), 0, 1);
  const finish = tween(frame, m("siyoum") + B(0.5), m("full"), 0, 1);
  const read = interpolate(grow, [0, 1], [0, 24]) + finish * (TOTAL - 24);
  const reserved = interpolate(grow, [0, 1], [0, 63]) * (1 - finish);
  const people = Math.round(interpolate(grow, [0, 1], [1, 8]) + finish * 4);
  const cardIn = springAt(frame, fps, m("progress"), { damping: 13, stiffness: 150 });
  const cardOut = tween(frame, m("reserve") - 4, m("reserve") + 4, 0, 1);
  const cardBack = springAt(frame, fps, m("siyoum"), { damping: 13, stiffness: 150 });
  const fullHit = springAt(frame, fps, m("full"), { damping: 8, stiffness: 260 });
  const showCard = (frame >= m("progress") && frame < m("reserve") + 6) || frame >= m("siyoum");
  const cardY = frame >= m("siyoum") ? interpolate(cardBack, [0, 1], [2200, 660]) : interpolate(cardIn, [0, 1], [2200, 820]) - cardOut * 1600;

  const screen = (() => {
    if (frame >= m("shareTap")) {
      return (
        <>
          <Shot src="ocean-session.jpg" />
          <Fade start={m("share")} duration={5}>
            <Shot src="ocean-session-partager.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("reserve")) {
      const picked = seqFrames("ocean-session-reserver", 0, 6);
      const confirmed = seqFrames("ocean-session-reserver", 8, 11);
      return (
        <Seq
          frames={[...picked, ...confirmed]}
          at={[
            m("reserve"),
            m("box42") + 2, m("box42") + 7,
            m("box43") + 2, m("box43") + 7,
            m("box44") + 2, m("box44") + 7,
            m("done"), m("done") + 4, m("done") + 8, m("done") + 12,
          ]}
        />
      );
    }
    return <Scroll src="ocean-session-full.jpg" chrome="ocean-session.jpg" fromY={0} toY={330} start={m("progress")} end={m("progress") + B(3)} />;
  })();

  return (
    <Stage look={spec.look}>
      <Phone pose={pose} screenBg={pal.bg}>
        {screen}
        {boxes.map((b, i) => (
          <Tap key={i} x={b.x + 12} y={b.y + b.h + 16} at={m(`box${42 + i}`)} />
        ))}
        <Tap x={confirm.x} y={confirm.y} at={m("confirm")} />
        <Tap x={share.x} y={share.y} at={m("shareTap")} />
      </Phone>
      {showCard ? (
        <div style={{ position: "absolute", left: 110, top: cardY, transform: `scale(${1 + fullHit * 0.06 - (frame >= m("full") ? 0.06 : 0) * fullHit})` }}>
          <ProgressCard look={spec.look} people={people} read={read} reserved={reserved} />
        </div>
      ) : null}
      <Confetti x={540} y={1150} at={m("full")} colors={[pal.primary, pal.secondary, PROGRESS.read, "#C79A3B"]} />
      {frame >= m("full") ? (
        <div style={{ position: "absolute", top: 980, left: 0, right: 0, textAlign: "center" }}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: 210,
              color: pal.primary,
              letterSpacing: "-0.03em",
              transform: `scale(${interpolate(fullHit, [0, 1], [2.4, 1])})`,
              opacity: interpolate(frame, [m("full"), m("full") + 3], [0, 1], clamp),
            }}
          >
            150/150
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 46,
              color: pal.inkSoft,
              marginTop: 10,
              opacity: interpolate(frame, [m("full") + 8, m("full") + 16], [0, 1], clamp),
            }}
          >
            {"Une chaîne terminée, ensemble"}
          </div>
        </div>
      ) : null}
      {frame >= m("done") && frame < m("shareTap") ? (
        <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Pill text={"Tehilim 42, 43 et 44\u00a0: à vous"} start={m("done")} bg={pal.primary} size={40} />
        </div>
      ) : null}
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("progress") - 8, lines: ["Lisez", "*à plusieurs*"] },
          { at: m("progress"), out: m("reserve") - 8, lines: ["Suivez", "*l'avancée*"] },
          { at: m("reserve"), out: m("shareTap") - 8, lines: ["Chacun réserve", "*ses psaumes*"] },
          { at: m("shareTap"), out: m("siyoum") - 8, lines: ["Invitez", "*d'un lien*"] },
          { at: m("siyoum"), lines: ["Jusqu'au", "*siyoum*"] },
        ]}
      />
    </Stage>
  );
}
