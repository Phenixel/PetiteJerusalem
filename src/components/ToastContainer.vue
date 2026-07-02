<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useToast, type ToastType } from "../composables/useToast";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";

const { t } = useI18n();
const { toasts, dismiss } = useToast();

const ICONS: Record<ToastType, { name: IconName; class: string }> = {
  success: { name: "circle-check", class: "text-emerald-500" },
  error: { name: "alert-circle", class: "text-red-500" },
  info: { name: "info", class: "text-primary" },
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
        class="pointer-events-auto flex items-center gap-3 w-full max-w-md px-4 py-3 rounded-xl bg-surface shadow-pop"
      >
        <AppIcon
          :name="ICONS[toast.type].name"
          :size="18"
          :class="ICONS[toast.type].class"
          class="shrink-0"
        />
        <p class="flex-1 text-sm font-medium text-text-primary">
          {{ toast.message }}
        </p>
        <button
          @click="dismiss(toast.id)"
          :aria-label="t('common.close')"
          class="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors dark:hover:bg-white/10"
        >
          <AppIcon name="x" :size="14" />
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
