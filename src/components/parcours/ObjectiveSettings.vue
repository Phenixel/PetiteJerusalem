<script setup lang="ts">
/**
 * Les réglages d'un objectif qui n'est pas un programme : une habitude (son
 * nom, ses jours, son repère sur le fil du jour, comme à sa création,
 * P2-Habitude), une lecture du calendrier ou un texte du jour (son moment,
 * ses jours ; pour la paracha, toute la semaine ou une montée par jour).
 * Tout s'enregistre au fil des touches : un réglage se refait
 * d'un geste, il ne se valide pas.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import {
  ANCHOR_MOMENT,
  type HabitAnchor,
  type MomentId,
  type Objective,
} from "../../services/parcours/model";
import ToggleSwitch from "../ToggleSwitch.vue";
import StepHabit from "./create/StepHabit.vue";
import ObjectivePauseRemove from "./ObjectivePauseRemove.vue";
import DaysPicker from "./pickers/DaysPicker.vue";
import MomentPicker from "./pickers/MomentPicker.vue";

const props = defineProps<{ objective: Objective }>();

const { t } = useI18n();
const store = useParcours();

function save(change: Partial<Objective>): void {
  store.saveObjective({ ...props.objective, ...change } as Objective);
}

const moment = computed({
  get: () => props.objective.moment,
  set: (value: MomentId) => save({ moment: value }),
});

const days = computed({
  get: () => ("days" in props.objective ? props.objective.days : []),
  set: (value: number[]) => save({ days: value } as Partial<Objective>),
});

const anchor = computed({
  get: () => (props.objective.kind === "habit" ? (props.objective.anchor ?? null) : null),
  set: (value: HabitAnchor | null) => {
    if (props.objective.kind !== "habit") return;
    // Le repère porte aussi le moment : écrit en dernier, il fait foi.
    const next = { ...props.objective, moment: value ? ANCHOR_MOMENT[value] : "anytime" };
    if (value) next.anchor = value;
    else delete next.anchor;
    store.saveObjective(next);
  },
});

/** La paracha : une montée par jour (aliyot.ts), ou toute la semaine. */
const byAliya = computed({
  get: () => props.objective.kind === "cycle" && props.objective.split === "aliyot",
  set: (on: boolean) => {
    if (props.objective.kind !== "cycle") return;
    const next = { ...props.objective };
    if (on) next.split = "aliyot";
    else delete next.split;
    store.saveObjective(next);
  },
});

const name = computed({
  get: () => (props.objective.kind === "habit" ? props.objective.name : ""),
  set: (value: string) => save({ name: value.slice(0, 60) } as Partial<Objective>),
});
</script>

<template>
  <div v-if="objective.kind === 'habit'" class="space-y-7">
    <StepHabit
      v-model:name="name"
      v-model:days="days"
      v-model:moment="moment"
      v-model:anchor="anchor"
      :preset="objective.preset"
      editing
    />
    <ObjectivePauseRemove :objective="objective" />
  </div>
  <div v-else class="space-y-7">
    <section v-if="'days' in objective">
      <h2 class="text-sm font-bold">{{ t("parcours.form.days") }}</h2>
      <DaysPicker v-model="days" class="mt-2" />
      <p class="mt-2 text-[13px] text-text-secondary">{{ t("parcours.form.daysHint") }}</p>
    </section>

    <label
      v-if="objective.kind === 'cycle' && objective.cycle === 'parasha'"
      class="card flex cursor-pointer items-center gap-3 px-4 py-3"
    >
      <span class="flex-1">
        <span class="block text-[15px] font-bold">{{ t("parcours.settings.byAliya") }}</span>
        <span class="block text-[13px] text-text-secondary">{{
          t("parcours.settings.byAliyaHint")
        }}</span>
      </span>
      <ToggleSwitch v-model="byAliya" />
    </label>

    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.moment") }}</h2>
      <MomentPicker v-model="moment" class="mt-2" />
    </section>

    <ObjectivePauseRemove :objective="objective" />
  </div>
</template>
