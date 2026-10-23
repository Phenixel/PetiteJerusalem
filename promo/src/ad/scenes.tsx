/**
 * The scenes of the advertisement (plan.ts), in motion design: one day,
 * from dawn to night, each part of the app told by what it does rather than
 * by its screen. The screens come after, in the montage (Ad.tsx).
 *
 * Each scene is a function of the frame from its start; `m("name")` is a
 * marked beat of plan.ts in frames, where the music plays its sound.
 */
import type { ComponentType } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, beatPulse, clamp, springAt, tween } from "../anim.ts";
import { Confetti } from "../components/Confetti.tsx";
import { Phone } from "../components/Phone.tsx";
import { Shot } from "../components/Screens.tsx";
import { poseAt } from "../components/Stage.tsx";
import { KineticTitle } from "../components/Text.tsx";
import { DISPLAY, SANS, SHADOW_POP } from "../theme.ts";
import { LogoMotion, LogoPieces } from "../v4/LogoMotion.tsx";
import { BINDINGS, C, Chip, Flame, Galaxy, HEBREW, Icon, NightStars, PhoneShape, Pop, READERS, SidourBook, Sky, TextLines, Title, Toggle, Volume, Waves } from "./art.tsx";
import type { AdSceneId } from "./plan.ts";

export type SceneProps = {
  /** A marked beat of the scene, in frames from its start. */
  m: (name: string) => number;
  /** The scene's length, in frames. */
  len: number;
};

const NNBSP = " ";

// --- The opening ---------------------------------------------------------------------

/** Three verbs struck on the first beats, then the logo builds and the name comes. */
export function AdHook({ beats }: { beats: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = [
    { text: "Prier.", icon: "sun" },
    { text: "Étudier.", icon: "book-open" },
    { text: "Partager.", icon: "users" },
  ];
  const leave = tween(frame, B(3), B(3.6), 0, 1);
  const logoAt = B(3.4);
  const end = B(beats);
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, transform: `translateY(${-leave * 300}px)`, opacity: 1 - leave }}>
        {words.map((word, i) => {
          if (frame < B(i)) return <div key={i} style={{ height: 190 }} />;
          const p = springAt(frame, fps, B(i), { damping: 11, stiffness: 230, mass: 0.6 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 36,
                height: 190,
                transform: `scale(${2 - p}) rotate(${(1 - p) * -6}deg)`,
                opacity: Math.min(1, p * 3),
              }}
            >
              <div style={{ width: 150, height: 150, borderRadius: 150, background: i === 1 ? C.blue : C.orange, display: "grid", placeItems: "center" }}>
                <Icon name={word.icon} size={84} color={C.white} stroke={2.2} />
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 168, letterSpacing: "-0.03em", color: C.ink, fontStyle: i === 2 ? "italic" : undefined }}>
                {word.text}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      {frame >= logoAt ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [end - 4, end], [1, 0], clamp) }}>
          <div style={{ marginTop: -220 }}>
            <LogoMotion size={560} start={logoAt} speed={1.5} />
          </div>
          <div style={{ marginTop: -30 }}>
            <KineticTitle lines={["PETITE JERUSALEM"]} start={logoAt + B(1.6)} color={C.ink} size={96} stagger={3} weight={600} />
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 50,
              color: C.deep,
              opacity: interpolate(frame, [logoAt + B(2.6), logoAt + B(2.6) + 8], [0, 1], clamp),
            }}
          >
            La Torah au quotidien
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

// --- Dawn: the day's times --------------------------------------------------------------

const SUN_MARKS = [
  { icon: "sunrise", name: "Alot haCha'har", time: "06:37", q: 0.12 },
  { icon: "sun", name: "Netz haHama", time: "08:11", q: 0.27 },
  { icon: "sun", name: "'Hatsot", time: "13:35", q: 0.5 },
  { icon: "sunset", name: "Chkia", time: "19:01", q: 0.85 },
];

