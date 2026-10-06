/**
 * Le calendrier : les fêtes de l'année, 'Hanoukah en couleur, puis les
 * dates à soi (un anniversaire, un leilouy nichmat) qui reviennent sur
 * l'accueil la semaine venue, et le convertisseur de dates.
 */
import { useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { Phone } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { Fade, Scroll, Shot } from "../components/Screens.tsx";
import { Captions, Stage, poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { palette } from "../theme.ts";
import { center, zone } from "../zones.ts";

export function CalendrierFeature({ spec, m }: FeatureProps) {
  const frame = useCurrentFrame();
  const pal = palette(spec.look);
  const mesDates = center(zone("oceanNight-calendrier:mesDates"));
  const convertir = center(zone("oceanNight-calendrier:convertir"));
  const occasion = zone("oceanNight-accueil:occasion");

  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: -8 }],
    [B(1.2), {}],
    [m("hanoukah") - B(0.5), { ry: -8 }],
    [m("hanoukah") + B(0.5), { width: 860, y: 1530, ry: 0 }],
    [m("mesDatesTap") - B(0.5), { width: 860, y: 1530 }],
    [m("mesDatesTap"), { ry: 8 }],
    [m("ajout") + B(1), { ry: -8 }],
    [m("accueil"), {}],
    [m("convertir") - B(0.5), { ry: 0 }],
    [m("convertir") + B(1), { rz: 3 }],
  ]);

  const screen = (() => {
    if (frame >= m("convertir") - B(0.5)) {
      return (
        <>
          <Shot src="oceanNight-calendrier.jpg" />
          <Fade start={m("convertir")} duration={5}>
            <Shot src="oceanNight-convertir.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("accueil")) return <Shot src="oceanNight-accueil.jpg" />;
    if (frame >= m("ajout")) return <Shot src="oceanNight-ajout-date.jpg" />;
    if (frame >= m("mesDatesTap") - B(0.5)) {
      return (
        <>
          <Shot src="oceanNight-calendrier.jpg" />
          <Fade start={m("mesDates")} duration={5}>
            <Shot src="oceanNight-mes-dates.jpg" />
          </Fade>
        </>
      );
    }
    if (frame >= m("hanoukah")) return <Shot src="oceanNight-calendrier-hanouka.jpg" />;
    return <Scroll src="oceanNight-calendrier-full.jpg" chrome="oceanNight-calendrier.jpg" fromY={0} toY={1400} start={m("fetes")} end={m("hanoukah") - 2} />;
  })();

  return (
    <Stage look={spec.look}>
      <Phone pose={pose} dark screenBg={pal.bg}>
        {screen}
        <Tap x={mesDates.x} y={mesDates.y} at={m("mesDatesTap")} />
        <Tap x={convertir.x} y={convertir.y} at={m("convertir") - 4} />
      </Phone>
      <PopOut src="oceanNight-accueil.jpg" zone={occasion} pose={pose} start={m("occasion")} end={m("convertir") - B(1)} to={{ x: 540, y: 1080, width: 940 }} />
      {frame >= m("hanoukah") && frame < m("mesDatesTap") ? (
        <div style={{ position: "absolute", top: 530, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Pill text="du 5 au 12 décembre" start={m("hanoukah") + 4} bg={pal.primary} size={42} />
        </div>
      ) : null}
      <Captions
        look={spec.look}
        items={[
          { at: 4, out: m("hanoukah") - 8, lines: ["Toutes les fêtes", "*de l'année*"] },
          { at: m("hanoukah"), out: m("mesDatesTap") - 8, lines: ["Hanoukah,", "*c'est là*"] },
          { at: m("mesDatesTap"), out: m("ajout") - 8, lines: ["Et vos", "*dates à vous*"] },
          { at: m("ajout"), out: m("accueil") - 8, lines: ["Anniversaire,", "*leilouy nichmat*"] },
          { at: m("accueil"), out: m("convertir") - 8, lines: ["Rappelées", "*chaque année*"] },
          { at: m("convertir"), lines: ["Et les dates", "*converties*"] },
        ]}
      />
    </Stage>
  );
}
