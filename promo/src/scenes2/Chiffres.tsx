/**
 * « Petite Jérusalem en chiffres » : six nombres qui défilent jusqu'à leur
 * valeur, chacun avec l'écran qui le prouve. Les chiffres sont ceux du
 * catalogue (src/datas/textStudies.json).
 */
import { useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { BeatBump, Counter, Shine, Subtitle } from "../components/Fx.tsx";
import { Shot } from "../components/Screens.tsx";
import { EchoPhone, Fan } from "../components/Sections2.tsx";
import { poseAt } from "../components/Stage.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { STONE, palette } from "../theme.ts";

const FIGURES = [
  { value: 150, lines: ["psaumes de", "*Tehilim*"], src: "emerald-tehilim.jpg" },
  { value: 62, lines: ["traités de", "*Michna*"], src: "emerald-corpus-michna.jpg" },
  { value: 40, lines: ["traités du", "*Talmud*"], src: "emerald-corpus-talmud.jpg" },
  { value: 54, lines: ["parachiot", "*de la Torah*"], src: "emerald-corpus-tanakh.jpg" },
  { value: 13, lines: ["brakhot,", "*du Birkat Hamazon à la lune*"], src: "emerald-corpus-brahot.jpg" },
  { value: 3, lines: ["langues :", "*français, anglais, hébreu*"], src: "" },
];

export function ChiffresFeature({ spec }: FeatureProps) {
  const frame = useCurrentFrame();
  const step = B(6);
  const k = Math.min(FIGURES.length - 1, Math.floor(frame / step));
  const fig = FIGURES[k];
  const pal = palette(spec.look);
  const backs = [pal.primary, STONE.beige, STONE.night];
  const bg = backs[k % backs.length];
  const onLight = bg === STONE.beige;

  const pose = (f: number) => {
    const l = f - k * step;
    const dir = k % 2 ? -1 : 1;
    return poseAt(l, [
      [B(0.8), { y: 2600, rz: dir * 14, width: 560 }],
      [B(1.6), { y: 1420, width: 560, rz: dir * -3 }],
      [B(5.4), { y: 1400, width: 600, rz: dir * 2, ry: dir * 10 }],
      [B(6), { y: 2600, width: 600, rz: dir * 16 }],
    ]);
  };

  return (
    <>
      <StoneWall bg={bg} dark={bg === STONE.night} onColor={bg === pal.primary} drift={1.5} seed={`chiffre-${k}`} />
      <BeatBump>
        <div style={{ position: "absolute", top: 170, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Counter value={fig.value} start={k * step + 2} duration={B(1.2)} size={300} color={onLight ? pal.primary : "#ffffff"} />
        </div>
        {k < 5 ? (
          <EchoPhone pose={pose(frame)} prev={[pose(frame - 1), pose(frame - 2)]} screenBg={pal.bg}>
            <Shot src={fig.src} />
            <Shine at={k * step + B(1.8)} />
          </EchoPhone>
        ) : (
          <Fan
            start={k * step + B(0.8)}
            cy={1420}
            width={430}
            items={[
              { src: "lang-en-accueil.jpg", look: { theme: "sunset", dark: false } },
              { src: "lang-fr-accueil.jpg", look: { theme: "sunset", dark: false } },
              { src: "lang-he-accueil.jpg", look: { theme: "sunset", dark: false } },
            ]}
          />
        )}
      </BeatBump>
      {FIGURES.map((f, i) => (
        <Subtitle key={i} lines={f.lines} start={i * step + B(1.2)} end={i < FIGURES.length - 1 ? (i + 1) * step - 8 : undefined} look={spec.look} top={520} size={76} />
      ))}
    </>
  );
}
