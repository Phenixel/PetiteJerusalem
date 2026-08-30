<script setup lang="ts">
import AppearanceSettings from "../../components/settings/AppearanceSettings.vue";

/**
 * Onglet Préférences du profil : langue, apparence claire ou sombre, thème de
 * couleurs et polices. Les réglages eux-mêmes vivent dans AppearanceSettings,
 * partagé avec l'introduction de première ouverture, pour que les mêmes choix
 * s'y présentent de la même façon.
 *
 * userId null : réglages sans compte (page profil de l'app native). Les choix
 * sont alors gardés sur l'appareil, et le compte les adoptera à la connexion
 * (userPreferencesService).
 */
defineProps<{
  userId: string | null;
}>();
</script>

<template>
  <AppearanceSettings :user-id="userId" with-descriptions />
</template>
