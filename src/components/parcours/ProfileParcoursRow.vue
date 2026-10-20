<script setup lang="ts">
/**
 * La ligne « Mon parcours » du profil de l'app : elle y mène, et dit la
 * journée, ce qui en est fait (« 1 sur 4 », « Journée pleine ») et sa barre
 * sous le nom. Là pour tous : le parcours se tient sans compte.
 *
 * Chargée à la demande (voir NativeProfileHome) : elle tire le calendrier
 * hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcoursLamp } from "../../composables/useParcoursLamp";
import { analyticsService } from "../../services/analyticsService";
import SettingsRow from "../settings/SettingsRow.vue";

const { t } = useI18n();
const lamp = useParcoursLamp();

const value = computed(() => {
  const { done, total } = lamp.today.value;
  if (total === 0) return undefined;
  return done === total
    ? t("parcours.profile.todayDone")
    : t("parcours.profile.todayCount", { done, total });
});
const progress = computed(() => {
  const { done, total } = lamp.today.value;
  return total === 0 ? undefined : done / total;
});

/** Le raccourci d'avant : on compte toujours son toucher. */
function opened(): void {
  analyticsService.capture("profile_shortcut_clicked", { shortcut: "parcours" });
}
</script>

<template>
  <SettingsRow
    :label="t('parcours.title')"
    :value="value"
    :progress="progress"
    to="/parcours"
    @click="opened"
  />
</template>
