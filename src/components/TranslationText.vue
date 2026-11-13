<script setup lang="ts">
import { computed } from "vue";
import { richRuns } from "../services/textService";

/**
 * Une ligne de traduction, avec son gras et son italique. Le Talmud de
 * Steinsaltz met sa traduction littérale en gras et son explication en
 * romain : le gras dit ce que le texte dit, le reste ce que le traducteur
 * ajoute pour le faire comprendre. On le lit comme des fragments (richRuns),
 * jamais comme du HTML.
 */
const props = defineProps<{ text: string }>();

const runs = computed(() => richRuns(props.text));
</script>

<template>
  <span
    v-for="(run, index) in runs"
    :key="index"
    :class="{ 'font-semibold text-text-primary': run.bold, italic: run.italic }"
    >{{ run.text }}</span
  >
</template>
