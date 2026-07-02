<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { sessionService } from "../../../services/sessionService";
import type { Session } from "../../../models/models";
import AppIcon from "../../../components/icons/AppIcon.vue";

const { t } = useI18n();

defineProps<{
  session: Session;
  isOwner?: boolean;
}>();

const emit = defineEmits<{
  (e: "share"): void;
  (e: "manage"): void;
}>();
</script>

<template>
  <div class="mb-12 text-center max-w-3xl mx-auto">
    <h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
      {{ session.name }}
    </h2>
    <p class="text-text-secondary text-lg mb-6">{{ session.description }}</p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <span class="chip bg-primary/10 text-primary">{{
        sessionService.formatTextType(session.type)
      }}</span>
      <span class="chip bg-black/5 text-text-secondary dark:bg-white/10"
        >{{ t("common.dateLimit") }} : {{ sessionService.formatDate(session.dateLimit) }}</span
      >
      <span class="chip bg-black/5 text-text-secondary dark:bg-white/10"
        >{{ t("common.createdBy") }} : {{ session.creatorName }}</span
      >
      <button
        v-if="isOwner"
        @click="emit('manage')"
        class="btn btn-primary !px-3.5 !py-1.5 !text-sm"
        :title="t('detailSession.manageSession')"
      >
        <AppIcon name="settings" :size="14" />
        {{ t("common.manage") }}
      </button>
      <button
        @click="emit('share')"
        class="btn btn-soft !px-3.5 !py-1.5 !text-sm"
        :title="t('common.share')"
      >
        <AppIcon name="share" :size="14" />
        {{ t("common.share") }}
      </button>
    </div>
  </div>
</template>
