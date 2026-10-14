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
 *
 * Un volume qu'on vient de créer (`arriving`) tombe sur sa planche, rebondit
 * un peu, et soulève une poussière dorée : il est arrivé.
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

const props = withDefaults(
  defineProps<{
    home?: boolean;
    /** L'objectif qu'on vient de créer : son volume arrive sous les yeux. */
    arriving?: string | null;
  }>(),
  { home: false, arriving: null },
);

/** La poussière dorée du volume qui se pose : six grains, en éventail. */
const SPECKS = [-68, -40, -14, 14, 40, 68];
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

/** Un volume arrive sur cette étagère (une habitude arrive ailleurs). */
const receiving = computed(() =>
  volumes.value.some((volume) => volume.objective.id === props.arriving),
);
</script>

<template>
  <div class="volume-shelf" :class="{ 'is-receiving': receiving }">
    <div class="shelf-row">
      <RouterLink
        v-for="volume in volumes"
        :key="volume.objective.id"
        :to="`/parcours/objectif/${volume.objective.id}`"
        class="shelf-cell press-feedback"
        :class="{ 'is-arriving': volume.objective.id === arriving }"
        :data-arriving="volume.objective.id === arriving ? '' : undefined"
        :aria-label="volume.label"
        @click="emit('open', volume.objective)"
      >
        <span class="shelf-slot">
          <span v-if="volume.objective.id === arriving" class="shelf-specks" aria-hidden="true">
            <i v-for="angle in SPECKS" :key="angle" :style="{ '--angle': `${angle}deg` }" />
          </span>
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

/*
 * Le volume qu'on vient de créer : il tombe sur la planche en accélérant,
 * rebondit deux fois, et soulève une poussière dorée (le liseré des
 * reliures) ; sa ligne vient ensuite. Le délai laisse la page glisser
 * jusqu'à lui.
 */
.shelf-cell.is-arriving {
  --arrive-delay: 0.45s;
}
/*
 * Le défilement de l'étagère la coupe en haut : de la place pour la chute,
 * que le doigt traverse jusqu'à ce qui est dessous.
 */
.volume-shelf.is-receiving {
  padding-top: 120px;
  margin-top: -120px;
  pointer-events: none;
}
.is-receiving .shelf-cell {
  pointer-events: auto;
}
.is-arriving .shelf-slot > :deep(svg) {
  transform-origin: 50% 100%;
  animation: volume-lands 0.95s var(--arrive-delay) backwards;
}
.is-arriving .shelf-caption {
  animation: caption-comes 0.35s ease-out calc(var(--arrive-delay) + 0.75s) backwards;
}
.shelf-specks {
  position: absolute;
  inset-inline-start: 50%;
  bottom: 0;
  z-index: 2;
}
.shelf-specks i {
  position: absolute;
  bottom: 0;
  left: -2.5px;
  width: 5px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: #e2c06a;
  opacity: 0;
  transform-origin: 50% 100%;
  animation: speck-flies 0.6s ease-out calc(var(--arrive-delay) + 0.48s) forwards;
}
@keyframes volume-lands {
  0% {
    opacity: 0;
    transform: translateY(-110px) rotate(-7deg);
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.55);
  }
  12% {
    opacity: 1;
  }
  52% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0.45, 0.55, 1);
  }
  66% {
    transform: translateY(-14px) rotate(2deg);
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.55);
  }
  78% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0.45, 0.55, 1);
  }
  88% {
    transform: translateY(-4px);
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.55);
  }
  100% {
    transform: none;
  }
}
@keyframes speck-flies {
  0% {
    opacity: 1;
    transform: rotate(var(--angle)) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-34px) scale(0.4);
  }
}
@keyframes caption-comes {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-arriving .shelf-slot > :deep(svg),
  .is-arriving .shelf-caption {
    animation: none;
  }
  .shelf-specks {
    display: none;
  }
}
</style>
