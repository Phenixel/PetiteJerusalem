import { computed, ref, shallowRef, watch } from "vue";
import { localDayKey } from "../services/dateService";
import {
  putObjective,
  removeObjective,
  setPaused,
  setTaskDone,
  setTaskSkipped,
  setUnitsRead,
} from "../services/parcours/actions";
import { joiningEntries } from "../services/parcours/account";
import { restCalendar } from "../services/parcours/calendar";
import { fetchAccountParcours, writeAccountEntries } from "../services/parcours/cloud";
import {
  addDirt,
  emptyDirt,
  readDeviceState,
  restoreDeviceState,
  writeDeviceState,
  type DeviceState,
  type DirtyEntries,
} from "../services/parcours/deviceStore";
import {
  importLegacy,
  legacyProjection,
  type LegacyDailyReading,
} from "../services/parcours/legacyDailyReading";
import { changedEntries, hasChanges, mergeParcours } from "../services/parcours/merge";
import type {
  CatchUpOption,
  DayKey,
  Objective,
  ParcoursData,
  ProgramObjective,
} from "../services/parcours/model";
import { applyCatchUp, resumeProgram, type RestCalendar } from "../services/parcours/plan";
import {
  daySummaries,
  firstDay,
  scheduleContext,
  streakOf,
  tasksForDay,
  type Task,
} from "../services/parcours/schedule";
import { trackTaskMarked, trackTaskSkipped } from "../services/parcours/tracking";
import { isIsraelPlace } from "../services/zmanimService";
import { isNativeApp } from "./useNativeApp";
import { useNow } from "./useNow";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Mon parcours, tel que les pages et l'accueil s'en servent : les données,
 * ce qu'elles donnent aujourd'hui, et de quoi les changer.
 *
 * L'APPAREIL est le socle (deviceStore.ts) : il sert sans compte, sans réseau
 * et dès le premier rendu. Le COMPTE emporte tout d'un appareil à l'autre :
 * à la connexion, ce qu'il porte se fusionne avec ce que l'appareil peut lui
 * verser (account.ts), puis chaque changement part vers lui, entrée par
 * entrée (cloud.ts). Une écriture qui échoue reste à écrire (`dirty`) et
 * repart au retour du réseau, après une nouvelle lecture du compte : on
 * n'écrit jamais d'après une copie qu'on n'a pas relue.
 *
 * Avec un compte, Mon parcours tient aussi à jour la lecture du jour d'avant,
 * que les versions installées et le rappel du soir lisent encore
 * (legacyDailyReading.ts) ; les widgets et la montre la tirent de l'appareil.
 */

const state = shallowRef<DeviceState>(readDeviceState());
const accountId = ref<string | null>(null);
/** Le compte a été relu depuis le serveur depuis la dernière coupure : on peut écrire. */
let synced = false;
let adopting: Promise<void> | null = null;
let lastAdoptAt = 0;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * La lecture du jour d'avant telle que le compte la porte (lue, puis écrite) :
 * on n'écrit que ce qui change, les listes d'un côté, le jour de l'autre.
 */
let legacyLists: string | null = null;
let legacyProgress: string | null = null;
let started = false;

/** Après une absence, on relit le compte : un autre appareil a pu écrire. */
const REFRESH_AFTER_MS = 5 * 60_000;
const PUSH_DELAY_MS = 1200;

function persist(next: DeviceState): void {
  state.value = next;
  writeDeviceState(next);
  refreshSurfaces();
}

/** Les widgets et la montre montrent la lecture du jour : ils suivent chaque changement. */
function refreshSurfaces(): void {
  if (!isNativeApp) return;
  void import("../services/widgetService")
    .then(({ widgetService }) => widgetService.refresh())
    .catch(() => {
      // Lot périmé après un déploiement : les widgets suivront au prochain lancement.
    });
}

const today = (): DayKey => localDayKey();

/** Applique des données nouvelles, les garde, et les envoie au compte. */
function commit(next: ParcoursData): void {
  const current = state.value;
  const changes = changedEntries(current.data, next);
  if (!hasChanges(changes)) return;
  persist({
    ...current,
    data: next,
    dirty: accountId.value ? addDirt(current.dirty, changes) : current.dirty,
  });
  schedulePush();
}

function schedulePush(): void {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
}

/** Ce qui a été écrit, retiré des entrées à écrire s'il n'a pas rechangé entre-temps. */
function settled(written: DirtyEntries, sent: ParcoursData): DirtyEntries {
  const { data, dirty } = state.value;
  return {
    objectives: dirty.objectives.filter(
      (id) => !written.objectives.includes(id) || data.objectives[id] !== sent.objectives[id],
    ),
    days: dirty.days.filter(
      (day) => !written.days.includes(day) || data.days[day] !== sent.days[day],
    ),
  };
}

