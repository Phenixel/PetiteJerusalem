import { computed, ref, watch, type Ref } from "vue";
import type { ZmanKey } from "../services/zmanimService";
import { isNativeApp } from "./useNativeApp";

/**
 * Les rappels d'horaires, tels que l'utilisateur les pose : quels horaires
 * doivent le prévenir, combien de minutes à l'avance, et s'il veut être
 * averti avant l'entrée du Chabbat et des fêtes.
 *
 * Gardés sur l'APPAREIL (localStorage), jamais dans le compte : une
 * notification est planifiée par le téléphone qui la recevra
 * (@capacitor/local-notifications), à partir du lieu choisi sur cet
 * appareil-là. La même liste synchronisée sur une tablette laissée au tiroir
 * n'aurait aucun sens, et le rappel de la chkia de Paris n'en a pas pour qui
 * lit ses horaires à Jérusalem.
 *
 * Ce module ne planifie rien : il ne porte que l'état et la permission
 * système. La planification vit dans zmanReminderService, qui suit cet état.
 * C'est aussi ce qui lui permet de rester hors du moteur d'horaires (hebcal) :
 * la page de réglages n'a pas à le charger pour cocher une case.
 */

const STORAGE_KEY = "pj_zman_reminders";

/** Un rappel posé sur un horaire de la journée. */
export interface ZmanReminder {
  key: ZmanKey;
  /** Combien de minutes avant l'horaire la notification part (0 = à l'heure pile). */
  minutesBefore: number;
}

/** Ce que l'appareil retient des rappels. */
interface ReminderState {
  zmanim: ZmanReminder[];
  /** Rappel avant l'entrée du Chabbat et des fêtes. Activé d'office. */
  rest: boolean;
  /** Dernier délai choisi : ce que le geste rapide reprend. */
  lastMinutes: number;
}

/** Le délai proposé d'office : assez tôt pour se préparer, assez tard pour compter. */
export const DEFAULT_MINUTES_BEFORE = 15;

/**
 * L'avance du rappel de l'entrée du repos : une heure. C'est le temps qu'il
 * faut pour finir ce qu'on fait et allumer, et c'est une durée qu'on annonce
 * telle quelle (« Chabbat entre dans une heure ») sans avoir à la lire.
 */
export const REST_REMINDER_MINUTES = 60;

/** Les délais proposés d'un geste dans la fenêtre de réglage. */
export const MINUTE_CHOICES = [0, 5, 10, 15, 30, 45, 60];

/** Bornes du délai réglable à la main : de l'heure pile à trois heures avant. */
export const MIN_MINUTES_BEFORE = 0;
export const MAX_MINUTES_BEFORE = 180;
/** Pas du réglage à la main : les minutes se comptent de cinq en cinq. */
export const MINUTES_STEP = 5;

const DEFAULT_STATE: ReminderState = {
  zmanim: [],
  rest: true,
  lastMinutes: DEFAULT_MINUTES_BEFORE,
};

/** Ce que vaut un délai lu du stockage, ou saisi : entier, dans les bornes. */
export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MINUTES_BEFORE;
  return Math.min(MAX_MINUTES_BEFORE, Math.max(MIN_MINUTES_BEFORE, Math.round(value)));
}

function readStored(): ReminderState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<ReminderState>;
    const zmanim = Array.isArray(parsed.zmanim)
      ? parsed.zmanim
          .filter((entry): entry is ZmanReminder => typeof entry?.key === "string")
          .map((entry) => ({ key: entry.key, minutesBefore: clampMinutes(entry.minutesBefore) }))
      : [];
    return {
      zmanim,
      // Absent d'un état écrit avant ce réglage : le rappel du repos est
      // proposé d'office, son absence vaut donc « oui », pas « non ».
      rest: parsed.rest !== false,
      lastMinutes: clampMinutes(parsed.lastMinutes ?? DEFAULT_MINUTES_BEFORE),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const state: Ref<ReminderState> = ref(readStored());

watch(
  state,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Stockage indisponible : les rappels valent pour la session en cours.
    }
  },
  { deep: true },
);

