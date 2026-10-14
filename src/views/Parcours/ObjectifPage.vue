<script setup lang="ts">
/**
 * Un objectif ouvert. Un programme y dit où l'on en est et ce qu'il y a à
 * lire : au jour (P2-Programme), le volume en grand, la piste de l'année, la
 * portion du jour ; à la semaine (P2-Semaine), la semaine où l'on en est, sa
 * carte et ses cases. Ses réglages sont à côté (« Modifier »), la feuille
 * « Rattraper » s'ouvre d'ici.
 *
 * Une habitude, une lecture du calendrier, un texte du jour s'y règlent
 * directement.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import CatchUpSheet from "../../components/parcours/CatchUpSheet.vue";
import ObjectiveSettings from "../../components/parcours/ObjectiveSettings.vue";
import ObjectiveTodayCard from "../../components/parcours/ObjectiveTodayCard.vue";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
import PausedNotice from "../../components/parcours/PausedNotice.vue";
import ProgramDaily from "../../components/parcours/ProgramDaily.vue";
import ProgramWeekly from "../../components/parcours/ProgramWeekly.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { ProgramObjective } from "../../services/parcours/model";

useParcoursMeta("parcours.objective.title", "/parcours");

const { t } = useI18n();
const route = useRoute();
const store = useParcours();
const views = useParcoursViews();

const objective = computed(() => {
  const found = store.data.value.objectives[String(route.params.id)];
  return found && found.deletedAt === undefined ? found : null;
});
const program = computed<ProgramObjective | null>(() =>
  objective.value?.kind === "program" ? objective.value : null,
);
const title = computed(() => (objective.value ? views.objectiveTitle(objective.value) : ""));

const finished = computed(() => {
  const p = program.value;
  if (!p) return false;
  const position = store.context.value.plans.get(p.id)?.positionAt(store.today.value) ?? 0;
  return position >= p.total;
});

// La carte « Rattraper » de l'accueil arrive ici la feuille ouverte (?rattraper=1).
const catchingUp = ref(route.query.rattraper === "1");
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 pb-10 pt-[18px] md:px-6 md:py-12">
    <div class="flex items-center justify-between">
      <ParcoursBack to="/parcours" :label="t('parcours.title')" />
      <RouterLink
        v-if="program"
        :to="`/parcours/objectif/${program.id}/reglages`"
        class="btn btn-soft edit-btn"
      >
        {{ t("common.edit") }}
      </RouterLink>
    </div>

    <!-- En pause : dit en tête, avec « Reprendre », pas seulement dans les réglages. -->
    <PausedNotice v-if="objective" class="mt-5" :objective="objective" />

    <p v-if="!objective" class="mt-16 text-center text-text-secondary">
      {{ t("parcours.objective.missing") }}
    </p>

    <template v-else-if="program">
      <!-- Fini : le siyoum. -->
      <section v-if="finished" class="card mt-8 px-5 py-6 text-center">
        <p class="font-display text-2xl font-bold">{{ t("parcours.program.finishedTitle") }}</p>
        <p class="mt-2 text-text-secondary">{{ t("parcours.program.finishedText") }}</p>
        <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">{{
          t("parcours.links.new")
        }}</RouterLink>
      </section>
      <ProgramWeekly
        v-else-if="program.rhythm === 'weekly'"
        :program="program"
        @catch-up="catchingUp = true"
      />
      <ProgramDaily v-else :program="program" @catch-up="catchingUp = true" />

      <CatchUpSheet :open="catchingUp" :program="program" @close="catchingUp = false" />
    </template>

    <!-- Une lecture : ce qu'il y a à lire aujourd'hui, et « Lire », puis ses réglages. -->
    <template v-else>
      <h1 class="mt-6 text-center font-display text-3xl font-bold">{{ title }}</h1>
      <ObjectiveTodayCard
        v-if="objective.kind === 'cycle' || objective.kind === 'text'"
        class="mt-6"
        :objective="objective"
      />
      <ObjectiveSettings class="mt-8" :objective="objective" />
    </template>
  </main>
</template>

<style scoped>
.edit-btn {
  min-height: 38px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
}
</style>
