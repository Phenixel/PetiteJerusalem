<script setup lang="ts">
import ZmanimSettings from "../../components/settings/ZmanimSettings.vue";
import ReadingSettings from "../../components/settings/ReadingSettings.vue";

/**
 * Onglet Préférences du profil : ce qui règle la façon dont l'application se
 * comporte, par opposition à l'onglet Apparence (couleurs, polices, taille) et
 * à l'onglet Notifications (ce qui sonne).
 *
 * Il existe partout, site compris : ce sont des préférences de personne, pas
 * des réglages d'appareil. D'autres viendront s'y ranger ; chacune est une
 * section, dans son cadre, séparée des autres par un simple écart.
 */
</script>

<template>
  <div class="flex flex-col gap-10">
    <ZmanimSettings />
    <ReadingSettings />
  </div>
</template>
