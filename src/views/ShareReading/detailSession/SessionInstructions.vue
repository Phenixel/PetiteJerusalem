<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../../components/icons/AppIcon.vue";

const { t } = useI18n();
</script>

<template>
  <div class="mb-10">
    <h3 class="font-semibold text-text-primary mb-2 flex items-center gap-2">
      <AppIcon name="info" :size="15" class="text-primary" />
      {{ t("detailSession.instructions.title") }}
    </h3>
    <ul class="list-disc list-inside space-y-1 text-sm text-text-secondary">
      <li>{{ t("detailSession.instructions.step1") }}</li>
      <li>{{ t("detailSession.instructions.step2") }}</li>
      <li>{{ t("detailSession.instructions.step3") }}</li>
    </ul>
  </div>
</template>
