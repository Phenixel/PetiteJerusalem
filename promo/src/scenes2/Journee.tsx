/**
 * « Votre journée, réglée sur le ciel » : six heures d'une même journée,
 * l'horloge à volets en tête, le ciel du fond qui passe de l'aube à la
 * nuit. À chaque heure, ce que l'app propose à ce moment-là : le prochain
 * horaire, Cha'harit, la lecture du jour, Min'ha, la chkia, le Chema du
 * coucher (l'app passe en sombre avec la nuit).
 */
import { useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { Notification } from "../components/Brand.tsx";
import { BeatBump, FlipClock, Shine, StoneMosaic, Subtitle } from "../components/Fx.tsx";
import { Push, Shot } from "../components/Screens.tsx";
import { EchoPhone } from "../components/Sections2.tsx";
import { poseAt } from "../components/Stage.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { STONE, THEMES, palette, type Look } from "../theme.ts";

type Hour = { time: string; bg: string; onColor?: boolean; dark?: boolean; lines: string[] };

const HOURS: Hour[] = [
  { time: "06:40", bg: STONE.beige, lines: ["Au réveil,", "*le prochain horaire*"] },
  { time: "06:54", bg: STONE.soft, lines: ["Cha'harit,", "*le sidour ouvert*"] },
  { time: "07:30", bg: STONE.beige, lines: ["Votre lecture", "*vous fait signe*"] },
  { time: "14:30", bg: THEMES.sunset.secondary, onColor: true, lines: ["Min'ha,", "*jusqu'à 19 h 17*"] },
  { time: "19:00", bg: THEMES.sunset.primary, onColor: true, lines: ["La chkia,", "*dans 17 minutes*"] },
  { time: "22:30", bg: STONE.night, dark: true, lines: ["Le Chema", "*avant de dormir*"] },
];

export function JourneeFeature(_props: FeatureProps) {
  const frame = useCurrentFrame();
  const step = B(6);
  const k = Math.min(HOURS.length - 1, Math.floor(frame / step));
  const hour = HOURS[k];
  const look: Look = { theme: "sunset", dark: k === 5 };
  const pal = palette(look);

  const pose = (f: number) => {
    const l = f - k * step;
    const dir = k % 2 ? -1 : 1;
    return poseAt(l, [
      [0, { x: 540 + dir * 1200, y: 1380, width: 600, rz: dir * 18 }],
      [B(0.7), { y: 1380, width: 600, rz: dir * -2 }],
      [B(5), { y: 1340, width: 660, rz: dir * 2, ry: dir * -8 }],
      [B(6), { x: 540 - dir * 1200, y: 1340, width: 660, rz: dir * -18 }],
    ]);
  };

  const screen = (() => {
    switch (k) {
      case 0:
        return <Shot src="jour-matin-accueil.jpg" />;
      case 1:
        return <Shot src="jour-matin-chaharit.jpg" />;
      case 2:
        return (
          <>
            <Shot src="sunset-lecture-du-jour.jpg" />
            <Notification title={"Ta lecture du jour t'attend \u{1F4D6}"} body="Il te reste 3 textes à lire aujourd'hui." start={k * step + B(1)} end={k * step + B(5)} />
          </>
        );
      case 3:
        return <Push from={<Shot src="jour-midi-accueil.jpg" />} to={<Shot src="jour-midi-minha.jpg" />} start={k * step + B(3)} />;
      case 4:
        return (
          <>
            <Shot src="jour-soir-horaires.jpg" />
            <Notification title="Chkia" body="Dans 15 minutes, à 19:17." start={k * step + B(1.5)} end={k * step + B(5.5)} />
          </>
        );
      default:
        return <Shot src="jour-nuit-chema.jpg" />;
    }
  })();

  const clockBg = k === 5 ? "#ffffff" : STONE.night;
  const clockInk = k === 5 ? STONE.night : "#ffffff";

  return (
    <>
      <StoneWall bg={hour.bg} dark={hour.dark} onColor={hour.onColor} drift={1.2} seed={`jour-${k}`} />
      <BeatBump>
        <EchoPhone pose={pose(frame)} prev={[pose(frame - 1), pose(frame - 2)]} dark={look.dark} screenBg={pal.bg}>
          {screen}
          <Shine at={k * step + B(0.8)} />
        </EchoPhone>
      </BeatBump>
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 15 }}>
        <FlipClock times={HOURS.map((h, i) => ({ at: i * step, value: h.time }))} size={120} bg={clockBg} ink={clockInk} />
      </div>
      {HOURS.map((h, i) => (
        <Subtitle key={i} lines={h.lines} start={i * step + 3} end={i < HOURS.length - 1 ? (i + 1) * step - 8 : undefined} look={{ theme: "sunset", dark: i === 5 }} />
      ))}
      {/* Le soir tombe : la mosaïque de nuit passe avant le Chema. */}
      <StoneMosaic at={5 * step} color={STONE.night} joint="rgba(255,255,255,0.08)" seed="nuit" />
    </>
  );
}
