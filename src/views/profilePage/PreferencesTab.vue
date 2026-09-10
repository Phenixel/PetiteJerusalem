<script setup lang="ts">
import AppearanceSettings from "../../components/settings/AppearanceSettings.vue";
import NotificationSettings from "../../components/settings/NotificationSettings.vue";

/**
 * Onglet Préférences du profil : langue, apparence claire ou sombre, thème de
 * couleurs et polices, puis les rappels d'horaires de l'app native. Les
 * réglages d'apparence vivent dans AppearanceSettings, partagé avec
 * l'introduction de première ouverture, pour que les mêmes choix s'y
 * présentent de la même façon.
 *
 * Les rappels ne sont pas de l'apparence, et ils n'ont rien à faire dans
 * l'introduction : ils ont leur propre bloc, en fin de page, et ne s'affichent
 * que dans l'app native (voir NotificationSettings).
 *
 * userId null : réglages sans compte (page profil de l'app native). Les choix
 * sont alors gardés sur l'appareil, et le compte les adoptera à la connexion
 * (userPreferencesService). Les rappels, eux, restent toujours sur l'appareil :
 * c'est lui qui les fera sonner.
 */
defineProps<{
  userId: string | null;
}>();
</script>

<template>
  <div>
    <AppearanceSettings :user-id="userId" with-descriptions />
    <NotificationSettings class="mt-10" />
  </div>
</template>
