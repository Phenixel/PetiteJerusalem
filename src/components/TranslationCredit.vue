<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { TranslationSource } from "../services/textService";

/**
 * D'où vient la traduction affichée : son nom, son auteur, sa licence, et le
 * texte chez Sefaria. Les licences sous lesquelles on la reprend le
 * demandent (CC BY, CC BY-NC), et le lecteur doit savoir qui il lit. Posée à
 * la fin du texte, là où se lit ce qui clôt une page.
 */
defineProps<{ sources: TranslationSource[] }>();

const { t } = useI18n();

/** « CC-BY-NC » → « CC BY-NC » ; le domaine public dans la langue du lecteur. */
function licenseLabel(source: TranslationSource): string {
  if (source.license === "Public Domain") return t("textReading.translation.publicDomain");
  return source.license.replace(/^CC-/, "CC ");
}
</script>

<template>
  <aside class="mt-10 text-sm text-text-secondary">
    <p class="font-semibold text-text-primary">{{ t("textReading.translation.credit") }}</p>
    <ul class="mt-1 space-y-1">
      <li v-for="source in sources" :key="source.url">
        <a
          :href="source.url"
          target="_blank"
          rel="noopener"
          class="underline underline-offset-2 hover:text-primary transition-colors"
          >{{ source.name }}</a
        ><template v-if="source.by">, {{ source.by }}</template
        ><template v-if="source.year">, {{ source.year }}</template
        ><template v-if="source.publisher"> ({{ source.publisher }})</template>
        ·
        <a
          v-if="source.licenseUrl"
          :href="source.licenseUrl"
          target="_blank"
          rel="noopener"
          class="underline underline-offset-2 hover:text-primary transition-colors"
          >{{ licenseLabel(source) }}</a
        >
        <template v-else>{{ licenseLabel(source) }}</template>
      </li>
    </ul>
    <p class="mt-1 text-xs">{{ t("textReading.translation.sefariaNote") }}</p>
  </aside>
</template>
