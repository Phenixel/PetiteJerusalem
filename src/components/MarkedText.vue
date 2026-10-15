<script setup lang="ts">
import { computed } from "vue";
import { leadRanges, markedPieces } from "../services/pageForm";

/**
 * Un passage dont certains mots sont mis en avant :
 *  - soulignés, ceux que citent les dibbourim hamat'hilim de ses
 *    commentaires, quand le panneau des commentaires est ouvert sur lui (voir
 *    CommentaryPanel.vue) ;
 *  - en gras, ceux que la page imprimée y met (`strong`, voir
 *    talmudOpenings) : le début d'une Michna, d'une Guemara.
 * Sans rien de tout cela, le texte tel quel.
 */
const props = defineProps<{
  text: string;
  leads?: string[] | null;
  strong?: [number, number][] | null;
}>();

const pieces = computed(() =>
  markedPieces(
    props.text,
    props.leads?.length ? leadRanges(props.text, props.leads) : [],
    props.strong ?? [],
  ),
);
</script>

<template>
  <template v-for="(piece, i) in pieces" :key="i"
    ><mark v-if="piece.marked" class="lead-mark"
      ><b v-if="piece.strong" class="opening">{{ piece.text }}</b
      ><template v-else>{{ piece.text }}</template></mark
    ><b v-else-if="piece.strong" class="opening">{{ piece.text }}</b
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

/* Le début d'une Michna, d'une Guemara : en gras, comme sur la page. */
.opening {
  font-weight: 700;
}
</style>
