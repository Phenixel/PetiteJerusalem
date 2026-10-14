<script setup lang="ts">
/**
 * La lumière de la série et ses jours d'affilée, écrits juste après le nom
 * dans le bandeau du profil du site (ProfileHeader, place `name`) : le
 * dessin, sans fond, et le compte, à l'encre du bandeau. Les toucher ouvre
 * Mes lumières.
 *
 * Chargée à la demande (voir ProfilePage) : elle tire le calendrier hébraïque.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";
import LightsSheet from "./LightsSheet.vue";
import StreakLight from "./StreakLight.vue";

const { t } = useI18n();
const store = useParcours();
const lamp = useParcoursLamp();

const label = computed(() => {
  const name = t(`parcours.lights.names.${lamp.light.value.id}`);
  const days = `${lamp.days.value} ${t("parcours.streak.days", lamp.days.value)}`;
  return t("parcours.lights.openLabel", { name: `${name}, ${days}` });
});

const open = ref(false);
function openLights(): void {
  open.value = true;
  analyticsService.capture("parcours_lights_opened", { source: "profile" });
}
</script>

<template>
  <span v-if="store.begun.value" class="inline-flex">
    <button type="button" class="streak press-feedback" :aria-label="label" @click="openLights">
      <StreakLight :light="lamp.light.value.id" :level="lamp.level.value" :width="46" />
      <span class="font-display text-[26px] font-bold leading-none md:text-[34px]">
        {{ lamp.days.value }}
      </span>
    </button>
    <LightsSheet :open="open" @close="open = false" />
  </span>
</template>

<style scoped>
.streak {
  display: inline-flex;
  align-items: center;
  gap: 0;
  color: var(--color-on-brand);
}
@media (min-width: 768px) {
  .streak > :deep(svg) {
    width: 56px;
    height: auto;
  }
}
</style>
