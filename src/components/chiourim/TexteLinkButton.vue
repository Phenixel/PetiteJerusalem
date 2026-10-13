<script setup lang="ts">
/**
 * « Lire le texte » : d'un cours ou d'une série vers le livre de la
 * bibliothèque qu'il étudie, au chapitre près. Une commande qui porte son
 * dessin et son nom (voir docs/design.md), à côté du bouton d'écoute.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../../models/models";
import { texteRoute } from "../../services/chiourTexte";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{
  entry: TextStudyJsonEntry;
  chapitre: number | null;
  /** D'où l'on part (propriété `source` de `chiour_text_opened`). */
  source: "chiour" | "serie";
  chiourSlug?: string | null;
}>();

const { t } = useI18n();
const to = computed(() => texteRoute(props.entry, props.chapitre));

function track() {
  analyticsService.capture("chiour_text_opened", {
    source: props.source,
    chiour_slug: props.chiourSlug ?? null,
    texte_id: Number(props.entry.id),
    chapitre: props.chapitre,
  });
}
</script>

<template>
  <router-link :to="to" class="btn btn-soft !rounded-pill" @click="track">
    <AppIcon name="book-open" :size="16" />
    {{ t("chiourim.texte.read") }}
  </router-link>
</template>
