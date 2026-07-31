<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../../components/icons/AppIcon.vue";

defineProps<{
  loading: boolean;
  availableCount: number;
}>();

const emit = defineEmits<{
  (e: "draw"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="card p-5 mb-8 max-w-3xl mx-auto text-center">
    <h3 class="font-bold text-lg text-text-primary">
      {{ t("detailSession.randomDraw.title") }}
    </h3>
    <p class="text-sm text-text-secondary mt-0.5 mb-4">
      {{ t("detailSession.randomDraw.subtitle") }}
    </p>
    <button
      @click="emit('draw')"
      class="btn btn-primary"
      :disabled="loading || availableCount === 0"
    >
      <AppIcon
        :name="loading ? 'spinner' : 'shuffle'"
        :size="16"
        :class="{ 'animate-spin': loading }"
      />
      {{ loading ? t("detailSession.randomDraw.drawing") : t("detailSession.randomDraw.button") }}
    </button>
    <p v-if="availableCount === 0" class="text-sm text-text-secondary mt-3">
      {{ t("detailSession.randomDraw.noneAvailable") }}
    </p>
  </div>
</template>
