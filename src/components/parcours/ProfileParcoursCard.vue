<script setup lang="ts">
/**
 * Mon parcours, dans le profil : la lumière de la série et son compte, la
 * lumière qu'on a et le record, la journée (« Aujourd'hui, 2 sur 3 », et
 * sa barre), puis « Mes lumières ». Toute la carte du haut mène à Mon
 * parcours. Pas encore commencé : la lampe attend, et la carte y mène
 * aussi (Mon parcours dit par où commencer).
 *
 * Dans l'app comme sur le site : le parcours se tient sans compte.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";
import { taskProgress } from "../../services/parcours/schedule";
import LightsSheet from "./LightsSheet.vue";
import StreakLight from "./StreakLight.vue";

const { t } = useI18n();
const store = useParcours();
const lamp = useParcoursLamp();

/** Ce qu'aujourd'hui demande, et ce qui en est fait. */
const today = computed(() => {
  const day = store.today.value;
  const tasks = store.todayTasks.value;
  const done = tasks.filter((task) => taskProgress(store.data.value, task, day) === "done").length;
  return { done, total: tasks.length };
});

const lightsOpen = ref(false);
function openLights(): void {
  lightsOpen.value = true;
  analyticsService.capture("parcours_lights_opened", { source: "profile" });
}

/** Le raccourci d'avant, la ligne « Mon parcours » : on compte toujours son toucher. */
function opened(): void {
  analyticsService.capture("profile_shortcut_clicked", { shortcut: "parcours" });
}
</script>

<template>
  <section class="card px-4 py-4" :aria-label="t('parcours.title')">
    <template v-if="store.begun.value">
      <RouterLink to="/parcours" class="press-feedback flex items-center gap-4" @click="opened">
        <StreakLight
          class="flex-none"
          :light="lamp.light.value.id"
          :level="lamp.level.value"
          :width="84"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-semibold text-text-secondary">
            {{ t("parcours.title") }}
          </span>
          <span class="flex items-baseline gap-1.5">
            <span class="font-display text-[34px] font-bold leading-none text-primary">
              {{ lamp.days.value }}
            </span>
            <span class="text-[15px] font-bold">
              {{ t("parcours.streak.days", lamp.days.value) }}
            </span>
          </span>
          <span class="mt-0.5 block text-[13px] text-text-secondary">
            {{ t(`parcours.lights.names.${lamp.light.value.id}`) }} ·
            {{ t("parcours.profile.best", { n: store.streak.value.best }) }}
          </span>
        </span>
        <svg
          class="h-5 w-5 flex-none text-text-secondary rtl:rotate-180"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M9 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </RouterLink>

      <!-- La journée : ce qui est fait sur ce qu'elle demande. -->
      <div v-if="today.total" class="mt-4">
        <p class="flex items-baseline justify-between text-[13px] font-semibold">
          <span>{{ t("parcours.profile.today") }}</span>
          <span class="tabular-nums text-text-secondary">
            {{
              today.done === today.total
                ? t("parcours.profile.todayDone")
                : t("parcours.profile.todayCount", today)
            }}
          </span>
        </p>
        <span class="day-bar mt-1.5" aria-hidden="true">
          <span :style="{ width: `${(100 * today.done) / today.total}%` }" />
        </span>
      </div>

      <button type="button" class="lights-btn press-feedback mt-4" @click="openLights">
        <svg class="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1Q9 7 15 8Q9 9 8 15Q7 9 1 8Q7 7 8 1Z" fill="currentColor" />
        </svg>
        {{ t("parcours.lights.open") }}
      </button>
      <LightsSheet :open="lightsOpen" @close="lightsOpen = false" />
    </template>

    <!-- Pas encore commencé : la lampe attend ; Mon parcours dit par où commencer. -->
    <RouterLink
      v-else
      to="/parcours"
      class="press-feedback flex items-center gap-4"
      @click="opened"
    >
      <StreakLight class="flex-none" light="lamp" level="low" :width="76" />
      <span class="min-w-0 flex-1">
        <span class="block text-[15px] font-bold">{{ t("parcours.title") }}</span>
        <span class="block text-[13px] text-text-secondary">{{ t("parcours.empty.text") }}</span>
      </span>
      <svg
        class="h-5 w-5 flex-none text-text-secondary rtl:rotate-180"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </RouterLink>
  </section>
</template>

<style scoped>
.day-bar {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}
.day-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand);
  transition: width 0.3s ease;
}
/* Mes lumières : une commande ronde, son dessin et son nom. */
.lights-btn {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
}
@media (prefers-reduced-motion: reduce) {
  .day-bar > span {
    transition: none;
  }
}
</style>
