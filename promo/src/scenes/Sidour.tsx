/**
 * Le sidour, en mode sombre : Cha'harit et son horaire, le menu qui mène à
 * chaque passage, la boussole du Kotel qui suit le téléphone, et le
 * parchemin du Pitoum haketoret.
 */
import { useCurrentFrame } from "remotion";
import { B, tween } from "../anim.ts";
import { Phone } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { Fade, Push, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

export function SidourFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const pal = palette(spec.look);
  const chaharit = center(zone("night-sidour:chaharit"));
  const horaire = zone("night-chaharit:horaire");
  const menu = center(zone("night-chaharit:menu"));
  const kotel = center(zone("night-chaharit-amida:kotel"));

  const turn = tween(frame, m("kotel"), m("parchemin") - B(0.5), 0, 1);
  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: 8 }],
    [B(1.2), {}],
    [m("horaire"), {}],
    [m("menuTap") - B(0.5), { ry: 12, x: 560 }],
    [m("amida"), { ry: 0, x: 540 }],
    [m("kotel"), { width: 700, y: 1220 }],
    [m("parchemin") - B(0.5), { width: 700, y: 1220 }],
    [m("parchemin") + B(1), { width: 720, rz: -3 }],
    [B(24), { width: 860, y: 1360, rz: 0 }],
  ]);
  // Le téléphone tourne dans la main pendant que la flèche cherche le Kotel.
  pose.rz = (pose.rz ?? 0) + (frame >= m("kotel") && frame < m("parchemin") ? Math.sin(turn * Math.PI) * -24 : 0);

  const screen = (() => {
    if (frame >= m("parchemin")) return <Shot src="night-parchemin.jpg" />;
    if (frame >= m("kotel")) {
      const frames = seqFrames("night-kotel", 0, 12);
      const len = m("parchemin") - B(0.5) - m("kotel");
      return <Seq frames={frames} at={frames.map((_, i) => m("kotel") + Math.round((i * len) / frames.length))} />;
    }
    if (frame >= m("amida")) return <Shot src="night-chaharit-amida.jpg" />;
    if (frame >= m("menu")) {
      return (
        <>
          <Shot src="night-chaharit.jpg" />
          <Fade start={m("menu")} duration={5}>
            <Shot src="night-chaharit-menu.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("chaharit")) return <Push from={<Shot src="night-sidour.jpg" />} to={<Shot src="night-chaharit.jpg" />} start={m("chaharit")} />;
    return <Shot src="night-sidour.jpg" />;
  })();

  return (
    <Stage look={spec.look}>
      <Phone pose={pose} dark screenBg={pal.bg}>
        {screen}
        <Tap x={chaharit.x} y={chaharit.y} at={m("chaharitTap")} />
        <Tap x={menu.x} y={menu.y} at={m("menuTap")} />
        <Tap x={kotel.x} y={kotel.y} at={m("kotelTap")} />
      </Phone>
      <PopOut src="night-chaharit.jpg" zone={horaire} pose={pose} start={m("horaire")} end={m("menuTap") - B(1)} to={{ x: 540, y: 1100, width: 900 }} />
      {frame < m("chaharitTap") ? (
        <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Pill text="Ici en mode sombre" start={B(1)} out={m("chaharitTap") - 6} bg={pal.primary} size={38} />
        </div>
      ) : null}
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("chaharit") - 4, lines: ["Cha'harit, Min'ha,", "*Arvit*"] },
          { at: m("chaharit") + 4, out: m("menuTap") - 8, lines: ["Avec l'heure", "*de chaque office*"] },
          { at: m("menuTap"), out: m("amida") - 8, lines: ["Chaque passage", "*sous le doigt*"] },
          { at: m("amida"), out: m("parchemin") - 8, lines: ["Tourné", "*vers le Kotel*"] },
          { at: m("parchemin"), lines: ["Jusqu'au", "*parchemin*"] },
        ]}
      />
    </Stage>
  );
}
