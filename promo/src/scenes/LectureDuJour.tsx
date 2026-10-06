/**
 * La lecture du jour : la carte de l'accueil, la page qui suit ce qui est
 * lu, la liste qu'on compose, le rappel à l'heure choisie, la notification,
 * et le jour bouclé.
 */
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, clamp, springAt, tween } from "../anim.ts";
import { Notification } from "../components/Brand.tsx";
import { Confetti } from "../components/Confetti.tsx";
import { Phone } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { Fade, Push, Shot } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { DISPLAY, SANS, SHADOW_POP, palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

const TEXTS = ["Tehilim 1", "Tehilim 2", "Tehilim 3", "Tehilim 23"];

export function LectureDuJourFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pal = palette(spec.look);
  const daily = zone("sunset-accueil:daily");
  const gerer = center(zone("emerald-lecture-du-jour:gerer"));
  const cloche = center(zone("emerald-lecture-du-jour:cloche"));

  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: 8 }],
    [B(1.2), {}],
    [m("openTap") - B(0.5), { ry: 0 }],
    [m("open") + B(1), { ry: -10, x: 560 }],
    [m("liste"), { ry: 0, x: 540 }],
    [m("rappel") + B(1), { ry: 10, x: 520 }],
    [m("notif"), { ry: 0, x: 540 }],
    [m("suivi") - B(0.5), {}],
    [m("suivi") + B(1), { y: 2900, rz: -12 }],
  ]);

  const screen = (() => {
    if (frame >= m("notif")) return <Shot src="emerald-accueil.jpg" />;
    if (frame >= m("rappel") - B(0.5)) {
      return (
        <>
          <Shot src="emerald-lecture-du-jour.jpg" />
          <Fade start={m("rappel")} duration={5}>
            <Shot src="emerald-lecture-du-jour-rappel.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("listeTap") - B(0.5)) {
      return (
        <>
          <Shot src="emerald-lecture-du-jour.jpg" />
          <Fade start={m("liste")} duration={5}>
            <Shot src="emerald-lecture-du-jour-liste.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("open")) return <Push from={<Shot src="emerald-accueil.jpg" />} to={<Shot src="emerald-lecture-du-jour.jpg" />} start={m("open")} />;
    return <Shot src="emerald-accueil.jpg" />;
  })();

  // Le suivi du jour, redessiné en grand : les textes se cochent un à un.
  const listIn = springAt(frame, fps, m("suivi"), { damping: 14, stiffness: 150 });
  // Tehilim 1 est déjà lu ; les trois autres se cochent sur les temps.
  const tickAt = (i: number) => (i === 0 ? m("suivi") : m("suivi") + B(0.5) * i);
  const doneCount = TEXTS.filter((_, i) => frame >= tickAt(i)).length;
  const ratio = 0.25 + [1, 2, 3].reduce((acc, i) => acc + tween(frame, tickAt(i), tickAt(i) + 6, 0, 0.25), 0);

  return (
    <Stage look={spec.look}>
      <Phone pose={pose} screenBg={pal.bg}>
        {screen}
        <Tap x={daily.x + daily.w / 2} y={daily.y + daily.h / 2} at={m("openTap")} />
        <Tap x={gerer.x} y={gerer.y} at={m("listeTap")} />
        <Tap x={cloche.x} y={cloche.y} at={m("rappelTap")} />
        <Notification
          title={"Ta lecture du jour t'attend \u{1F4D6}"}
          body="Il te reste 3 textes à lire aujourd'hui."
          start={m("notif")}
          end={m("suivi") - 4}
        />
      </Phone>
      <PopOut src="emerald-accueil.jpg" zone={daily} pose={pose} start={m("card")} end={m("openTap") - B(1)} to={{ x: 540, y: 1150, width: 940 }} />
      {frame >= m("suivi") ? (
        <div
          style={{
            position: "absolute",
            left: 110,
            right: 110,
            top: interpolate(listIn, [0, 1], [2100, 640]),
            padding: "40px 48px",
            borderRadius: 10,
            background: pal.surface,
            boxShadow: SHADOW_POP,
            fontFamily: SANS,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: pal.ink }}>
            <span style={{ fontSize: 38, fontWeight: 700 }}>{`${doneCount} sur 4 lus aujourd'hui`}</span>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: pal.primary }}>{Math.round(ratio * 100)}%</span>
          </div>
          <div style={{ marginTop: 22, height: 22, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ width: `${ratio * 100}%`, height: "100%", background: pal.primary }} />
          </div>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
            {TEXTS.map((name, i) => {
              const on = frame >= tickAt(i);
              const tick = springAt(frame, fps, tickAt(i), { damping: 9, stiffness: 260 });
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 38, fontWeight: 600, color: pal.ink }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 999,
                      border: `4px solid ${pal.primary}`,
                      background: on ? pal.primary : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 30,
                      transform: `scale(${on ? 0.7 + 0.3 * tick : 1})`,
                    }}
                  >
                    {on ? "✓" : ""}
                  </div>
                  <span style={{ opacity: on ? 1 : 0.55, textDecoration: on ? "line-through" : undefined }}>{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <Confetti x={540} y={980} at={m("done")} colors={[pal.primary, pal.secondary, "#C79A3B"]} />
      {frame >= m("done") ? (
        <div
          style={{
            position: "absolute",
            top: 1420,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 110,
            color: pal.primary,
            transform: `scale(${interpolate(springAt(frame, fps, m("done"), { damping: 9, stiffness: 240 }), [0, 1], [2, 1])})`,
            opacity: interpolate(frame, [m("done"), m("done") + 3], [0, 1], clamp),
          }}
        >
          Jour bouclé
        </div>
      ) : null}
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("openTap") - 8, lines: ["Votre lecture", "*sur l'accueil*"] },
          { at: m("openTap"), out: m("listeTap") - 8, lines: ["Ce qui reste", "*à lire*"] },
          { at: m("listeTap"), out: m("rappelTap") - 8, lines: ["Une liste", "*composée par vous*"] },
          { at: m("rappelTap"), out: m("notif") - 8, lines: ["Un rappel", "*à l'heure choisie*"] },
          { at: m("notif"), out: m("suivi") - 8, lines: ["Il vous fait", "*signe*"] },
          { at: m("suivi"), lines: ["Chaque jour,", "*coché*"] },
        ]}
      />
    </Stage>
  );
}
