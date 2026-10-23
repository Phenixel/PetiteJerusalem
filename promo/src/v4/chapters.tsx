/**
 * The chapters of the version 4.0 video, each one a scene in the first
 * series' manner (src/scenes): the phone held calmly, turning a little from
 * one moment to the next, real gestures, a card that comes out of the
 * screen to be read, and two-line captions that follow one another.
 *
 * The phone goes from one chapter to the next without leaving: each scene
 * starts at rest on the screen where the previous one ended (`from`), and
 * ends at rest. Gestures fall on the marked beats of plan.ts (`m("tap")`,
 * in frames from the chapter's start), where the music plays their sound.
 *
 * The screens are the captures of scripts/shots-v4.mjs, in the chapter's
 * language (`<locale>-<shot>`); the areas touched come from their marks.
 */
import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { Phone, type PhonePose } from "../components/Phone.tsx";
import { PopOut } from "../components/PopOut.tsx";
import { CircleReveal, Fade, Push, Scroll, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { Captions, poseAt, type Caption } from "../components/Stage.tsx";
import { Spotlight, Swipe, Tap } from "../components/Touch.tsx";
import { center, zone, type Zone } from "../zones.ts";
import { LOOK_V4, V4 } from "./palette.ts";
import { CAPTION_COLORS, TabBars } from "./parts.tsx";
import type { ChapterId, ChapterPlan } from "./plan.ts";
import type { Locale, V4Strings } from "./strings.ts";

export type ChapterProps = {
  loc: Locale;
  strings: V4Strings;
  plan: ChapterPlan;
  /** A marked beat of the chapter, in frames from its start. */
  m: (name: string) => number;
  /** The chapter's length, in frames. */
  len: number;
};

const cap = (loc: Locale, shot: string) => `${loc}-${shot}.jpg`;
/** The screen a chapter starts from: the previous chapter's last, in the 4.0 cut unless the plan says. */
const prev = (loc: Locale, plan: ChapterPlan, shot: string) => cap(loc, plan.from ?? shot);
const frames = (loc: Locale, shot: string, from: number, to: number) => seqFrames(`${loc}-${shot}`, from, to);
const z = (loc: Locale, key: string): Zone => zone(`${loc}-${key}`);

/** Frames placed every `step` video frames from `start`. */
const spread = (start: number, count: number, step = 2) => Array.from({ length: count }, (_, i) => start + i * step);

const PHONE_W = 416;
const PHONE_H = 873;

/** Below the two lines of a caption: the phone never climbs under them. */
const MIN_TOP = 520;

/**
 * The pose that brings a point of the app screen (sx, sy) to (540, cy), the
 * phone `width` wide; lowered if its top would climb under the caption. What
 * must be read larger than that comes out of the screen instead (PopOut).
 */
function focus(sx: number, sy: number, width: number, cy = 1150): Partial<PhonePose> {
  const s = width / PHONE_W;
  const y = cy - (47 + sy - PHONE_H / 2) * s;
  return { x: 540 - (sx - 195) * s, y: Math.max(y, MIN_TOP + (PHONE_H * s) / 2), width };
}

/** A chapter's frame: the phone, what floats around it, its captions. */
function Scene({ pose, screen, children, captions, strings }: { pose: PhonePose; screen: ReactNode; children?: ReactNode; captions: Caption[]; strings: V4Strings }) {
  return (
    <AbsoluteFill>
      <Phone pose={pose} screenBg={V4.bg}>
        {screen}
      </Phone>
      {children}
      <Captions items={captions} look={LOOK_V4} colors={CAPTION_COLORS} dir={strings.dir} />
    </AbsoluteFill>
  );
}

/** Loops a sequence's frames every `step` video frames (the galaxy turning, the blocks wobbling). */
function loopFrame(names: string[], frame: number, start: number, step = 3) {
  return names[Math.max(0, Math.floor((frame - start) / step)) % names.length];
}

// --- Where things moved ----------------------------------------------------------------

function Bars({ loc, strings, m, len }: ChapterProps) {
  const c = strings.captions.bars;
  return (
    <AbsoluteFill>
      <TabBars
        before={{ src: cap(loc, "avant"), bar: z(loc, "avant:bar") }}
        after={{ src: cap(loc, "accueil"), bar: z(loc, "accueil:bar") }}
        from={[z(loc, "avant:library"), z(loc, "avant:chiourim")]}
        to={z(loc, "accueil:study")}
        fresh={z(loc, "accueil:sidour")}
        strings={strings}
        at={{ old: m("old"), now: m("now"), arrows: [m("arrow0"), m("arrow1")], fresh: m("fresh") }}
        out={len - 12}
      />
      <Captions
        look={LOOK_V4}
        colors={CAPTION_COLORS}
        dir={strings.dir}
        items={[
          { at: 4, out: m("second") - 8, lines: c[0] },
          { at: m("second"), out: len - 10, lines: c[1], size: 88 },
        ]}
      />
    </AbsoluteFill>
  );
}

/**
 * Étude's three tabs. In the 4.0 cut the phone rises with it on screen;
 * after another chapter (`from`), Étude's tab is touched and the page comes.
 */
function Etude({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.etude;
  const t1 = m("tap1");
  const t2 = m("tap2");
  const tab1 = center(z(loc, "etude:tab1"));
  const tab2 = center(z(loc, "etude:tab2"));
  const zoom = focus(195, 300, 720);
  const entered = plan.from !== undefined;
  const pose = poseAt(frame, [
    entered ? [0, {}] : [0, { y: 2700, rx: 30, rz: 8 }],
    entered ? [m("push") + 12, {}] : [B(1.2), {}],
    [t1 - 12, zoom],
    [t2 + 22, zoom],
    [len - 10, {}],
  ]);
  const tabs = <Seq frames={frames(loc, "etude", 0, 14)} at={[0, ...spread(t1 + 2, 6), t1 + 15, ...spread(t2 + 2, 6), t2 + 15]} />;
  const study = center(z(loc, "accueil:study"));
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          {entered ? (
            <>
              <Push from={<Shot src={cap(loc, plan.from!)} />} to={tabs} start={m("push")} />
              <Tap x={study.x} y={study.y} at={m("tab")} color={V4.ink} />
            </>
          ) : (
            tabs
          )}
          <Tap x={tab1.x} y={tab1.y} at={t1} color={V4.ink} />
          <Tap x={tab2.x} y={tab2.y} at={t2} color={V4.ink} />
        </>
      }
      captions={[
        { at: entered ? 4 : B(0.6), out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    />
  );
}

function Sidour({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.sidour;
  const tab = center(z(loc, "accueil:sidour"));
  const card = z(loc, "sidour:moment");
  const hero = center(card);
  const pose = poseAt(frame, [
    [0, {}],
    [m("tap") - 6, { ry: loc === "he" ? -6 : 6 }],
    [m("push") + 12, {}],
    [len - 4, {}],
  ]);
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push from={<Shot src={prev(loc, plan, "etude-14")} />} to={<Shot src={cap(loc, "sidour")} />} start={m("push")} />
          <Tap x={tab.x} y={tab.y} at={m("tap")} color={V4.ink} />
          {/* The card of the moment touched: Cha'harit opens. */}
          <Tap x={hero.x} y={hero.y} at={m("open")} color="#ffffff" />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      {/* The card of the moment comes out of the screen, to be read. */}
      <PopOut src={cap(loc, "sidour")} zone={card} pose={pose} start={m("pop")} end={m("open") - 10} to={{ x: 540, y: 1180, width: 960 }} />
    </Scene>
  );
}

/** The panel of the quiet modes, the frames of its coming down (shots-v4.mjs, `calme`). */
const CALME_DROP = 14;

function Calme({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.calme;
  const panel = z(loc, "calme:panel");
  const dnd = center(z(loc, "calme:dnd"));
  const drop = m("drop");
  const tap = m("dnd");
  const zoom = focus(195, panel.y + panel.h / 2, 760);
  const pose = poseAt(frame, [
    [0, {}],
    [m("second") - 6, {}],
    [tap - 10, zoom],
    [len - 14, zoom],
    [len - 2, {}],
  ]);
  const popped = frame >= tap + 3 ? `${loc}-calme-${CALME_DROP + 1}.jpg` : `${loc}-calme-${CALME_DROP}.jpg`;
  const popEnd = m("second") - 4;
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push
            from={<Shot src={cap(loc, "sidour")} />}
            to={
              <Seq
                frames={[`${loc}-moment-00.jpg`, ...frames(loc, "calme", 0, CALME_DROP + 1)]}
                at={[0, ...spread(drop, CALME_DROP, 2), drop + 2 * CALME_DROP + 14, tap + 3]}
              />
            }
            start={m("push")}
          />
          <Tap x={dnd.x} y={dnd.y} at={tap} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      {/* The three modes, out of the screen; the app's, on Android. */}
      <PopOut src={popped} zone={panel} pose={pose} start={m("pop")} end={popEnd} to={{ x: 540, y: 1000, width: 1000 }} />
      {frame >= m("pop") + 6 && frame < popEnd ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              padding: "12px 30px",
              borderRadius: 999,
              background: V4.text,
              color: V4.bg,
              fontFamily: '"Manrope", "Heebo", sans-serif',
              fontWeight: 800,
              fontSize: 36,
              opacity: Math.min(1, (frame - m("pop") - 6) / 6, (popEnd - frame) / 6),
            }}
          >
            {strings.android}
          </div>
        </div>
      ) : null}
    </Scene>
  );
}

