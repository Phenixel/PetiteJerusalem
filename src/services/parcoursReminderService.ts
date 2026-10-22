import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";
import type { Router } from "vue-router";
import { isNativeApp } from "../composables/useNativeApp";
import { useParcoursReminders } from "../composables/useParcoursReminders";
import { refreshPermission } from "../composables/useZmanReminders";
import { analyticsService } from "./analyticsService";
import { PARCOURS_ID_BASE, PARCOURS_ID_LAST, type ReminderSettings } from "./parcours/reminders";
import { SUNSET_REMINDER_OFFSET_MINUTES } from "./zmanimService";

/**
 * The reminders of Mon parcours, scheduled on the phone (native app only).
 *
 * Like the zmanim reminders (zmanReminderService), nothing comes from a
 * server: the hour of a slot is computed on the device, from the place and
 * the calendar, and the notification is scheduled there with
 * @capacitor/local-notifications. It rings without network, and without an
 * account.
 *
 * What a reminder says depends on what is left to do, which only the open
 * app knows (the names of the objectives come from useParcoursViews, inside
 * a component): the plan is therefore made by ParcoursReminderScheduler.vue,
 * mounted at the root of the app, and handed here. This service only
 * replaces what is pending and listens to the touch.
 */

/** Marker carried by our notifications: the touch event is shared with the others. */
const REMINDER_SOURCE = "parcours-reminder";

/** Android channel of these reminders, so they can be muted on their own. */
const CHANNEL_ID = "pj-parcours";

function isOurId(id: number): boolean {
  return id >= PARCOURS_ID_BASE && id < PARCOURS_ID_LAST;
}

/** A notification ready to go. */
export interface ParcoursNotification {
  id: number;
  at: Date;
  title: string;
  body: string;
  slot: string;
}

class ParcoursReminderService {
  private started = false;
  private queue: Promise<void> = Promise.resolve();

  /**
   * Listens to the touch of our notifications: it opens the home page,
   * where the deck puts the card of the moment first. Called at launch, with
   * the zmanim reminders: Capacitor keeps the event of a cold start until
   * someone listens.
   */
  init(router: Router): void {
    if (!isNativeApp || this.started) return;
    this.started = true;
    void import("@capacitor/local-notifications")
      .then(({ LocalNotifications }) => {
        LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
          const extra = event.notification.extra as { source?: string; slot?: string } | undefined;
          if (extra?.source !== REMINDER_SOURCE) return;
          analyticsService.capture("parcours_reminder_opened", { slot: extra.slot ?? null });
          void router.push("/");
        });
      })
      .catch(() => {});
  }

  /** Replaces what is pending with `notifications`. Calls are chained, never crossed. */
  schedule(
    notifications: ParcoursNotification[],
    channel: { name: string; description: string },
  ): Promise<void> {
    if (!isNativeApp) return Promise.resolve();
    this.queue = this.queue.then(() => this.replace(notifications, channel));
    return this.queue;
  }

  private async replace(
    notifications: ParcoursNotification[],
    channel: { name: string; description: string },
  ): Promise<void> {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const pending = await LocalNotifications.getPending();
      const ours = pending.notifications.filter((notification) => isOurId(notification.id));
      if (ours.length > 0) {
        await LocalNotifications.cancel({ notifications: ours.map(({ id }) => ({ id })) });
      }
      if (notifications.length === 0) return;
      // Without permission, the system would refuse: it is asked when a
      // slot is turned on, never here, out of any gesture.
      if ((await refreshPermission()) !== "granted") return;
      await this.ensureChannel(LocalNotifications, channel);
      await LocalNotifications.schedule({
        notifications: notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          // Without it, Android holds the notification until its next idle
          // window, and "20 minutes before the chkia" would come after it.
          schedule: { at: notification.at, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          extra: { source: REMINDER_SOURCE, slot: notification.slot },
        })),
      });
    } catch {
      // Plugin missing (old binary) or scheduling refused: the reminders
      // come back at the next return to the foreground.
    }
  }

  private async ensureChannel(
    notifications: LocalNotificationsPlugin,
    channel: { name: string; description: string },
  ): Promise<void> {
    try {
      await notifications.createChannel({
        id: CHANNEL_ID,
        name: channel.name,
        description: channel.description,
        importance: 4,
        visibility: 1,
      });
    } catch {
      // No channels on this platform (iOS).
    }
  }

  /**
   * Carries the evening reminder of the server (Le rappel du soir) over to
   * the device, once: its fixed hour becomes the day's summary, its call
   * before the chkia the Min'ha slot, then the server stops sending it, or
   * both would ring. Only with the permission already granted: otherwise
   * the server's reminder is left as it is, rather than lost.
   */
  async migrateServerReminder(): Promise<void> {
    if (!isNativeApp) return;
    const reminders = useParcoursReminders();
    if (reminders.migrated.value) return;
    try {
      const { authService } = await import("./authService");
      const user = await authService.getCurrentUser();
      if (!user) return;
      const { userPreferencesService } = await import("./userPreferencesService");
      const prefs = await userPreferencesService.getPreferences(user.id);
      if (prefs.pushReminderEnabled !== true) {
        reminders.setMigrated();
        return;
      }
      if ((await refreshPermission()) !== "granted") return;
      const daily = prefs.pushReminderDailyEnabled !== false;
      const sunset = prefs.pushSunsetReminderEnabled === true;
      const slots: Partial<ReminderSettings> = {};
      if (daily) {
        slots.day = {
          on: true,
          time: {
            kind: "fixed",
            hour: prefs.pushReminderHour ?? 18,
            minute: prefs.pushReminderMinute ?? 0,
          },
        };
      }
      if (sunset) {
        slots.minha = {
          on: true,
          time: { kind: "zman", zman: "sunset", offset: -SUNSET_REMINDER_OFFSET_MINUTES },
        };
      }
      const { pushService } = await import("./pushService");
      await pushService.stopServerReminder(user.id);
      reminders.setMigrated(slots);
      analyticsService.capture("parcours_reminders_migrated", { daily, sunset });
    } catch {
      // Offline, or the preferences unreadable: tried again at the next launch.
    }
  }
}

export const parcoursReminderService = new ParcoursReminderService();
