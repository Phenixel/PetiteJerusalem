<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useReadingSize } from "../composables/useReadingSize";

/**
 * Le réglage de la taille du texte (A− / A+), partagé par tous les écrans de
 * lecture : le lecteur de la bibliothèque, le chnei mikra, la lecture du jour
 * et le menu de lecture flottant. La préférence, elle, est commune à toute
 * l'application (useReadingSize).
 */
const { t } = useI18n();
const readingSize = useReadingSize();
</script>

<template>
  <div
    class="inline-flex items-center rounded-lg bg-black/5 dark:bg-white/10"
    role="group"
    :aria-label="t('textReading.textSize')"
  >
    <button
      @click="readingSize.decrease()"
      :disabled="!readingSize.canDecrease.value"
      class="px-3 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
      :aria-label="t('textReading.textSizeDecrease')"
      :title="t('textReading.textSizeDecrease')"
    >
      A−
    </button>
    <button
      @click="readingSize.increase()"
      :disabled="!readingSize.canIncrease.value"
      class="px-3 py-1.5 text-base font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
      :aria-label="t('textReading.textSizeIncrease')"
      :title="t('textReading.textSizeIncrease')"
    >
      A+
    </button>
  </div>
</template>
