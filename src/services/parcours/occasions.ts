import { devicePreference } from "../devicePreference";

/**
 * Les cartes d'occasion du paquet (la lune, un soir de 'Omer, l'allumage de
 * 'Hanouka) qu'on a dites faites. Elles ne comptent pas dans la journée et
 * ne vont pas au compte : l'appareil s'en souvient, pour qu'une lune bénie ne
 * revienne pas la nuit suivante. Les plus anciennes s'oublient.
 *
 * Une clé dit l'occasion et sa fois : `halevana:5787-8` (le mois), `omer:5787-12`
 * (le soir), `hanouka:5787-3` (la bougie).
 */
const KEEP = 60;

const store = devicePreference<string[]>(
  "pj_parcours_occasions",
  (raw) => {
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : null;
    } catch {
      return null;
    }
  },
  (keys) => JSON.stringify(keys),
);

export function readOccasionsDone(): string[] {
  return store.read() ?? [];
}

/** Coche ou décoche une occasion ; renvoie ce qui est retenu. */
export function writeOccasionDone(keys: string[], key: string, done: boolean): string[] {
  const rest = keys.filter((k) => k !== key);
  const next = done ? [...rest, key].slice(-KEEP) : rest;
  store.write(next);
  return next;
}
