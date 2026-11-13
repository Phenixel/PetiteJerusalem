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
 * L'étagère défile au doigt quand elle se remplit, plutôt que de rapetisser
 * ses volumes : un titre de couverture doit se lire. À la souris, elle ne
 * défile pas (tout le monde n'a pas de pavé tactile) : les volumes passent
 * sur une planche de plus, comme dans une bibliothèque.
 *
 * Sur l'accueil, toucher un volume ouvre ce qu'il y a à lire aujourd'hui,
 * à l'endroit où l'on en est (`readRoute`) ; un appui long, ou le clic
 * droit, ouvre sa page et ses réglages. Dans Mon parcours, le volume ouvre
 * sa page, qui commence par « Lire ».
 *
 * Un volume en pause pâlit et porte une pastille « En pause » : on le voit
 * sur l'étagère, pas seulement dans ses réglages.
 *
 * Les textes du jour (un psaume, une page qu'on aime, autant qu'on veut)
 * font un seul volume, « Lecture du jour » (« Mes Tehilim journaliers » quand
 * ce ne sont que des psaumes, voir dailyName), qui ouvre leur page : on les y
 * lit à la suite, on en ajoute, on en retire. Son liseré se remplit des
 * textes lus aujourd'hui.
 *
 * Un volume qu'on vient de créer (`arriving`) tombe sur sa planche, rebondit
 * un peu, et soulève une poussière dorée : il est arrivé.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { useLongPress } from "../../composables/useLongPress";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { tehilimOfCycle } from "../../services/dailyCycles";
import { localDayFrom } from "../../services/dateService";
import type { Objective, ProgramObjective, TextObjective } from "../../services/parcours/model";
import { liveObjectives, taskProgress, type Task } from "../../services/parcours/schedule";
import { placeOf, unitLabel } from "../../services/parcours/texts";
import AppIcon from "../icons/AppIcon.vue";
import ProgramVolume, { type VolumeFormat } from "./ProgramVolume.vue";

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

/** La page des textes du jour : les lire, en ajouter, en retirer. */
const DAILY_PAGE = "/bibliotheque/lecture-du-jour";

const { t, locale } = useI18n();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();

const pagePath = (objective: Objective): string => `/parcours/objectif/${objective.id}`;

/** Où mène un volume : sur l'accueil, la lecture du jour ; sinon (ou rien à lire), sa page. */
const targetOf = (objective: Objective) =>
  (props.home ? views.readRoute(objective, store.today.value) : null) ?? pagePath(objective);

// Sur l'accueil, l'appui long (au doigt) ou le clic droit ouvre la page du
// volume. Sur Android, l'appui long donne aussi un clic droit : une seule fois.
let pressed: string | null = null;
let openedAt = 0;
function openPage(page: string | null): void {
  if (!page || Date.now() - openedAt < 800) return;
  openedAt = Date.now();
  void router.push(page);
}
const press = useLongPress(
  (target) => {
    pressed = target.closest<HTMLElement>("[data-page]")?.dataset.page ?? null;
    return pressed !== null;
  },
  () => openPage(pressed),
);
function onContextmenu(event: MouseEvent, page: string): void {
  if (!props.home) return;
  event.preventDefault();
  openPage(page);
}

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

/** Un volume de l'étagère : celui d'un objectif, ou celui des textes du jour. */
interface ShelfVolume {
  key: string;
  /** Où le toucher mène ; `page`, où mènent l'appui long et le clic droit. */
  to: RouteLocationRaw;
  page: string;
  color: string;
  lines: string[];
  sub: string;
  format: VolumeFormat;
  progress: number;
  caption: string;
  ribbon: boolean;
  paused: boolean;
  label: string;
  arriving: boolean;
}

function objectiveVolume(objective: Objective): ShelfVolume {
  const task = taskOf(objective);
  const paused = objective.pausedFrom !== undefined && objective.pausedFrom <= store.today.value;
  const text = paused ? t("parcours.paused.title") : caption(objective);
  return {
    key: objective.id,
    to: targetOf(objective),
    page: pagePath(objective),
    ...views.volumeOf(objective),
    progress: objective.kind === "program" ? programState(objective).progress : 0,
    caption: text,
    ribbon: !paused && task !== undefined && !isDone(task),
    paused,
    label: `${views.objectiveTitle(objective)}, ${text}`,
    arriving: objective.id === props.arriving,
  };
}

/** Les textes du jour, un seul volume : son épaisseur dit combien il en tient. */
function dailyVolume(texts: TextObjective[]): ShelfVolume {
  const tasks = texts.map(taskOf).filter((task): task is Task => task !== undefined);
  const done = tasks.filter(isDone).length;
  const name = views.dailyName(texts.map((objective) => objective.textId));
  const text =
    props.home && tasks.length
      ? t("parcours.shelf.of", { n: done, total: tasks.length })
      : name.count(texts.length);
  return {
    key: "lecture-du-jour",
    to: DAILY_PAGE,
    page: DAILY_PAGE,
    color: views.objectiveColor(texts[0]),
    lines: [name.cover],
    sub: t("parcours.task.everyDay"),
    format: texts.length >= 7 ? "thick" : texts.length >= 3 ? "regular" : "small",
    progress: tasks.length ? done / tasks.length : 0,
    caption: text,
    ribbon: done < tasks.length,
    paused: false,
    label: `${name.title}, ${text}`,
    arriving: texts.some((objective) => objective.id === props.arriving),
  };
}

const volumes = computed<ShelfVolume[]>(() => {
  const read = liveObjectives(store.data.value).filter(
    (o) => o.kind === "program" || o.kind === "cycle" || o.kind === "text",
  );
  const texts = read.filter((o): o is TextObjective => o.kind === "text");
  const out: ShelfVolume[] = [];
  for (const objective of read) {
    if (objective.kind !== "text") out.push(objectiveVolume(objective));
    // Le volume des textes du jour, à la place du premier d'entre eux.
    else if (objective === texts[0]) out.push(dailyVolume(texts));
  }
  return out;
});

/** Un volume arrive sur cette étagère (une habitude arrive ailleurs). */
const receiving = computed(() => volumes.value.some((volume) => volume.arriving));
</script>

<template>
  <div class="volume-shelf" :class="{ 'is-receiving': receiving }">
    <div class="shelf-row" v-bind="home ? press : {}">
      <RouterLink
        v-for="volume in volumes"
        :key="volume.key"
        :to="volume.to"
        class="shelf-cell press-feedback"
        :class="{ 'is-arriving': volume.arriving, 'is-paused': volume.paused }"
        :data-arriving="volume.arriving ? '' : undefined"
        :data-page="volume.page"
        :aria-label="volume.label"
        @contextmenu="onContextmenu($event, volume.page)"
      >
        <span class="shelf-slot">
          <span v-if="volume.arriving" class="shelf-specks" aria-hidden="true">
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
          <span v-if="volume.paused" class="shelf-paused" aria-hidden="true">
            <AppIcon name="pause" class="size-3.5" />
            {{ t("parcours.paused.title") }}
          </span>
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
.shelf-slot > :deep(svg) {
  margin-bottom: -16px;
}
/* En pause : le volume pâlit, et la pastille le dit sur sa couverture. */
.is-paused .shelf-slot > :deep(svg) {
  opacity: 0.45;
  filter: saturate(0.2);
}
.shelf-paused {
  position: absolute;
  inset-inline-start: 50%;
  bottom: 34px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px 4px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  transform: translateX(-50%);
}
[dir="rtl"] .shelf-paused {
  transform: translateX(50%);
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
/*
 * À la souris, plusieurs planches : une grille de rangées de même hauteur,
 * chacune avec sa planche peinte en travers sur toute la largeur.
 */
@media (hover: hover) and (pointer: fine) {
  .volume-shelf {
    --row: 186px;
    --row-gap: 18px;
    --plank: #b59a70;
    overflow-x: visible;
  }
  :root.dark .volume-shelf {
    --plank: #7c654a;
  }
  .shelf-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    grid-auto-rows: var(--row);
    justify-items: center;
    gap: var(--row-gap) 14px;
    width: auto;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0 124px,
      var(--plank) 124px 133px,
      rgb(58 46 30 / 0.12) 133px 137px,
      transparent 137px calc(var(--row) + var(--row-gap))
    );
  }
  .shelf-row::after {
    display: none;
  }
  .shelf-plank {
    visibility: hidden;
  }
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
