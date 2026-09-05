<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { sessionService } from "../../../services/sessionService";
import type { Session } from "../../../models/models";
import AppIcon from "../../../components/icons/AppIcon.vue";

const { t } = useI18n();

defineProps<{
  session: Session;
  isOwner?: boolean;
  hasReported?: boolean;
}>();

const emit = defineEmits<{
  (e: "share"): void;
  (e: "manage"): void;
  (e: "edit"): void;
  (e: "report"): void;
}>();
</script>

<template>
  <div class="mb-12 text-center max-w-3xl mx-auto">
    <h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4">
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
      <!-- Corriger un intitulé ou une date depuis la page où on s'en aperçoit -->
      <button
        v-if="isOwner && sessionService.canEditSession(session)"
        @click="emit('edit')"
        class="btn btn-soft !px-3.5 !py-1.5 !text-sm"
        :title="t('common.edit')"
      >
        <AppIcon name="pencil" :size="14" />
        {{ t("common.edit") }}
      </button>
      <button
        @click="emit('share')"
        class="btn btn-soft !px-3.5 !py-1.5 !text-sm"
        :title="t('common.share')"
      >
        <AppIcon name="share" :size="14" />
        {{ t("common.share") }}
      </button>
      <!-- Signalement (modération App Store) : ouvert à tous sauf au créateur,
           désactivé une fois la session signalée depuis cet appareil. -->
      <button
        v-if="!isOwner"
        @click="emit('report')"
        class="btn btn-soft !px-3.5 !py-1.5 !text-sm"
        :disabled="hasReported"
        :title="hasReported ? t('moderation.alreadyReported') : t('moderation.reportButton')"
      >
        <AppIcon name="flag" :size="14" />
        {{ hasReported ? t("moderation.reported") : t("moderation.reportButton") }}
      </button>
    </div>
  </div>
</template>
