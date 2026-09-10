import { HDate } from "@hebcal/core";
import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";
import { watch } from "vue";
import type { Router } from "vue-router";
import { isNativeApp } from "../composables/useNativeApp";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import {
  refreshPermission,
  REST_REMINDER_MINUTES,
  useZmanReminders,
  type ZmanReminder,
} from "../composables/useZmanReminders";
import { i18n, loadLocaleMessages, type SupportedLocale } from "../i18n";
import { DEFAULT_SEO_LOCALE, sectionPath, type SeoLocale } from "../content/seoLocales";
import { analyticsService } from "./analyticsService";
import {
  computeZmanim,
  dayInPlace,
  formatZmanTime,
  restPeriodAt,
  ZMAN_KEYS,
  type ZmanimPlace,
  type ZmanKey,
} from "./zmanimService";

/**
 * Les rappels d'horaires, posés sur le téléphone (app native uniquement).
 *
 * Rien ne part d'un serveur : un horaire se calcule sur l'appareil
 * (zmanimService), la notification est donc programmée sur l'appareil aussi,
 * par @capacitor/local-notifications. Le téléphone sonne à l'heure dite même
 * sans réseau, et aucune position n'est confiée à personne, contrairement au
 * rappel de lecture d'avant-chkia, qui part d'une Cloud Function et doit lui
 * donner un lieu (voir pushService).
 *
 * Un horaire n'a pas d'heure fixe : l'alot de demain n'est pas celui
 * d'aujourd'hui. Une notification qui « se répète tous les jours à 6 h 13 »
 * serait donc fausse dès le lendemain. On programme à la place une suite
 * d'instants exacts, chacun calculé pour son jour, sur les quelques jours qui
 * viennent, et on la reprend à chaque retour au premier plan : la fenêtre
 * avance avec l'utilisateur.
 *
 * Ce que le système laisse en attente est compté (iOS ne retient que les 64
 * plus proches, tous rappels confondus) : la fenêtre est donc partagée entre
 * les rappels posés, d'autant plus courte qu'ils sont nombreux, et jamais plus
 * courte que deux jours.
 */

/** Plage d'identifiants réservée à ces rappels : ce qu'on annule est le nôtre. */
const ID_BASE = 41_000_000;
/** Un horaire ne peut pas porter plus d'occurrences que cet écart. */
const ID_STRIDE = 20;
/** Les identifiants des rappels du repos, après ceux des horaires. */
const ID_REST = ID_BASE + ZMAN_KEYS.length * ID_STRIDE;
const ID_LAST = ID_REST + ID_STRIDE;

/**
 * Marqueur porté par nos notifications : le plugin sert aussi aux push
 * rejouées au premier plan (pushService), et l'événement du toucher est
 * global. Chacun ne traite que les siennes.
 */
const REMINDER_SOURCE = "zman-reminder";

/** Canal Android des rappels d'horaires, pour qu'ils se coupent à part. */
const CHANNEL_ID = "pj-zmanim";

/** Un rappel de nous, à annuler avant de reprogrammer. */
function isOurId(id: number): boolean {
  return id >= ID_BASE && id < ID_LAST;
}

/**
 * Combien de notifications en attente on s'autorise. iOS en garde 64 par
 * application, les plus proches, et jette silencieusement le reste : on reste
 * en dessous pour que la coupe soit la nôtre et non la sienne.
 */
export const MAX_PENDING = 56;

/** Au plus trois entrées de repos d'avance : un mois de calendrier suffit. */
const REST_OCCURRENCES = 3;
const REST_HORIZON_DAYS = 30;

/** Fenêtre par horaire rappelé, selon le nombre de rappels posés. */
const MIN_HORIZON_DAYS = 2;
const MAX_HORIZON_DAYS = 14;

/** Ce qu'un rappel annonce, une fois placé dans le temps. */
export interface PlannedReminder {
  /** Identifiant système, stable pour un horaire et un rang donnés. */
  id: number;
  /** Quand la notification part. */
  at: Date;
  /** L'instant annoncé : l'horaire lui-même, ou l'entrée du repos. */
  target: Date;
  minutesBefore: number;
  /** L'horaire concerné, null quand c'est l'entrée d'un temps de repos. */
  zman: ZmanKey | null;
  /** Fêtes couvertes par le repos annoncé (vide pour un simple Chabbat). */
  festivals?: string[];
  /** Le repos annoncé couvre un Chabbat. */
  shabbat?: boolean;
}

