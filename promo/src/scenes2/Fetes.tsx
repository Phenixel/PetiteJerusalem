/**
 * « Votre app se met en fête » : le temps d'une fête, l'app change d'habit
 * (src/services/holidayThemes.ts) : ses couleurs, le souhait de l'accueil
 * entre deux ornements, la forme du bouton rond. Cinq fêtes, filmées en
 * invité le jour même, horloge figée.
 */
import { useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { BeatBump, Shine, StoneMosaic, Subtitle } from "../components/Fx.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { Fade, Shot } from "../components/Screens.tsx";
import { EchoPhone } from "../components/Sections2.tsx";
import { poseAt } from "../components/Stage.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { STONE } from "../theme.ts";
import { zone } from "../zones.ts";

/** Les fêtes, dans l'ordre de l'année : leurs couleurs sont celles de holidayThemes.ts. */
const FETES = [
  { id: "hanouka", from: 0, primary: "#9F7A00", secondary: "#FFD23F", dark: true, lines: ["Hanouka :", "*la hanoukia s'allume*"] },
  { id: "pourim", from: 8, primary: "#CC2E70", secondary: "#F2B705", dark: false, lines: ["Pourim :", "*crécelle et masque*"] },
  { id: "pessah", from: 15, primary: "#2A86A3", secondary: "#D8B570", dark: false, lines: ["Pessah :", "*le vin et la matsa*"] },
  { id: "souccot", from: 22, primary: "#4E8A2E", secondary: "#D9B324", dark: false, lines: ["Souccot :", "*loulav et etrog*"] },
  { id: "tichri", from: 29, primary: "#D8322F", secondary: "#D9A21B", dark: false, lines: ["Roch Hachana :", "*la pomme et le miel*"] },
];

export function FetesFeature({ spec }: FeatureProps) {
  const frame = useCurrentFrame();
  let k = 0;
  FETES.forEach((f, i) => {
    if (frame >= B(f.from)) k = i;
  });
  const fete = FETES[k];
  const start = B(fete.from);
  const end = B(FETES[k + 1]?.from ?? 36);
  const fab = zone(`fete-${fete.id}-accueil:fab`);
  const greeting = zone(`fete-${fete.id}-accueil:greeting`);
  // Le zoom met le bouton rond de la fête bas dans l'image, sous les sous-titres.
  const zoomW = 820;
  const zoomY = 1470 - (47 + fab.y + fab.h / 2 - 423.5) * (zoomW / 416);
  const dir = k % 2 ? -1 : 1;

  const pose = (f: number) =>
    poseAt(f - start, [
      [0, { x: 540 + dir * 1200, y: 1380, width: 600, rz: dir * 20 }],
      [B(0.7), { y: 1380, width: 600, rz: dir * -2 }],
      [B(3.2), { y: 1380, width: 600, rz: 0 }],
      [B(4), { y: zoomY, width: zoomW, rz: 0 }],
      [end - start, { y: zoomY + 60, width: zoomW * 1.05, rz: dir * 2 }],
    ]);
  const p0 = pose(frame);
  const bg = fete.primary;

  return (
    <>
      <StoneWall bg={bg} onColor drift={1.5} seed={`fete-${k}`} />
      <BeatBump>
        <EchoPhone pose={p0} prev={[pose(frame - 1), pose(frame - 2)]} dark={fete.dark} screenBg={fete.dark ? STONE.night : STONE.beige}>
          <Shot src={`fete-${fete.id}-accueil.jpg`} />
          <Fade start={start + B(3.2)} duration={6}>
            <Shot src={`fete-${fete.id}-horaires.jpg`} />
          </Fade>
          <Shine at={start + B(1)} />
          <Shine at={start + B(4.2)} />
        </EchoPhone>
        <PopOut
          src={`fete-${fete.id}-accueil.jpg`}
          zone={{ x: greeting.x - 8, y: greeting.y - 8, w: greeting.w + 16, h: greeting.h + 16 }}
          pose={p0}
          start={start + B(1)}
          end={start + B(3)}
          to={{ x: 540, y: 900, width: 980 }}
          tilt={dir * 3}
        />
      </BeatBump>
      {FETES.map((f, i) => (
        <Subtitle key={f.id} lines={f.lines} start={B(f.from) + 3} end={i < FETES.length - 1 ? B(FETES[i + 1].from) - 8 : undefined} look={spec.look} accent={f.primary} />
      ))}
      {FETES.slice(1).map((f) => (
        <StoneMosaic key={f.id} at={B(f.from)} color={f.secondary} seed={`fm-${f.id}`} />
      ))}
    </>
  );
}