async function push(): Promise<void> {
  const uid = accountId.value;
  if (!uid || !synced) return;
  const { data, dirty } = state.value;
  try {
    await writeAccountEntries(uid, data, dirty);
    if (accountId.value === uid) persist({ ...state.value, dirty: settled(dirty, data) });
  } catch {
    // Hors ligne ou serveur injoignable : tout reste à écrire, et repartira
    // après une nouvelle lecture du compte au retour du réseau.
    synced = false;
    return;
  }
  await writeLegacy(uid);
}

/** Les champs de la lecture du jour d'avant, tels que le profil les porte. */
async function readLegacy(uid: string): Promise<LegacyDailyReading> {
  const { userPreferencesService } = await import("../services/userPreferencesService");
  const prefs = await userPreferencesService.getPreferencesFromServer(uid);
  return {
    ids: prefs.dailyReadingIds ?? [],
    options: prefs.dailyReadingOptions ?? [],
    progress: {
      date: prefs.dailyReadingProgress?.date ?? "",
      completedIds: prefs.dailyReadingProgress?.completedIds ?? [],
      completedOptions: prefs.dailyReadingProgress?.completedOptions,
      parashaProgress: prefs.dailyReadingProgress?.parashaProgress,
    },
  };
}

/** Les listes de la lecture du jour, comparables d'un côté à l'autre. */
const listsKey = (ids: number[], options: string[]): string =>
  JSON.stringify({ ids: [...ids].sort((x, y) => x - y), options: [...options].sort() });

/**
 * Réécrit la lecture du jour d'avant d'après Mon parcours, si elle a changé.
 * Le jour ne s'écrit que pour qui s'en sert encore : sans liste, rien à cocher.
 */
async function writeLegacy(uid: string): Promise<void> {
  const projection = legacyProjection(state.value.data, today());
  const lists = listsKey(projection.dailyReadingIds, projection.dailyReadingOptions);
  const progress = JSON.stringify(projection.dailyReadingProgress);
  const used = projection.dailyReadingIds.length > 0 || projection.dailyReadingOptions.length > 0;
  try {
    const { userPreferencesService } = await import("../services/userPreferencesService");
    if (lists !== legacyLists) {
      await userPreferencesService.savePreferences(uid, {
        dailyReadingIds: projection.dailyReadingIds,
        dailyReadingOptions: projection.dailyReadingOptions,
      });
      legacyLists = lists;
    }
    if (used && progress !== legacyProgress) {
      await userPreferencesService.saveDailyProgress(uid, projection.dailyReadingProgress);
      legacyProgress = progress;
    }
  } catch {
    // Hors ligne : la prochaine écriture vers le compte la refera.
  }
}

/**
 * Prend en charge le compte connecté : ce qu'il porte, fusionné avec ce que
 * l'appareil peut lui verser et avec la lecture du jour d'avant ; puis tout
 * ce qui diffère part vers lui.
 */
function adopt(uid: string): Promise<void> {
  adopting ??= (async () => {
    try {
      const [remote, legacy] = await Promise.all([fetchAccountParcours(uid), readLegacy(uid)]);
      if (accountId.value !== uid) return;
      const current = state.value;
      const joining = joiningEntries(current.data, current.owner, uid);
      const merged = importLegacy(mergeParcours(remote, joining), legacy, today());
      const kept = current.owner?.uid === uid ? current.dirty : emptyDirt();
      persist({
        data: merged,
        owner: { uid },
        dirty: addDirt(kept, changedEntries(remote, merged)),
      });
      synced = true;
      lastAdoptAt = Date.now();
      legacyLists = listsKey(legacy.ids, legacy.options);
      legacyProgress = JSON.stringify(legacy.progress);
      await push();
    } catch {
      // Hors ligne au lancement : l'appareil sert seul, le retour du réseau relira le compte.
      synced = false;
    } finally {
      adopting = null;
    }
  })();
  return adopting;
}

/** Un autre compte se connecte : ce qui était au précédent quitte l'écran tout de suite. */
function switchTo(uid: string): void {
  const current = state.value;
  if (current.owner && current.owner.uid !== uid) {
    persist({
      data: joiningEntries(current.data, current.owner, uid),
      owner: { uid },
      dirty: emptyDirt(),
    });
  }
}