function Moment({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.moment;
  const pill = z(loc, "moment:pill");
  const sheet = z(loc, "moment:sheet");
  const tap = m("tap");
  const sheetIn = m("sheet");
  // The sheet's sky and the cycle of the day, under its title.
  const zoom = focus(195, sheet.y + 150, 780);
  const pose = poseAt(frame, [
    [0, {}],
    [sheetIn + 14, {}],
    [sheetIn + 30, zoom],
    [len - 14, zoom],
    [len - 2, {}],
  ]);
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={`${loc}-calme-${CALME_DROP + 1}.jpg`} />
          <Fade start={0} duration={8}>
            <Seq frames={frames(loc, "moment", 0, 7)} at={[0, ...spread(sheetIn + 2, 6, 3), sheetIn + 22]} />
          </Fade>
          <Tap x={center(pill).x} y={center(pill).y} at={tap} color="#ffffff" />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      {/* The pill: the sky of the moment, until when, how long still. */}
      <PopOut src={`${loc}-moment-00.jpg`} zone={pill} pose={pose} start={m("pop")} end={tap - 10} to={{ x: 540, y: 1150, width: 1000 }} />
    </Scene>
  );
}

/** The frames of the end of the service pushed up (shots-v4.mjs, `fin`). */
const FIN_PULL = 12;
const FIN_LAST = 17;

