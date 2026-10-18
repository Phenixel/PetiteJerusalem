/**
 * The chapters of the version 4.0 videos. Each one shows one change, on the
 * phone, with its sentence; its gestures fall on the marked beats of
 * plan.ts (`m("tap")` gives the frame, from the chapter's start), where the
 * music plays their sound.
 *
 * The screens are the captures of scripts/shots-v4.mjs, in the chapter's
 * language (`<locale>-<shot>`); the areas touched come from their marks.
 */
import type { ComponentType } from "react";
import { useCurrentFrame } from "remotion";
import { B } from "../anim.ts";
import { Fade, Push, Scroll, Seq, Shot, seqFrames } from "../components/Screens.tsx";
import { Spotlight, Swipe, Tap } from "../components/Touch.tsx";
import { center, zone, type Zone } from "../zones.ts";
import type { ChapterId, ChapterPlan } from "./plan.ts";
import { Chapter, focusPose, TabBars } from "./parts.tsx";
import { V4 } from "./palette.ts";
import type { Locale, V4Strings } from "./strings.ts";

export type ChapterProps = {
  loc: Locale;
  strings: V4Strings;
  plan: ChapterPlan;
  /** A marked beat of the chapter, in frames from its start. */
  m: (name: string) => number;
  /** The chapter's length, in frames. */
  len: number;
  /** The side the phone comes from (they alternate). */
  side: 1 | -1;
};

const cap = (loc: Locale, shot: string) => `${loc}-${shot}.jpg`;
const frames = (loc: Locale, shot: string, from: number, to: number) => seqFrames(`${loc}-${shot}`, from, to);
const z = (loc: Locale, key: string): Zone => zone(`${loc}-${key}`);

/** Frames placed every `step` video frames from `start`, then the last one held. */
function spread(start: number, count: number, step = 2) {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

// --- Where things moved ----------------------------------------------------------------

function Bars({ loc, strings, m }: ChapterProps) {
  return (
    <>
      <TabBars
        before={{ src: cap(loc, "avant"), bar: z(loc, "avant:bar") }}
        after={{ src: cap(loc, "accueil"), bar: z(loc, "accueil:bar") }}
        from={[z(loc, "avant:library"), z(loc, "avant:chiourim")]}
        to={z(loc, "accueil:study")}
        fresh={z(loc, "accueil:sidour")}
        strings={strings}
        at={{ after: m("after"), arrows: [m("arrow0"), m("arrow1")], fresh: m("fresh") }}
      />
      <ChapterSubtitle strings={strings} text={strings.chapters.bars} />
    </>
  );
}

/** A chapter's sentence alone, without the phone (the tab bars). */
function ChapterSubtitle({ strings, text }: { strings: V4Strings; text: string }) {
  return <Chapter subtitles={[{ text, from: 0 }]} strings={strings} bare />;
}

function Etude({ loc, strings, m, side }: ChapterProps) {
  const t1 = m("tap1");
  const t2 = m("tap2");
  const tab1 = center(z(loc, "etude:tab1"));
  const tab2 = center(z(loc, "etude:tab2"));
  return (
    <Chapter subtitles={[{ text: strings.chapters.etude, from: 0 }]} strings={strings} side={side} poses={[[0, {}], [B(1), { width: 700, y: 1300 }]]}>
      <Seq frames={frames(loc, "etude", 0, 14)} at={[0, ...spread(t1 + 2, 6), t1 + 15, ...spread(t2 + 2, 6), t2 + 15]} />
      <Tap x={tab1.x} y={tab1.y} at={t1} color={V4.ink} />
      <Tap x={tab2.x} y={tab2.y} at={t2} color={V4.ink} />
    </Chapter>
  );
}

function Sidour({ loc, strings, m, side }: ChapterProps) {
  const tab = center(z(loc, "accueil:sidour"));
  const card = z(loc, "sidour:moment");
  const c = center(card);
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.sidour, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("tap") - 4, { width: 680, y: 1150 }], [m("push") + 6, {}], [m("focus"), focusPose(c.x, c.y + 60, 900)]]}
    >
      <Push from={<Shot src={cap(loc, "accueil")} />} to={<Shot src={cap(loc, "sidour")} />} start={m("push")} />
      <Tap x={tab.x} y={tab.y} at={m("tap")} color={V4.ink} />
      <Spotlight {...card} start={m("focus")} end={m("focus") + B(4)} color={V4.blue} radius={18} />
    </Chapter>
  );
}

// --- What is new -------------------------------------------------------------------------

