<script setup lang="ts">
/**
 * Mon parcours, dans l'en-tête du profil : la lumière de la série, son
 * compte, la lumière qu'on a et le record, la journée (« Aujourd'hui, 2 sur
 * 3 », et sa barre), et le chemin vers Mon parcours. Toucher la lumière
 * ouvre Mes lumières. Pas encore commencé : la lampe attend, et la ligne
 * mène à Mon parcours, qui dit par où commencer.
 *
 * Sans cadre à lui : il vit dans l'en-tête. `brand`, sur la bannière du
 * site, à la couleur du thème : le texte prend l'encre de la bannière, et la
 * lumière se pose sur un médaillon clair (une ménorah dorée se perdait dans
 * l'orange). `plain`, dans l'en-tête de l'app, centré comme lui. Le
 * parcours se tient sans compte, dans l'app comme sur le site.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";
import { taskProgress } from "../../services/parcours/schedule";
import LightsSheet from "./LightsSheet.vue";
import StreakLight from "./StreakLight.vue";

const props = withDefaults(defineProps<{ tone?: "brand" | "plain" }>(), { tone: "plain" });
const tone = computed(() => props.tone);

const { t } = useI18n();
const store = useParcours();
const lamp = useParcoursLamp();

const lightName = computed(() => t(`parcours.lights.names.${lamp.light.value.id}`));

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
  <section class="profile-parcours" :class="`is-${tone}`" :aria-label="t('parcours.title')">
    <template v-if="store.begun.value">
      <div class="pp-head flex items-center gap-3.5">
        <button
          type="button"
          class="pp-light press-feedback flex-none"
          :aria-label="t('parcours.lights.openLabel', { name: lightName })"
          @click="openLights"
        >
          <StreakLight
            :light="lamp.light.value.id"
            :level="lamp.level.value"
            :width="tone === 'brand' ? 62 : 76"
          />
        </button>
        <span class="min-w-0 text-start">
          <span class="flex items-baseline gap-1.5">
            <span class="pp-number font-display text-[34px] font-bold leading-none">
              {{ lamp.days.value }}
            </span>
            <span class="text-[15px] font-bold">
              {{ t("parcours.streak.days", lamp.days.value) }}
            </span>
          </span>
          <span class="pp-soft mt-0.5 block text-[13px]">
            {{ lightName }} · {{ t("parcours.profile.best", { n: store.streak.value.best }) }}
          </span>
        </span>
      </div>

      <!-- La journée : ce qui est fait sur ce qu'elle demande. -->
      <div v-if="today.total" class="mt-3.5">
        <p class="flex items-baseline justify-between text-[13px] font-semibold">
          <span>{{ t("parcours.profile.today") }}</span>
          <span class="pp-soft tabular-nums">
            {{
              today.done === today.total
                ? t("parcours.profile.todayDone")
                : t("parcours.profile.todayCount", today)
            }}
          </span>
        </p>
        <span class="pp-bar mt-1.5" aria-hidden="true">
          <span :style="{ width: `${(100 * today.done) / today.total}%` }" />
        </span>
      </div>

      <RouterLink to="/parcours" class="pp-link press-feedback mt-2" @click="opened">
        {{ t("parcours.title") }}
        <svg class="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </RouterLink>
      <LightsSheet :open="lightsOpen" @close="lightsOpen = false" />
    </template>

    <!-- Pas encore commencé : la lampe attend ; Mon parcours dit par où commencer. -->
    <RouterLink
      v-else
      to="/parcours"
      class="press-feedback flex items-center gap-3.5"
      @click="opened"
    >
      <StreakLight class="flex-none" light="lamp" level="low" :width="76" />
      <span class="min-w-0 flex-1">
        <span class="block text-[15px] font-bold">{{ t("parcours.title") }}</span>
        <span class="pp-soft block text-[13px]">{{ t("parcours.empty.text") }}</span>
      </span>
      <svg class="h-5 w-5 flex-none rtl:rotate-180" viewBox="0 0 24 24" aria-hidden="true">
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
/* Dans l'en-tête de l'app : centré comme lui, l'encre de la page, la couleur
   du thème pour le compte. */
.profile-parcours.is-plain {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--color-text-primary);
}
.is-plain .pp-head {
  justify-content: center;
}
.is-plain > div:not(.pp-head) {
  align-self: stretch;
}
.is-plain .pp-number,
.is-plain .pp-link {
  color: var(--color-primary);
}
.is-plain .pp-soft {
  color: var(--color-text-secondary);
}
.is-plain .pp-bar {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}
.is-plain .pp-bar > span {
  background: var(--color-brand);
}
/* Sur la bannière du site : tout à l'encre de la bannière, la lumière sur
   son médaillon clair. */
.profile-parcours.is-brand {
  color: var(--color-on-brand);
}
.is-brand .pp-light {
  display: grid;
  width: 80px;
  height: 80px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}
.is-brand .pp-soft {
  color: color-mix(in srgb, var(--color-on-brand) 80%, transparent);
}
.is-brand .pp-bar {
  background: color-mix(in srgb, var(--color-on-brand) 18%, transparent);
}
.is-brand .pp-bar > span {
  background: var(--color-on-brand);
}
.pp-bar {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
}
.pp-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}
.pp-link {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 800;
}
@media (prefers-reduced-motion: reduce) {
  .pp-bar > span {
    transition: none;
  }
}
</style>