/**
 * Permission des notifications, telle que le système la donne.
 *
 * « unknown » tant qu'on ne l'a pas demandée au plugin (le site web y reste,
 * il ne planifie rien) ; « prompt » quand le système n'a pas encore posé la
 * question, et c'est le seul état où l'on a le droit de la poser.
 */
export type NotificationPermission = "unknown" | "prompt" | "granted" | "denied";

const permission = ref<NotificationPermission>("unknown");

/** Vrai quand les alarmes à l'heure exacte sont autorisées (Android 12+). */
const exactAlarms = ref(true);

/** Le plugin, chargé à la demande : le site web ne le tire jamais. */
async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

function readPermission(display: string): NotificationPermission {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  return "prompt";
}

/**
 * L'état de la permission, relu auprès du système.
 *
 * Il change hors de l'application (réglages du téléphone) : on le relit à
 * chaque ouverture de l'écran qui l'affiche, plutôt que de se fier à ce qu'on
 * en savait la dernière fois.
 */
export async function refreshPermission(): Promise<NotificationPermission> {
  if (!isNativeApp) return "unknown";
  try {
    const notifications = await plugin();
    permission.value = readPermission((await notifications.checkPermissions()).display);
    try {
      // Android 12+ : sans « alarmes et rappels », le système décale la
      // notification de quelques minutes. Ailleurs (iOS), rien à demander.
      exactAlarms.value =
        (await notifications.checkExactNotificationSetting()).exact_alarm !== "denied";
    } catch {
      exactAlarms.value = true; // Réglage inconnu de la plateforme : rien à signaler.
    }
  } catch {
    // Plugin absent (vieux binaire) : on ne conclut rien.
  }
  return permission.value;
}

/**
 * S'assure que l'application peut notifier. `ask` autorise la fenêtre du
 * système, qui ne se pose qu'une fois : on ne la déclenche donc que sur un
 * geste qui demande un rappel, jamais au lancement.
 */
export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  if (!isNativeApp) return false;
  const current = await refreshPermission();
  if (current === "granted") return true;
  if (!ask || current === "denied") return false;
  try {
    const asked = await (await plugin()).requestPermissions();
    permission.value = readPermission(asked.display);
  } catch {
    return false;
  }
  return permission.value === "granted";
}

/** Ouvre le réglage « alarmes et rappels » du système (Android 12+). */
export async function openExactAlarmSetting(): Promise<void> {
  if (!isNativeApp) return;
  try {
    await (await plugin()).changeExactNotificationSetting();
  } catch {
    // Réglage inconnu de la plateforme : rien à ouvrir.
  }
}

export function useZmanReminders() {
  const reminders = computed(() => state.value.zmanim);
  const restEnabled = computed(() => state.value.rest);
  const lastMinutes = computed(() => state.value.lastMinutes);

  /** Le rappel posé sur cet horaire, s'il y en a un. */
  function reminderFor(key: ZmanKey): ZmanReminder | null {
    return state.value.zmanim.find((entry) => entry.key === key) ?? null;
  }

  /**
   * Pose (ou déplace) le rappel d'un horaire. Le délai retenu devient celui
   * que le geste rapide reprendra sur les autres lignes.
   */
  function setReminder(key: ZmanKey, minutesBefore: number): void {
    const minutes = clampMinutes(minutesBefore);
    const zmanim = state.value.zmanim.filter((entry) => entry.key !== key);
    zmanim.push({ key, minutesBefore: minutes });
    state.value = { ...state.value, zmanim, lastMinutes: minutes };
  }

  function clearReminder(key: ZmanKey): void {
    state.value = {
      ...state.value,
      zmanim: state.value.zmanim.filter((entry) => entry.key !== key),
    };
  }

  function setRestEnabled(value: boolean): void {
    state.value = { ...state.value, rest: value };
  }

  return {
    reminders,
    restEnabled,
    lastMinutes,
    permission,
    exactAlarms,
    reminderFor,
    setReminder,
    clearReminder,
    setRestEnabled,
  };
}
