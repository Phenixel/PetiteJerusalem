<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  userDisplayName: string
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="relative overflow-hidden mb-12 py-16 px-6 md:px-12 bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
  >
    <div
      class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=')] opacity-30"
    ></div>
    <div class="relative z-10 max-w-[1200px] mx-auto">
      <div class="flex items-center gap-4 mb-2">
        <h1 class="text-4xl md:text-5xl font-bold text-white tracking-tight">
          {{ userDisplayName }}
        </h1>
        <span
          class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wider uppercase border border-white/20"
          >{{ t('profile.activeMember') }}</span
        >
      </div>
    </div>
  </div>
</template>
