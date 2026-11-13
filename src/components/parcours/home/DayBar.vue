<script setup lang="ts">
/**
 * La barre de la journée, sous le paquet replié (P2-Accueil) : une case par
 * carte du jour, rangées par moment, du matin au coucher. Pleine, c'est
 * fait ; à moitié teintée, la carte du dessus ; grise, ce qui vient. Le
 * compte au bout. La toucher étale toutes les cartes, comme le geste vers le
 * bas.
 *
 * Les cartes en plus (rattraper) n'y sont pas : elles ne comptent pas dans
 * la journée.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { DeckCard } from "../../../composables/useTodayDeck";
import type { MomentId } from "../../../services/parcours/model";

const props = defineProps<{
  day: DeckCard[];
  /** La carte du dessus du paquet. */
  current: string | null;
  count: { done: number; total: number };
}>();
const emit = defineEmits<{ (e: "open"): void }>();

const { t } = useI18n();

const groups = computed(() => {
  const byMoment = new Map<MomentId, { key: string; state: string }[]>();
  for (const card of props.day) {
    if (card.extra) continue;
    const state = card.done ? "is-done" : card.key === props.current ? "is-current" : "";
    const cells = byMoment.get(card.moment) ?? [];
    cells.push({ key: card.key, state });
    byMoment.set(card.moment, cells);
  }
  return [...byMoment.entries()].map(([moment, cells]) => ({ moment, cells }));
});
</script>

<template>
  <button
    type="button"
    class="day-bar"
    :aria-label="t('parcours.hub.dayBar', { done: count.done, total: count.total })"
    @click="emit('open')"
  >
    <span class="flex flex-1 gap-2.5" aria-hidden="true">
      <!-- Un moment prend la place de ses cartes : chaque case a la même largeur. -->
      <span
        v-for="group in groups"
        :key="group.moment"
        class="flex gap-[3px]"
        :style="{ flex: group.cells.length }"
      >
        <span v-for="cell in group.cells" :key="cell.key" class="day-cell" :class="cell.state" />
      </span>
    </span>
    <!-- A full day: « Journée pleine » above says it, not « 5 sur 5 » as well. -->
    <span
      v-if="count.done < count.total"
      class="whitespace-nowrap text-[13px] font-bold tabular-nums"
    >
      {{ t("parcours.hub.count", { done: count.done, total: count.total }) }}
    </span>
  </button>
</template>

<style scoped>
.day-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 14px;
  padding: 8px 0;
  color: var(--color-text-primary);
  cursor: pointer;
}
.day-cell {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  transition: background-color 0.25s ease;
}
.day-cell.is-done {
  background: var(--color-primary);
}
/* La carte du dessus : à moitié teintée, elle est en cours. */
.day-cell.is-current {
  background: color-mix(in srgb, var(--color-primary) 35%, transparent);
}
</style>
