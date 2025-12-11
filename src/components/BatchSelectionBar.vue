<script setup lang="ts">
defineProps<{
  count: number
  loading?: boolean
  label?: string
  buttonText?: string
  buttonLoadingText?: string
}>()

defineEmits<{
  (e: 'confirm'): void
}>()
</script>

<template>
  <div
    v-if="count > 0"
    class="fixed bottom-0 left-0 right-0 p-4 z-50 animate-[slideUp_0.3s_ease-out]"
  >
    <div
      class="max-w-2xl mx-auto bg-white/95 backdrop-blur-xl border border-primary/20 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] rounded-2xl p-4 flex items-center justify-between gap-4 dark:bg-gray-800/95 dark:border-primary/30"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
        >
          <i class="fa-solid fa-check-double text-lg"></i>
        </div>
        <div>
          <p class="font-bold text-text-primary dark:text-gray-100">
            {{ count }} texte{{ count > 1 ? 's' : '' }} sélectionné{{ count > 1 ? 's' : '' }}
          </p>
          <p v-if="label" class="text-xs text-text-secondary dark:text-gray-400">
            {{ label }}
          </p>
        </div>
      </div>

      <button
        @click="$emit('confirm')"
        :disabled="loading"
        class="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transform hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
      >
        <i class="fa-solid" :class="loading ? 'fa-circle-notch fa-spin' : 'fa-check'"></i>
        {{ loading ? buttonLoadingText || 'Chargement...' : buttonText || 'Confirmer' }}
      </button>
    </div>
  </div>
</template>
