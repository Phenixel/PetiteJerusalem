<script setup lang="ts">
import { computed } from "vue";
import { leadRanges, markedPieces } from "../services/pageForm";

/**
 * Un passage dont certains mots sont soulignés : ceux que citent les
 * dibbourim hamat'hilim de ses commentaires, quand le panneau des
 * commentaires est ouvert sur lui (voir CommentaryPanel.vue). Sans dibbour,
 * le texte tel quel.
 */
const props = defineProps<{ text: string; leads?: string[] | null }>();

const pieces = computed(() =>
  props.leads?.length
    ? markedPieces(props.text, leadRanges(props.text, props.leads))
    : [{ text: props.text, marked: false }],
);
</script>

<template>
  <template v-for="(piece, i) in pieces" :key="i"
    ><mark v-if="piece.marked" class="lead-mark">{{ piece.text }}</mark
    ><template v-else>{{ piece.text }}</template></template
  >
</template>

<style scoped>
/* Les mots commentés : soulignés à la couleur du thème, sans fond, pour que
   la lecture reste celle du texte. Assez bas pour passer sous les voyelles. */
.lead-mark {
  background: none;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.45em;
  text-decoration-skip-ink: none;
}
</style>
