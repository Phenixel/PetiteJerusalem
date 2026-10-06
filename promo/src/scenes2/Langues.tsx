/**
 * « Français, English, עברית » : la même app dans ses trois langues. Le
 * téléphone se retourne d'une langue à l'autre (l'hébreu de droite à
 * gauche, interface comprise), puis les trois s'ouvrent en éventail.
 */
import { interpolate, useCurrentFrame } from "remotion";
import { B, clamp } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { BeatBump, Shine, StoneMosaic, Subtitle } from "../components/Fx.tsx";
import { Phone } from "../components/Phone.tsx";
import { Shot } from "../components/Screens.tsx";
import { Fan } from "../components/Sections2.tsx";
import { poseAt } from "../components/Stage.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { STONE, palette, type Look } from "../theme.ts";

const LIGHT: Look = { theme: "sunset", dark: false };
const LANGS = ["fr", "en", "he"] as const;

export function LanguesFeature({ spec }: FeatureProps) {
  const frame = useCurrentFrame();
  const pal = palette(spec.look);

  // Premier chapitre : un téléphone qui se retourne à chaque langue.
  const flipAt = [B(4), B(8)];
  let lang = 0;
  let ry = 0;
  for (let i = 0; i < flipAt.length; i++) {
    const t = frame - flipAt[i];
    if (t >= -5 && t < 0) ry = interpolate(t, [-5, 0], [0, 90], clamp);
    if (t >= 0) lang = i + 1;
    if (t >= 0 && t < 5) ry = interpolate(t, [0, 5], [-90, 0], clamp);
  }
  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: -8 }],
    [B(1.2), { y: 1360, width: 640 }],
    [B(11), { y: 1340, width: 680 }],
    [B(12), { y: 2700, width: 600, rz: 12 }],
  ]);
  pose.ry = (pose.ry ?? 0) + ry;

  const chapter = frame < B(12) ? 0 : frame < B(24) ? 1 : 2;
  const bg = [STONE.beige, pal.primary, STONE.night][chapter];

  return (
    <>
      <StoneWall bg={bg} onColor={chapter === 1} dark={chapter === 2} drift={1.2} seed={`lang-${chapter}`} />
      <BeatBump>
        {chapter === 0 ? (
          <Phone pose={pose} screenBg={pal.bg}>
            <Shot src={`lang-${LANGS[lang]}-accueil.jpg`} />
            <Shine at={B(1.5)} />
          </Phone>
        ) : null}
        {chapter === 1 ? (
          <Fan
            start={B(12)}
            cy={1400}
            width={440}
            spread={interpolate(frame, [B(13), B(15)], [0.2, 1], clamp)}
            items={LANGS.map((l) => ({ src: `lang-${l}-horaires.jpg`, look: LIGHT }))}
          />
        ) : null}
        {chapter === 2 ? (
          <Fan
            start={B(24)}
            cy={1400}
            width={440}
            spread={interpolate(frame, [B(25), B(27)], [0.2, 1.05], clamp)}
            turn={interpolate(frame, [B(28), B(36)], [0, -12], clamp)}
            items={LANGS.map((l) => ({ src: `lang-${l}-tehilim-23.jpg`, look: LIGHT }))}
          />
        ) : null}
      </BeatBump>
      <Subtitle lines={["Votre app", "*en français*"]} start={6} end={flipAt[0] - 8} look={spec.look} />
      <Subtitle lines={["Your app", "*in English*"]} start={flipAt[0] + 2} end={flipAt[1] - 8} look={spec.look} />
      <Subtitle lines={["האפליקציה שלכם", "*בעברית*"]} start={flipAt[1] + 2} end={B(12) - 8} look={spec.look} dir="rtl" />
      <Subtitle lines={["Les horaires", "*dans votre langue*"]} start={B(12) + 3} end={B(24) - 8} look={spec.look} />
      <Subtitle lines={["Le même texte,", "*pour toute la famille*"]} start={B(24) + 3} look={{ ...spec.look, dark: true }} />
      <StoneMosaic at={B(12)} color={pal.primary} seed="l1" />
      <StoneMosaic at={B(24)} color={STONE.night} joint="rgba(255,255,255,0.08)" seed="l2" />
    </>
  );
}
