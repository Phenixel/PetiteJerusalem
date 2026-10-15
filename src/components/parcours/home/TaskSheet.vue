<script setup lang="ts">
/**
 * La fiche d'une carte (P2-Accueil) : une feuille qui monte du bas, à
 * l'appui long sur la carte, ou au toucher d'une carte qui n'a pas de page à
 * ouvrir. Chaque geste y a son bouton, pour qui ne glisse pas : c'est fait,
 * l'ouvrir, plus tard, pas aujourd'hui ; et le programme qu'elle sert.
 */
import { useI18n } from "vue-i18n";
import type { DeckCard } from "../../../composables/useTodayDeck";
import BottomSheet from "../BottomSheet.vue";

defineProps<{ card: DeckCard | null }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "done"): void;
  (e: "undo"): void;
  (e: "later"): void;
  (e: "skip", skipped: boolean): void;
  (e: "opened"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <BottomSheet :open="card !== null" :label="card?.title" @close="emit('close')">
    <template v-if="card">
      <p class="text-[13px] font-semibold text-text-secondary">
        {{ card.done ? card.doneKicker : card.kicker }}
      </p>
      <p class="mt-1 text-2xl font-extrabold">{{ card.title }}</p>
      <p v-if="card.meta" class="mt-1 text-[15px] text-text-secondary">{{ card.meta }}</p>

      <div class="mt-[18px] grid grid-cols-2 gap-2">
        <button v-if="card.done" type="button" class="btn btn-soft sheet-btn" @click="emit('undo')">
          {{ t("parcours.hub.undo") }}
        </button>
        <button v-else type="button" class="btn btn-primary sheet-btn" @click="emit('done')">
          {{ t("parcours.hub.done") }}
        </button>
        <RouterLink
          v-if="card.route"
          :to="card.route"
          class="btn btn-soft sheet-btn"
          @click="emit('opened')"
        >
          {{ t("parcours.hub.open") }}
        </RouterLink>
        <button
          v-if="!card.done && !card.skipped"
          type="button"
          class="btn btn-soft sheet-btn"
          @click="emit('later')"
        >
          {{ t("parcours.hub.later") }}
        </button>
        <button
          v-if="!card.done"
          type="button"
          class="btn btn-soft sheet-btn"
          @click="emit('skip', !card.skipped)"
        >
          {{ card.skipped ? t("parcours.hub.unskip") : t("parcours.hub.skip") }}
        </button>
      </div>
      <RouterLink
        v-if="card.programId"
        :to="`/parcours/objectif/${card.programId}`"
        class="mt-4 block text-center text-sm font-bold text-primary"
        @click="emit('close')"
      >
        {{ t("parcours.hub.program") }}
      </RouterLink>
    </template>
  </BottomSheet>
</template>

<style scoped>
/* Les boutons de la fiche : la mesure de la maquette, deux par ligne. */
.sheet-btn {
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
</style>
