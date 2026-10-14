<script setup lang="ts">
/**
 * La lampe, à côté de la salutation de l'accueil : allumée tant que la série
 * tient, avec son compte de jours. Elle mène à Mon parcours. Rien tant que
 * le parcours n'a pas commencé : le paquet y invite déjà.
 *
 * Chargée à la demande (voir HomeView) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import ParcoursLamp from "../ParcoursLamp.vue";

const { t } = useI18n();
const store = useParcours();

const days = computed(() => store.streak.value.current);
</script>

<template>
  <RouterLink
    v-if="store.begun.value"
    to="/parcours"
    class="press-feedback inline-flex items-end gap-1"
    :aria-label="t('parcours.hub.lamp', { n: days }, days)"
  >
    <ParcoursLamp :lit="days > 0" :size="52" />
    <span v-if="days > 0" class="pb-1 font-display text-2xl font-bold leading-none text-primary">
      {{ days }}
    </span>
  </RouterLink>
</template>
