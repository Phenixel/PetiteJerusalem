<script setup lang="ts">
/**
 * Les réglages d'un objectif qui n'est pas un programme : une habitude (son
 * nom, ses jours, son moment), une lecture du calendrier ou un texte du jour
 * (son moment, ses jours). Tout s'enregistre au fil des touches : un réglage
 * se refait d'un geste, il ne se valide pas.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import type { MomentId, Objective } from "../../services/parcours/model";
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

const name = computed({
  get: () => (props.objective.kind === "habit" ? props.objective.name : ""),
  set: (value: string) => save({ name: value.slice(0, 60) } as Partial<Objective>),
});
</script>

<template>
  <div class="space-y-7">
    <label v-if="objective.kind === 'habit'" class="block">
      <span class="text-sm font-bold">{{ t("parcours.form.name") }}</span>
      <input
        class="field mt-2"
        :value="name"
        :placeholder="t(`parcours.habits.${objective.preset}`)"
        maxlength="60"
        @change="name = ($event.target as HTMLInputElement).value"
      />
    </label>

    <section v-if="'days' in objective">
      <h2 class="text-sm font-bold">{{ t("parcours.form.days") }}</h2>
      <DaysPicker v-model="days" class="mt-2" />
      <p class="mt-2 text-[13px] text-text-secondary">{{ t("parcours.form.daysHint") }}</p>
    </section>

    <section>
      <h2 class="text-sm font-bold">{{ t("parcours.form.moment") }}</h2>
      <MomentPicker v-model="moment" class="mt-2" />
    </section>

    <ObjectivePauseRemove :objective="objective" />
  </div>
</template>
