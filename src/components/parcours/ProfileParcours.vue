<script setup lang="ts">
/**
 * Mon parcours, au bas du bandeau du profil du site (ProfileHeader), sur
 * toute la largeur, sans filet : la journée (« Aujourd'hui, 1 sur 4 »), la
 * lumière qu'on a et le record, « Mon parcours » qui y mène, et la barre.
 * Tout à l'encre du bandeau. Pas encore commencé : la ligne dit par où
 * commencer. La lumière et ses jours, eux, sont dans leur pastille, à côté
 * du nom (ProfileStreakPill).
 *
 * Le profil de l'app a les siens : ProfileStreakPill, sur le rond, et
 * ProfileParcoursRow.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";

const { t } = useI18n();
const store = useParcours();
const lamp = useParcoursLamp();

const begun = computed(() => store.begun.value);
const lightName = computed(() => t(`parcours.lights.names.${lamp.light.value.id}`));
const share = computed(() => {
  const { done, total } = lamp.today.value;
  return total === 0 ? 0 : done / total;
});
const todayText = computed(() => {
  const { done, total } = lamp.today.value;
  if (total === 0) return "";
  return done === total
    ? t("parcours.profile.todayDone")
    : t("parcours.profile.todayCount", { done, total });
});

/** Le raccourci d'avant, la ligne « Mon parcours » : on compte toujours son toucher. */
function opened(): void {
  analyticsService.capture("profile_shortcut_clicked", { shortcut: "parcours" });
}
</script>

<template>
  <!-- En bas, sur toute la largeur : la journée, et ce qui mène à Mon parcours. -->
  <div class="pp-foot">
    <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
      <template v-if="begun">
        <span class="font-bold">{{ t("parcours.profile.today") }}</span>
        <span class="pp-soft tabular-nums">
          {{ todayText
          }}<span class="hidden sm:inline">
            · {{ lightName }} · {{ t("parcours.profile.best", { n: store.streak.value.best }) }}
          </span>
        </span>
      </template>
      <span v-else class="font-bold">{{ t("parcours.empty.title") }}</span>
      <RouterLink to="/parcours" class="pp-link press-feedback ms-auto" @click="opened">
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
    </p>
    <span v-if="begun && lamp.today.value.total" class="pp-bar mt-2.5" aria-hidden="true">
      <span :style="{ width: `${share * 100}%` }" />
    </span>
  </div>
</template>

<style scoped>
.pp-foot {
  padding-top: 0.5rem;
  color: var(--color-on-brand);
}
.pp-soft {
  color: color-mix(in srgb, var(--color-on-brand) 78%, transparent);
}
.pp-link {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  font-weight: 800;
}
.pp-bar {
  display: block;
  height: 7px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-on-brand) 16%, transparent);
}
.pp-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-on-brand);
  transition: width 0.3s ease;
}
@media (prefers-reduced-motion: reduce) {
  .pp-bar > span {
    transition: none;
  }
}
</style>
