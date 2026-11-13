/**
 * Ce qui signe les vidéos : le logo de l'app (public/favicon.svg de l'app,
 * redessiné ici pour s'animer pièce par pièce), la notification du
 * téléphone, et le carton de fin.
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, springAt, tween } from "../anim.ts";
import { SANS, STONE } from "../theme.ts";
import { StoneWall } from "./Backgrounds.tsx";
import { KineticTitle } from "./Text.tsx";

/**
 * Le logo : la tour, le mur et le dôme, puis le livre ouvert. `build` va de
 * 0 à 1 et monte les pièces l'une après l'autre.
 */
export function Logo({ size, build = 1 }: { size: number; build?: number }) {
  const part = (from: number) => interpolate(build, [from, from + 0.35], [0, 1], clamp);
  const rise = (from: number) => `translateY(${(1 - part(from)) * 14}px)`;
  return (
    <svg width={size} height={size} viewBox="15 20 70 70" role="img" aria-label="Petite Jérusalem">
      <g fill="#C79A3B">
        <g style={{ transform: rise(0.1), opacity: part(0.1) }}>
          <path d="M22 34h8v20h-8z" />
          <path d="M22 32h2v2.5h-2zm3 0h2v2.5h-2zm3 0h2v2.5h-2z" />
        </g>
        <g style={{ transform: rise(0), opacity: part(0) }}>
          <rect x="20" y="44" width="60" height="16" rx="1.5" />
        </g>
        <g style={{ transform: rise(0.2), opacity: part(0.2) }}>
          <path d="M59 44a9 9 0 0 1 18 0z" />
          <path d="M68 30.5l1.3 5h-2.6z" />
        </g>
        <g style={{ transform: rise(0.3), opacity: part(0.3) }}>
          <path d="M49 34.5c1.3 2.4 1.8 5 1.8 7.8 0 .8-3.6.8-3.6 0 0-2.8.5-5.4 1.8-7.8z" />
          <rect x="48.4" y="41.6" width="1.2" height="2.4" />
          <path d="M54.4 36c1.05 2 1.5 4 1.5 6 0 .7-3 .7-3 0 0-2 .45-4 1.5-6z" />
          <rect x="53.9" y="41.9" width="1" height="2.1" />
        </g>
      </g>
      <g stroke="#F1E7CF" strokeWidth="1" opacity={0.9 * part(0.25)}>
        <line x1="20" y1="49.3" x2="80" y2="49.3" />
        <line x1="20" y1="54.6" x2="80" y2="54.6" />
        <line x1="33" y1="44" x2="33" y2="49.3" />
        <line x1="47" y1="44" x2="47" y2="49.3" />
        <line x1="61" y1="44" x2="61" y2="49.3" />
        <line x1="27" y1="49.3" x2="27" y2="54.6" />
        <line x1="40" y1="49.3" x2="40" y2="54.6" />
        <line x1="54" y1="49.3" x2="54" y2="54.6" />
        <line x1="68" y1="49.3" x2="68" y2="54.6" />
        <line x1="33" y1="54.6" x2="33" y2="60" />
        <line x1="47" y1="54.6" x2="47" y2="60" />
        <line x1="61" y1="54.6" x2="61" y2="60" />
      </g>
      {/* Le livre s'ouvre : chaque page part de la reliure. */}
      <g>
        <g style={{ transformOrigin: "50px 68px", transform: `scaleX(${part(0.45)})` }}>
          <path d="M50 62C40 57 27 58 15 63v13c12-5 25-6 35-1z" fill="#1D6FDB" />
        </g>
        <g style={{ transformOrigin: "50px 68px", transform: `scaleX(${part(0.45)})` }}>
          <path d="M50 62C60 57 73 58 85 63v13c-12-5-25-6-35-1z" fill="#2E7BE6" />
        </g>
        <path d="M50 62v14" stroke="#16467e" strokeWidth="2" strokeLinecap="round" opacity={part(0.4)} />
        <g stroke="#CFE1FB" strokeWidth="1.1" fill="none" opacity={0.85 * part(0.6)}>
          <path d="M22 65.5c8-2.5 17-2.7 25 .6" />
          <path d="M22 69.5c8-2.5 17-2.7 25 .6" />
          <path d="M53 66.1c8-3.3 17-3.1 25-.6" />
          <path d="M53 70.1c8-3.3 17-3.1 25-.6" />
        </g>
      </g>
    </svg>
  );
}

/** Une notification qui descend du haut de l'écran (points de l'app). */
export function Notification({
  title,
  body,
  start,
  end,
  dark = false,
}: {
  title: string;
  body: string;
  start: number;
  end: number;
  dark?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start || frame > end + 10) return null;
  const p = springAt(frame, fps, start, { damping: 13, stiffness: 150 });
  const leave = tween(frame, end, end + 8, 0, 1);
  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: 6,
        transform: `translateY(${(1 - p) * -140 - leave * 140}px) scale(${0.92 + 0.08 * p})`,
        borderRadius: 22,
        padding: "13px 14px",
        display: "flex",
        gap: 11,
        alignItems: "center",
        background: dark ? "rgba(52,52,58,0.96)" : "rgba(250,248,244,0.97)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
        fontFamily: SANS,
        color: dark ? "#f3f4f6" : "#1c1a17",
        zIndex: 20,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: STONE.beige, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Logo size={36} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.6, fontWeight: 600 }}>
          <span>Petite Jérusalem</span>
          <span>maintenant</span>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, marginTop: 1 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.85 }}>{body}</div>
      </div>
    </div>
  );
}

/** Le carton de fin : le logo se monte, le nom, la promesse, les stores. */
export function EndCard({ primary, start, length }: { primary: string; start: number; length: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - start;
  if (t < 0) return null;
  const build = tween(frame, start, start + 22, 0, 1);
  const logoP = springAt(frame, fps, start, { damping: 12, stiffness: 120 });
  const fadeOut = interpolate(frame, [start + length - 4, start + length + 26], [1, 0], clamp);
  const zoom = 1 + t * 0.0009;
  const store = (label: string, at: number) => {
    const p = springAt(frame, fps, start + at, { damping: 12, stiffness: 190 });
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "20px 40px",
          borderRadius: 999,
          background: STONE.ink,
          color: STONE.beige,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 40,
          transform: `scale(${p})`,
        }}
      >
        {label}
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <StoneWall bg={STONE.beige} drift={0.4} seed="fin" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${zoom})` }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * logoP})`, marginBottom: 10 }}>
          <Logo size={300} build={build} />
        </div>
        <KineticTitle lines={["Petite Jérusalem"]} start={start + 8} color={STONE.ink} size={104} stagger={4} />
        <div style={{ height: 26 }} />
        <KineticTitle
          lines={["Gratuit, sans publicité"]}
          start={start + 16}
          color={primary}
          size={50}
          font={SANS}
          weight={700}
          stagger={2}
        />
        <div style={{ height: 70 }} />
        <div style={{ display: "flex", gap: 24 }}>
          {store("App Store", 24)}
          {store("Google Play", 28)}
        </div>
        <div style={{ height: 40 }} />
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: 36,
            color: STONE.inkSoft,
            opacity: interpolate(t, [32, 42], [0, 1], clamp),
          }}
        >
          petite-jerusalem.fr
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

