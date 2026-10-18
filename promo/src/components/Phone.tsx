/**
 * Le téléphone : un cadre générique (aucune marque), sa barre d'état, et
 * l'écran de l'app en dessous, en points CSS de l'app (390 de large, 800 de
 * haut sous la barre d'état), comme les captures.
 */
import type { CSSProperties, ReactNode } from "react";
import { SANS, SHADOW_POP } from "../theme.ts";

export const SCREEN_W = 390;
export const STATUS_H = 47;
export const APP_H = 800;
export const SCREEN_H = STATUS_H + APP_H;
const BEZEL = 13;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;

export type PhonePose = {
  /** Centre du téléphone dans la vidéo. */
  x: number;
  y: number;
  /** Largeur du téléphone dans la vidéo, cadre compris. */
  width: number;
  rx?: number;
  ry?: number;
  rz?: number;
  opacity?: number;
};

/** Où tombe un point de l'écran de l'app (sx, sy) dans la vidéo, téléphone à plat. */
export function screenToCanvas(pose: PhonePose, sx: number, sy: number) {
  const s = pose.width / PHONE_W;
  return {
    x: pose.x + (sx - SCREEN_W / 2) * s,
    y: pose.y + (STATUS_H + sy - SCREEN_H / 2) * s,
    s,
  };
}

function StatusBar({ dark }: { dark: boolean }) {
  const ink = dark ? "#f3f4f6" : "#1c1a17";
  return (
    <div
      style={{
        height: STATUS_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 30px 0 34px",
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 16,
        color: ink,
      }}
    >
      <span>9:41</span>
      <svg width="68" height="14" viewBox="0 0 68 14" fill={ink}>
        <rect x="0" y="9" width="3" height="5" rx="1" />
        <rect x="5" y="6" width="3" height="8" rx="1" />
        <rect x="10" y="3" width="3" height="11" rx="1" />
        <rect x="15" y="0" width="3" height="14" rx="1" />
        <path d="M30 4.5a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM32.6 7.3a6.2 6.2 0 0 1 7.8 0L36.5 11.5z" />
        <rect x="47" y="1.5" width="18" height="11" rx="3" fill="none" stroke={ink} strokeWidth="1.3" opacity="0.5" />
        <rect x="49" y="3.5" width="13" height="7" rx="1.5" />
        <rect x="66" y="5" width="1.6" height="4" rx="0.8" opacity="0.5" />
      </svg>
    </div>
  );
}

export function Phone({
  pose,
  dark = false,
  screenBg,
  children,
  style,
}: {
  pose: PhonePose;
  dark?: boolean;
  screenBg: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const s = pose.width / PHONE_W;
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x - PHONE_W / 2,
        top: pose.y - PHONE_H / 2,
        width: PHONE_W,
        height: PHONE_H,
        transform: `perspective(2600px) scale(${s}) rotateX(${pose.rx ?? 0}deg) rotateY(${pose.ry ?? 0}deg) rotateZ(${pose.rz ?? 0}deg)`,
        opacity: pose.opacity ?? 1,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 64,
          background: "#16140f",
          boxShadow: `${SHADOW_POP}, inset 0 0 0 2px #3a3630`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: BEZEL,
          top: BEZEL,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 52,
          overflow: "hidden",
          background: screenBg,
        }}
      >
        <StatusBar dark={dark} />
        <div style={{ position: "absolute", left: 0, top: STATUS_H, width: SCREEN_W, height: APP_H, overflow: "hidden" }}>
          {children}
        </div>
        {/* L'îlot de la caméra, et la barre d'accueil. */}
        <div style={{ position: "absolute", left: SCREEN_W / 2 - 62, top: 11, width: 124, height: 34, borderRadius: 20, background: "#000" }} />
        <div
          style={{
            position: "absolute",
            left: SCREEN_W / 2 - 68,
            bottom: 8,
            width: 136,
            height: 5,
            borderRadius: 3,
            background: dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.75)",
          }}
        />
      </div>
    </div>
  );
}
