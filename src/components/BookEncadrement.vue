<script setup lang="ts">
/**
 * Les passages qui se disent à l'ouverture d'un livre de la bibliothèque : le
 * Yehi ratson des Tehilim, avec ses trois versets, en tête de la liste des
 * cent cinquante psaumes.
 *
 * C'est là qu'on les cherche : on ouvre le livre, on dit ce qui s'y dit, on
 * choisit son psaume. Les répéter au-dessus de chacun des cent cinquante
 * laisserait croire qu'ils se redisent à chaque fois.
 *
 * Ce composant porte à lui seul les textes et leur rendu (voir
 * encadrementService, LiturgyText) : la bibliothèque le charge à la demande,
 * ses autres corpus n'en portent rien.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { encadrementOfBook } from "../services/encadrementService";
import ReadingEncadrement from "./ReadingEncadrement.vue";

const props = defineProps<{ corpus: string }>();

const { t } = useI18n();

const passages = computed(() => encadrementOfBook(props.corpus));
</script>

<template>
  <div v-if="passages" class="space-y-3">
    <ReadingEncadrement :blocks="passages.before" :title="t('encadrement.before')" class="!my-0" />
    <ReadingEncadrement :blocks="passages.after" :title="t('encadrement.after')" class="!my-0" />
  </div>
</template>
