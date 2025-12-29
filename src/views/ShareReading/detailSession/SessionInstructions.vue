<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div
    class="mb-8 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100 dark:from-blue-900/10 dark:to-indigo-900/10 dark:border-blue-800/30"
  >
    <h3 class="font-bold text-lg text-blue-900 mb-3 flex items-center gap-2 dark:text-blue-200">
      <i class="fa-solid fa-circle-info"></i> {{ t('detailSession.instructions.title') }}
    </h3>
    <ul class="list-disc list-inside space-y-2 text-blue-800/80 text-sm dark:text-blue-300">
      <li>{{ t('detailSession.instructions.step1') }}</li>
      <li>{{ t('detailSession.instructions.step2') }}</li>
      <li>{{ t('detailSession.instructions.step3') }}</li>
    </ul>
  </div>
</template>
