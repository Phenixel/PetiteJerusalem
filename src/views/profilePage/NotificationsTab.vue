<script setup lang="ts">
import NotificationSettings from "../../components/settings/NotificationSettings.vue";

/**
 * Onglet Notifications du profil : les rappels d'horaires posés sur cet
 * appareil, et l'entrée du Chabbat et des fêtes.
 *
 * App native seulement (l'onglet n'existe pas ailleurs, voir ProfilePage) :
 * une notification est programmée par le téléphone qui la recevra, un
 * navigateur n'a rien à programmer.
 */
</script>

<template>
  <NotificationSettings />
</template>
