<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isAiTranslation, type TranslationSource } from "../services/textService";

/**
 * Avant une traduction faite par IA (le français tiré de l'anglais, voir
 * docs/traductions.md) : une phrase dit d'où elle vient et qu'elle peut
 * contenir des erreurs. Rien pour une traduction humaine.
 */
const props = defineProps<{ sources: TranslationSource[] | undefined }>();

const { t } = useI18n();

const shown = computed(() => isAiTranslation(props.sources));
</script>

<template>
  <p v-if="shown" class="text-sm text-text-secondary">
    {{ t("textReading.translation.aiNotice") }}
  </p>
</template>
