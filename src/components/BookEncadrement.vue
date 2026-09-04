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
 *
 * `part` sépare les deux quand la page a un vrai déroulé : sur les Tehilim du
 * jour, l'avant coiffe les psaumes et l'après se dit après eux, donc en bas de
 * page. Le catalogue des Tehilim, lui, n'a pas de fin de lecture à marquer :
 * il les pose tous les deux, à l'ouverture du livre.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { encadrementOfBook } from "../services/encadrementService";
import ReadingEncadrement from "./ReadingEncadrement.vue";

const props = withDefaults(
  defineProps<{
    corpus: string;
    /** Ce qui se dit avant la lecture, après, ou les deux (par défaut). */
    part?: "before" | "after" | "both";
  }>(),
  { part: "both" },
);

const { t } = useI18n();

const passages = computed(() => encadrementOfBook(props.corpus));
</script>

<template>
  <div v-if="passages" class="space-y-3">
    <ReadingEncadrement
      v-if="part !== 'after'"
      :blocks="passages.before"
      :title="t('encadrement.before')"
      class="!my-0"
    />
    <ReadingEncadrement
      v-if="part !== 'before'"
      :blocks="passages.after"
      :title="t('encadrement.after')"
      class="!my-0"
    />
  </div>
</template>
