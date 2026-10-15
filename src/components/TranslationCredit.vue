<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TranslationSource } from "../services/textService";

/**
 * Qui a traduit le texte affiché : son nom, et rien d'autre. Posé à la fin du
 * texte, là où se lit ce qui clôt une page.
 *
 * Le nom mène à la traduction chez Sefaria, dont la page donne l'édition et
 * la licence : les licences CC admettent qu'on les cite par un lien vers ce
 * qui les porte, et la page de lecture reste sobre.
 */
const props = defineProps<{ sources: TranslationSource[] }>();

const { t } = useI18n();

/** Une ligne par traducteur, même s'il signe plusieurs sources du texte. */
const translators = computed(() => {
  const seen = new Set<string>();
  return props.sources.filter((source) => {
    const name = source.by ?? source.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
});
</script>

<template>
  <p class="mt-10 text-sm text-text-secondary">
    {{ t("textReading.translation.credit") }}
    <template v-for="(source, index) in translators" :key="source.url"
      ><template v-if="index > 0">, </template
      ><a
        :href="source.url"
        target="_blank"
        rel="noopener"
        class="underline underline-offset-2 hover:text-primary transition-colors"
        >{{ source.by ?? source.name }}</a
      ></template
    >
  </p>
</template>