/** Démarré au premier usage : qui n'ouvre jamais Mon parcours ne charge rien. */
function start(): void {
  if (started) return;
  started = true;
  // Le natif garde une copie que le système ne vide pas avec le localStorage.
  void restoreDeviceState().then((restored) => {
    const current = state.value;
    const isEmpty = Object.keys(current.data.objectives).length === 0;
    if (restored && isEmpty && Object.keys(restored.data.objectives).length > 0) persist(restored);
  });
  void import("../services/authService")
    .then(({ authService }) => {
      authService.onAuthChanged((user) => {
        const uid = user?.id ?? null;
        const previous = accountId.value;
        if (uid === previous) return;
        accountId.value = uid;
        synced = false;
        if (uid) {
          switchTo(uid);
          void adopt(uid);
        } else if (previous) {
          // Déconnexion : tout reste sur l'appareil ; ce qui s'écrira désormais
          // l'est sans compte, et rejoindra le prochain compte qui se connecte.
          persist({ ...state.value, owner: { uid: previous, leftAt: Date.now() } });
        }
      });
    })
    .catch(() => {
      // Lot périmé après un déploiement : l'appareil sert seul.
    });
  window.addEventListener("online", () => {
    if (accountId.value) void adopt(accountId.value);
  });
  document.addEventListener("visibilitychange", () => {
    const uid = accountId.value;
    if (
      document.visibilityState === "visible" &&
      uid &&
      Date.now() - lastAdoptAt > REFRESH_AFTER_MS
    ) {
      void adopt(uid);
    }
  });
}

/** Le rattrapage qu'on a choisi de faire « sans demander », appliqué au retard du jour. */
function autoCatchUp(data: ParcoursData, day: DayKey, isRest: RestCalendar): ParcoursData {
  let next = data;
  for (const objective of Object.values(data.objectives)) {
    if (objective.kind !== "program" || !objective.autoCatchUp || objective.deletedAt) continue;
    const caught = applyCatchUp(objective, objective.autoCatchUp, day, next.days, isRest);
    if (caught !== objective) next = putObjective(next, caught);
  }
  return next;
}

export function useParcours() {
  start();
  const now = useNow();
  const { place } = useZmanimLocation();

  const data = computed(() => state.value.data);
  const todayKey = computed(() => localDayKey(now.value));
  const isRest = computed(() => restCalendar(isIsraelPlace(place.value)));
  const context = computed(() => scheduleContext(data.value, isRest.value));
  const signedIn = computed(() => accountId.value !== null);

  const tasksOn = (day: DayKey): Task[] => tasksForDay(data.value, day, context.value);
  const todayTasks = computed(() => tasksOn(todayKey.value));
  const begun = computed(() => firstDay(data.value));
  const streak = computed(() => {
    const first = begun.value;
    if (!first) return { current: 0, best: 0, held: 0 };
    return streakOf(daySummaries(data.value, first, todayKey.value, todayKey.value, context.value));
  });

  // « Faire ainsi sans demander » : le retard du jour se rattrape seul.
  watch([todayKey, context], () => commit(autoCatchUp(data.value, todayKey.value, isRest.value)), {
    immediate: true,
  });

  return {
    data,
    today: todayKey,
    context,
    isRest,
    signedIn,
    todayTasks,
    begun,
    streak,
    tasksOn,
    /** Coche ou décoche une tâche, ce jour-là ; `source` dit d'où (le suivi d'audience). */
    setDone(task: Task, day: DayKey, done: boolean, source: string) {
      commit(setTaskDone(data.value, task, day, done));
      trackTaskMarked(data.value, context.value, task, day, todayKey.value, done, source);
    },
    /** « Pas aujourd'hui », ou son contraire. */
    setSkipped(task: Task, day: DayKey, skipped: boolean, source: string) {
      commit(setTaskSkipped(data.value, task.id, day, skipped));
      trackTaskSkipped(task, skipped, source);
    },
    /** Les unités d'un programme lues ce jour-là. */
    setUnits(objectiveId: string, day: DayKey, units: number) {
      commit(setUnitsRead(data.value, objectiveId, day, units));
    },
    saveObjective(objective: Objective) {
      commit(putObjective(data.value, objective));
    },
    removeObjective(id: string) {
      commit(removeObjective(data.value, id));
    },
    setPaused(id: string, paused: boolean) {
      const objective = data.value.objectives[id];
      // Un programme qui reprend : sa fin recule du temps de la pause (resumeProgram).
      if (!paused && objective?.kind === "program") {
        const resumed = resumeProgram(objective, todayKey.value, data.value.days, isRest.value);
        commit(putObjective(data.value, resumed));
        return;
      }
      commit(setPaused(data.value, id, paused ? todayKey.value : null));
    },
    /** Rattrape le retard d'un programme ; `remember` en fait la règle des fois suivantes. */
    catchUp(program: ProgramObjective, option: CatchUpOption, remember: boolean) {
      const caught = applyCatchUp(program, option, todayKey.value, data.value.days, isRest.value);
      const next = { ...caught };
      if (remember) next.autoCatchUp = option;
      else delete next.autoCatchUp;
      commit(putObjective(data.value, next));
    },
  };
}

export type ParcoursStore = ReturnType<typeof useParcours>;
