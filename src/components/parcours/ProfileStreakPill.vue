<script setup lang="ts">
/**
 * La lumière de la série et ses jours d'affilée, ensemble dans une petite
 * pastille claire : le dessin, puis le compte. Dans le profil de l'app, elle
 * est à cheval sur le bas du rond à l'initiale, côté fin, détachée d'un
 * liseré de la couleur de la page (`overlap`) ; dans le bandeau du site,
 * juste à côté du nom. Sur un fond clair, la lumière se lit quelle que soit
 * sa couleur, et le compte aussi. La toucher ouvre Mes lumières. Rien tant
 * que le parcours n'a pas commencé.
 *
 * Chargée à la demande (voir NativeProfileHome, ProfilePage) : elle tire le
 * calendrier hébraïque.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";
import LightsSheet from "./LightsSheet.vue";
import StreakLight from "./StreakLight.vue";

withDefaults(defineProps<{ overlap?: boolean }>(), { overlap: false });

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
    <button
      type="button"
      class="streak-pill press-feedback"
      :class="{ 'is-overlap': overlap }"
      :aria-label="label"
      @click="openLights"
    >
      <StreakLight :light="lamp.light.value.id" :level="lamp.level.value" :width="34" />
      <span class="streak-pill-count">{{ lamp.days.value }}</span>
    </button>
    <LightsSheet :open="open" @close="open = false" />
  </span>
</template>

<style scoped>
.streak-pill {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 2px;
  padding: 2px 12px 2px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: 0 2px 6px rgb(58 46 30 / 0.16);
  color: var(--color-text-primary);
}
[dir="rtl"] .streak-pill {
  padding: 2px 6px 2px 12px;
}
/* À cheval sur le rond : un liseré de la couleur de la page l'en détache. */
.streak-pill.is-overlap {
  box-shadow:
    0 0 0 3px var(--color-page),
    0 3px 8px rgb(58 46 30 / 0.18);
}
/* Le compte dans la police du texte : les chiffres bas de casse de Playfair
   le rapetissaient à cette taille. */
.streak-pill-count {
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
</style>
