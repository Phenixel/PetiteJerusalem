<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  total: number
  participants: number
  reserved: number
  read: number
}>()

const stats = computed(() => {
  const { total, reserved, read } = props
  return {
    reservedPercentage: total > 0 ? (reserved / total) * 100 : 0,
    readPercentage: total > 0 ? (read / total) * 100 : 0,
    remaining: total - reserved,
  }
})
</script>

<template>
  <div class="mb-12 max-w-3xl mx-auto animate-[fadeIn_0.5s_ease_0.2s] fill-mode-backwards">
    <div class="flex items-end justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="text-3xl font-bold text-green-500 dark:text-green-400">
          {{ participants }}
        </span>
        <span
          class="text-sm font-medium text-green-600 dark:text-green-300 transform translate-y-[-2px]"
          >{{ t('progressBar.participants') }}</span
        >
      </div>
      <div class="flex items-center gap-1 text-text-secondary dark:text-gray-400">
        <span class="text-sm">{{ t('progressBar.total') }}</span>
        <span class="text-xl font-bold text-text-primary dark:text-gray-200">{{ total }}</span>
      </div>
    </div>

    <div class="relative h-3 bg-gray-600/30 rounded-full overflow-hidden mb-3">
      <div
        class="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 ease-out rounded-full"
        :style="{ width: `${stats.reservedPercentage}%` }"
      ></div>

      <div
        class="absolute top-0 left-0 h-full bg-green-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]"
        :style="{ width: `${stats.readPercentage}%` }"
      ></div>
    </div>

    <div class="flex items-center justify-start gap-6 text-xs font-medium">
      <div class="flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <div class="w-2 h-2 rounded-full bg-green-500"></div>
        <span>{{ read }} {{ t('progressBar.read') }}</span>
      </div>
      <div class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
        <span>{{ reserved }} {{ t('progressBar.reserved') }}</span>
      </div>
      <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <div class="w-2 h-2 rounded-full bg-gray-400"></div>
        <span>{{ stats.remaining }} {{ t('progressBar.remaining') }}</span>
      </div>
    </div>
  </div>
</template>
