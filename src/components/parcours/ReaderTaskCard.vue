<script setup lang="ts">
/**
 * Au bas d'une lecture ouverte depuis Mon parcours (`?objectif=`), la fin de
 * la portion du jour (P2-Lecteur) : « Fin de la portion du jour », et un
 * anneau qu'on tire vers le haut pour la marquer faite. L'anneau se remplit
 * à mesure qu'on tire ; lâché au bout, la portion est faite, le signet a
 * avancé. « Annuler » la défait. Pour qui ne tire pas, l'anneau est un
 * bouton : Entrée ou Espace font de même.
 *
 * Elle suit la lecture d'un chapitre à l'autre : l'adresse garde l'objectif.
 *
 * Chargée à la demande (voir TextReadingPage) : elle tire le calendrier
 * hébraïque.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { haptic } from "../../services/haptics";
import { addDays } from "../../services/parcours/days";

const props = defineProps<{ objectiveId: string }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

/** Tirée de tant, la portion est faite. */
const PULL = 120;

const task = computed(
  () =>
    store.todayTasks.value.find((candidate) => candidate.objectiveId === props.objectiveId) ?? null,
);
const view = computed(() => (task.value ? views.taskView(task.value, store.today.value) : null));
const done = computed(() => view.value?.progress === "done");

/** La portion suivante : « Demain, 7:4 à 8:1. Le signet a avancé. » */
const next = computed(() => {
  const objective = view.value?.objective;
  if (!objective || objective.kind !== "program") return t("parcours.reader.doneSub");
  for (let i = 1; i <= 14; i++) {
    const day = addDays(store.today.value, i);
    const found = store.tasksOn(day).find((candidate) => candidate.objectiveId === objective.id);
    if (found) {
      return t("parcours.reader.next", { portion: views.portionText(found, objective) });
    }
  }
  return t("parcours.reader.doneSub");
});

const pulling = ref(false);
const dy = ref(0);
let y0 = 0;

const share = computed(() => (done.value ? 1 : Math.max(0, Math.min(1, -dy.value / PULL))));
const coreRadius = computed(() => (done.value ? 26 : Math.round(6 + share.value * 16)));
const label = computed(() => {
  if (done.value) return t("parcours.reader.done");
  return share.value >= 1 ? t("parcours.reader.release") : t("parcours.reader.pull");
});
const sub = computed(() => {
  if (done.value) return next.value;
  return share.value >= 1 ? t("parcours.reader.releaseSub") : t("parcours.reader.pullSub");
});

function markDone(): void {
  if (!task.value || done.value) return;
  haptic("done");
  store.setDone(task.value, store.today.value, true, "reader");
}

function undo(): void {
  if (!task.value) return;
  haptic("undo");
  store.setDone(task.value, store.today.value, false, "reader");
}

// L'anneau plein : lâché maintenant, la portion est faite. Cela se sent.
watch(
  () => pulling.value && share.value >= 1,
  (full) => {
    if (full) haptic("tick");
  },
);

function onDown(event: PointerEvent): void {
  if (done.value || event.button !== 0) return;
  y0 = event.clientY;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Le pointeur est déjà relâché : rien à capturer.
  }
  pulling.value = true;
  dy.value = 0;
}
function onMove(event: PointerEvent): void {
  if (pulling.value) dy.value = Math.min(0, event.clientY - y0);
}
function onUp(): void {
  if (!pulling.value) return;
  const reached = -dy.value >= PULL;
  pulling.value = false;
  dy.value = 0;
  if (reached) markDone();
}
</script>

<template>
  <section
    v-if="view"
    class="reader-end"
    :class="{ 'is-pulling': pulling }"
    :style="pulling ? { transform: `translateY(${Math.max(-140, dy * 0.5)}px)` } : undefined"
    role="button"
    tabindex="0"
    :aria-label="done ? label : t('parcours.reader.aria')"
    :aria-pressed="done"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @keydown.enter.prevent="markDone"
    @keydown.space.prevent="markDone"
  >
    <p class="text-[13px] font-bold text-text-secondary">{{ t("parcours.reader.end") }}</p>
    <svg class="mt-4" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="32" class="ring" />
      <circle
        cx="38"
        cy="38"
        r="32"
        class="ring-fill"
        pathLength="100"
        :stroke-dasharray="`${Math.round(share * 100)} 100`"
        transform="rotate(-90 38 38)"
      />
      <circle cx="38" cy="38" :r="coreRadius" class="core" />
      <path v-if="done" d="M27 38.5l7.5 7.5L50 30.5" class="check" />
    </svg>
    <p class="mt-3.5 text-center text-[17px] font-extrabold">{{ label }}</p>
    <p class="mt-1 text-center text-sm text-text-secondary">{{ sub }}</p>
    <div v-if="done" class="mt-[18px] flex gap-2.5" @pointerdown.stop>
      <RouterLink to="/" class="p-2.5 text-[15px] font-bold text-primary">
        {{ t("parcours.day.back") }}
      </RouterLink>
      <button type="button" class="p-2.5 text-[15px] font-bold text-text-secondary" @click="undo">
        {{ t("parcours.reader.undo") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.reader-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 18px 60px;
  border-top: 1px solid var(--color-line);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  transition: transform 0.3s ease;
}
.reader-end.is-pulling {
  transition: none;
}
.reader-end:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
.ring,
.ring-fill {
  fill: none;
  stroke-width: 4;
}
.ring {
  stroke: var(--color-line-strong);
}
.ring-fill {
  stroke: var(--color-primary);
  stroke-linecap: round;
}
.core {
  fill: var(--color-brand);
  transition: r 0.2s ease;
}
.check {
  fill: none;
  stroke: var(--color-on-brand);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (prefers-reduced-motion: reduce) {
  .reader-end,
  .core {
    transition: none;
  }
}
</style>
