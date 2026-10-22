/**
 * The designer's logo, in motion: it builds itself piece by piece, then
 * lives quietly.
 *
 * Nothing is redrawn (docs/design.md, "The logo and the share banners"):
 * the pieces are cut from the designer's PNG (public/brand/logo.png, copied
 * from the app's assets/brand/logo-transparent.png) when the video renders,
 * by color and by place, and each one moves on its own:
 *
 *  1. the book opens from its spine;
 *  2. the wall rises out of it;
 *  3. the tower, the cypresses and the dome come up from behind the wall,
 *     the cypresses growing;
 *  4. the flame of the dome lights;
 *  5. the star falls from above, turning, lands with a few sparks, and
 *     twinkles from then on, the flame flickering.
 *
 * The boundaries were measured on the 1024 px image (fractions below); a
 * new logo would have its own.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { continueRender, delayRender, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, springAt, tween } from "../anim.ts";

type Piece = "star" | "flame" | "dome" | "cypress" | "tower" | "wall" | "book";

const PIECES: Piece[] = ["star", "flame", "dome", "cypress", "tower", "wall", "book"];

/** Where each piece ends, as a share of the image (measured on the 1024 px logo). */
const CUT = {
  /** Below it, nothing of the star. */
  starBottom: 0.3,
  /** The flame of the dome, above the dome itself. */
  flameBottom: 0.363,
  /** The top of the wall: the tower, the cypresses and the dome stand above it. */
  wallTop: 0.506,
  /** The tower on the left, the dome on the right, the cypresses between. */
  towerRight: 0.35,
  domeLeft: 0.527,
  /** The top of the book's pages. */
  bookTop: 0.586,
};

function pieceOf(x: number, y: number, r: number, b: number): Piece {
  if (y < CUT.starBottom) return "star";
  // The book is blue, with a white edge where it lies on the wall.
  if (y >= CUT.bookTop && b >= r - 10) return "book";
  if (y >= CUT.wallTop) return "wall";
  if (y < CUT.flameBottom) return "flame";
  if (x >= CUT.domeLeft) return "dome";
  if (x < CUT.towerRight) return "tower";
  return "cypress";
}

let cutting: Promise<Record<Piece, string>> | null = null;

/** Cuts the logo into its pieces, once per render: an image per piece, on the same square. */
function cutLogo(src: string): Promise<Record<Piece, string>> {
  cutting ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const source = context.getImageData(0, 0, w, h).data;
      const layers = Object.fromEntries(PIECES.map((p) => [p, new ImageData(w, h)])) as Record<Piece, ImageData>;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (source[i + 3] < 4) continue;
          const target = layers[pieceOf(x / w, y / h, source[i], source[i + 2])].data;
          target[i] = source[i];
          target[i + 1] = source[i + 1];
          target[i + 2] = source[i + 2];
          target[i + 3] = source[i + 3];
        }
      }
      const urls = {} as Record<Piece, string>;
      for (const piece of PIECES) {
        context.clearRect(0, 0, w, h);
        context.putImageData(layers[piece], 0, 0);
        urls[piece] = canvas.toDataURL("image/png");
      }
      resolve(urls);
    };
    image.onerror = () => reject(new Error(`logo not loaded: ${src}`));
    image.src = src;
  });
  return cutting;
}

function useLogoPieces(): Record<Piece, string> | null {
  const [pieces, setPieces] = useState<Record<Piece, string> | null>(null);
  const [handle] = useState(() => delayRender("cutting the logo"));
  useEffect(() => {
    cutLogo(staticFile("brand/logo.png")).then(
      (urls) => {
        setPieces(urls);
        continueRender(handle);
      },
      (error) => {
        console.error(error);
        continueRender(handle);
      },
    );
  }, [handle]);
  return pieces;
}

/** A piece on the logo's square; `clip` keeps it above a line (it rises from behind it). */
function Layer({ src, size, style, clipBelow }: { src: string; size: number; style?: CSSProperties; clipBelow?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: clipBelow === undefined ? undefined : `inset(0 0 ${(1 - clipBelow) * 100}% 0)`,
      }}
    >
      <Img src={src} style={{ position: "absolute", inset: 0, width: size, height: size, ...style }} />
    </div>
  );
}

