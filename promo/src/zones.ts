/**
 * Les zones repérées dans les captures (public/captures/marks.json, écrit
 * par scripts/captures.mjs) : un bouton, une carte, en points de l'écran.
 */
import marks from "../public/captures/marks.json";

export type Zone = { x: number; y: number; w: number; h: number };

export function zone(key: string): Zone {
  const z = (marks as Record<string, Zone>)[key];
  if (!z) throw new Error(`Zone inconnue : ${key} (relancer npm run captures)`);
  return z;
}

export const center = (z: Zone) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
