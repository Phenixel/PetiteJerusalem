/**
 * The feature sections of the 4.0 ads (series 3): 24 beats each, series 1's
 * manner. The phone rises from below, real gestures fall on the marked
 * beats (src/videos.ts), what must be read comes out of the screen, and the
 * captions sell the change in two lines, the second carrying the point.
 *
 * The screens and touched areas are those of the 4.0 presentation
 * (scripts/shots-v4.mjs, French); the helpers come from its chapters.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { Phone, type PhonePose } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { Fade, Push, Scroll, Seq, Shot } from "../components/Screens.tsx";
import { Captions, poseAt, type Caption } from "../components/Stage.tsx";
import { Pill } from "../components/Text.tsx";
import { Swipe, Tap } from "../components/Touch.tsx";
import { center, type Zone } from "../zones.ts";
import { CALME_DROP, FIN_LAST, FIN_PULL, PROGRESS_LAST, cap, focus, frames, loopFrame, spread, z } from "../v4/chapters.tsx";
import { LOOK_V4, V4 } from "../v4/palette.ts";
import { CAPTION_COLORS } from "../v4/parts.tsx";
import type { AdFeatureProps } from "./Ad.tsx";

const L = "fr" as const;
const NBSP = " ";

/** The phone's way in: from below, tilted, as in series 1. */
const RISE: [number, Partial<PhonePose>] = [0, { y: 2700, rx: 30, rz: -8 }];

/** A pill in the 4.0 orange, under the captions. */
function Tag({ text, at, out, dark = false }: { text: string; at: number; out?: number; dark?: boolean }) {
  const frame = useCurrentFrame();
  if (frame < at || (out !== undefined && frame > out + 8)) return null;
  return (
    <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 12 }}>
      <Pill text={text} start={at} out={out} bg={dark ? V4.night : V4.orange} color="#ffffff" size={40} />
    </div>
  );
}

function Frame({ pose, screen, captions, children }: { pose: PhonePose; screen: ReactNode; captions: Caption[]; children?: ReactNode }) {
  return (
    <AbsoluteFill>
      <Phone pose={pose} screenBg={V4.bg}>
        {screen}
      </Phone>
      {children}
      <Captions items={captions} look={LOOK_V4} colors={CAPTION_COLORS} />
    </AbsoluteFill>
  );
}

// --- Mon parcours -----------------------------------------------------------------------

export function ParcoursAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const lamp = center(z(L, "accueil:lamp"));
  const streak = z(L, "parcours:streak");
  const galaxy = frames(L, "parcours", 0, 11);
  const turning = loopFrame(galaxy, frame, m("push"));
  const wall = m("wall");
  const goal = m("goal");
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [m("tap") - 8, focus(195, 120, 700)],
    [m("push") + 10, {}],
    [wall, {}],
    [wall + 14, { ry: -10, x: 560 }],
    [goal, { ry: 0, x: 540 }],
    [B(24), { width: 660, rz: 2 }],
  ]);
  const parcours = (
    <>
      <Shot src={turning} />
      <Fade start={wall} duration={2}>
        <Scroll src={`${L}-parcours-full.jpg`} chrome={galaxy[0]} fromY={0} toY={420} start={wall} end={goal - 6} />
      </Fade>
    </>
  );
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Shot src={cap(L, "accueil")} />
          <Push from={null} to={parcours} start={m("push")} />
          <Push from={null} to={<Shot src={cap(L, "objectif")} />} start={goal} />
          <Tap x={lamp.x} y={lamp.y} at={m("tap")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: m("pop") - 8, lines: ["Voici", "*Mon parcours*"] },
        { at: m("pop"), out: wall - 8, lines: ["Votre série,", "*jour après jour*"] },
        { at: wall, out: goal - 8, lines: ["Une pierre", "*par jour tenu*"] },
        { at: goal, lines: ["Fixez-vous", "*un objectif*"] },
      ]}
    >
      <PopOut src={turning} zone={streak} pose={pose} start={m("pop")} end={wall - 12} to={{ x: 540, y: 1180, width: 940 }} tilt={-2} />
      <Tag text="Étude et prière" at={goal + 8} />
    </Frame>
  );
}

// --- Sidour -------------------------------------------------------------------------------

