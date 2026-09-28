<script setup lang="ts">
import AppearanceSettings from "../../components/settings/AppearanceSettings.vue";

/**
 * Onglet Apparence du profil : langue, apparence claire ou sombre, thème de
 * couleurs et polices. Les réglages eux-mêmes vivent dans AppearanceSettings,
 * partagé avec l'introduction de première ouverture, pour que les mêmes choix
 * s'y présentent de la même façon.
 *
 * Les notifications ont leur propre onglet : elles ne se règlent pas au même
 * moment que les couleurs, et elles ne valent que dans l'app native.
 *
 * Profil du site seulement, donc toujours avec un compte : l'app pose les
 * mêmes réglages sur sa sous-page Apparence (NativeProfileSection), compte ou
 * non.
 */
defineProps<{
  userId: string;
}>();
</script>

<template>
  <AppearanceSettings :user-id="userId" with-descriptions />
</template>
