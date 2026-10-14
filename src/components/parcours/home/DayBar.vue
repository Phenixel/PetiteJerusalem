<script setup lang="ts">
/**
 * La barre de la journée, sous le paquet : une case par carte du jour,
 * rangées par moment, du matin au coucher. Pleine, c'est fait ; à moitié
 * teintée, la carte du dessus ; grise, ce qui vient ; à peine marquée, ce
 * qu'on a mis de côté aujourd'hui. Le compte au bout.
 *
 * À plat, comme tout ce qui n'est pas le mur (docs/design.md).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskView } from "../../../composables/useParcoursViews";
import type { MomentId } from "../../../services/parcours/model";

const props = defineProps<{ views: TaskView[]; current: string | null }>();

const { t } = useI18n();

type CellState = "done" | "current" | "coming" | "skipped";

const groups = computed(() => {
  const byMoment = new Map<MomentId, { key: string; state: CellState }[]>();
  for (const view of props.views) {
    const state: CellState =
      view.progress === "done"
        ? "done"
        : view.key === props.current
          ? "current"
          : view.skipped
            ? "skipped"
            : "coming";
    const cells = byMoment.get(view.task.moment) ?? [];
    cells.push({ key: view.key, state });
    byMoment.set(view.task.moment, cells);
  }
  return [...byMoment.entries()].map(([moment, cells]) => ({ moment, cells }));
});

const done = computed(() => props.views.filter((view) => view.progress === "done").length);
</script>

<template>
  <div
    v-if="views.length"
    class="flex items-center gap-3"
    role="img"
    :aria-label="t('parcours.hub.dayBar', { done, total: views.length })"
  >
    <div class="flex min-w-0 flex-1 gap-2">
      <!-- Un moment prend la place de ses cartes : chaque case a la même largeur. -->
      <div
        v-for="group in groups"
        :key="group.moment"
        class="flex basis-0 gap-[3px]"
        :style="{ flexGrow: group.cells.length }"
      >
        <span
          v-for="cell in group.cells"
          :key="cell.key"
          class="day-cell"
          :class="`is-${cell.state}`"
        />
      </div>
    </div>
    <span class="flex-none text-[13px] font-bold tabular-nums text-text-secondary">
      {{ t("parcours.day.count", { done, total: views.length }) }}
    </span>
  </div>
</template>

<style scoped>
.day-cell {
  flex: 1;
  height: 8px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}
.day-cell.is-done {
  background: var(--color-brand);
}
/* La carte du dessus : à moitié teintée, elle est en cours. */
.day-cell.is-current {
  background: color-mix(in srgb, var(--color-brand) 45%, transparent);
}
.day-cell.is-skipped {
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
}
</style>