export function SidourAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const tab = center(z(L, "accueil:sidour"));
  const card = z(L, "sidour:moment");
  const hero = center(card);
  const panel = z(L, "calme:panel");
  const dnd = center(z(L, "calme:dnd"));
  const end = z(L, "fin:end");
  const drop = m("drop");
  const tap = m("dnd");
  const fin = m("fin");
  const pull = m("pull");
  const release = pull + FIN_PULL * 2;
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [m("tab") - 6, { ry: 8 }],
    [m("push") + 12, {}],
    [m("open"), {}],
    [tap - 10, focus(195, panel.y + panel.h / 2, 760)],
    [fin - 6, focus(195, panel.y + panel.h / 2, 760)],
    [fin + 6, {}],
    [pull - 6, focus(195, end.y - 60, 760)],
    [B(24), focus(195, end.y - 60, 800)],
  ]);
  const popped = frame >= tap + 3 ? `${L}-calme-${CALME_DROP + 1}.jpg` : `${L}-calme-${CALME_DROP}.jpg`;
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Shot src={cap(L, "accueil")} />
          <Push from={null} to={<Shot src={cap(L, "sidour")} />} start={m("push")} />
          <Push
            from={null}
            to={
              <Seq
                frames={[`${L}-moment-00.jpg`, ...frames(L, "calme", 0, CALME_DROP + 1)]}
                at={[0, ...spread(drop, CALME_DROP, 2), drop + 2 * CALME_DROP + 6, tap + 3]}
              />
            }
            start={m("open") + 3}
          />
          <Push
            from={null}
            to={<Seq frames={frames(L, "fin", 0, FIN_LAST)} at={[0, ...spread(pull, FIN_PULL, 2), ...spread(release + 2, 4, 3), release + 16]} />}
            start={fin}
          />
          <Tap x={tab.x} y={tab.y} at={m("tab")} color={V4.ink} />
          <Tap x={hero.x} y={hero.y} at={m("open")} color="#ffffff" />
          <Tap x={dnd.x} y={dnd.y} at={tap} color={V4.ink} />
          <Swipe x0={195} y0={560} x1={195} y1={368} start={pull} end={release} />
        </>
      }
      captions={[
        { at: 4, out: m("pop") - 8, lines: ["Le *Sidour*", "a son onglet"] },
        { at: m("pop"), out: m("open") - 8, lines: ["La prière", "*du moment*"] },
        { at: m("open"), out: fin - 8, lines: ["Avant la tefila,", "*le téléphone se tait*"] },
        { at: fin, lines: ["L'office est dit,", "*c'est noté*"] },
      ]}
    >
      <PopOut src={cap(L, "sidour")} zone={card} pose={pose} start={m("pop")} end={m("open") - 10} to={{ x: 540, y: 1180, width: 960 }} />
      <PopOut src={popped} zone={panel} pose={pose} start={drop + 2 * CALME_DROP} end={tap - 4} to={{ x: 540, y: 1020, width: 1000 }} />
      <Tag text="Sur Android" at={drop + 2 * CALME_DROP + 4} out={fin - 6} dark />
    </Frame>
  );
}

// --- La page du daf ---------------------------------------------------------------------

