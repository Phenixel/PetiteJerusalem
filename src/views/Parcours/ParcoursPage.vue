<script setup lang="ts">
/**
 * Mon parcours (P2-Parcours) : où j'en suis. La lampe et la série, le mur
 * des cinq dernières semaines (on y touche un jour pour le compléter, on
 * écarte deux doigts dessus pour le mur entier), les volumes de l'étagère,
 * les habitudes et leur semaine. Au bas, le rappel du soir ; et, quand un
 * texte d'aujourd'hui manque sur l'appareil, de quoi le télécharger (tous
 * deux vivaient sur Ma journée, retirée).
 *
 * On y arrive par la lampe de l'accueil, ou par le profil. Dans l'app, tout
 * marche sans compte, sur ce téléphone ; un compte le fait suivre d'un
 * appareil à l'autre, et le site l'exige.
 *
 * On y revient aussi d'un objectif qu'on vient de créer : la page glisse
 * jusqu'à lui, et il arrive sous les yeux (le volume tombe sur sa planche,
 * l'habitude se glisse dans sa liste), une fois (useParcoursArrival).
 */
import { HDate } from "@hebcal/core";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import DailyReminderButton from "../../components/parcours/DailyReminderButton.vue";
import DaySheet from "../../components/parcours/DaySheet.vue";
import HabitWeek from "../../components/parcours/HabitWeek.vue";
import OfflineTextsNotice from "../../components/parcours/OfflineTextsNotice.vue";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
import ParcoursLamp from "../../components/parcours/ParcoursLamp.vue";
import StoneWall from "../../components/parcours/StoneWall.vue";
import VolumeShelf from "../../components/parcours/VolumeShelf.vue";
import { prefersReducedMotion } from "../../composables/useMotion";
import { isNativeApp } from "../../composables/useNativeApp";
import { takeArrival } from "../../composables/useParcoursArrival";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { usePinchOpen } from "../../composables/usePinchOpen";
import { useWallLabels } from "../../composables/useWallLabels";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { localDayFrom } from "../../services/dateService";
import { addDays } from "../../services/parcours/days";
import { taskEntries } from "../../services/parcours/entries";
import type { DayKey } from "../../services/parcours/model";
import { liveObjectives, wallWeeks } from "../../services/parcours/schedule";
import { hebrewMonthName, isIsraelPlace } from "../../services/zmanimService";

useParcoursMeta("parcours.title", "/parcours");

const { t, locale } = useI18n();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();
const labels = useWallLabels();
const { place } = useZmanimLocation();

/** Ce qu'il faut sur l'appareil pour lire les textes d'aujourd'hui sans connexion. */
const entries = computed(() => {
  const il = isIsraelPlace(place.value);
  const today = store.today.value;
  return store.todayTasks.value.flatMap((task) => {
    const objective = store.data.value.objectives[task.objectiveId];
    return objective ? taskEntries(task, objective, today, il) : [];
  });
});

/** Cinq semaines : de quoi voir un mois, et le geste de la semaine qui finit. */
const WEEKS = 5;

const weeks = computed(() =>
  wallWeeks(
    store.data.value,
    addDays(store.today.value, -7 * (WEEKS - 1)),
    store.today.value,
    store.today.value,
    store.context.value,
  ),
);
const initials = computed(() => labels.weekdayInitials());

const habits = computed(() => liveObjectives(store.data.value).filter((o) => o.kind === "habit"));
const empty = computed(() => liveObjectives(store.data.value).length === 0);
const lamp = useParcoursLamp();

const picked = ref<DayKey | null>(null);

/** « depuis Iyar 5785 » : le mois hébraïque du premier jour du parcours. */
const since = computed(() => {
  const first = store.begun.value;
  const date = first ? localDayFrom(first) : null;
  if (!date) return "";
  date.setHours(12);
  const hd = new HDate(date);
  const month = `${hebrewMonthName(hd.getMonth(), hd.getFullYear(), locale.value)} ${hd.getFullYear()}`;
  return t("parcours.wall.allSince", { month });
});

// Deux doigts écartés sur le mur : le mur entier.
const wall = ref<HTMLElement | null>(null);
usePinchOpen(wall, () => void router.push("/parcours/mur"));

/** L'objectif qu'on vient de créer, le temps de son arrivée. */
const arriving = ref<string | null>(takeArrival());
/** Ce que dit un lecteur d'écran : « Séder Toharot est sur votre étagère ». */
const arrivedNote = ref("");
const timers: ReturnType<typeof setTimeout>[] = [];