function Fin({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.fin;
  const end = z(loc, "fin:end");
  const pull = m("pull");
  // The line, then the card it grows into, a little above it.
  const zoom = focus(195, end.y - 60, 760);
  const pose = poseAt(frame, [
    [0, {}],
    [pull - 10, zoom],
    [len - 10, zoom],
    [len, {}],
  ]);
  const release = pull + FIN_PULL * 3;
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push
            from={<Shot src={`${loc}-moment-07.jpg`} />}
            to={
              <Seq
                frames={frames(loc, "fin", 0, FIN_LAST)}
                at={[0, ...spread(pull, FIN_PULL, 3), ...spread(release + 2, 4, 4), release + 22]}
              />
            }
            start={m("push")}
          />
          <Swipe x0={195} y0={560} x1={195} y1={368} start={pull} end={release} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    />
  );
}

// --- What is new -------------------------------------------------------------------------

function Accueil({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.accueil;
  const rtl = loc === "he";
  // Before on the reading's start side, today's after it.
  const side = rtl ? -1 : 1;
  const join = m("join");
  const s = m("swipe");
  const edit = m("edit");
  const card = z(loc, "deck:card");
  const cc = center(card);
  const zoomCard = focus(195, cc.y + 140, 780);
  const after: Partial<PhonePose> = { x: 540 + 250 * side, width: 450, ry: -10 * side };
  const pose = poseAt(frame, [
    [0, {}],
    [14, after],
    [join, after],
    [join + 16, {}],
    [s - 12, zoomCard],
    [m("done") + 20, zoomCard],
    [m("done") + 36, {}],
    [len - 8, {}],
  ]);
  // The 3.10 home page comes in beside it, then leaves.
  const before = poseAt(frame, [
    [0, { x: 540 - 1100 * side, width: 450, ry: 10 * side, rz: -6 * side }],
    [16, { x: 540 - 250 * side, width: 450, ry: 10 * side }],
    [join, { x: 540 - 250 * side, width: 450, ry: 10 * side }],
    [join + 14, { x: 540 - 1200 * side, width: 450, ry: 20 * side, rz: -8 * side }],
  ]);
  const x0 = card.x + card.w * (rtl ? 0.7 : 0.3);
  const screen = (
    <>
      <Push from={<Shot src={`${loc}-fin-${FIN_LAST}.jpg`} />} to={<Shot src={cap(loc, "accueil")} />} start={0} />
      {frame >= s - 2 ? <Seq frames={frames(loc, "deck", 0, 12)} at={[0, ...spread(s, 5, 3), ...spread(s + 15, 6, 3), s + 34]} /> : null}
      <Swipe x0={x0} y0={cc.y} x1={x0 + 200 * (rtl ? -1 : 1)} y1={cc.y} start={s} end={s + 13} />
      <Fade start={edit} duration={6}>
        <Shot src={loopFrame(frames(loc, "modifier", 0, 5), frame, edit, 4)} />
      </Fade>
    </>
  );
  const label = (text: string, x: number, at: number, dark: boolean) =>
    frame < join + 6 ? (
      <div style={{ position: "absolute", left: x - 250, width: 500, top: 640, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            padding: "12px 30px",
            borderRadius: 999,
            background: dark ? V4.text : V4.orange,
            color: dark ? V4.bg : V4.onOrange,
            fontFamily: '"Manrope", "Heebo", sans-serif',
            fontWeight: 800,
            fontSize: 38,
            opacity: Math.min(1, Math.max(0, (frame - at) / 6)) * Math.min(1, Math.max(0, (join + 6 - frame) / 6)),
          }}
        >
          {text}
        </div>
      </div>
    ) : null;
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={screen}
      captions={[
        { at: 4, out: join + 4, lines: c[0] },
        { at: join + 14, out: edit - 8, lines: c[1] },
        { at: edit, out: len - 6, lines: c[2] },
      ]}
    >
      {frame < join + 16 ? (
        <Phone pose={before} screenBg={V4.bg}>
          <Shot src={cap(loc, "avant")} />
        </Phone>
      ) : null}
      {label(strings.before, 540 - 250 * side, 10, true)}
      {label(strings.after, 540 + 250 * side, 14, false)}
    </Scene>
  );
}