export function DafAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const button = center(z(L, "daf:page"));
  const toggle = center(z(L, "traduction:toggle"));
  const notice = z(L, "traduction:notice");
  const open = center(z(L, "commentaires:open"));
  const page: Zone = { x: 4, y: 392, w: 382, h: 348 };
  const passage: Zone = { x: 12, y: notice.y - 10, w: 366, h: 360 };
  const panel: Zone = { x: 0, y: 300, w: 390, h: 440 };
  const tr = m("translation");
  const cm = m("commentaries");
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [m("tap") - 6, { ry: -8 }],
    [m("page") + 10, {}],
    [tr, { ry: 8 }],
    [cm, { ry: 0 }],
    [B(24), { width: 660 }],
  ]);
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Seq frames={frames(L, "daf", 0, 6)} at={[0, ...spread(m("page"), 5, 2), m("page") + 10]} />
          <Fade start={tr - 2} duration={4}>
            <Shot src={`${L}-daf-00.jpg`} />
          </Fade>
          <Fade start={m("on")} duration={4}>
            <Shot src={cap(L, "traduction")} />
          </Fade>
          <Fade start={cm} duration={4}>
            <Seq frames={frames(L, "commentaires", 0, 10)} at={[0, ...spread(m("passage") + 2, 4, 2), m("passage") + 11, ...spread(m("open") + 2, 4, 2), m("open") + 11]} />
          </Fade>
          <Tap x={button.x} y={button.y} at={m("tap")} color={V4.ink} />
          <Tap x={toggle.x} y={toggle.y} at={m("toggle")} color={V4.ink} />
          <Tap x={200} y={480} at={m("passage")} color={V4.ink} />
          <Tap x={open.x} y={open.y} at={m("open")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: m("zoom") - 8, lines: ["Le Talmud", "*dans sa page*"] },
        { at: m("zoom"), out: tr - 8, lines: ["Rachi et Tossafot", "*autour du texte*"] },
        { at: tr, out: cm - 8, lines: ["La traduction", "*sous l'hébreu*"] },
        { at: cm, lines: [`Touchez un passage${NBSP}:`, "*ses commentaires*"] },
      ]}
    >
      <PopOut src={`${L}-daf-06.jpg`} zone={page} pose={pose} start={m("zoom")} end={tr - 8} to={{ x: 540, y: 1200, width: 1040 }} tilt={-1.5} />
      <PopOut src={cap(L, "traduction")} zone={passage} pose={pose} start={m("on") + 10} end={cm - 6} to={{ x: 540, y: 1180, width: 980 }} tilt={-2} />
      <PopOut src={`${L}-commentaires-10.jpg`} zone={panel} pose={pose} start={m("open") + 14} end={B(24) + 10} to={{ x: 540, y: 1200, width: 1000 }} tilt={-1.5} />
      <Tag text="En bêta" at={m("zoom") + 6} out={tr - 8} dark />
    </Frame>
  );
}

// --- La table d'étude -------------------------------------------------------------------

export function TableAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const aside = center(z(L, "table:aside"));
  const bar = z(L, "table:bar");
  const barTap = { x: bar.x + bar.w - 18, y: bar.y + bar.h / 2 };
  const strip = z(L, "progress:strip");
  const f = m("fly");
  const pr = m("progress");
  const sl = m("slide");
  const step = 3;
  const dragEnd = sl + 12 * step;
  const books = frame >= m("second") ? `${L}-table-12.jpg` : `${L}-table-11.jpg`;
  const shelf: Zone = { x: bar.x, y: bar.y - 26, w: 170, h: bar.h + 26 };
  const names = frames(L, "progress", 0, PROGRESS_LAST);
  const progressAt = [0, ...spread(sl, 12, step), ...spread(dragEnd + 3, 4, 3), dragEnd + 18];
  let index = 0;
  for (let i = 0; i < progressAt.length; i++) if (frame >= progressAt[i]) index = i;
  const bottom: Zone = { x: 0, y: 560, w: 390, h: 200 };
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [m("aside") - 6, { ry: -8 }],
    [m("second"), { ry: 0 }],
    [pr, { ry: 8 }],
    [B(24), { ry: 0, width: 660 }],
  ]);
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Seq frames={frames(L, "table", 0, 13)} at={[0, ...spread(f, 10, 3), f + 32, m("second"), m("sheet") + 3]} />
          <Push from={null} to={<Seq frames={names} at={progressAt} />} start={pr} />
          <Tap x={aside.x} y={aside.y} at={m("aside")} color={V4.ink} />
          <Tap x={barTap.x} y={barTap.y} at={m("bar")} color={V4.ink} />
          <Swipe x0={40} y0={strip.y + strip.h / 2} x1={340} y1={strip.y + strip.h / 2} start={sl} end={dragEnd} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: ["Mettez un texte", "*de côté*"] },
        { at: m("second"), out: m("bar") - 8, lines: ["Un deuxième", "*le rejoint*"] },
        { at: m("bar"), out: pr - 8, lines: ["Votre table", "*d'étude*"] },
        { at: pr, lines: ["La barre de lecture", "*se fait glisser*"] },
      ]}
    >
      <PopOut src={books} zone={shelf} pose={pose} start={f + 34} end={m("bar") - 8} to={{ x: 540, y: 1150, width: 620 }} tilt={-2} />
      <PopOut src={names[index]} zone={bottom} pose={pose} start={sl + 6} end={B(24) + 10} to={{ x: 540, y: 1180, width: 1000 }} tilt={-1} />
    </Frame>
  );
}