/** Le temps que la page glisse jusqu'à lui, puis qu'il touche la planche. */
const SCROLL_AFTER_MS = 120;
const LANDS_AFTER_MS = 940;
const ARRIVAL_MS = 2600;

function welcome(id: string): void {
  const objective = store.data.value.objectives[id];
  if (!objective) {
    arriving.value = null;
    return;
  }
  const still = prefersReducedMotion();
  arrivedNote.value = t(
    objective.kind === "habit" ? "parcours.arrived.habit" : "parcours.arrived.volume",
    { title: views.objectiveTitle(objective) },
  );
  // Après la position que le routeur rend au retour : la page glisse jusqu'à lui.
  timers.push(
    setTimeout(() => {
      document.querySelector<HTMLElement>("[data-arriving]")?.scrollIntoView({
        behavior: still ? "auto" : "smooth",
        block: "center",
        inline: "center",
      });
    }, SCROLL_AFTER_MS),
  );
  // Le volume touche la planche : un battement.
  if (!still && objective.kind !== "habit") {
    timers.push(setTimeout(() => haptic("tick"), LANDS_AFTER_MS));
  }
  timers.push(setTimeout(() => (arriving.value = null), ARRIVAL_MS));
}

onBeforeUnmount(() => timers.forEach(clearTimeout));

onMounted(() => {
  if (arriving.value) welcome(arriving.value);
  analyticsService.capture("parcours_viewed", {
    objectives_count: liveObjectives(store.data.value).length,
    streak: store.streak.value.current,
    signed_in: store.signedIn.value,
  });
});
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 pb-10 pt-[18px] md:px-6 md:py-12">
    <ParcoursBack to="/" :label="t('parcours.day.back')" />
    <h1 class="mt-1 text-center text-[30px] font-bold md:text-4xl">
      {{ t("parcours.title") }}
    </h1>

    <div class="md:grid md:grid-cols-2 md:gap-12">
      <div>
        <!-- La lampe, en grand. La flamme baisse un jour manqué, elle ne s'éteint pas. -->
        <section class="mt-[18px] flex flex-col items-center text-center">
          <ParcoursLamp :level="lamp.level.value" :width="168" />
          <p class="mt-1.5 flex items-baseline gap-2">
            <span class="font-display text-[44px] font-bold leading-none text-primary">
              {{ store.streak.value.current }}
            </span>
            <span class="text-base font-bold">
              {{ t("parcours.streak.days", store.streak.value.current) }}
            </span>
          </p>
          <p class="mt-1.5 text-sm text-text-secondary">
            {{ t("parcours.streak.best", { n: store.streak.value.best }) }}
          </p>
        </section>

        <OfflineTextsNotice class="mt-6" :entries="entries" />

        <!-- Le mur : une pierre par jour, une colonne par semaine, nommée par sa
             paracha. C'est le bout droit du grand mur : le passé est à gauche. -->
        <section :aria-label="t('parcours.wall.title')">
          <h2 class="parcours-h2">
            <RouterLink to="/parcours/mur" class="hover:text-primary">
              {{ t("parcours.wall.title") }}
            </RouterLink>
          </h2>
          <div ref="wall" class="wall-pinch flex gap-2">
            <div
              class="flex w-4 flex-none flex-col text-xs font-bold text-text-secondary"
              aria-hidden="true"
            >
              <span
                v-for="(initial, i) in initials"
                :key="i"
                class="flex items-center"
                :class="i === 6 ? 'h-[37px]' : 'h-[30px]'"
              >
                {{ initial }}
              </span>
            </div>
            <StoneWall
              class="flex-1"
              :weeks="weeks"
              :selected="picked"
              variant="compact"
              @pick="(day) => (picked = day)"
            >
              <template #footer="{ week }">
                <span class="mt-1.5 truncate text-center text-[11px] font-bold text-text-secondary">
                  {{ labels.weekLabel(week.week) }}
                </span>
              </template>
            </StoneWall>
          </div>
          <p class="mt-3 text-[13px] leading-relaxed text-text-secondary">
            {{ t("parcours.wall.legend") }}
          </p>
          <RouterLink
            to="/parcours/mur"
            class="card card-hover press-feedback mt-3 flex items-center justify-between gap-3 px-4 py-3"
          >
            <span>
              <span class="block text-[15px] font-bold">{{ t("parcours.wall.all") }}</span>
              <span class="block text-[13px] text-text-secondary">
                {{ t("parcours.wall.allHint") }}
              </span>
            </span>
            <span v-if="since" class="text-sm font-bold text-primary">{{ since }}</span>
          </RouterLink>
        </section>
      </div>

      <div>
        <!-- Rien encore : le parcours commence par un objectif. -->
        <section v-if="empty" class="mt-10 text-center md:mt-0">
          <p class="text-lg font-bold">{{ t("parcours.empty.title") }}</p>
          <p class="mt-1 text-text-secondary">{{ t("parcours.empty.text") }}</p>
          <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">
            {{ t("parcours.empty.cta") }}
          </RouterLink>
        </section>

        <template v-else>
          <section>
            <h2 class="parcours-h2">{{ t("parcours.shelf.title") }}</h2>
            <VolumeShelf :arriving="arriving" />
          </section>

          <!-- Mes habitudes : un nom, et sa semaine en petites cases. -->
          <section v-if="habits.length">
            <h2 class="parcours-h2">{{ t("parcours.habits.title") }}</h2>
            <div class="card divide-y divide-line overflow-hidden">
              <RouterLink
                v-for="habit in habits"
                :key="habit.id"
                :to="`/parcours/objectif/${habit.id}`"
                class="habit-row flex min-h-14 items-center gap-3 px-3.5 py-2.5 hover:bg-surface-soft"
                :class="{ 'is-arriving': habit.id === arriving }"
                :data-arriving="habit.id === arriving ? '' : undefined"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-[15px] font-bold">{{ views.objectiveTitle(habit) }}</span>
                  <span class="block text-[13px] text-text-secondary">
                    {{ views.whenLabel(habit) }}
                  </span>
                </span>
                <HabitWeek :objective="habit" />
              </RouterLink>
            </div>
          </section>
        </template>

        <div class="card mt-3.5 divide-y divide-line overflow-hidden">
          <RouterLink
            to="/parcours/nouveau"
            class="flex min-h-14 items-center px-3.5 text-[15px] font-bold text-primary hover:bg-surface-soft"
          >
            {{ t("parcours.links.new") }}
          </RouterLink>
        </div>

        <DailyReminderButton class="mt-8" />

        <!-- Sans compte, dans l'app : tout marche, mais sur ce téléphone seulement. -->
        <p
          v-if="isNativeApp && !store.signedIn.value"
          class="mt-6 text-center text-[13px] text-text-secondary"
        >
          {{ t("parcours.guest.text") }}
          <RouterLink to="/login?redirect=/parcours" class="font-bold text-primary">
            {{ t("parcours.guest.cta") }}
          </RouterLink>
        </p>
      </div>
    </div>

    <DaySheet :day="picked" source="parcours_wall" @close="picked = null" />
    <p class="sr-only" aria-live="polite">{{ arrivedNote }}</p>
  </main>
