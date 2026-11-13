/**
 * « 3 gestes que personne ne connaît » : un classement, trois chapitres de
 * six secondes. Le numéro géant tombe, laisse voir l'app à travers lui,
 * puis le geste se joue au téléphone : la ligne d'horaire tirée, le double
 * appui qui fait défiler, la boussole du Kotel.
 */
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { B, springAt, tween } from "../anim.ts";
import { StoneWall } from "../components/Backgrounds.tsx";
import { BeatBump, Shine, StoneMosaic, Subtitle, TextWindow } from "../components/Fx.tsx";
import { Phone, SCREEN_W } from "../components/Phone.tsx";
import { Scroll, Seq, Shot, capture, seqFrames } from "../components/Screens.tsx";
import { poseAt } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Swipe, Tap } from "../components/Touch.tsx";
import type { FeatureProps } from "../Promo.tsx";
import { STONE, palette, type Look } from "../theme.ts";
import { center, zone } from "../zones.ts";

const LOOKS: Look[] = [
  { theme: "sunset", dark: false },
  { theme: "emerald", dark: false },
  { theme: "sunset", dark: true },
];

export function SecretsFeature({ m }: FeatureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chapters = [0, m("deux"), m("trois")];
  const k = frame >= chapters[2] ? 2 : frame >= chapters[1] ? 1 : 0;
  const look = LOOKS[k];
  const pal = palette(look);
  const local = frame - chapters[k];

  // Le numéro tombe sur le premier temps du chapitre, puis rejoint son coin.
  const numP = springAt(frame, fps, chapters[k], { damping: 12, stiffness: 140 });
  const toCorner = springAt(frame, fps, chapters[k] + B(1.5), { damping: 14, stiffness: 150 });

  const row = zone("sunset-horaires-swipe:row");
  const rowY = row.y + row.h / 2;
  const pill = zone("emerald-tehilim-23-defilement:pill");
  const kotel = center(zone("night-chaharit-amida:kotel"));

  const phoneIn = chapters[k] + B(1.5);
  const pose = poseAt(local, [
    [B(1.2), { y: 2700, rx: 30, rz: k % 2 ? 10 : -10 }],
    [B(2.4), { y: 1330, width: 600 }],
    [B(4), { y: 1330, width: 600 }],
    [B(5), { y: 1300, width: 680, ry: k === 1 ? 10 : -10 }],
    [B(11), { y: 1300, width: 680, ry: 0 }],
    [B(12), { y: 1250, width: 900 }],
  ]);
  if (k === 2) pose.rz = (pose.rz ?? 0) + Math.sin(tween(local, B(4), B(11), 0, Math.PI)) * -26;

  const screen = (() => {
    if (k === 0) {
      const drag = seqFrames("sunset-horaires-swipe", 0, 11);
      const settle = seqFrames("sunset-horaires-swipe", 12, 18);
      const s0 = chapters[0] + B(4);
      const s1 = s0 + B(3);
      return (
        <>
          <Seq
            frames={[...drag, ...settle]}
            at={[...drag.map((_, i) => s0 + Math.round((i * (s1 - s0)) / (drag.length - 1))), ...settle.map((_, i) => s1 + 4 + i * 3)]}
          />
          <Swipe x0={row.x + row.w - 40} y0={rowY} x1={row.x + row.w - 300} y1={rowY} start={s0} end={s1} />
        </>
      );
    }
    if (k === 1) {
      const tapAt = chapters[1] + B(4);
      return (
        <>
          {frame < tapAt + 4 ? (
            <Shot src="emerald-tehilim-23.jpg" />
          ) : (
            <>
              <Scroll src="emerald-tehilim-119-full.jpg" chrome="emerald-tehilim-23.jpg" fromY={0} toY={1700} start={tapAt + 6} end={chapters[2]} />
              <div style={{ position: "absolute", left: pill.x - 4, top: pill.y - 4, width: pill.w + 8, height: pill.h + 8, overflow: "hidden", borderRadius: 999 }}>
                <Img src={capture("emerald-tehilim-23-defilement-00.jpg")} style={{ position: "absolute", left: -(pill.x - 4), top: -(pill.y - 4), width: SCREEN_W }} />
              </div>
            </>
          )}
          <Tap x={195} y={480} at={tapAt} />
          <Tap x={195} y={480} at={tapAt + 5} />
        </>
      );
    }
    const tapAt = chapters[2] + B(3);
    const frames = seqFrames("night-kotel", 0, 12);
    return (
      <>
        {frame < tapAt + 6 ? (
          <Shot src="night-chaharit-amida.jpg" />
        ) : (
          <Seq frames={frames} at={frames.map((_, i) => tapAt + 6 + Math.round((i * (B(7) - 6)) / frames.length))} />
        )}
        <Tap x={kotel.x} y={kotel.y} at={tapAt} />
      </>
    );
  })();

  const captions = [
    { lines: ["Glissez un horaire :", "*un rappel est posé*"] },
    { lines: ["Double appui :", "*le texte défile seul*"] },
    { lines: ["Le Kotel,", "*toujours en face*"] },
  ];
  const numberSrc = ["sunset-horaires.jpg", "emerald-tehilim-23.jpg", "night-chaharit-amida.jpg"][k];

  return (
    <>
      <StoneWall bg={pal.bg} dark={look.dark} drift={1} seed={`secret-${k}`} />
      <BeatBump from={0}>
        {local < B(2.6) ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 560,
              display: "flex",
              justifyContent: "center",
              transform: `translateY(${toCorner * -900}px) scale(${1 - toCorner * 0.8})`,
              opacity: 1 - toCorner,
            }}
          >
            <div style={{ transform: `scale(${numP})` }}>
              <TextWindow text={`${k + 1}`} src={numberSrc} size={900} start={chapters[k]} panY={[10, 40]} stroke={pal.primary} />
            </div>
          </div>
        ) : null}
        {local >= B(1.5) ? (
          <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 12 }}>
            <Pill text={`Geste n° ${k + 1} sur 3`} start={chapters[k] + B(1.5)} bg={pal.primary} size={38} />
          </div>
        ) : null}
        {local >= B(1.2) ? (
          <Phone pose={pose} dark={look.dark} screenBg={pal.bg}>
            {screen}
            <Shine at={phoneIn + 10} />
          </Phone>
        ) : null}
      </BeatBump>
      <Subtitle lines={captions[k].lines} start={chapters[k] + 4} end={(chapters[k + 1] ?? B(36)) - 10} look={look} />
      {k === 0 && frame >= chapters[0] + B(7.5) && frame < chapters[1] ? (
        <div style={{ position: "absolute", top: 600, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 13 }}>
          <Pill text="Rappel posé, 15 min avant" start={chapters[0] + B(7.5)} bg={STONE.night} size={40} />
        </div>
      ) : null}
      <StoneMosaic at={chapters[1]} color={palette(LOOKS[1]).primary} seed="s1" />
      <StoneMosaic at={chapters[2]} color={STONE.night} joint="rgba(255,255,255,0.08)" seed="s2" />
    </>
  );
}
