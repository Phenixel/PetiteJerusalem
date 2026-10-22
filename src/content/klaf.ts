import type { KlafKind } from "../services/textService";

/**
 * The sidour's parchments: their photos, as a sofer wrote them (public/klaf),
 * with their sizes, so the window takes the photo's shape before it has
 * loaded. The vocalized text is already in the flow of the service; the
 * window shows the parchment alone (see KlafViewer.vue).
 */

export interface KlafPhoto {
  src: string;
  width: number;
  height: number;
}

/** The photos of each parchment, in page order. */
export const KLAF_PHOTOS: Record<KlafKind, KlafPhoto[]> = {
  ketoret: [
    { src: "/klaf/ketoret-1.webp", width: 1569, height: 1600 },
    { src: "/klaf/ketoret-2.webp", width: 1550, height: 1600 },
  ],
  menora: [{ src: "/klaf/menora.webp", width: 1215, height: 1600 }],
};
