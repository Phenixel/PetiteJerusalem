import encadrementsJson from "../datas/encadrements.json";
import type { TextStudyJsonEntry } from "../models/models";
import { parseTefilaBlocks, type TextBlock } from "./textService";

/**
 * Les passages qui encadrent une lecture : ce que l'on dit avant, ce que l'on
 * dit après. Les Tehilim ont leur Yehi ratson et leurs trois versets, le
 * Cantique des cantiques son Léchem yihoud et son Ribon kol haolamim.
 *
 * Ce sont de la liturgie, pas du corpus : ils s'écrivent dans le format des
 * fichiers de tefila (didascalies, mises en avant) et se rendent par le même
 * LiturgyText. Ils vivent dans le bundle plutôt que sous `public/texts/`,
 * parce qu'ils accompagnent des textes que l'app lit hors ligne : les faire
 * dépendre d'un téléchargement les rendrait absents là où on les attend.
 */

/** Lecture qui a des passages dédiés. Clé du fichier de données. */
export type EncadrementKey = "tehilim" | "chir-hachirim";

export interface Encadrement {
  key: EncadrementKey;
  /** Ce qui se dit avant la lecture. */
  before: TextBlock[];
  /** Ce qui se dit après la lecture. */
  after: TextBlock[];
}

interface EncadrementJsonEntry {
  before?: unknown;
  after?: unknown;
}

const raw = encadrementsJson as Record<string, EncadrementJsonEntry>;

/** Les blocs sont les mêmes à chaque affichage : on ne les reparse qu'une fois. */
const cache = new Map<EncadrementKey, Encadrement>();

function encadrement(key: EncadrementKey): Encadrement | null {
  const cached = cache.get(key);
  if (cached) return cached;
  const entry = raw[key];
  if (!entry) return null;
  const built: Encadrement = {
    key,
    before: parseTefilaBlocks(entry.before),
    after: parseTefilaBlocks(entry.after),
  };
  cache.set(key, built);
  return built;
}

/** Sefaria : le lien du Cantique des cantiques, seule entrée du Tanakh encadrée. */
const CHIR_HACHIRIM_LINK = "https://www.sefaria.org/Song_of_Songs";

/** La lecture dont une entrée du catalogue relève, s'il y en a une. */
export function encadrementKeyOf(entry: TextStudyJsonEntry | undefined): EncadrementKey | null {
  if (!entry) return null;
  if (String(entry.type) === "Tehilim") return "tehilim";
  if (entry.link === CHIR_HACHIRIM_LINK) return "chir-hachirim";
  return null;
}

/** Les passages qui encadrent la lecture d'une entrée du catalogue. */
export function encadrementOf(entry: TextStudyJsonEntry | undefined): Encadrement | null {
  const key = encadrementKeyOf(entry);
  return key ? encadrement(key) : null;
}

/**
 * Où poser les encadrements dans une liste de lectures. Le « avant » s'ouvre
 * au premier texte d'une même lecture, le « après » se ferme au dernier :
 * cinq Tehilim à la suite ne répètent pas cinq fois le Yehi ratson, qui ne se
 * dit qu'une fois pour tout ce qu'on lit.
 *
 * Rendu par id d'entrée, pour que la vue n'ait rien à recalculer en boucle.
 */
export function encadrementBounds(
  entries: TextStudyJsonEntry[],
): Map<string, { before?: TextBlock[]; after?: TextBlock[] }> {
  const bounds = new Map<string, { before?: TextBlock[]; after?: TextBlock[] }>();
  entries.forEach((entry, i) => {
    const key = encadrementKeyOf(entry);
    if (!key) return;
    const passages = encadrement(key);
    if (!passages) return;
    const place: { before?: TextBlock[]; after?: TextBlock[] } = {};
    if (encadrementKeyOf(entries[i - 1]) !== key) place.before = passages.before;
    if (encadrementKeyOf(entries[i + 1]) !== key) place.after = passages.after;
    if (place.before || place.after) bounds.set(String(entry.id), place);
  });
  return bounds;
}
