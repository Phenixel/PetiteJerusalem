<script setup lang="ts">
import { useI18n } from "vue-i18n";

defineProps<{
  userDisplayName: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="py-16 px-6 md:px-12 mb-12">
    <div class="max-w-[1200px] mx-auto">
      <div class="flex flex-wrap items-center gap-4">
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
          {{ userDisplayName }}
        </h1>
        <span class="chip bg-primary/10 text-primary">{{ t("profile.activeMember") }}</span>
      </div>
    </div>
  </div>
</template>
