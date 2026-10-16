import { aliyotObjective, checkedAliyot } from "../services/parcours/aliyot";
import { useParcours } from "./useParcours";

/**
 * Les montées cochées du chnei mikra (ChneiMikraPage) : chacune se coche une
 * fois lue, deux fois le texte et une fois le Targoum, au fil de la semaine,
 * depuis la liste de la semaine ou depuis sa case dans le texte.
 *
 * Elles vivent dans Mon parcours (services/parcours/aliyot.ts) : gardées sur
 * l'appareil, emportées par le compte, et liées au chnei mikra « une montée
 * par jour » quand on le suit (la carte du jour se fait par ses montées, et
 * une carte cochée coche les siennes). Une semaine se nomme par son Chabbat
 * (la `weekKey` de la paracha) : la suivante repart de zéro, feuilleter vers
 * une paracha passée retrouve ce qu'on y avait coché.
 */
export function useChneiMikraChecks() {
  const store = useParcours();

  /** Les montées cochées (comptées de 0) de la semaine du Chabbat `week`, sur `count`. */
  function checked(week: string, count: number): Set<number> {
    const data = store.data.value;
    return checkedAliyot(data.days, week, count, aliyotObjective(data));
  }

  /** Coche ou décoche une montée (comptée de 0) de la semaine du Chabbat `week`. */
  function setChecked(week: string, aliya: number, count: number, done: boolean): void {
    store.setAliyaChecked(week, aliya, count, done);
  }

  return { checked, setChecked };
}

/**
 * Les coches de la version 3.10.11, gardées sur l'appareil seulement
 * (localStorage), par semaine, sous le nom « texte:début » (le texte de la
 * paracha et la ligne où la montée commence). Elles passent une fois dans
 * Mon parcours : `takeLegacyChecks` rend les montées cochées d'un texte
 * (leur rang dans `offsets`, les débuts de ses montées) et les retire.
 */
const LEGACY_KEY = "pj-chnei-mikra-aliyot";

export function takeLegacyChecks(
  week: string,
  textId: string | number,
  offsets: number[],
): number[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as unknown;
    if (!store || typeof store !== "object" || Array.isArray(store)) return [];
    const weeks = store as Record<string, unknown>;
    const keys = Array.isArray(weeks[week])
      ? (weeks[week] as unknown[]).filter((k): k is string => typeof k === "string")
      : [];
    const taken = offsets.flatMap((offset, index) =>
      keys.includes(`${textId}:${offset}`) ? [index] : [],
    );
    if (taken.length === 0) return [];
    const left = keys.filter((k) => !k.startsWith(`${textId}:`));
    if (left.length > 0) weeks[week] = left;
    else delete weeks[week];
    if (Object.keys(weeks).length > 0) localStorage.setItem(LEGACY_KEY, JSON.stringify(weeks));
    else localStorage.removeItem(LEGACY_KEY);
    return taken;
  } catch {
    // Stockage illisible ou refusé : il n'y a rien à reprendre.
    return [];
  }
}