function Aube({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const rise = m("sunrise");
  const phone = m("phone");
  // The sun passes each time when its chip pops (plan.ts).
  const chips = SUN_MARKS.map((_, i) => m(`chip${i}`));
  const q = interpolate(frame, [rise, ...chips, len], [-0.04, ...SUN_MARKS.map((s) => s.q), 1], clamp);
  const cx = 540;
  const cy = 1430;
  const pos = (t: number) => ({ x: cx - 620 * Math.cos(t * Math.PI), y: cy - 560 * Math.sin(t * Math.PI) });
  const sun = pos(q);
  const night = interpolate(frame, [rise, rise + B(3)], [1, 0], clamp);
  const chipsOut = phone - 6;
  return (
    <AbsoluteFill>
      <Sky keys={[[0, C.night], [rise, C.night], [rise + B(3), C.dawn], [chips[1], C.day]]} />
      <NightStars opacity={night} bottom={1150} />
      {/* The sun's path, dotted behind it. */}
      {Array.from({ length: 48 }, (_, i) => {
        const t = i / 47;
        if (t > q || frame >= chipsOut + 8) return null;
        const p = pos(t);
        return <div key={i} style={{ position: "absolute", left: p.x - 5, top: p.y - 5, width: 10, height: 10, borderRadius: 10, background: C.white, opacity: 0.8 * (1 - tween(frame, chipsOut, chipsOut + 8, 0, 1)) }} />;
      })}
      <div style={{ position: "absolute", left: sun.x - 150, top: sun.y - 150, width: 300, height: 300, borderRadius: 300, background: "#FFE3B8", opacity: 0.55 }} />
      <div style={{ position: "absolute", left: sun.x - 95, top: sun.y - 95, width: 190, height: 190, borderRadius: 190, background: "#FFB547" }} />
      {/* The logo's Jerusalem, its book under it: the sun rises behind its wall. */}
      <LogoPieces size={1500} pieces={["tower", "dome", "flame", "cypress", "wall", "book"]} style={{ position: "absolute", left: -210, top: 600 }} />
      {SUN_MARKS.map((mark, i) => {
        const p = pos(mark.q);
        const left = Math.min(Math.max(p.x, 250), 830);
        return (
          <Pop key={i} at={chips[i]} out={chipsOut} style={{ left: left - 240, width: 480, top: p.y - 150, display: "flex", justifyContent: "center" }}>
            <Chip icon={mark.icon} name={mark.name} value={mark.time} size={40} />
          </Pop>
        );
      })}
      <Title lines={["Avant même l'aube,", "*elle sait l'heure*"]} at={B(0.3)} out={rise + B(1.4)} dark />
      <Title lines={["Les horaires du jour,", "*à la minute près*"]} at={chips[0]} out={m("title2") - 8} />
      <Title lines={["Où que vous soyez", "*dans le monde*"]} at={m("title2")} />
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", padding: "0 60px" }}>
        {["Paris", "Jérusalem", "New York", "Montréal"].map((city, i) => (
          <div key={city} style={{ position: "relative", width: city.length * 25 + 130, height: 84 }}>
            <Pop at={m(`city${i}`)} style={{ left: 0, top: 0 }}>
              <Chip icon="map-pin" name={city} size={36} />
            </Pop>
          </div>
        ))}
      </div>
      {frame >= phone ? (
        <Phone
          pose={poseAt(frame, [
            [phone, { y: 2700, width: 560, rz: 8 }],
            [phone + B(1.2), { y: 1300, width: 560, rz: -3 }],
            [len, { y: 1280, width: 560, rz: 0 }],
          ])}
          screenBg={C.cream}
        >
          <Shot src="fr-horaires.jpg" />
        </Phone>
      ) : null}
    </AbsoluteFill>
  );
}

// --- The prayer: the Sidour, then the phone that goes quiet ---------------------------

const SIDOUR_LINES = ["שחרית", "מוֹדֶה אֲנִי לְפָנֶיךָ", "מֶלֶךְ חַי וְקַיָּם", "שֶׁהֶחֱזַרְתָּ בִּי נִשְׁמָתִי", "בְּחֶמְלָה, רַבָּה אֱמוּנָתֶךָ"];

function Tefila({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = tween(frame, m("open"), m("open") + B(1.4), 0, 1);
  const drop = springAt(frame, fps, m("book"), { damping: 13, stiffness: 120 });
  const ring = m("ring");
  const quiet = m("quiet");
  const bookOut = tween(frame, ring - B(1), ring - B(0.2), 0, 1);
  const width = 440;
  const ringing = frame >= ring && frame < quiet;
  const shake = ringing ? 8 * Math.sin(frame * 1.7) : 0;
  const phoneIn = springAt(frame, fps, ring - B(0.4), { damping: 12, stiffness: 170 });
  const out = tween(frame, len - 8, len, 0, 1);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Sky keys={[[0, C.day], [B(1), C.cream]]} />
      {frame < ring ? (
        <div
          style={{
            position: "absolute",
            left: 540 - width,
            top: 1080 - (width * 1.36) / 2,
            transform: `translateX(${-(1 - open) * (width / 2)}px) translateY(${(1 - drop) * -1500 - bookOut * 900}px) scale(${1 - bookOut * 0.5}) rotate(${(1 - drop) * -10}deg)`,
            opacity: 1 - bookOut,
          }}
        >
          <SidourBook open={open} width={width} lines={SIDOUR_LINES} seen={(i) => tween(frame, m("open") + B(1.1) + i * 5, m("open") + B(1.1) + i * 5 + 8, 0, 1)} />
        </div>
      ) : null}
      <Pop at={m("pill")} out={ring - B(1)} style={{ left: 0, right: 0, top: 640, display: "flex", justifyContent: "center" }}>
        <Chip icon="sun" name="Cha'harit" value="jusqu'à 13:35" size={40} />
      </Pop>
      <Title lines={["Le Sidour s'ouvre", "*au bon moment*"]} at={B(0.4)} out={ring - B(1.2)} />
      {frame >= ring - B(0.4) ? (
        <>
          <Waves x={540} y={830} on={ringing} color={C.orange} />
          <div style={{ position: "absolute", left: 540 - 150, top: 830 - 307, transform: `scale(${phoneIn}) rotate(${shake}deg)` }}>
            <PhoneShape width={300}>
              <Icon name={frame >= quiet ? "bell-off" : "bell"} size={150} color={frame >= quiet ? C.deep : C.ink} stroke={1.8} />
            </PhoneShape>
          </div>
          <Pop at={ring + B(0.6)} style={{ left: 0, right: 0, top: 1300, display: "flex", justifyContent: "center", gap: 20 }}>
            <Toggle icon="circle-minus" label="Ne pas déranger" at={m("toggle0")} />
            <Toggle icon="bell-off" label="Silencieux" at={m("toggle1")} />
            <Toggle icon="vibrate" label="Vibreur" at={m("toggle2")} />
          </Pop>
          <Pop at={quiet + 4} style={{ left: 0, right: 0, top: 1640, display: "flex", justifyContent: "center" }}>
            <Chip name="Sur Android" size={34} bg={C.ink} color={C.cream} />
          </Pop>
        </>
      ) : null}
      <Title lines={["Avant la tefila,", "*le téléphone se tait*"]} at={ring} />
    </AbsoluteFill>
  );
}

// --- Study: the shelf, the daf page, the translation ------------------------------------

const GEMARA = ["מאימתי קורין", "את שמע בערבין", "משעה שהכהנים", "נכנסים לאכול", "בתרומתן עד סוף", "האשמורה הראשונה", "דברי רבי אליעזר"];

function Etude({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pull = m("pull");
  const daf = m("daf");
  const trans = m("trans");
  const shelfOut = tween(frame, pull, daf, 0, 1);
  const volW = 132;
  const volH = 380;
  const gap = 12;
  const x0 = (1080 - (6 * volW + 5 * gap)) / 2;
  const shelfY = 1200;
  // The page: open from the Talmud volume, then up and smaller when the translation comes.
  const pageIn = springAt(frame, fps, daf, { damping: 14, stiffness: 120 });
  const pageAway = tween(frame, trans, trans + B(1), 0, 1);
  const pageW = 900;
  const pageH = 980;
  const gem = (i: number) => tween(frame, m("gemara") + i * 3, m("gemara") + i * 3 + 7, 0, 1);
  const rashi = springAt(frame, fps, m("rashi"), { damping: 13, stiffness: 150 });
  const tossafot = springAt(frame, fps, m("tossafot"), { damping: 13, stiffness: 150 });
  const card = springAt(frame, fps, trans + B(0.6), { damping: 13, stiffness: 140 });
  const line = springAt(frame, fps, m("line"), { damping: 14, stiffness: 160 });
  const out = tween(frame, len - 8, len, 0, 1);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Sky keys={[[0, C.cream]]} />
      {/* The shelf and its six volumes, falling one per beat. */}
      {frame < daf + 6 ? (
        <>
          <div style={{ position: "absolute", left: 80, right: 80, top: shelfY, height: 26, background: "#B98A5E", borderRadius: 3, opacity: 1 - shelfOut, boxShadow: "0 10px 0 #9A7049" }} />
          {BINDINGS.map((book, i) => {
            const at = m(`book${i}`);
            if (frame < at) return null;
            const p = springAt(frame, fps, at, { damping: 12, stiffness: 160 });
            const talmud = book.name === "Talmud";
            const lift = talmud ? tween(frame, pull, daf, 0, 1) : 0;
            return (
              <div
                key={book.name}
                style={{
                  position: "absolute",
                  left: x0 + i * (volW + gap),
                  top: shelfY - volH,
                  transform: `translateY(${(1 - p) * -900 - lift * 260}px) rotate(${(1 - p) * -14}deg) scale(${1 + lift * 0.4})`,
                  opacity: talmud ? 1 - tween(frame, daf - 2, daf + 6, 0, 1) : 1 - shelfOut,
                  zIndex: talmud ? 2 : 1,
                }}
              >
                <Volume name={book.name} color={book.color} width={volW} height={volH} />
              </div>
            );
          })}
        </>
      ) : null}
      <Title lines={["Toute une *bibliothèque*", "dans la poche"]} at={B(0.3)} out={pull - 4} />
      {/* The daf: the gemara in the middle, Rachi and Tossafot around it. */}
      {frame >= daf ? (
        <div
          style={{
            position: "absolute",
            left: 540 - pageW / 2,
            top: 1210 - pageH / 2,
            width: pageW,
            height: pageH,
            background: "#FFFDF8",
            borderRadius: 6,
            boxShadow: SHADOW_POP,
            transform: `scale(${(0.3 + 0.7 * pageIn) * (1 - pageAway * 0.45)}) translateY(${-pageAway * 900}px)`,
            opacity: 1 - tween(frame, trans + B(0.6), trans + B(1.2), 0, 1),
          }}
        >
          <div dir="rtl" style={{ position: "absolute", left: 300, width: 300, top: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: HEBREW, fontWeight: 800, fontSize: 70, color: C.ink, border: `3px solid ${C.ink}`, padding: "2px 18px", opacity: gem(0), marginBottom: 10 }}>מאימתי</div>
            {GEMARA.slice(1).map((text, i) => (
              <div key={i} style={{ fontFamily: HEBREW, fontWeight: 500, fontSize: 38, color: C.ink, opacity: gem(i + 1), transform: `translateY(${(1 - gem(i + 1)) * 14}px)` }}>
                {text}
              </div>
            ))}
          </div>
          {/* Rachi on the binding's side, then under the gemara. */}
          <div style={{ position: "absolute", left: 620, top: 60, width: 240, transform: `translateX(${(1 - rashi) * 400}px)`, opacity: rashi }}>
            <TextLines count={22} width={240} height={9} gap={9} seed="rashi" color="rgba(30,27,24,0.28)" />
          </div>
          <div style={{ position: "absolute", left: 470, top: 640, width: 390, transform: `translateY(${(1 - rashi) * 300}px)`, opacity: rashi }}>
            <TextLines count={11} width={390} height={9} gap={9} seed="rashi2" color="rgba(30,27,24,0.28)" />
          </div>
          {/* Tossafot on the edge's side. */}
          <div style={{ position: "absolute", left: 40, top: 60, width: 240, transform: `translateX(${(tossafot - 1) * 400}px)`, opacity: tossafot }}>
            <TextLines count={22} width={240} height={9} gap={9} seed="tossafot" color="rgba(30,27,24,0.22)" />
          </div>
          <div style={{ position: "absolute", left: 40, top: 640, width: 390, transform: `translateY(${(1 - tossafot) * 300}px)`, opacity: tossafot }}>
            <TextLines count={11} width={390} height={9} gap={9} seed="tossafot2" color="rgba(30,27,24,0.22)" />
          </div>
          <Pop at={m("rashi") + 4} out={trans - 4} style={{ left: 640, top: -34 }}>
            <Chip name="Rachi" size={30} bg={C.blue} color={C.white} />
          </Pop>
          <Pop at={m("tossafot") + 4} out={trans - 4} style={{ left: 60, top: -34 }}>
            <Chip name="Tossafot" size={30} bg={C.orange} color={C.white} />
          </Pop>
        </div>
      ) : null}
      <Title lines={["Le Talmud", "*dans sa page*"]} at={daf} out={trans - 6} />
      {/* The translation, under the Hebrew it translates. */}
      {frame >= trans + B(0.6) ? (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 760,
            padding: "60px 56px",
            background: C.white,
            borderRadius: 8,
            boxShadow: SHADOW_POP,
            transform: `translateY(${(1 - card) * 1200}px)`,
          }}
        >
          <div dir="rtl" style={{ fontFamily: HEBREW, fontWeight: 600, fontSize: 64, color: C.ink, textAlign: "right", lineHeight: 1.35 }}>
            מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִין
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 44,
              lineHeight: 1.35,
              color: C.soft,
              opacity: line,
              transform: `translateY(${(1 - line) * 40}px)`,
            }}
          >
            {`À partir de quand récite-t-on le Chéma le soir${NNBSP}?`}
          </div>
          <Pop at={trans + B(1.2)} style={{ right: 50, top: -36 }}>
            <Chip icon="languages" name="Traduction" size={30} bg={C.orange} color={C.white} />
          </Pop>
        </div>
      ) : null}
      <Title lines={["La traduction,", "*sous l'hébreu*"]} at={trans} />
    </AbsoluteFill>
  );
}

