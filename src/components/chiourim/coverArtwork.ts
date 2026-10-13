/**
 * La pochette d'un cours en image, pour ce que le système en montre hors de
 * l'app : la notification et l'écran verrouillé d'Android, l'écran verrouillé
 * et le centre de contrôle d'iOS (voir services/mediaSession.ts).
 *
 * Les pochettes de l'app sont du CSS (ChiourCover.vue) : le système, lui, veut
 * une image. On la dessine donc, de la même façon, sur un canevas : la teinte
 * de la reliure, le cadre estampé, le titre crème au centre, aussi grand que
 * la pochette le permet. Une fois par pochette, gardée en mémoire.
 */
import { COVER_INK, coverTone } from "./cover";

const SIZE = 512;
/** Le cadre estampé, en retrait du bord comme sur la pochette de l'app. */
const FRAME_INSET = SIZE * 0.06;
/** La largeur où le titre doit tenir. */
const TEXT_WIDTH = SIZE * 0.72;
const MAX_LINES = 4;
const FONT_FAMILY = '"Playfair Display", "Lora", Georgia, serif';

const cache = new Map<string, Promise<string | null>>();

/** Le titre en lignes qui tiennent dans la largeur, à cette taille de police. */
function wrap(ctx: CanvasRenderingContext2D, text: string, fontSize: number): string[] {
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > TEXT_WIDTH) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** La plus grande taille où le titre tient en quatre lignes au plus, sans mot qui déborde. */
function fit(ctx: CanvasRenderingContext2D, text: string): { size: number; lines: string[] } {
  for (let size = 88; size > 30; size -= 4) {
    const lines = wrap(ctx, text, size);
    const fits =
      lines.length <= MAX_LINES && lines.every((l) => ctx.measureText(l).width <= TEXT_WIDTH);
    if (fits) return { size, lines };
  }
  // Trop long même petit : les quatre premières lignes, la dernière coupée.
  const lines = wrap(ctx, text, 32).slice(0, MAX_LINES);
  lines[MAX_LINES - 1] = lines[MAX_LINES - 1] ? `${lines[MAX_LINES - 1]}…` : "";
  return { size: 32, lines: lines.filter(Boolean) };
}

async function draw(seed: string, label: string): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // La police des titres, si elle n'est pas déjà là : sans elle, le canevas
  // dessinerait le titre dans la police de repli.
  await document.fonts?.load(`700 64px ${FONT_FAMILY}`).catch(() => undefined);

  ctx.fillStyle = coverTone(seed);
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = COVER_INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(FRAME_INSET, FRAME_INSET, SIZE - 2 * FRAME_INSET, SIZE - 2 * FRAME_INSET);
  ctx.globalAlpha = 1;

  const { size, lines } = fit(ctx, label);
  const lineHeight = size * 1.08;
  ctx.fillStyle = COVER_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Un titre hébreu se lit de droite à gauche, ses signes aussi.
  ctx.direction = /[֐-׿]/.test(label) ? "rtl" : "ltr";
  const top = SIZE / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, top + i * lineHeight));

  return canvas.toDataURL("image/png");
}

/**
 * La pochette d'une série (ou d'un rav) en image PNG, en `data:` URL ; null
 * quand le canevas manque (rendu côté serveur, tests).
 */
export function coverArtwork(seed: string, label: string): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const key = `${seed}\u0000${label}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = draw(seed, label).catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}