/** The star's sparks when it lands: four small stars thrown out, fading. */
function Sparks({ size, at }: { size: number; at: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 22) return null;
  const p = tween(frame, at, at + 22, 0, 1);
  const cx = size * 0.5;
  const cy = size * 0.2;
  return (
    <>
      {[0, 1, 2, 3].map((k) => {
        const angle = (Math.PI / 2) * k + Math.PI / 4;
        const d = size * (0.08 + 0.16 * p);
        const s = size * 0.05 * (1 - p * 0.6);
        return (
          <Img
            key={k}
            src={staticFile(`brand/star-${k % 2 ? "orange" : "blue"}.png`)}
            style={{
              position: "absolute",
              left: cx + Math.cos(angle) * d - s / 2,
              top: cy + Math.sin(angle) * d - s / 2,
              width: s,
              height: s,
              opacity: 1 - p,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * The logo, `size` px square, building from frame `start`; `speed` above 1
 * builds it faster (the opening), below 1 slower.
 */
export function LogoMotion({ size, start = 0, speed = 1 }: { size: number; start?: number; speed?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pieces = useLogoPieces();
  if (!pieces) return <div style={{ width: size, height: size }} />;
  const at = (f: number) => start + f / speed;
  const spring = (f: number, config = {}) => springAt(frame, fps, at(f), { damping: 13, stiffness: 140, ...config });

  // 1. The book opens from its spine.
  const book = spring(0, { damping: 12, stiffness: 120 });
  // 2. The wall rises out of it.
  const wall = spring(6);
  // 3. Behind the wall, the tower, the dome; the cypresses grow.
  const tower = spring(13);
  const dome = spring(16, { damping: 14 });
  const cypress = spring(19, { damping: 9, stiffness: 160 });
  // 4. The flame lights.
  const flame = spring(26, { damping: 8, stiffness: 200 });
  // 5. The star falls, turning, and lands.
  const star = spring(24, { damping: 11, stiffness: 110 });
  const landed = at(38);
  const twinkle = frame > landed ? 1 + 0.06 * Math.sin((frame - landed) / 9) : 1;
  const flicker = frame > at(34) ? 1 + 0.07 * Math.sin((frame - at(34)) / 4) * Math.sin((frame - at(34)) / 11) : 1;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Behind the wall, rising above its line. */}
      <Layer
        src={pieces.tower}
        size={size}
        clipBelow={CUT.wallTop + 0.004}
        style={{ transform: `translateY(${(1 - tower) * size * 0.14}px)` }}
      />
      <Layer
        src={pieces.dome}
        size={size}
        clipBelow={CUT.wallTop + 0.004}
        style={{ transform: `translateY(${(1 - dome) * size * 0.18}px)` }}
      />
      <Layer
        src={pieces.flame}
        size={size}
        style={{
          transformOrigin: `${0.665 * size}px ${CUT.flameBottom * size}px`,
          transform: `translateY(${(1 - dome) * size * 0.18}px) scale(${flame * flicker})`,
          opacity: Math.min(1, flame * 1.5),
        }}
      />
      <Layer
        src={pieces.cypress}
        size={size}
        clipBelow={CUT.wallTop + 0.004}
        style={{
          transformOrigin: `${0.44 * size}px ${CUT.wallTop * size}px`,
          transform: `scaleY(${Math.max(0, cypress)})`,
        }}
      />
      {/* The wall, out of the book: kept above the book's middle while it rises. */}
      <Layer
        src={pieces.wall}
        size={size}
        clipBelow={0.69}
        style={{ transform: `translateY(${(1 - wall) * size * 0.2}px)`, opacity: Math.min(1, wall * 3) }}
      />
      {/* The book opens from its spine. */}
      <Layer
        src={pieces.book}
        size={size}
        style={{
          transformOrigin: `${0.5 * size}px ${0.86 * size}px`,
          transform: `scale(${0.15 + 0.85 * book}, ${0.55 + 0.45 * book})`,
          opacity: interpolate(book, [0, 0.25], [0, 1], clamp),
        }}
      />
      {/* The star falls, turning. */}
      <Layer
        src={pieces.star}
        size={size}
        style={{
          transformOrigin: `${0.5 * size}px ${0.2 * size}px`,
          transform: `translateY(${(1 - star) * -size * 0.45}px) rotate(${(1 - star) * 180}deg) scale(${(0.4 + 0.6 * star) * twinkle})`,
          opacity: interpolate(frame, [at(24), at(28)], [0, 1], clamp),
        }}
      />
      <Sparks size={size} at={at(36)} />
    </div>
  );
}
