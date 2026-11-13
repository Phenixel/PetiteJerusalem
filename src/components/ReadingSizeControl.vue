<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useReadingSizeControl } from "../composables/useReadingSize";

/**
 * The text size control (A− / A+), shared by every reading screen: the
 * library reader, chnei mikra, the daily reading and the floating reading
 * menu. The text's size is common to the whole app (useReadingSize); while a
 * form of the page is on screen (the daf, the Sefer Torah), the control
 * drives that form's own size (usePageFormSize).
 */
const { t } = useI18n();
const readingSize = useReadingSizeControl();
</script>

<template>
  <div
    class="inline-flex items-center rounded-btn bg-black/5 dark:bg-white/10"
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
