import { ref } from "vue";

/**
 * Les montées cochées du chnei mikra (ChneiMikraPage) : chacune se coche une
 * fois lue, deux fois le texte et une fois le Targoum, au fil de la semaine.
 *
 * Rangées par semaine (le Chabbat de la paracha, `weekKey`) : la semaine
 * suivante repart de zéro sans rien effacer, et feuilleter vers une paracha
 * passée retrouve ce qu'on y avait coché. Une montée s'y nomme
 * « texte:début », le texte de la paracha (une paracha double en a deux) et
 * la ligne où la montée commence.
 *
 * Sur l'appareil seulement (localStorage), comme la table d'étude : c'est un
 * fil de lecture de la semaine, pas une donnée du compte.
 */
const STORAGE_KEY = "pj-chnei-mikra-aliyot";
/** Les semaines gardées : de quoi feuilleter un trimestre en arrière. */
const MAX_WEEKS = 13;

type Store = Record<string, string[]>;

function load(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Store = {};
    for (const [week, keys] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(keys)) out[week] = keys.filter((k): k is string => typeof k === "string");
    }
    return out;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Stockage plein ou refusé : les coches tiennent le temps de la visite.
  }
}

const checked = ref<Store>(load());

export function aliyaKey(textId: string | number, offset: number): string {
  return `${textId}:${offset}`;
}

export function useChneiMikraChecks() {
  function isChecked(week: string, key: string): boolean {
    return checked.value[week]?.includes(key) ?? false;
  }

  /** Coche ou décoche la montée ; vrai si elle vient d'être cochée. */
  function toggle(week: string, key: string): boolean {
    const keys = checked.value[week] ?? [];
    const done = !keys.includes(key);
    const next: Store = {
      ...checked.value,
      [week]: done ? [...keys, key] : keys.filter((k) => k !== key),
    };
    if (next[week].length === 0) delete next[week];
    // Les semaines les plus anciennes s'en vont (une clé de semaine est une date ISO).
    const weeks = Object.keys(next).sort();
    for (const old of weeks.slice(0, Math.max(0, weeks.length - MAX_WEEKS))) delete next[old];
    checked.value = next;
    save(next);
    return done;
  }

  return { isChecked, toggle };
}

/** Pour les tests : relit le stockage. */
export function resetChneiMikraChecksForTests(): void {
  checked.value = load();
}
