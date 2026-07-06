<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { pushService } from "../../services/pushService";
import { userPreferencesService } from "../../services/userPreferencesService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * Réglage du rappel de lecture quotidienne par notification push.
 * N'est monté que dans l'app native (l'onglet est masqué sur le web).
 */

const props = defineProps<{ userId: string }>();
const { t, locale } = useI18n();
const toast = useToast();

const loading = ref(true);
const busy = ref(false);
const enabled = ref(false);
const permissionDenied = ref(false);

onMounted(async () => {
  try {
    const prefs = await userPreferencesService.getPreferences(props.userId);
    enabled.value = prefs.pushReminderEnabled === true;
    permissionDenied.value = (await pushService.getPermissionStatus()) === "denied";
  } finally {
    loading.value = false;
  }
});

async function toggle() {
  busy.value = true;
  try {
    if (enabled.value) {
      await pushService.disable(props.userId);
      enabled.value = false;
    } else {
      await pushService.enable(props.userId, String(locale.value));
      enabled.value = true;
      permissionDenied.value = false;
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "PERMISSION_DENIED") {
      permissionDenied.value = true;
      toast.error(t("notifications.permissionDenied"));
    } else {
      toast.error(t("notifications.error"));
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card p-6">
    <h2 class="text-2xl font-bold text-text-primary mb-2 flex items-center gap-3">
      <AppIcon name="bell" :size="20" class="text-primary" />
      {{ t("notifications.title") }}
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      {{ t("notifications.description") }}
    </p>

    <div v-if="loading" class="flex items-center gap-2 text-text-secondary">
      <AppIcon name="spinner" :size="15" class="animate-spin" />
      {{ t("common.loading") }}
    </div>

    <template v-else>
      <button class="btn w-full sm:w-auto" :class="enabled ? 'btn-soft' : 'btn-primary'" :disabled="busy" @click="toggle">
        <AppIcon v-if="busy" name="spinner" :size="15" class="animate-spin" />
        <AppIcon v-else name="bell" :size="15" />
        {{ enabled ? t("notifications.disable") : t("notifications.enable") }}
      </button>

      <p v-if="enabled" class="mt-4 flex items-center gap-2 text-sm text-primary">
        <AppIcon name="circle-check" :size="14" />
        {{ t("notifications.enabled") }}
      </p>
      <p
        v-if="permissionDenied"
        class="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
      >
        <AppIcon name="alert-circle" :size="14" />
        {{ t("notifications.permissionDenied") }}
      </p>
    </template>
  </section>
</template>