function Deck({ loc, strings, m, len, side, plan }: ChapterProps) {
  const s = m("swipe");
  const card = z(loc, "deck:card");
  const c = center(card);
  const dir = loc === "he" ? -1 : 1;
  const x0 = card.x + card.w * (dir > 0 ? 0.3 : 0.7);
  const edit = plan.marks.edit ? m("edit") : null;
  const zoom = focusPose(195, c.y + 120, 780);
  return (
    <Chapter
      subtitles={[
        { text: strings.chapters.deck, from: 0, to: edit ?? undefined },
        ...(edit ? [{ text: strings.chapters.edit, from: edit + 4 }] : []),
      ]}
      strings={strings}
      side={side}
      poses={[[0, {}], [s - 8, zoom], [m("done") + 14, zoom], [m("done") + 30, {}]]}
    >
      <Seq frames={frames(loc, "deck", 0, 12)} at={[0, ...spread(s, 5, 3), ...spread(s + 15, 6, 3), s + 34]} />
      <Swipe x0={x0} y0={c.y} x1={x0 + 200 * dir} y1={c.y} start={s} end={s + 13} />
      {edit ? (
        <Fade start={edit} duration={6}>
          <Loop names={frames(loc, "modifier", 0, 5)} start={edit} end={len} step={4} />
        </Fade>
      ) : null}
    </Chapter>
  );
}

/** Loops a sequence's frames every `step` video frames from `start` until `end`. */
function Loop({ names, start, end, step = 3 }: { names: string[]; start: number; end: number; step?: number }) {
  const frame = useCurrentFrame();
  const at: number[] = [];
  const order: string[] = [];
  for (let f = start, i = 0; f < end; f += step, i++) {
    at.push(f);
    order.push(names[i % names.length]);
  }
  // Seq needs each frame once: pick the frame for now among the loop.
  let index = 0;
  for (let i = 0; i < at.length; i++) if (frame >= at[i]) index = i;
  return <Shot src={order[index] ?? names[0]} />;
}

function Parcours({ loc, strings, m, side, plan }: ChapterProps) {
  const app = Boolean(plan.marks.tap);
  const scroll = m("scroll");
  const goal = plan.marks.goal ? m("goal") : null;
  const galaxy = frames(loc, "parcours", 0, 11);
  const lamp = z(loc, "accueil:lamp");
  const parcours = (
    <>
      <Loop names={galaxy} start={0} end={scroll} />
      {/* The whole page takes over to scroll down to the wall. */}
      <Fade start={scroll} duration={1}>
        <Scroll src={`${loc}-parcours-full.jpg`} chrome={galaxy[0]} fromY={0} toY={360} start={scroll} end={scroll + B(1.5)} />
      </Fade>
    </>
  );
  return (
    <Chapter
      subtitles={[
        { text: strings.chapters.parcours, from: 0, to: goal ?? undefined },
        ...(goal ? [{ text: strings.chapters.goal, from: goal + 4 }] : []),
      ]}
      strings={strings}
      side={side}
      poses={app ? [[0, {}], [m("tap") - 6, focusPose(center(lamp).x, 160, 760)], [m("push") + 8, {}]] : [[0, {}]]}
    >
      {app ? <Push from={<Shot src={cap(loc, "accueil")} />} to={parcours} start={m("push")} /> : parcours}
      {app ? <Tap x={center(lamp).x} y={center(lamp).y} at={m("tap")} color={V4.ink} /> : null}
      {goal ? <Push from={null} to={<Shot src={cap(loc, "objectif")} />} start={goal} /> : null}
    </Chapter>
  );
}

function Daf({ loc, strings, m, side }: ChapterProps) {
  const button = center(z(loc, "daf:page"));
  const zoom = m("zoom");
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.daf, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("page") + 10, {}], [zoom + 14, focusPose(195, 560, 980)], [zoom + 60, focusPose(170, 600, 1120)]]}
    >
      <Seq frames={frames(loc, "daf", 0, 6)} at={[0, ...spread(m("page"), 5, 2), m("page") + 10]} />
      <Tap x={button.x} y={button.y} at={m("tap")} color={V4.ink} />
    </Chapter>
  );
}

/** The translation (part of a chapter): the plain text, the button touched, then the translation. */
function TranslationScreens({ loc, m }: Pick<ChapterProps, "loc" | "m">) {
  const toggle = center(z(loc, "traduction:toggle"));
  return (
    <>
      <Seq frames={[`${loc}-daf-00.jpg`, cap(loc, "traduction")]} at={[0, m("on")]} />
      <Tap x={toggle.x} y={toggle.y} at={m("tap")} color={V4.ink} />
    </>
  );
}

/** The commentaries (part of a chapter): a passage touched, its sheet, then its commentaries. */
function CommentaryScreens({ loc, m }: Pick<ChapterProps, "loc" | "m">) {
  const open = center(z(loc, "commentaires:open"));
  const p = m("passage");
  const o = m("open");
  return (
    <>
      <Seq frames={frames(loc, "commentaires", 0, 10)} at={[0, ...spread(p + 2, 4, 2), p + 11, ...spread(o + 2, 4, 2), o + 11]} />
      <Tap x={200} y={480} at={p} color={V4.ink} />
      <Tap x={open.x} y={open.y} at={o} color={V4.ink} />
    </>
  );
}

