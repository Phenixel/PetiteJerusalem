<script setup lang="ts">
import ZmanimSettings from "../../components/settings/ZmanimSettings.vue";
import ReadingSettings from "../../components/settings/ReadingSettings.vue";

/**
 * Onglet Préférences du profil : ce qui règle la façon dont l'application se
 * comporte, par opposition à l'onglet Apparence (couleurs, polices, taille) et
 * à l'onglet Notifications (ce qui sonne).
 *
 * Il existe partout, site compris : ce sont des préférences de personne, pas
 * des réglages d'appareil. D'autres viendront s'y ranger, chacune en section,
 * et les sections se séparent d'un filet, comme leurs lignes : rien n'est mis
 * en carte ici, sans quoi la page deviendrait un empilement de boîtes à mesure
 * qu'elle s'allonge (voir docs/design.md).
 */
</script>

<template>
  <div class="flex flex-col gap-8">
    <ZmanimSettings />
    <ReadingSettings class="border-t border-line pt-8" />
  </div>
</template>
