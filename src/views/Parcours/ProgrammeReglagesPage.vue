<script setup lang="ts">
/**
 * Modifier un programme : sa date de fin, son rythme, son moment. Changer la
 * date ou le rythme repart d'aujourd'hui, à la position atteinte : le pas se
 * recalcule sur ce qui reste. Mettre en pause garde tout ; retirer se
 * confirme.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "../../components/icons/AppIcon.vue";
import ObjectivePauseRemove from "../../components/parcours/ObjectivePauseRemove.vue";
import EndDatePicker from "../../components/parcours/pickers/EndDatePicker.vue";
import MomentPicker from "../../components/parcours/pickers/MomentPicker.vue";
import RhythmPicker from "../../components/parcours/pickers/RhythmPicker.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import type { DayKey, MomentId, ProgramObjective, Rhythm } from "../../services/parcours/model";
import { rebase } from "../../services/parcours/plan";

useParcoursMeta("parcours.settings.title", "/parcours");

const { t } = useI18n();
const route = useRoute();
const store = useParcours();
const views = useParcoursViews();

const program = computed<ProgramObjective | null>(() => {
  const found = store.data.value.objectives[String(route.params.id)];
  return found?.kind === "program" && found.deletedAt === undefined ? found : null;
});

const position = computed(() =>
  program.value
    ? (store.context.value.plans.get(program.value.id)?.positionAt(store.today.value) ?? 0)
    : 0,
);

function change(next: Partial<Pick<ProgramObjective, "end" | "rhythm">>): void {
  const p = program.value;
  if (!p) return;
  store.saveObjective(
    rebase(p, next, store.today.value, store.data.value.days, store.isRest.value),
  );
  analyticsService.capture("parcours_program_updated", { field: Object.keys(next)[0] });
}

const end = computed({
  get: () => program.value?.end ?? store.today.value,
  set: (value: DayKey) => change({ end: value }),
});
const rhythm = computed({
  get: () => program.value?.rhythm ?? "daily",
  set: (value: Rhythm) => change({ rhythm: value }),
});
const moment = computed({
  get: () => program.value?.moment ?? "evening",
  set: (value: MomentId) => {
    if (program.value) store.saveObjective({ ...program.value, moment: value });
  },
});
const paces = computed(() =>
  program.value
    ? views.paceLabels(
        program.value.corpus,
        program.value.total - position.value,
        store.today.value,
        end.value,
      )
    : { daily: "", weekdays: "", weekly: "" },
);

function forgetAutoCatchUp(): void {
  const p = program.value;
  if (!p) return;
  const next = { ...p };
  delete next.autoCatchUp;
  store.saveObjective(next);
}
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-12">
    <RouterLink
      :to="program ? `/parcours/objectif/${program.id}` : '/parcours'"
      class="back-link mb-4"
    >
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ program ? views.objectiveTitle(program) : t("parcours.title") }}
    </RouterLink>
    <h1 class="text-center font-display text-3xl font-bold">{{ t("parcours.settings.title") }}</h1>

    <p v-if="!program" class="mt-16 text-center text-text-secondary">
      {{ t("parcours.objective.missing") }}
    </p>
    <div v-else class="mt-8 space-y-8">
      <section>
        <h2 class="text-sm font-bold">{{ t("parcours.form.end") }}</h2>
        <EndDatePicker v-model="end" class="mt-2" :today="store.today.value" />
      </section>
      <section>
        <h2 class="text-sm font-bold">{{ t("parcours.form.rhythm") }}</h2>
        <RhythmPicker v-model="rhythm" class="mt-2" :paces="paces" />
        <p class="mt-2 text-[13px] text-text-secondary">{{ t("parcours.settings.rebaseHint") }}</p>
      </section>
      <section>
        <h2 class="text-sm font-bold">{{ t("parcours.form.moment") }}</h2>
        <MomentPicker v-model="moment" class="mt-2" />
      </section>
      <div v-if="program.autoCatchUp" class="card flex items-center gap-3 px-4 py-3">
        <span class="flex-1">
          <span class="block text-[15px] font-bold">{{ t("parcours.settings.autoCatchUp") }}</span>
          <span class="block text-[13px] text-text-secondary">
            {{ t(`parcours.catchUp.options.${program.autoCatchUp}`) }}
          </span>
        </span>
        <button type="button" class="btn btn-soft btn-sm" @click="forgetAutoCatchUp">
          {{ t("parcours.settings.forget") }}
        </button>
      </div>
      <ObjectivePauseRemove :objective="program" />
    </div>
  </main>
</template>