function Translation({ loc, strings, m, side }: ChapterProps) {
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.translation, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("on") + 4, {}], [m("zoom") + 12, focusPose(195, 420, 980)]]}
    >
      <TranslationScreens loc={loc} m={m} />
    </Chapter>
  );
}

function Commentaries({ loc, strings, m, side }: ChapterProps) {
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.commentaries, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("panel") + 4, {}], [m("panel") + 20, focusPose(195, 470, 820)]]}
    >
      <CommentaryScreens loc={loc} m={m} />
    </Chapter>
  );
}

/** In the app: the translation, then the commentaries (the commentaries alone in Hebrew). */
function Texte(props: ChapterProps) {
  const { loc, strings, m, side, plan } = props;
  if (!plan.marks.tap) return <Commentaries {...props} />;
  const p = m("passage");
  return (
    <Chapter
      subtitles={[
        { text: strings.chapters.translation, from: 0, to: p - 10 },
        { text: strings.chapters.commentaries, from: p - 4 },
      ]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("on") + 4, {}], [m("zoom") + 12, focusPose(195, 420, 960)], [p - 16, focusPose(195, 420, 960)], [p - 4, {}], [m("panel") + 6, {}], [m("panel") + 22, focusPose(195, 470, 820)]]}
    >
      <TranslationScreens loc={loc} m={m} />
      <Fade start={p - 6} duration={4}>
        <CommentaryScreens loc={loc} m={m} />
      </Fade>
    </Chapter>
  );
}

function Table({ loc, strings, m, side }: ChapterProps) {
  const aside = center(z(loc, "table:aside"));
  const bar = z(loc, "table:bar");
  const barTap = { x: loc === "he" ? bar.x + 18 : bar.x + bar.w - 18, y: bar.y + bar.h / 2 };
  const f = m("fly");
  const zoomBar = focusPose(195, bar.y - 120, 800);
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.table, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [f + 18, {}], [f + 32, zoomBar], [m("bar") + 2, zoomBar], [m("sheet") + 10, {}]]}
    >
      <Seq frames={frames(loc, "table", 0, 13)} at={[0, ...spread(f, 10, 2), f + 22, m("second"), m("sheet")]} />
      <Tap x={aside.x} y={aside.y} at={m("aside")} color={V4.ink} />
      <Tap x={barTap.x} y={barTap.y} at={m("bar")} color={V4.ink} />
    </Chapter>
  );
}

function Audio({ loc, strings, m, side }: ChapterProps) {
  const play = center(z(loc, "audio:play"));
  const bar = center(z(loc, "audio:bar"));
  const zoom = focusPose(195, bar.y - 140, 800);
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.audio, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("play") + 8, {}], [m("play") + 22, zoom], [m("bar") + 2, zoom], [m("full") + 14, {}]]}
    >
      <Seq frames={frames(loc, "audio", 0, 8)} at={[0, m("play") + 3, ...spread(m("full"), 6, 2), m("full") + 13]} />
      <Tap x={play.x} y={play.y} at={m("play")} color={V4.ink} />
      <Tap x={bar.x} y={bar.y} at={m("bar")} color="#ffffff" />
    </Chapter>
  );
}

function Contact({ loc, strings, m, side }: ChapterProps) {
  const tab = z(loc, "contact:profile");
  const row = z(loc, "contact:row");
  const reply = focusPose(195, 470, 820);
  return (
    <Chapter
      subtitles={[{ text: strings.chapters.contact, from: 0 }]}
      strings={strings}
      side={side}
      poses={[[0, {}], [m("push") + 8, {}], [m("push") + 26, reply]]}
    >
      <Push from={<Shot src={`${loc}-contact-00.jpg`} />} to={<Shot src={`${loc}-contact-01.jpg`} />} start={m("push")} />
      <Spotlight {...tab} start={m("badge")} end={m("row") - 4} color={V4.blue} radius={14} />
      <Spotlight {...row} start={m("badge") + 6} end={m("row")} color={V4.ink} radius={12} />
      <Tap x={center(row).x} y={center(row).y} at={m("row")} color={V4.ink} />
    </Chapter>
  );
}

export const CHAPTERS: Record<ChapterId, ComponentType<ChapterProps>> = {
  bars: Bars,
  etude: Etude,
  sidour: Sidour,
  deck: Deck,
  parcours: Parcours,
  daf: Daf,
  translation: Translation,
  commentaries: Commentaries,
  texte: Texte,
  table: Table,
  audio: Audio,
  contact: Contact,
};
