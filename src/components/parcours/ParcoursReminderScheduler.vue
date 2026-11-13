<script setup lang="ts">
/**
 * Plans the reminders of Mon parcours, without a face (native app only).
 *
 * A reminder names what is left to do ("Encore à faire : Min'ha et
 * Tehilim"), and those names are said by useParcoursViews, which needs a
 * component: the plan is therefore made here, mounted once at the root of
 * the app, and handed to parcoursReminderService, which schedules it.
 *
 * It is redone whenever what it depends on moves: the settings, a task
 * checked (today's reminder then names less, or nothing), the place and the
 * opinion of the zmanim, the language, the day, and the return to the
 * foreground, which moves the window of scheduled days forward.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursReminders } from "../../composables/useParcoursReminders";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useZmanimOpinion } from "../../composables/useZmanimOpinion";
import { joinNames } from "../../services/widgetPayloads";
import { planParcoursReminders, type PlannedSlot } from "../../services/parcours/reminders";
import {
  parcoursReminderService,
  type ParcoursNotification,
} from "../../services/parcoursReminderService";

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const reminders = useParcoursReminders();
const { place } = useZmanimLocation();
const { opinion } = useZmanimOpinion();

/** Named in the notification: past these, « et 2 autres ». */
const NAMED = 3;
/** A task checked, then another: one plan for both. */
const SETTLE_MS = 1500;

function describe(planned: PlannedSlot): ParcoursNotification {
  const names = planned.tasks.flatMap((task) => {
    const objective = store.data.value.objectives[task.objectiveId];
    if (!objective) return [];
    // An office of the three tefilot is named by itself, as on its card.
    return [task.step ? t(`parcours.tefilot.${task.step}`) : views.objectiveTitle(objective)];
  });
  const shown = names.slice(0, NAMED);
  const rest = names.length - shown.length;
  if (rest > 0) shown.push(t("parcours.reminders.notify.others", { n: rest }, rest));
  return {
    id: planned.id,
    at: planned.at,
    slot: planned.slot,
    title: t(`parcours.reminders.notify.titles.${planned.slot}`),
    body: t("parcours.reminders.notify.body", { list: joinNames(shown, locale.value) }),
  };
}

function schedule(): void {
  const planned = planParcoursReminders({
    settings: reminders.settings.value,
    place: place.value,
    data: store.data.value,
    tasksOn: store.tasksOn,
    today: store.today.value,
  });
  void parcoursReminderService.schedule(planned.map(describe), {
    name: t("parcours.reminders.channelName"),
    description: t("parcours.reminders.channelDescription"),
  });
}

let timer: ReturnType<typeof setTimeout> | undefined;
function soon(): void {
  clearTimeout(timer);
  timer = setTimeout(schedule, SETTLE_MS);
}

const resumed = ref(0);
watch([reminders.settings, store.data, store.today, place, opinion, locale, resumed], soon, {
  immediate: true,
});

let removeResume: (() => void) | null = null;
onMounted(() => {
  void parcoursReminderService.migrateServerReminder();
  import("@capacitor/app")
    .then(({ App }) => App.addListener("resume", () => resumed.value++))
    .then((handle) => (removeResume = () => void handle.remove()))
    .catch(() => {});
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  removeResume?.();
});
</script>

<template>
  <span hidden />
</template>
