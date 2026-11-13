import { devicePreference } from "../devicePreference";
import { parseParcours } from "./merge";
import { emptyParcours } from "./model";
import type { ParcoursData } from "./model";

/**
 * Mon parcours sur l'appareil : le socle, avec ou sans compte.
 *
 * Sans compte, c'est la seule copie : elle se garde dans le `localStorage`
 * (lu en synchrone, pour le premier rendu) et dans les préférences natives
 * (qui survivent à un `localStorage` vidé par le système), voir
 * devicePreference. Changer d'appareil sans compte la perd : c'est dit à
 * l'écran, et un compte la rattrape à la connexion.
 *
 * Avec un compte, elle sert hors ligne et au premier rendu, et retient ce qui
 * n'est pas encore parti vers le compte (`dirty`).
 */

/** Le dernier compte suivi sur l'appareil, et quand il est parti. */
export interface DeviceOwner {
  uid: string;
  /** Déconnexion (ms) : ce qui a été écrit depuis l'a été sans compte. */
  leftAt?: number;
}

/** Les entrées pas encore écrites dans le compte. */
export interface DirtyEntries {
  objectives: string[];
  days: string[];
}

export interface DeviceState {
  data: ParcoursData;
  owner: DeviceOwner | null;
  dirty: DirtyEntries;
}

const STORAGE_KEY = "pj-parcours";

const noDirt = (): DirtyEntries => ({ objectives: [], days: [] });

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function parseState(raw: string | null): DeviceState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof DeviceState, unknown>>;
    const owner = parsed.owner as Partial<DeviceOwner> | null | undefined;
    const dirty = parsed.dirty as Partial<Record<keyof DirtyEntries, unknown>> | undefined;
    return {
      data: parseParcours(parsed.data),
      owner:
        owner && typeof owner.uid === "string"
          ? {
              uid: owner.uid,
              ...(typeof owner.leftAt === "number" ? { leftAt: owner.leftAt } : {}),
            }
          : null,
      dirty: { objectives: strings(dirty?.objectives), days: strings(dirty?.days) },
    };
  } catch {
    return null;
  }
}

const store = devicePreference<DeviceState>(STORAGE_KEY, parseState, (state) =>
  JSON.stringify(state),
);

/** Ce que l'appareil porte, tout de suite. */
export function readDeviceState(): DeviceState {
  return store.read() ?? { data: emptyParcours(), owner: null, dirty: noDirt() };
}

export function writeDeviceState(state: DeviceState): void {
  store.write(state);
}

/** Ce que garde le natif quand le `localStorage` a été vidé (app native seulement). */
export const restoreDeviceState = (): Promise<DeviceState | null> => store.restore();

/** Ajoute des entrées à écrire, sans doublon. */
export function addDirt(dirty: DirtyEntries, more: DirtyEntries): DirtyEntries {
  return {
    objectives: [...new Set([...dirty.objectives, ...more.objectives])],
    days: [...new Set([...dirty.days, ...more.days])],
  };
}

export const emptyDirt = noDirt;
