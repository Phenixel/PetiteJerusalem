<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import { isNativeApp } from "../../composables/useNativeApp";
import {
  ensureNotificationPermission,
  refreshPermission,
  useZmanReminders,
} from "../../composables/useZmanReminders";
import { announcementsPushEnabled, setAnnouncementsPush } from "../../services/announcementTopics";
import { analyticsService } from "../../services/analyticsService";

/**
 * « Être prévenu » : la page des informations est le bon moment pour demander
 * la permission de notifier, puisqu'on y vient chercher des nouvelles. Le
 * bouton n'apparaît que dans l'app, tant que le système n'a jamais posé la
 * question ; refusée, elle ne se redemande pas d'ici (voir les réglages).
 */
const { t, locale } = useI18n();
const { permission } = useZmanReminders();

const visible = computed(
  () => isNativeApp && announcementsPushEnabled.value && permission.value === "prompt",
);

onMounted(() => void refreshPermission());

async function ask(): Promise<void> {
  const granted = await ensureNotificationPermission(true);
  analyticsService.capture("announcements_push_prompt", { granted });
  if (granted) await setAnnouncementsPush(true, String(locale.value));
}
</script>

<template>
  <button v-if="visible" type="button" class="btn btn-soft btn-sm" @click="ask">
    <AppIcon name="bell" :size="14" />
    {{ t("announcements.pushPrompt") }}
  </button>
</template>