/** L'entrée du repos, une heure avant l'allumage, sur le mois qui vient. */
function planRestReminders(place: ZmanimPlace, locale: string, now: Date): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  let abs = new HDate(dayInPlace(place, now)).abs();
  const lastAbs = abs + REST_HORIZON_DAYS;
  while (abs <= lastAbs && planned.length < REST_OCCURRENCES) {
    const period = restPeriodAt(place, new HDate(abs), locale);
    if (!period) {
      abs++;
      continue;
    }
    const at = new Date(period.start.getTime() - REST_REMINDER_MINUTES * 60_000);
    // Un repos déjà entré (ou entré dans moins d'une heure) n'a plus de
    // rappel à donner : on passe au suivant.
    if (at.getTime() > now.getTime()) {
      planned.push({
        id: ID_REST + planned.length,
        at,
        target: period.start,
        minutesBefore: REST_REMINDER_MINUTES,
        zman: null,
        festivals: period.festivals,
        shabbat: period.shabbat !== null,
      });
    }
    abs = period.last.abs() + 1;
  }
  return planned;
}

/** Combien de jours d'avance chaque horaire rappelé peut se permettre. */
function horizonDays(reminderCount: number, budget: number): number {
  if (reminderCount === 0) return 0;
  const perReminder = Math.floor(budget / reminderCount);
  return Math.max(MIN_HORIZON_DAYS, Math.min(MAX_HORIZON_DAYS, perReminder));
}

/**
 * Les notifications à programmer, dans l'ordre où elles partiront.
 *
 * Fonction pure : elle ne touche à rien, ce qui la rend vérifiable sans
 * téléphone (voir src/__tests__/zmanReminders.test.ts).
 */
export function planZmanReminders(options: {
  place: ZmanimPlace;
  reminders: ZmanReminder[];
  /** Rappel avant l'entrée du Chabbat et des fêtes. */
  rest: boolean;
  /** Langue des noms de fêtes portés par le plan. */
  locale: string;
  now?: Date;
  budget?: number;
}): PlannedReminder[] {
  const { place, rest, locale } = options;
  const now = options.now ?? new Date();
  const budget = options.budget ?? MAX_PENDING;

  const restPlan = rest ? planRestReminders(place, locale, now) : [];
  // Les rappels d'horaires se partagent ce que le repos laisse.
  const reminders = options.reminders.filter((reminder) => ZMAN_KEYS.includes(reminder.key));
  const days = horizonDays(reminders.length, budget - restPlan.length);

  const counts = new Map<ZmanKey, number>();
  const planned: PlannedReminder[] = [];
  // Le jour à l'extérieur, les rappels à l'intérieur : les horaires d'une
  // journée ne se calculent qu'une fois, quel que soit le nombre de rappels.
  for (let offset = 0; offset <= days && reminders.length > 0; offset++) {
    const day = new Date(now.getTime());
    day.setDate(day.getDate() + offset);
    const times = computeZmanim(place, day);
    for (const reminder of reminders) {
      const done = counts.get(reminder.key) ?? 0;
      if (done >= days) continue;
      const zman = times.find((time) => time.key === reminder.key);
      if (!zman) continue; // Horaire incalculable ce jour-là (nuit polaire).
      const at = new Date(zman.date.getTime() - reminder.minutesBefore * 60_000);
      if (at.getTime() <= now.getTime()) continue; // Déjà passé.
      counts.set(reminder.key, done + 1);
      planned.push({
        id: ID_BASE + ZMAN_KEYS.indexOf(reminder.key) * ID_STRIDE + done,
        at,
        target: zman.date,
        minutesBefore: reminder.minutesBefore,
        zman: reminder.key,
      });
    }
  }

  // L'ordre est celui du départ des notifications : si le budget devait
  // quand même être dépassé, ce sont les plus lointaines qui tombent.
  return [...planned, ...restPlan].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, budget);
}

/** Le titre et le texte d'un rappel, dans la langue de l'interface. */
export function describeReminder(
  planned: PlannedReminder,
  tzid: string,
  locale: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): { title: string; body: string } {
  const time = formatZmanTime(planned.target, tzid, locale);
  if (planned.zman) {
    return {
      title: t(`zmanim.names.${planned.zman}`),
      body:
        planned.minutesBefore === 0
          ? t("zmanim.reminder.notifyNow", { time })
          : t("zmanim.reminder.notifyBody", { minutes: planned.minutesBefore, time }),
    };
  }
  const festivals = (planned.festivals ?? []).join(" · ");
  const title = planned.shabbat
    ? festivals
      ? `${t("zmanim.shabbat.title")} ${festivals}`
      : t("zmanim.shabbat.title")
    : festivals;
  return {
    title: title || t("zmanim.shabbat.title"),
    body: t("zmanim.reminder.notifyRest", { time }),
  };
}

/** L'espace de langue des adresses traduites, d'après la langue de l'interface. */
function seoLocaleOf(locale: string): SeoLocale {
  return locale === "en" || locale === "he" ? locale : DEFAULT_SEO_LOCALE;
}

