<script setup lang="ts">
/**
 * La fiche d'une carte, à l'appui long (ou au toucher, pour une carte qui
 * n'a pas de page à ouvrir) : ce qu'on peut en faire d'autre que l'ouvrir.
 * Cocher ou décocher, la remettre à plus tard (dans le paquet), « Pas
 * aujourd'hui », ouvrir sa page, voir l'objectif.
 */
import { useI18n } from "vue-i18n";
import type { TaskView } from "../../../composables/useParcoursViews";
import AppModal from "../../AppModal.vue";

defineProps<{ view: TaskView | null; canPostpone: boolean }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "done", done: boolean): void;
  (e: "later"): void;
  (e: "skip", skipped: boolean): void;
}>();

const { t } = useI18n();
</script>

<template>
  <AppModal :open="view !== null" :label="view?.title" @close="emit('close')">
    <template v-if="view">
      <p class="text-center text-sm font-semibold text-primary">{{ view.kicker }}</p>
      <h2 class="mt-1 text-center font-display text-2xl font-bold">{{ view.title }}</h2>
      <p v-if="view.meta" class="mt-1 text-center text-sm text-text-secondary">{{ view.meta }}</p>

      <div class="mt-6 flex flex-col gap-2">
        <button
          type="button"
          class="btn"
          :class="view.progress === 'done' ? 'btn-soft' : 'btn-primary'"
          @click="emit('done', view.progress !== 'done')"
        >
          {{ view.progress === "done" ? t("parcours.row.undo") : t("parcours.hub.done") }}
        </button>
        <button v-if="canPostpone" type="button" class="btn btn-soft" @click="emit('later')">
          {{ t("parcours.hub.later") }}
        </button>
        <button type="button" class="btn btn-soft" @click="emit('skip', !view.skipped)">
          {{ view.skipped ? t("parcours.hub.unskip") : t("parcours.row.skip") }}
        </button>
        <RouterLink v-if="view.route" :to="view.route" class="btn btn-soft" @click="emit('close')">
          {{ t("parcours.hub.open") }}
        </RouterLink>
        <RouterLink
          :to="`/parcours/objectif/${view.objective.id}`"
          class="py-2 text-center text-sm font-bold text-primary"
          @click="emit('close')"
        >
          {{ t("parcours.hub.objective") }}
        </RouterLink>
      </div>
    </template>
  </AppModal>
</template>
