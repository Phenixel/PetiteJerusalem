<script setup lang="ts">
/**
 * La lampe, à côté de la salutation de l'accueil (P2-Accueil) : un objet,
 * pas une icône, et sous elle le compte des jours d'affilée. Sa flamme monte
 * quand la journée est pleine ; la série qui grandit en fait une bougie, une
 * lanterne, jusqu'aux étoiles (StreakLight). Elle mène à Mon parcours. Rien
 * tant que le parcours n'a pas commencé : le paquet y invite déjà.
 *
 * Chargée à la demande (voir HomeView) : elle tire le calendrier hébraïque.
 */
import { useI18n } from "vue-i18n";
import { useParcours } from "../../../composables/useParcours";
import { useParcoursLamp } from "../../../composables/useParcoursLamp";
import StreakLight from "../StreakLight.vue";

const { t } = useI18n();
const store = useParcours();
const { days, level, light } = useParcoursLamp();
</script>

<template>
  <RouterLink
    v-if="store.begun.value"
    to="/parcours"
    class="press-feedback -mt-1.5 flex flex-col items-center text-text-primary"
    :aria-label="t('parcours.hub.lamp', { n: days }, days)"
  >
    <StreakLight :light="light.id" :level="level" :width="76" />
    <span class="-mt-0.5 text-[15px] font-extrabold tabular-nums">{{ days }}</span>
  </RouterLink>
</template>