</template>

<style scoped>
.parcours-h2 {
  margin: 38px 0 12px;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
}
/* Deux doigts écartés ouvrent le mur entier : la page ne zoome pas dessus. */
.wall-pinch {
  touch-action: pan-x pan-y;
}
/*
 * L'habitude qu'on vient de créer : sa ligne se glisse dans la liste, dans
 * la teinte du thème qui s'efface, et les cases de sa semaine se posent une
 * à une. Le délai laisse la page glisser jusqu'à elle.
 */
.habit-row.is-arriving {
  --arrive-delay: 0.45s;
  --arrive-from: 36px;
  animation: habit-arrives 1.9s ease-out var(--arrive-delay) backwards;
}
[dir="rtl"] .habit-row.is-arriving {
  --arrive-from: -36px;
}
.habit-row.is-arriving :deep(.habit-week i) {
  animation: cell-sets 0.32s ease-out calc(var(--arrive-delay) + 0.4s + var(--i) * 70ms) backwards;
}
@keyframes habit-arrives {
  0% {
    opacity: 0;
    transform: translateX(var(--arrive-from));
    background-color: color-mix(in srgb, var(--color-brand) 18%, transparent);
  }
  22% {
    opacity: 1;
    transform: none;
  }
  60% {
    background-color: color-mix(in srgb, var(--color-brand) 18%, transparent);
  }
  100% {
    background-color: transparent;
  }
}
@keyframes cell-sets {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  70% {
    transform: scale(1.25);
  }
}
@media (prefers-reduced-motion: reduce) {
  .habit-row.is-arriving,
  .habit-row.is-arriving :deep(.habit-week i) {
    animation: none;
  }
}
</style>
