<script setup lang="ts">
/**
 * L'étagère de Mon parcours : un volume par objectif qui se lit (un
 * programme, une lecture du calendrier, un texte du jour), posés sur une
 * planche, avec sous chacun où l'on en est. Les habitudes n'y sont pas : ce
 * ne sont pas des livres. Le dernier emplacement propose un volume de plus.
 *
 * L'étagère défile quand elle se remplit, plutôt que de rapetisser ses
 * volumes : un titre de couverture doit se lire.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { Objective, ProgramObjective } from "../../services/parcours/model";
import { liveObjectives } from "../../services/parcours/schedule";
import { unitOf } from "../../services/parcours/texts";
import ProgramVolume from "./ProgramVolume.vue";

const emit = defineEmits<{ (e: "open", objective: Objective): void }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

function programCaption(objective: ProgramObjective): { progress: number; caption: string } {
  const plan = store.context.value.plans.get(objective.id);
  if (!plan) return { progress: 0, caption: "" };
  const today = store.today.value;
  const position = plan.positionAt(today);
  const progress = objective.total > 0 ? position / objective.total : 0;
  const percent = Math.floor(progress * 100);
  if (position >= objective.total) return { progress: 1, caption: t("parcours.shelf.finished") };
  const behind = plan.state(today).behind;
  const state = behind
    ? t("parcours.shelf.behind", { units: views.unitsLabel(unitOf(objective.corpus), behind) })
    : t("parcours.shelf.onTrack");
  return { progress, caption: t("parcours.shelf.caption", { percent, state }) };
}

const volumes = computed(() => {
  const today = store.today.value;
  const pending = new Set(
    store.todayTasks.value
      .filter((task) => views.taskView(task, today).progress !== "done")
      .map((task) => task.objectiveId),
  );
  return liveObjectives(store.data.value)
    .filter((o) => o.kind === "program" || o.kind === "cycle" || o.kind === "text")
    .map((objective) => {
      const { progress, caption } =
        objective.kind === "program"
          ? programCaption(objective)
          : { progress: 0, caption: views.objectiveTitle(objective) };
      return {
        objective,
        ...views.volumeOf(objective),
        progress,
        caption,
        ribbon: pending.has(objective.id),
        label: `${views.objectiveTitle(objective)}, ${caption}`,
      };
    });
});
</script>

<template>
  <div class="volume-shelf">
    <div class="shelf-row">
      <RouterLink
        v-for="volume in volumes"
        :key="volume.objective.id"
        :to="`/parcours/objectif/${volume.objective.id}`"
        class="shelf-cell press-feedback"
        :aria-label="volume.label"
        @click="emit('open', volume.objective)"
      >
        <span class="shelf-slot">
          <ProgramVolume
            :color="volume.color"
            :lines="volume.lines"
            :sub="volume.sub"
            :progress="volume.progress"
            :ribbon="volume.ribbon"
            :format="volume.format"
          />
        </span>
        <span class="shelf-plank" aria-hidden="true" />
        <span class="shelf-caption">{{ volume.caption }}</span>
      </RouterLink>
      <RouterLink to="/parcours/nouveau" class="shelf-cell press-feedback">
        <span class="shelf-slot">
          <span class="shelf-add">
            <span class="font-display text-3xl leading-none text-primary" aria-hidden="true"
              >+</span
            >
            <span class="mt-1.5 text-xs font-bold text-primary">{{ t("parcours.shelf.add") }}</span>
          </span>
        </span>
        <span class="shelf-plank" aria-hidden="true" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
/* L'étagère défile quand elle se remplit. */
.volume-shelf {
  overflow-x: auto;
  scrollbar-width: none;
  margin-inline: -1rem;
  padding-inline: 1rem;
}
.volume-shelf::-webkit-scrollbar {
  display: none;
}
.shelf-row {
  display: flex;
  gap: 14px;
  width: max-content;
  min-width: 100%;
  padding-inline: 10px;
}
.shelf-row::after {
  /* La planche court jusqu'au bout de la ligne, au-delà du dernier volume. */
  content: "";
  flex: 1;
  align-self: flex-start;
  height: 9px;
  margin-top: 124px;
  margin-inline-start: -7px;
  border-start-end-radius: 3px;
  border-end-end-radius: 3px;
  background: #b59a70;
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}
:root.dark .shelf-row::after {
  background: #7c654a;
}
.shelf-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 104px;
}
/* La place du plus grand volume : tous se posent sur la même planche. */
.shelf-slot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  height: 124px;
}
/* Le bas du dessin garde la place du signet : il pend devant la planche. */
.shelf-slot :deep(svg) {
  margin-bottom: -16px;
}
.shelf-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 104px;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  text-align: center;
}
/* Un segment de planche par volume, qui déborde sur l'écart : ils se touchent. */
.shelf-plank {
  align-self: stretch;
  height: 9px;
  margin-inline: -7px;
  background: #b59a70;
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}
.shelf-cell:first-child .shelf-plank {
  margin-inline-start: -10px;
  border-start-start-radius: 3px;
  border-end-start-radius: 3px;
}
:root.dark .shelf-plank {
  background: #7c654a;
}
.shelf-caption {
  padding-top: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-secondary);
}
</style>