function Parcours({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.parcours;
  const lamp = center(z(loc, "accueil:lamp"));
  const streak = z(loc, "parcours:streak");
  const galaxy = frames(loc, "parcours", 0, 11);
  const turning = loopFrame(galaxy, frame, m("push"));
  const wall = m("wall");
  const pose = poseAt(frame, [
    [0, {}],
    [m("tap") - 8, focus(195, 120, 700)],
    [m("push") + 10, {}],
    [wall, {}],
    [wall + 14, { ry: loc === "he" ? 8 : -8, x: 555 }],
    [m("goal"), { ry: 0, x: 540 }],
    [len - 8, {}],
  ]);
  const parcours = (
    <>
      <Shot src={turning} />
      <Fade start={wall} duration={2}>
        <Scroll src={`${loc}-parcours-full.jpg`} chrome={galaxy[0]} fromY={0} toY={360} start={wall} end={wall + B(2)} />
      </Fade>
    </>
  );
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          {/* The home page's blocks still wobbling (4.0), or the previous chapter's screen. */}
          <Shot src={plan.from ? cap(loc, plan.from) : loopFrame(frames(loc, "modifier", 0, 5), frame, 0, 4)} />
          <Fade start={0} duration={6}>
            <Shot src={cap(loc, "accueil")} />
          </Fade>
          <Push from={null} to={parcours} start={m("push")} />
          <Push from={null} to={<Shot src={cap(loc, "objectif")} />} start={m("goal")} />
          <Tap x={lamp.x} y={lamp.y} at={m("tap")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: wall - 8, lines: c[0], size: 86 },
        { at: wall, out: m("goal") - 8, lines: c[1] },
        { at: m("goal"), out: len - 6, lines: c[2] },
      ]}
    >
      {/* The streak, the light and its days, out of the screen. */}
      <PopOut src={turning} zone={streak} pose={pose} start={m("pop")} end={wall - 14} to={{ x: 540, y: 1150, width: 900 }} tilt={-2} />
    </Scene>
  );
}

