<script setup lang="ts">
/**
 * Mon parcours : où j'en suis. La lampe et la série, le mur des cinq
 * dernières semaines (on y touche un jour pour le compléter), les volumes de
 * l'étagère, les habitudes et leur semaine.
 *
 * On y arrive par la lampe de l'accueil, ou par le profil. Dans l'app, tout
 * marche sans compte, sur ce téléphone ; un compte le fait suivre d'un
 * appareil à l'autre, et le site l'exige.
 */
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import DaySheet from "../../components/parcours/DaySheet.vue";
import HabitWeek from "../../components/parcours/HabitWeek.vue";
import ParcoursLamp from "../../components/parcours/ParcoursLamp.vue";
import StoneWall from "../../components/parcours/StoneWall.vue";
import VolumeShelf from "../../components/parcours/VolumeShelf.vue";
import { isNativeApp } from "../../composables/useNativeApp";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useWallLabels } from "../../composables/useWallLabels";
import { analyticsService } from "../../services/analyticsService";
import { addDays } from "../../services/parcours/days";
import type { DayKey } from "../../services/parcours/model";
import { liveObjectives, wallWeeks } from "../../services/parcours/schedule";

useParcoursMeta("parcours.title", "/parcours");

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const labels = useWallLabels();

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
const lit = computed(() => store.streak.value.current > 0);

const picked = ref<DayKey | null>(null);
function pick(day: DayKey): void {
  picked.value = day;
  analyticsService.capture("parcours_day_opened", { source: "parcours_wall" });
}

onMounted(() => {
  analyticsService.capture("parcours_viewed", {
    objectives_count: liveObjectives(store.data.value).length,
    streak: store.streak.value.current,
    signed_in: store.signedIn.value,
  });
});
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
    <h1 class="text-center font-display text-3xl font-bold tracking-tight md:text-4xl">
      {{ t("parcours.title") }}
    </h1>

    <div class="mt-6 md:grid md:grid-cols-2 md:gap-12">
      <div>
        <!-- La lampe, et la série qu'elle porte. -->
        <section class="flex flex-col items-center text-center">
          <ParcoursLamp :lit="lit" :size="112" />
          <p class="mt-2 flex items-baseline gap-2">
            <span class="font-display text-5xl font-bold leading-none text-primary">
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

        <!-- Le mur : une pierre par jour, une colonne par semaine. -->
        <section class="mt-8" :aria-label="t('parcours.wall.title')">
          <h2 class="text-xl font-bold">
            <RouterLink to="/parcours/mur" class="hover:text-primary">
              {{ t("parcours.wall.title") }}
            </RouterLink>
          </h2>
          <div class="mt-3 flex gap-2">
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
              @pick="pick"
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
            <span v-if="store.begun.value" class="text-sm font-bold text-primary">
              {{ t("parcours.wall.held", { n: store.streak.value.held }, store.streak.value.held) }}
            </span>
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
          <section class="mt-10 md:mt-0">
            <h2 class="text-xl font-bold">{{ t("parcours.shelf.title") }}</h2>
            <VolumeShelf class="mt-3" />
          </section>

          <section v-if="habits.length" class="mt-10">
            <h2 class="text-xl font-bold">{{ t("parcours.habits.title") }}</h2>
            <div class="card mt-3 divide-y divide-line overflow-hidden">
              <RouterLink
                v-for="habit in habits"
                :key="habit.id"
                :to="`/parcours/objectif/${habit.id}`"
                class="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-soft"
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

        <div class="card mt-10 divide-y divide-line overflow-hidden">
          <RouterLink
            to="/parcours/journee"
            class="flex min-h-14 items-center px-4 font-semibold hover:bg-surface-soft"
          >
            {{ t("parcours.links.day") }}
          </RouterLink>
          <RouterLink
            to="/parcours/nouveau"
            class="flex min-h-14 items-center px-4 font-bold text-primary hover:bg-surface-soft"
          >
            {{ t("parcours.links.new") }}
          </RouterLink>
        </div>

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
  </main>
</template>
