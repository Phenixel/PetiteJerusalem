<script setup lang="ts">
/**
 * Rattraper : le retard d'un programme, et cinq façons de le reprendre. On
 * voit la semaine changer à chaque choix avant de l'appliquer ; rien ne
 * presse, et rien ne se décide sans la personne, sauf si elle a demandé de
 * faire ainsi à chaque fois.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useProgramWeek } from "../../composables/useProgramWeek";
import { analyticsService } from "../../services/analyticsService";
import {
  CATCH_UP_OPTIONS,
  type CatchUpOption,
  type ProgramObjective,
} from "../../services/parcours/model";
import { applyCatchUp, programPlan } from "../../services/parcours/plan";
import { unitOf } from "../../services/parcours/texts";
import AppModal from "../AppModal.vue";
import ToggleSwitch from "../ToggleSwitch.vue";
import ChoicePill from "./pickers/ChoicePill.vue";
import WeekBars from "./WeekBars.vue";

const props = defineProps<{ open: boolean; program: ProgramObjective }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const week = useProgramWeek();

const choice = ref<CatchUpOption>("week");
const remember = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    choice.value = props.program.autoCatchUp ?? "week";
    remember.value = props.program.autoCatchUp !== undefined;
  },
);

const behind = computed(
  () =>
    programPlan(props.program, store.data.value.days, store.isRest.value).state(store.today.value)
      .behind,
);
const unit = computed(() => unitOf(props.program.corpus));

/** Le programme tel qu'il serait avec ce choix : de quoi dessiner la semaine. */
const preview = computed(() =>
  applyCatchUp(
    props.program,
    choice.value,
    store.today.value,
    store.data.value.days,
    store.isRest.value,
  ),
);
const bars = computed(() =>
  week.bars(preview.value, store.data.value.days, store.isRest.value, store.today.value),
);
const result = computed(() => {
  const units = views.unitsLabel(unit.value, behind.value);
  if (choice.value === "pushEnd")
    return t("parcours.catchUp.results.pushEnd", { units, end: views.dayLabel(preview.value.end) });
  return t(`parcours.catchUp.results.${choice.value}`, { units });
});

function apply(): void {
  store.catchUp(props.program, choice.value, remember.value);
  analyticsService.capture("parcours_caught_up", {
    option: choice.value,
    behind: behind.value,
    remember: remember.value,
    source: "objective",
  });
  emit("close");
}
</script>

<template>
  <AppModal :open="open" :label="t('parcours.catchUp.title')" @close="emit('close')">
    <h2 class="font-display text-2xl font-bold">
      {{ t("parcours.catchUp.heading", { units: views.unitsLabel(unit, behind) }) }}
    </h2>
    <p class="mt-1 text-sm text-text-secondary">{{ t("parcours.catchUp.hint") }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <ChoicePill
        v-for="option in CATCH_UP_OPTIONS"
        :key="option"
        :on="choice === option"
        @click="choice = option"
      >
        {{ t(`parcours.catchUp.options.${option}`) }}
      </ChoicePill>
    </div>
    <WeekBars class="mt-6" :bars="bars" :label="t('parcours.program.weekLabel')" />
    <p class="mt-3 min-h-12 text-[15px] leading-relaxed">{{ result }}</p>
    <div class="mt-2 flex items-center gap-3">
      <span class="flex-1 text-sm">{{ t("parcours.catchUp.remember") }}</span>
      <ToggleSwitch v-model="remember" :label="t('parcours.catchUp.remember')" />
    </div>
    <button type="button" class="btn btn-primary mt-5 w-full" @click="apply">
      {{ t("parcours.catchUp.apply") }}
    </button>
  </AppModal>
</template>