// --- L'accueil --------------------------------------------------------------------------

export function AccueilAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const card = z(L, "deck:card");
  const cc = center(card);
  const s = m("swipe");
  const edit = m("edit");
  const pins = m("pins");
  const zoomCard = focus(195, cc.y + 140, 780);
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [s - 12, zoomCard],
    [m("done") + 20, zoomCard],
    [edit, {}],
    [edit + 12, { ry: -10, x: 560 }],
    [pins, { ry: 0, x: 540 }],
    [B(24), { width: 660, rz: 2 }],
  ]);
  const x0 = card.x + card.w * 0.3;
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Shot src={cap(L, "accueil")} />
          {frame >= s - 2 ? <Seq frames={frames(L, "deck", 0, 12)} at={[0, ...spread(s, 5, 3), ...spread(s + 15, 6, 3), s + 34]} /> : null}
          <Swipe x0={x0} y0={cc.y} x1={x0 + 200} y1={cc.y} start={s} end={s + 13} />
          <Fade start={edit} duration={6}>
            <Shot src={loopFrame(frames(L, "modifier", 0, 5), frame, edit, 4)} />
          </Fade>
          <Fade start={pins} duration={6}>
            <Shot src={cap(L, "epingles")} />
          </Fade>
        </>
      }
      captions={[
        { at: 4, out: s - 8, lines: ["Un nouvel", "*accueil*"] },
        { at: s, out: edit - 8, lines: [`Glissez une carte${NBSP}:`, "*c'est fait*"] },
        { at: edit, out: pins - 8, lines: ["Maintenez un bloc", "*pour le déplacer*"] },
        { at: pins, lines: ["Vos livres", "*à portée de pouce*"] },
      ]}
    >
      <Tag text="C'est fait" at={m("done")} out={edit - 6} />
      <Tag text="À votre main" at={pins + 8} dark />
    </Frame>
  );
}

// --- Les cours --------------------------------------------------------------------------

export function CoursAd({ m }: AdFeatureProps) {
  const frame = useCurrentFrame();
  const tab1 = center(z(L, "etude:tab1"));
  const play = center(z(L, "audio:play"));
  const barZone = z(L, "audio:bar");
  const bar = center(barZone);
  const t1 = m("tab");
  const au = m("audio");
  const pose = poseAt(frame, [
    RISE,
    [B(1.2), {}],
    [t1 - 10, focus(195, 300, 720)],
    [au, {}],
    [m("play") + 6, { ry: -8 }],
    [m("full"), { ry: 0 }],
    [B(24), { width: 680, rz: 2 }],
  ]);
  return (
    <Frame
      pose={pose}
      screen={
        <>
          <Seq frames={frames(L, "etude", 0, 7)} at={[0, ...spread(t1 + 2, 6), t1 + 15]} />
          <Push
            from={null}
            to={<Seq frames={frames(L, "audio", 0, 8)} at={[0, m("play") + 3, ...spread(m("full"), 6, 2), m("full") + 13]} />}
            start={au}
          />
          <Tap x={tab1.x} y={tab1.y} at={t1} color={V4.ink} />
          <Tap x={play.x} y={play.y} at={m("play")} color={V4.ink} />
          <Tap x={bar.x} y={bar.y} at={m("bar")} color="#ffffff" />
        </>
      }
      captions={[
        { at: 4, out: au - 8, lines: ["Les chiourim,", "*dans Étude*"] },
        { at: au, out: m("follow") - 8, lines: ["Lancez un cours,", "*il continue*"] },
        { at: m("follow"), out: m("bar") - 8, lines: ["Il joue", "*en arrière-plan*"] },
        { at: m("bar"), lines: ["Le lecteur", "*en plein écran*"] },
      ]}
    >
      <PopOut src={`${L}-audio-01.jpg`} zone={barZone} pose={pose} start={m("play") + 12} end={m("bar") - 10} to={{ x: 540, y: 1150, width: 980 }} tilt={-2} />
    </Frame>
  );
}