// --- Listening ------------------------------------------------------------------------

function Ecoute({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const button = springAt(frame, fps, m("button"), { damping: 11, stiffness: 180 });
  const play = m("play");
  const press = frame >= play && frame < play + 6 ? 0.9 : 1;
  const playing = frame >= play;
  const env = tween(frame, play, play + 10, 0, 1);
  const out = tween(frame, len - 8, len, 0, 1);
  const topics = ["Paracha", "Guemara", "Halakha"];
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Sky keys={[[0, C.blue]]} />
      <div style={{ position: "absolute", left: 50, right: 50, top: 150 }}>
        {frame >= B(0.3) ? <KineticTitle lines={["Des cours,", "*à écouter partout*"]} start={B(0.3)} color={C.white} accent="#FFE2A8" size={96} stagger={2} /> : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: 540 - 170,
          top: 820 - 170,
          width: 340,
          height: 340,
          borderRadius: 340,
          background: C.cream,
          display: "grid",
          placeItems: "center",
          boxShadow: SHADOW_POP,
          transform: `scale(${button * press})`,
        }}
      >
        <Icon name={playing ? "pause-solid" : "play-solid"} size={150} color={C.blue} />
      </div>
      {/* The sound, moving with the music. */}
      <div style={{ position: "absolute", left: 90, right: 90, top: 1160, height: 220, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {Array.from({ length: 28 }, (_, i) => {
          const h = 18 + env * (40 + 120 * Math.abs(Math.sin(frame / 3.2 + i * 0.75)) * (0.6 + 0.4 * beatPulse(frame + i)));
          return <div key={i} style={{ width: 16, height: h, borderRadius: 16, background: C.cream, opacity: 0.9 }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1500, display: "flex", justifyContent: "center", gap: 22 }}>
        {topics.map((topic, i) => (
          <div key={topic} style={{ position: "relative", width: 280, height: 90 }}>
            <Pop at={m(`rav${i}`)} style={{ left: 0, top: 0 }}>
              <Chip icon="headphones" name={topic} size={36} />
            </Pop>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// --- Together: a chain of 150 psalms ----------------------------------------------------

const SHARES = [30, 25, 25, 20, 25, 25];
const INITIALS = ["S", "D", "R", "M", "Y", "L"];
const COLS = 15;
const CELL = 50;
const GAP = 8;

function Ensemble({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grid = m("grid");
  const full = m("full");
  const link = m("link");
  const gridX = (1080 - (COLS * (CELL + GAP) - GAP)) / 2;
  const gridY = 470;
  // Which reader holds each psalm, and when it is read.
  const owner: number[] = [];
  const readAt: number[] = [];
  SHARES.forEach((share, k) => {
    const start = m(`reader${k}`) + 6;
    for (let j = 0; j < share; j++) {
      owner.push(k);
      readAt.push(start + Math.round((j / share) * B(1.2)));
    }
  });
  const read = readAt.filter((t) => frame >= t).length;
  const hit = springAt(frame, fps, full, { damping: 8, stiffness: 240 });
  const away = tween(frame, link, link + B(1), 0, 1);
  const flash = frame >= full && frame < full + 8;
  const out = tween(frame, len - 8, len, 0, 1);
  const avatarY = 1300;
  const avatarX = (k: number) => 540 + (k - 2.5) * 150;
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Sky keys={[[0, C.cream]]} />
      <Title lines={["150 psaumes,", "*chacun sa part*"]} at={B(0.3)} out={full - B(0.8)} />
      <Title lines={["Une chaîne terminée,", "*ensemble*"]} at={full} out={link - 8} />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${-away * 300}px) scale(${1 - away * 0.3})`, opacity: 1 - away }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1080,
            height: 1920,
            transform: `scale(${frame >= full ? 1 + 0.04 * (1 - hit) : 1})`,
            transformOrigin: "540px 750px",
            opacity: 1 - 0.75 * tween(frame, full + 6, full + 14, 0, 1),
          }}
        >
          {owner.map((k, i) => {
            const appear = tween(frame, grid + i * 0.25, grid + i * 0.25 + 8, 0, 1);
            const filled = frame >= readAt[i];
            const pop = filled ? springAt(frame, fps, readAt[i], { damping: 10, stiffness: 260 }) : 0;
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: gridX + col * (CELL + GAP),
                  top: gridY + row * (CELL + GAP),
                  width: CELL,
                  height: CELL,
                  borderRadius: 12,
                  background: flash ? "#FFD36B" : filled ? READERS[k] : C.stone,
                  transform: `scale(${appear * (filled ? 1 + 0.25 * (1 - pop) : 1)})`,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 17,
                  color: filled ? C.white : "rgba(30,27,24,0.35)",
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        {/* Who reads: each one takes a share, and it fills. */}
        {SHARES.map((_, k) => {
          const at = m(`reader${k}`);
          if (frame < at) return null;
          const p = springAt(frame, fps, at, { damping: 10, stiffness: 200 });
          const firstCell = SHARES.slice(0, k).reduce((a, b) => a + b, 0);
          const cx = gridX + (firstCell % COLS) * (CELL + GAP) + CELL / 2;
          const cy = gridY + Math.floor(firstCell / COLS) * (CELL + GAP) + CELL / 2;
          const beam = tween(frame, at + 2, at + 8, 0, 1) * (1 - tween(frame, at + B(1.4), at + B(1.8), 0, 1));
          return (
            <div key={k}>
              <svg style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "visible" }}>
                <line x1={avatarX(k)} y1={avatarY} x2={avatarX(k) + (cx - avatarX(k)) * beam} y2={avatarY + (cy - avatarY) * beam} stroke={READERS[k]} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" opacity={beam > 0 ? 0.9 : 0} />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: avatarX(k) - 60,
                  top: avatarY - 60,
                  width: 120,
                  height: 120,
                  borderRadius: 120,
                  background: READERS[k],
                  border: `6px solid ${C.white}`,
                  boxShadow: "0 10px 26px rgb(30 26 18 / 0.2)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 50,
                  color: C.white,
                  transform: `scale(${p})`,
                }}
              >
                {INITIALS[k]}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1450,
            textAlign: "center",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 56,
            color: C.ink,
            fontVariantNumeric: "tabular-nums",
            opacity: tween(frame, m("reader0"), m("reader0") + 6, 0, 1),
          }}
        >
          {"Lus\u00a0: "}
          <span style={{ color: C.deep }}>{read}</span> / 150
        </div>
        {frame >= full ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 580, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                padding: "10px 60px 30px",
                borderRadius: 40,
                background: C.cream,
                boxShadow: SHADOW_POP,
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: 220,
                letterSpacing: "-0.03em",
                color: C.deep,
                transform: `scale(${interpolate(hit, [0, 1], [2.2, 1])})`,
                opacity: interpolate(frame, [full, full + 3], [0, 1], clamp),
              }}
            >
              150/150
            </div>
          </div>
        ) : null}
      </div>
      <Confetti x={540} y={760} at={full} colors={[...READERS, "#FFD36B"]} count={90} />
      {/* Shared by a link: the messages come back. */}
      <Title lines={["Partagée", "*d'un simple lien*"]} at={link} />
      <Pop at={link + 4} style={{ left: 0, right: 0, top: 620, display: "flex", justifyContent: "center" }}>
        <Chip icon="share" name="petite-jerusalem.fr" size={40} bg={C.ink} color={C.cream} />
      </Pop>
      {["Je prends le 23", "Moi, du 90 au 95", "Lu, merci à tous"].map((text, i) => (
        <Pop key={text} at={m(`bubble${i}`)} style={{ left: i % 2 ? 300 : 90, top: 860 + i * 190 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexDirection: i % 2 ? "row-reverse" : "row" }}>
            <div style={{ width: 90, height: 90, borderRadius: 90, background: READERS[i * 2], display: "grid", placeItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: 40, color: C.white }}>{INITIALS[i * 2]}</div>
            <div style={{ padding: "26px 36px", borderRadius: 34, background: C.white, boxShadow: "0 10px 30px rgb(30 26 18 / 0.15)", fontFamily: SANS, fontWeight: 600, fontSize: 42, color: C.ink, whiteSpace: "nowrap" }}>{text}</div>
          </div>
        </Pop>
      ))}
    </AbsoluteFill>
  );
}

// --- Mon parcours: the wall, the light, a goal; the night ------------------------------

const STONE_COLORS = ["#F6A54E", "#F2B470", "#EC9A43", "#F4AC5C"];

function Parcours({ m, len }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stones = m("stones");
  const lights = [0, 1, 2].map((i) => m(`light${i}`));
  const goal = m("goal");
  const night = m("night");
  const darkness = tween(frame, night, night + B(2), 0, 1);
  const rows = 4;
  const perRow = 6;
  const sw = 150;
  const sh = 70;
  const lightOut = tween(frame, goal - 6, goal + 4, 0, 1);
  const ring = tween(frame, goal + B(1), goal + B(3.4), 0, 1, Easing.inOut(Easing.cubic));
  const ringIn = springAt(frame, fps, goal + B(0.5), { damping: 13, stiffness: 150 });
  const ringOut = tween(frame, night - 6, night + 4, 0, 1);
  return (
    <AbsoluteFill>
      <Sky keys={[[0, C.cream], [B(9), C.dusk], [night, C.dusk], [night + B(2), C.night]]} />
      <NightStars opacity={darkness} bottom={1150} seed="nuit" />
      {/* The wall: a stone a day. */}
      {Array.from({ length: rows * perRow }, (_, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const at = stones + i * 5;
        if (frame < at) return null;
        const p = springAt(frame, fps, at, { damping: 12, stiffness: 200 });
        const offset = row % 2 ? sw / 2 : 0;
        const x = (1080 - perRow * (sw + 8)) / 2 + col * (sw + 8) + offset - (row % 2 ? sw / 4 : 0);
        const y = 1700 - (row + 1) * (sh + 8);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: sw,
              height: sh,
              borderRadius: 8,
              background: STONE_COLORS[(i * 7) % STONE_COLORS.length],
              boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.08)",
              transform: `translateY(${(1 - p) * -500}px)`,
              opacity: Math.min(1, p * 2),
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1720, textAlign: "center", opacity: tween(frame, stones + 4, stones + 12, 0, 1) }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, color: darkness > 0.5 ? C.cream : C.deep, fontVariantNumeric: "lining-nums tabular-nums" }}>
          {Math.round(tween(frame, stones, stones + rows * perRow * 5, 1, 106))}
        </span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: darkness > 0.5 ? C.cream : C.ink }}> jours d'affilée</span>
      </div>
      {/* The light grows: a flame, a larger one, then the galaxy. */}
      <div style={{ position: "absolute", left: 540 - 300, top: 470, width: 600, height: 600, display: "grid", placeItems: "center", opacity: 1 - lightOut }}>
        {frame >= lights[0] && frame < lights[2] ? (
          <div style={{ transform: `scale(${springAt(frame, fps, lights[frame >= lights[1] ? 1 : 0], { damping: 9, stiffness: 180 }) * (frame >= lights[1] ? 1.5 : 1)})` }}>
            {frame >= lights[1] ? <div style={{ position: "absolute", left: 80 - 150, top: 120 - 150, width: 300, height: 300, borderRadius: 300, background: "#FFE3B8", opacity: 0.7 }} /> : null}
            <Flame size={160} frame={frame} />
          </div>
        ) : null}
        {frame >= lights[2] ? <Galaxy size={580} turn={(frame - lights[2]) * 2.2} grow={springAt(frame, fps, lights[2], { damping: 11, stiffness: 140 })} /> : null}
      </div>
      {[1, 30, 100].map((days, i) =>
        frame >= lights[i] && frame < (lights[i + 1] ?? goal - 6) ? (
          <Pop key={days} at={lights[i]} style={{ left: 0, right: 0, top: 1090, display: "flex", justifyContent: "center" }}>
            <Chip name={days === 1 ? "1 jour" : `${days} jours`} size={36} />
          </Pop>
        ) : null,
      )}
      {/* A goal: the ring that fills. */}
      {frame >= goal ? (
        <div style={{ position: "absolute", left: 540 - 220, top: 560, width: 440, height: 440, transform: `scale(${ringIn * (1 - ringOut)})`, opacity: 1 - ringOut }}>
          <svg width={440} height={440} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
            <circle cx={220} cy={220} r={180} stroke={C.white} strokeWidth={34} fill="none" />
            <circle cx={220} cy={220} r={180} stroke={C.orange} strokeWidth={34} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 180} strokeDashoffset={2 * Math.PI * 180 * (1 - ring)} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            {ring >= 1 ? (
              <Icon name="check" size={160} color={C.deep} stroke={3} />
            ) : (
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 46, color: C.ink, lineHeight: 1.2 }}>
                Tehilim
                <br />
                <span style={{ color: C.deep }}>en un mois</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <Title lines={["Mon parcours,", "*une pierre par jour*"]} at={B(0.3)} out={lights[1] - 6} />
      <Title lines={["Une lumière", "*qui grandit*"]} at={lights[1]} out={goal - 6} />
      <Title lines={["Fixez-vous", "*un objectif*"]} at={goal} out={night - 6} />
      <Title lines={["Une journée", "*bien remplie*"]} at={night + B(1)} dark />
    </AbsoluteFill>
  );
}

export const SCENES: Record<AdSceneId, ComponentType<SceneProps>> = {
  aube: Aube,
  tefila: Tefila,
  etude: Etude,
  ecoute: Ecoute,
  ensemble: Ensemble,
  parcours: Parcours,
};
