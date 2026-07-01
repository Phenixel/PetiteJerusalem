<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useToast, type ToastType } from "../composables/useToast";

const { t } = useI18n();
const { toasts, dismiss } = useToast();

const ICONS: Record<ToastType, string> = {
  success: "fa-solid fa-circle-check text-emerald-500",
  error: "fa-solid fa-circle-exclamation text-red-500",
  info: "fa-solid fa-circle-info text-primary",
};
</script>

<template>
  <div
    class="fixed bottom-6 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto flex items-center gap-3 w-full max-w-md px-4 py-3 rounded-xl bg-white shadow-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700"
      >
        <i :class="ICONS[toast.type]" class="text-lg shrink-0" aria-hidden="true"></i>
        <p class="flex-1 text-sm font-medium text-text-primary dark:text-gray-100">
          {{ toast.message }}
        </p>
        <button
          @click="dismiss(toast.id)"
          :aria-label="t('common.close')"
          class="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active,
.toast-move {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
