<script setup lang="ts">
/**
 * La lumière de la série, à cheval sur le rond du profil de l'app, en bas
 * de son côté de fin : un médaillon clair, la lumière dedans, et le compte
 * des jours d'affilée posé dessus. La toucher ouvre Mes lumières. Rien tant
 * que le parcours n'a pas commencé.
 *
 * Chargée à la demande (voir NativeProfileHome) : elle tire le calendrier
 * hébraïque.
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
  <span v-if="store.begun.value">
    <button
      type="button"
      class="light-badge press-feedback"
      :aria-label="label"
      @click="openLights"
    >
      <span class="light-badge-disc">
        <StreakLight :light="lamp.light.value.id" :level="lamp.level.value" :width="46" />
      </span>
      <span class="light-badge-count">{{ lamp.days.value }}</span>
    </button>
    <LightsSheet :open="open" @close="open = false" />
  </span>
</template>

<style scoped>
.light-badge {
  position: relative;
  display: block;
  width: 58px;
  height: 64px;
}
/* Le médaillon, détaché du rond par un liseré de la couleur de la page. */
.light-badge-disc {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow:
    0 0 0 3px var(--color-page),
    0 3px 8px rgb(58 46 30 / 0.18);
}
/* Le compte, posé sur le bas du médaillon. */
.light-badge-count {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  width: fit-content;
  min-width: 26px;
  margin-inline: auto;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-text-primary);
  box-shadow: 0 0 0 2px var(--color-page);
  font-size: 13px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  color: var(--color-page);
  font-variant-numeric: tabular-nums;
}
</style>
