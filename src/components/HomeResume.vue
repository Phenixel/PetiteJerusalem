<script setup lang="ts">
/**
 * Reprendre, sur l'accueil : le dernier texte lu, au verset près, comme la
 * ligne de la bibliothèque. Un bloc de l'accueil qu'on remet si on le veut
 * (useHomeLayout) ; rien à reprendre, il s'efface.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { readingProgressService } from "../services/readingProgressService";

const emit = defineEmits<{ (e: "open"): void }>();

const { t } = useI18n();

const last = readingProgressService.getResumePosition();
const link = computed(() =>
  last ? { path: last.path, query: { verset: String(last.line) } } : null,
);
</script>

<template>
  <RouterLink
    v-if="last && link"
    :to="link"
    class="card card-hover flex items-center justify-between gap-3 p-[18px]"
    @click="emit('open')"
  >
    <span class="min-w-0">
      <span class="block text-[13px] text-text-secondary">{{
        t("home.edit.blocks.reprendre.title")
      }}</span>
      <span class="mt-0.5 block truncate text-[17px] font-bold">{{ last.label }}</span>
    </span>
  </RouterLink>
</template>