class ZmanReminderService {
  private started = false;
  private queue: Promise<void> = Promise.resolve();
  private queued = false;

  /**
   * À appeler une fois au démarrage de l'app native. Reprogramme les rappels
   * à chaque fois que ce dont ils dépendent bouge : les rappels eux-mêmes, le
   * lieu de calcul, la langue des textes, et le retour au premier plan, qui
   * fait avancer la fenêtre des jours programmés.
   */
  init(router: Router): void {
    if (!isNativeApp || this.started) return;
    this.started = true;

    const { reminders, restEnabled } = useZmanReminders();
    watch([reminders, restEnabled], () => void this.refresh(), { deep: true });

    const { place } = useZmanimLocation();
    watch(place, () => void this.refresh());
    watch(i18n.global.locale, () => void this.refresh());

    import("@capacitor/app")
      .then(({ App }) => App.addListener("resume", () => void this.refresh()))
      .catch(() => {});

    // Toucher le rappel ouvre les horaires. Le marqueur `source` distingue nos
    // notifications de celles que pushService rejoue au premier plan : les
    // deux écoutent le même événement, chacun ne traite que les siennes.
    void import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
      LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const extra = event.notification.extra as
          | { source?: string; url?: string; zman?: string | null }
          | undefined;
        if (extra?.source !== REMINDER_SOURCE) return;
        analyticsService.capture("zman_reminder_opened", { zman: extra.zman ?? null });
        if (extra.url) void router.push(extra.url);
      });
    });

    void this.refresh();
  }

  /** Reprogramme la fenêtre. Les appels qui se chevauchent sont regroupés. */
  refresh(): Promise<void> {
    if (!isNativeApp) return Promise.resolve();
    if (this.queued) return this.queue;
    this.queued = true;
    this.queue = this.queue.then(() => {
      this.queued = false;
      return this.reschedule();
    });
    return this.queue;
  }

  private async reschedule(): Promise<void> {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      // Ce qui était programmé part d'abord : les instants changent d'un jour
      // à l'autre, on ne modifie pas une notification en attente, on la refait.
      const pending = await LocalNotifications.getPending();
      const ours = pending.notifications.filter((notification) => isOurId(notification.id));
      if (ours.length > 0) {
        await LocalNotifications.cancel({
          notifications: ours.map(({ id }) => ({ id })),
        });
      }

      const { reminders, restEnabled } = useZmanReminders();
      if (reminders.value.length === 0 && !restEnabled.value) return;
      // Sans permission, il n'y a rien à programmer : le système refuserait.
      // On ne la demande pas ici, hors de tout geste : ce serait une fenêtre
      // du système surgie de nulle part (voir ensureNotificationPermission).
      if ((await refreshPermission()) !== "granted") return;

      const locale = i18n.global.locale.value;
      // Les messages en et he arrivent par import dynamique : sans l'attente,
      // le premier rappel d'un utilisateur en/he partirait en français.
      await loadLocaleMessages(locale as SupportedLocale);
      const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string;

      const { place } = useZmanimLocation();
      const planned = planZmanReminders({
        place: place.value,
        reminders: reminders.value,
        rest: restEnabled.value,
        locale,
      });
      if (planned.length === 0) return;

      await this.ensureChannel(LocalNotifications, t);
      const url = sectionPath("horaires", seoLocaleOf(locale));
      await LocalNotifications.schedule({
        notifications: planned.map((reminder) => ({
          id: reminder.id,
          ...describeReminder(reminder, place.value.tzid, locale, t),
          // `allowWhileIdle` : sans lui, Android retient la notification
          // jusqu'à la prochaine fenêtre de veille, et un rappel de dix
          // minutes avant arriverait après l'horaire qu'il annonce.
          schedule: { at: reminder.at, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          extra: { source: REMINDER_SOURCE, url, zman: reminder.zman },
        })),
      });
    } catch {
      // Plugin absent (vieux binaire) ou programmation refusée : les rappels
      // repartiront au prochain retour au premier plan.
    }
  }

  /**
   * Le canal Android des rappels d'horaires : sans canal à eux, ils se
   * couperaient avec les rappels de lecture, et l'utilisateur ne peut plus
   * choisir. Sans effet sur iOS.
   */
  private async ensureChannel(
    notifications: LocalNotificationsPlugin,
    t: (key: string) => string,
  ): Promise<void> {
    try {
      await notifications.createChannel({
        id: CHANNEL_ID,
        name: t("zmanim.reminder.channelName"),
        description: t("zmanim.reminder.channelDescription"),
        importance: 4,
        visibility: 1,
      });
    } catch {
      // Plateforme sans canaux (iOS) : rien à créer.
    }
  }
}

export const zmanReminderService = new ZmanReminderService();
