<script setup lang="ts">
/**
 * L'étagère de Mon parcours : un volume par objectif qui se lit (un
 * programme, une lecture du calendrier, un texte du jour), posés sur une
 * planche, avec sous chacun où l'on en est. Les habitudes n'y sont pas : ce
 * ne sont pas des livres. Le dernier emplacement propose un volume de plus.
 *
 * Sous un volume, deux façons de dire où l'on en est (P2-Accueil,
 * P2-Parcours). Sur l'accueil, `home` : ce qui attend aujourd'hui et où
 * (« ce soir 7:1 »), ce qui est fait (« fait ce soir »), ou la position
 * (« 72 sur 150 »). Dans Mon parcours : l'avancement et le retard
 * (« 6 % · 9 en retard »).
 *
 * L'étagère défile quand elle se remplit, plutôt que de rapetisser ses
 * volumes : un titre de couverture doit se lire.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { tehilimOfCycle } from "../../services/dailyCycles";
import { localDayFrom } from "../../services/dateService";
import type { Objective, ProgramObjective } from "../../services/parcours/model";
import { liveObjectives, taskProgress, type Task } from "../../services/parcours/schedule";
import { placeOf, unitLabel } from "../../services/parcours/texts";
import ProgramVolume from "./ProgramVolume.vue";

const props = withDefaults(defineProps<{ home?: boolean }>(), { home: false });
const emit = defineEmits<{ (e: "open", objective: Objective): void }>();

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();

/** La tâche d'aujourd'hui d'un objectif, s'il en a une. */
const taskOf = (objective: Objective): Task | undefined =>
  store.todayTasks.value.find((task) => task.objectiveId === objective.id);

const isDone = (task: Task): boolean =>
  taskProgress(store.data.value, task, store.today.value) === "done";

/** « ce soir », « cette semaine » : le moment d'une tâche, dans la phrase. */
const whenOf = (task: Task): string =>
  t(task.weekly ? "parcours.when.weekly" : `parcours.when.${task.moment}`);

function programState(objective: ProgramObjective): { progress: number; position: number } {
  const plan = store.context.value.plans.get(objective.id);
  const position = plan?.positionAt(store.today.value) ?? 0;
  return { position, progress: objective.total > 0 ? position / objective.total : 0 };
}

function programCaption(objective: ProgramObjective): string {
  const { position, progress } = programState(objective);
  if (position >= objective.total) return t("parcours.shelf.finished");
  if (props.home) {
    const task = taskOf(objective);
    if (task && isDone(task)) return t("parcours.shelf.doneWhen", { when: whenOf(task) });
    const place = placeOf(objective.texts, position);
    if (task && place) {
      return t("parcours.shelf.next", {
        when: whenOf(task),
        place: unitLabel(place, locale.value, false),
      });
    }
    return t("parcours.shelf.of", { n: position, total: objective.total });
  }
  const behind = store.context.value.plans.get(objective.id)?.state(store.today.value).behind ?? 0;
  const state = behind ? t("parcours.shelf.behind", { n: behind }) : t("parcours.shelf.onTrack");
  return t("parcours.shelf.caption", { percent: Math.floor(progress * 100), state });
}

/** Les Tehilim du mois ou de la semaine : le dernier psaume lu, sur les 150. */
function tehilimPosition(objective: Objective, cycle: "tehilim-month" | "tehilim-week"): number {
  const date = localDayFrom(store.today.value) ?? new Date();
  date.setHours(12);
  const psalms = tehilimOfCycle(cycle, date).psalms;
  const task = taskOf(objective);
  return task && isDone(task) ? psalms[psalms.length - 1] : psalms[0] - 1;
}

function caption(objective: Objective): string {
  if (objective.kind === "program") return programCaption(objective);
  if (objective.kind === "cycle" && objective.cycle !== "parasha" && props.home) {
    return t("parcours.shelf.of", { n: tehilimPosition(objective, objective.cycle), total: 150 });
  }
  return views.objectiveTitle(objective);
}

const volumes = computed(() =>
  liveObjectives(store.data.value)
    .filter((o) => o.kind === "program" || o.kind === "cycle" || o.kind === "text")
    .map((objective) => {
      const task = taskOf(objective);
      const text = caption(objective);
      return {
        objective,
        ...views.volumeOf(objective),
        progress: objective.kind === "program" ? programState(objective).progress : 0,
        caption: text,
        ribbon: task !== undefined && !isDone(task),
        label: `${views.objectiveTitle(objective)}, ${text}`,
      };
    }),
);
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