function Daf({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.daf;
  const button = center(z(loc, "daf:page"));
  const second = m("second");
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The Vilna page, out of the screen: the gemara in the middle, Rachi and Tossafot around.
  const page: Zone = { x: 4, y: 392, w: 382, h: 348 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push from={<Shot src={prev(loc, plan, "objectif")} />} to={<Seq frames={frames(loc, "daf", 0, 6)} at={[0, ...spread(m("page"), 5, 2), m("page") + 10]} />} start={m("push")} />
          <Tap x={button.x} y={button.y} at={m("tap")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: second - 8, lines: c[0] },
        { at: second, out: len - 6, lines: c[1] },
      ]}
    >
      <PopOut src={`${loc}-daf-06.jpg`} zone={page} pose={pose} start={m("zoom")} end={len - 14} to={{ x: 540, y: 1200, width: 1040 }} tilt={-1.5} />
    </Scene>
  );
}

/** The last frame of the progress chapter: Cha'harit, where the slide left it. */
const PROGRESS_LAST = 17;

function Progress({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.progress;
  const strip = z(loc, "progress:strip");
  const sl = m("slide");
  const step = 4;
  const drag = spread(sl, 12, step);
  const end = sl + 12 * step;
  const at = [0, ...drag, ...spread(end + 3, 4, 3), end + 18];
  const names = frames(loc, "progress", 0, PROGRESS_LAST);
  let index = 0;
  for (let i = 0; i < at.length; i++) if (frame >= at[i]) index = i;
  const current = names[index];
  const rtl = loc === "he";
  const y = strip.y + strip.h / 2;
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The bottom of the screen, where the line rises and the titles ride it.
  const bottom: Zone = { x: 0, y: 560, w: 390, h: 200 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push from={<Shot src={`${loc}-daf-06.jpg`} />} to={<Seq frames={names} at={at} />} start={m("push")} />
          <Swipe x0={rtl ? 350 : 40} y0={y} x1={rtl ? 50 : 340} y1={y} start={sl} end={end} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      <PopOut src={current} zone={bottom} pose={pose} start={sl + 6} end={m("release") + 22} to={{ x: 540, y: 1180, width: 1000 }} tilt={-1} />
    </Scene>
  );
}

function Translation({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.translation;
  const toggle = center(z(loc, "traduction:toggle"));
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The AI notice and the translation under it (the French one); the
  // English translation has no notice: its first lines then.
  const notice = (() => {
    try {
      return z(loc, "traduction:notice");
    } catch {
      return null;
    }
  })();
  const passage: Zone = notice ? { x: 12, y: notice.y - 10, w: 366, h: 360 } : { x: 12, y: 340, w: 366, h: 380 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={prev(loc, plan, `progress-${PROGRESS_LAST}`)} />
          <Fade start={0} duration={6}>
            <Shot src={`${loc}-daf-00.jpg`} />
          </Fade>
          <Fade start={m("on")} duration={4}>
            <Shot src={cap(loc, "traduction")} />
          </Fade>
          <Tap x={toggle.x} y={toggle.y} at={m("tap")} color={V4.ink} />
        </>
      }
      captions={[{ at: 4, out: len - 6, lines: c[0] }]}
    >
      <PopOut src={cap(loc, "traduction")} zone={passage} pose={pose} start={m("pop")} end={len - 14} to={{ x: 540, y: 1180, width: 980 }} tilt={-2} />
    </Scene>
  );
}

function Commentaries({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.commentaries;
  const open = center(z(loc, "commentaires:open"));
  const p = m("passage");
  const o = m("open");
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The commentaries' panel, out of the screen, once open.
  const panel: Zone = { x: 0, y: 300, w: 390, h: 440 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={loc === "he" ? `${loc}-progress-${PROGRESS_LAST}.jpg` : cap(loc, "traduction")} />
          <Fade start={0} duration={6}>
            <Seq frames={frames(loc, "commentaires", 0, 10)} at={[0, ...spread(p + 2, 4, 2), p + 11, ...spread(o + 2, 4, 2), o + 11]} />
          </Fade>
          <Tap x={200} y={480} at={p} color={V4.ink} />
          <Tap x={open.x} y={open.y} at={o} color={V4.ink} />
        </>
      }
      captions={[{ at: 4, out: len - 6, lines: c[0] }]}
    >
      <PopOut src={`${loc}-commentaires-10.jpg`} zone={panel} pose={pose} start={m("panel") + 16} end={len - 12} to={{ x: 540, y: 1200, width: 1000 }} tilt={-1.5} />
    </Scene>
  );
}

function Table({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.table;
  const aside = center(z(loc, "table:aside"));
  const bar = z(loc, "table:bar");
  const barTap = { x: loc === "he" ? bar.x + 18 : bar.x + bar.w - 18, y: bar.y + bar.h / 2 };
  const f = m("fly");
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The books standing in the bar, out of the screen: one, then two. They
  // stand at the reading's start of the bar, the open one sticking up.
  const books = frame >= m("second") ? `${loc}-table-12.jpg` : `${loc}-table-11.jpg`;
  const shelf: Zone = { x: loc === "he" ? bar.x + bar.w - 170 : bar.x, y: bar.y - 26, w: 170, h: bar.h + 26 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={`${loc}-commentaires-10.jpg`} />
          <Fade start={0} duration={6}>
            <Seq frames={frames(loc, "table", 0, 13)} at={[0, ...spread(f, 10, 3), f + 32, m("second"), m("sheet") + 3]} />
          </Fade>
          <Tap x={aside.x} y={aside.y} at={m("aside")} color={V4.ink} />
          <Tap x={barTap.x} y={barTap.y} at={m("bar")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      <PopOut src={books} zone={shelf} pose={pose} start={f + 36} end={m("bar") - 8} to={{ x: 540, y: 1150, width: 600 }} tilt={-2} />
    </Scene>
  );
}

function Audio({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.audio;
  const play = center(z(loc, "audio:play"));
  const barZone = z(loc, "audio:bar");
  const bar = center(barZone);
  const pose = poseAt(frame, [
    [0, {}],
    [m("full") + 10, { ry: loc === "he" ? 6 : -6 }],
    [len - 6, {}],
  ]);
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push
            from={<Shot src={`${loc}-table-13.jpg`} />}
            to={<Seq frames={frames(loc, "audio", 0, 8)} at={[0, m("play") + 3, ...spread(m("full"), 6, 2), m("full") + 13]} />}
            start={m("push")}
          />
          <Tap x={play.x} y={play.y} at={m("play")} color={V4.ink} />
          <Tap x={bar.x} y={bar.y} at={m("bar")} color="#ffffff" />
        </>
      }
      captions={[{ at: 4, out: len - 6, lines: c[0] }]}
    >
      {/* The bar of the class playing, which follows from page to page. */}
      <PopOut src={`${loc}-audio-01.jpg`} zone={barZone} pose={pose} start={m("play") + 12} end={m("bar") - 10} to={{ x: 540, y: 1150, width: 980 }} tilt={-2} />
    </Scene>
  );
}

function Contact({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.contact;
  const tab = z(loc, "contact:profile");
  const row = z(loc, "contact:row");
  const second = m("second");
  const pose = poseAt(frame, [
    [0, {}],
    [len, {}],
  ]);
  // The team's answer, out of the screen.
  const reply: Zone = { x: 0, y: 420, w: 390, h: 240 };
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Push from={<Shot src={`${loc}-audio-08.jpg`} />} to={<Shot src={`${loc}-contact-00.jpg`} />} start={m("push")} />
          <Push from={null} to={<Shot src={`${loc}-contact-01.jpg`} />} start={m("open")} />
          <Spotlight {...tab} start={m("badge")} end={m("row") - 4} color={V4.blue} radius={14} />
          <Spotlight {...row} start={m("badge") + 10} end={m("row")} color={V4.ink} radius={12} />
          <Tap x={center(row).x} y={center(row).y} at={m("row")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: second - 8, lines: c[0] },
        { at: second, lines: c[1] },
      ]}
    >
      <PopOut src={`${loc}-contact-01.jpg`} zone={reply} pose={pose} start={second + 4} end={len + 30} to={{ x: 540, y: 1180, width: 1000 }} tilt={-1.5} />
    </Scene>
  );
}

