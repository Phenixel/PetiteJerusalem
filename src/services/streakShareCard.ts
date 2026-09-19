/**
 * La carte à partager : « 30 jours d'affilée », dessinée dans un canvas aux
 * couleurs de l'app, pour WhatsApp ou une story. Rien ne quitte l'appareil :
 * l'image est produite ici et remise au partage du système (ou téléchargée
 * quand le navigateur ne sait pas partager un fichier).
 *
 * Le dessin suit la charte : fond beige, une seule couleur pleine (l'accent
 * du thème), la flamme du compteur, les titres en Playfair.
 */
export interface StreakCardTexts {
  /** « 30 » et « jours d'affilée ». */
  count: string;
  countLabel: string;
  /** « Record : 42 jours ». */
  best: string;
  /** Le nom de l'app, en pied. */
  brand: string;
  /** La date du jour, en clair. */
  date: string;
}

const SIZE = 1080;

function flamePath(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  // Le tracé de l'icône « flame » (registry.ts), sur une grille de 24.
  const p = new Path2D(
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  );
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(p);
  ctx.restore();
}

export function drawStreakCard(
  texts: StreakCardTexts,
  accent: string,
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): HTMLCanvasElement {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // La surface, comme une carte de l'app : blanche, posée sur le beige.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(90, 120, SIZE - 180, SIZE - 240);

  ctx.strokeStyle = accent;
  flamePath(ctx, SIZE / 2 - 132, 215, 11);

  ctx.textAlign = "center";
  ctx.fillStyle = "#35312a";
  ctx.font = "bold 220px 'Playfair Display', Georgia, serif";
  ctx.fillText(texts.count, SIZE / 2, 660);

  ctx.font = "600 56px Manrope, system-ui, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(texts.countLabel, SIZE / 2, 740);

  ctx.font = "44px Manrope, system-ui, sans-serif";
  ctx.fillStyle = "#6d6759";
  ctx.fillText(texts.best, SIZE / 2, 830);

  ctx.font = "600 40px 'Playfair Display', Georgia, serif";
  ctx.fillStyle = "#35312a";
  ctx.fillText(texts.brand, SIZE / 2, SIZE - 60);
  ctx.font = "32px Manrope, system-ui, sans-serif";
  ctx.fillStyle = "#6d6759";
  ctx.fillText(texts.date, SIZE / 2, SIZE - 15);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/**
 * Partage la carte par la feuille de partage du système quand elle accepte
 * un fichier, la télécharge sinon. Renvoie « shared », « downloaded » ou
 * « cancelled » (partage refermé sans rien envoyer).
 */
export async function shareStreakCard(
  texts: StreakCardTexts,
  accent: string,
  fileName = "serie-petite-jerusalem.png",
): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await toBlob(drawStreakCard(texts, accent));
  if (!blob) return "cancelled";
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: texts.brand });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
