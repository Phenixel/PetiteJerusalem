<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

defineProps<{
  count: number;
  loading?: boolean;
  label?: string;
  buttonText?: string;
  buttonLoadingText?: string;
}>();

defineEmits<{
  (e: "confirm"): void;
}>();
</script>

<template>
  <div v-if="count > 0" class="fixed bottom-0 left-0 right-0 p-4 z-50 animate-[fadeIn_0.3s_ease]">
    <div
      class="max-w-2xl mx-auto bg-surface shadow-pop rounded-lg p-4 flex items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary"
        >
          <AppIcon name="check-double" :size="18" />
        </div>
        <div>
          <p class="font-bold text-text-primary">
            {{ t("batchSelection.textsSelected", { count }) }}
          </p>
          <p v-if="label" class="text-xs text-text-secondary">
            {{ label }}
          </p>
        </div>
      </div>

      <button @click="$emit('confirm')" :disabled="loading" class="btn btn-primary">
        <AppIcon v-if="loading" name="spinner" :size="15" class="animate-spin" />
        <AppIcon v-else name="check" :size="15" />
        {{ loading ? buttonLoadingText || t("common.loading") : buttonText || t("common.confirm") }}
      </button>
    </div>
  </div>
</template>