// --- The presentation of the whole app (plan.ts, overviewPlan) --------------------------

/** The phone rises on the home page: the card of the moment, then swiped once done. */
function Jour({ loc, strings, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.jour!;
  const rtl = loc === "he";
  const s = m("swipe");
  const card = z(loc, "deck:card");
  const cc = center(card);
  const zoomCard = focus(195, cc.y + 140, 780);
  const pose = poseAt(frame, [
    [0, { y: 2700, rx: 30, rz: 8 }],
    [B(1.2), {}],
    [s - 14, zoomCard],
    [m("done") + 24, zoomCard],
    [len - 8, {}],
  ]);
  const x0 = card.x + card.w * (rtl ? 0.7 : 0.3);
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={cap(loc, "accueil")} />
          {frame >= s - 2 ? <Seq frames={frames(loc, "deck", 0, 12)} at={[0, ...spread(s, 5, 3), ...spread(s + 15, 6, 3), s + 34]} /> : null}
          <Swipe x0={x0} y0={cc.y} x1={x0 + 200 * (rtl ? -1 : 1)} y1={cc.y} start={s} end={s + 13} />
        </>
      }
      captions={[
        { at: B(0.6), out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      {/* The card of the moment, out of the screen: Cha'harit, until when. */}
      <PopOut src={cap(loc, "accueil")} zone={card} pose={pose} start={B(1.8)} end={m("second") - 6} to={{ x: 540, y: 1150, width: 980 }} tilt={-2} />
    </Scene>
  );
}

/** The round button: the day's times open in a circle, the next one in large, then the day scrolls by to Chabbat. */
function Horaires({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.horaires!;
  const bar = z(loc, "accueil:bar");
  // The round button stands in the middle of the bar, raised above it.
  const fab = { x: bar.x + bar.w / 2, y: bar.y + 14 };
  const next = z(loc, "horaires:next");
  const sc = m("scroll");
  const pose = poseAt(frame, [
    [0, {}],
    [sc, {}],
    [sc + 16, { ry: loc === "he" ? 6 : -6 }],
    [len - 6, {}],
  ]);
  const times = <Scroll src={cap(loc, "horaires-full")} chrome={cap(loc, "horaires")} fromY={0} toY={1250} start={sc} end={len - 2} />;
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <CircleReveal under={<Shot src={prev(loc, plan, "moment-07")} />} over={times} cx={fab.x} cy={fab.y} start={m("open")} />
          <Tap x={fab.x} y={fab.y} at={m("tap")} color="#ffffff" />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      <PopOut src={cap(loc, "horaires")} zone={next} pose={pose} start={m("pop")} end={sc - 6} to={{ x: 540, y: 1150, width: 1000 }} tilt={-2} />
    </Scene>
  );
}

/** Partage: a chain of Tehilim and its psalms, ticked; then the reader's own, one after the other. */
function Chaine({ loc, strings, plan, m, len }: ChapterProps) {
  const frame = useCurrentFrame();
  const c = strings.captions.chaine!;
  const card = z(loc, "chaine:card");
  // The chain's own page opens from the arrow at the end of its title.
  const open = { x: card.x + card.w - 26, y: card.y + 34 };
  const pose = poseAt(frame, [
    [0, {}],
    [m("push") + 12, {}],
    [m("read"), { ry: loc === "he" ? -6 : 6 }],
    [len - 6, {}],
  ]);
  return (
    <Scene
      pose={pose}
      strings={strings}
      screen={
        <>
          <Shot src={prev(loc, plan, "chaine-00")} />
          <Fade start={0} duration={4}>
            <Shot src={`${loc}-chaine-00.jpg`} />
          </Fade>
          <Push from={null} to={<Shot src={cap(loc, "tehilim")} />} start={m("push")} />
          <Tap x={open.x} y={open.y} at={m("tap")} color={V4.ink} />
        </>
      }
      captions={[
        { at: 4, out: m("second") - 8, lines: c[0] },
        { at: m("second"), out: len - 6, lines: c[1] },
      ]}
    >
      {/* The chain's psalms, those read ticked. */}
      <PopOut src={`${loc}-chaine-00.jpg`} zone={card} pose={pose} start={m("pop")} end={m("tap") - 8} to={{ x: 540, y: 1180, width: 860 }} tilt={-2} />
      {/* The reader's psalms and where they stand. */}
      <PopOut src={cap(loc, "tehilim")} zone={{ x: 12, y: 238, w: 366, h: 300 }} pose={pose} start={m("read")} end={len - 10} to={{ x: 540, y: 1180, width: 980 }} tilt={-1.5} />
    </Scene>
  );
}

export const CHAPTERS: Record<ChapterId, ComponentType<ChapterProps>> = {
  jour: Jour,
  horaires: Horaires,
  chaine: Chaine,
  bars: Bars,
  etude: Etude,
  sidour: Sidour,
  calme: Calme,
  moment: Moment,
  fin: Fin,
  accueil: Accueil,
  parcours: Parcours,
  daf: Daf,
  progress: Progress,
  translation: Translation,
  commentaries: Commentaries,
  table: Table,
  audio: Audio,
  contact: Contact,
};
