<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ReportReason, Session } from "../models/models";
import { moderationService } from "../services/moderationService";
import { useToast } from "../composables/useToast";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Signalement d'une session (exigence App Store 1.2) : motif + détails
 * optionnels, avec la possibilité de bloquer le créateur dans la foulée.
 * Les signalements arrivent dans le backoffice ; au 3e signalement distinct
 * la session est masquée automatiquement.
 */

const { t } = useI18n();
const toast = useToast();

const props = defineProps<{
  show: boolean;
  session: Session | null;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "reported"): void;
  (e: "creator-blocked"): void;
}>();

const REASONS: ReportReason[] = ["inappropriate", "offensive", "spam", "other"];

const reason = ref<ReportReason>("inappropriate");
const details = ref("");
const blockCreator = ref(false);
const isSubmitting = ref(false);

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      reason.value = "inappropriate";
      details.value = "";
      blockCreator.value = false;
    }
  },
);

const closeModal = () => emit("update:show", false);

const submitReport = async () => {
  const session = props.session;
  if (!session || isSubmitting.value) return;

  try {
    isSubmitting.value = true;
    await moderationService.reportSession(session, reason.value, details.value);

    if (blockCreator.value && session.personId) {
      moderationService.blockCreator(session.personId);
    }

    toast.success(t("moderation.reportSuccess"));
    closeModal();
    emit("reported");
    if (blockCreator.value) {
      emit("creator-blocked");
    }
  } catch (error) {
    console.error("Erreur lors du signalement:", error);
    toast.errorFromException(error, t("moderation.reportError"));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="closeModal">
    <div class="modal-panel !max-w-md animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-xl font-bold text-text-primary">
          {{ t("moderation.reportTitle") }}
        </h3>
        <button @click="closeModal" class="icon-btn" :aria-label="t('common.close')">
          <AppIcon name="x" :size="16" />
        </button>
      </div>
      <p class="text-sm text-text-secondary mb-5">
        {{ t("moderation.reportSubtitle") }}
      </p>

      <form @submit.prevent="submitReport" class="space-y-5">
        <fieldset>
          <legend class="block text-sm font-semibold text-text-secondary mb-2">
            {{ t("moderation.reasonLabel") }}
          </legend>
          <div class="space-y-1.5">
            <label
              v-for="reasonOption in REASONS"
              :key="reasonOption"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
              :class="
                reason === reasonOption
                  ? 'bg-primary/10 text-text-primary'
                  : 'hover:bg-black/[0.03] dark:hover:bg-white/5'
              "
            >
              <input
                type="radio"
                name="report-reason"
                class="w-4 h-4 accent-primary cursor-pointer shrink-0"
                :value="reasonOption"
                v-model="reason"
              />
              <span class="text-sm font-medium">
                {{ t(`moderation.reasons.${reasonOption}`) }}
              </span>
            </label>
          </div>
        </fieldset>

        <div>
          <label for="report-details" class="block text-sm font-semibold text-text-secondary mb-2">
            {{ t("moderation.detailsLabel") }}
            <span class="font-normal text-text-secondary/70">
              ({{ t("guestForm.optional") }})
            </span>
          </label>
          <textarea
            id="report-details"
            v-model="details"
            class="field resize-y"
            rows="3"
            maxlength="1000"
            :placeholder="t('moderation.detailsPlaceholder')"
          ></textarea>
        </div>

        <!-- Bloquer le créateur (exigence App Store : pouvoir bloquer les
             utilisateurs abusifs) : ses sessions disparaissent de cet appareil. -->
        <label v-if="session?.personId" class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            v-model="blockCreator"
            class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer shrink-0"
          />
          <span>
            <span class="block text-sm font-semibold text-text-primary">
              {{ t("moderation.blockCreator") }}
            </span>
            <span class="block text-xs text-text-secondary mt-0.5">
              {{ t("moderation.blockCreatorHint") }}
            </span>
          </span>
        </label>

        <div class="flex gap-3 pt-1">
          <button type="button" @click="closeModal" class="btn btn-soft flex-1">
            {{ t("common.cancel") }}
          </button>
          <button type="submit" class="btn btn-danger flex-1" :disabled="isSubmitting">
            <AppIcon v-if="isSubmitting" name="spinner" :size="15" class="animate-spin" />
            <AppIcon v-else name="flag" :size="14" />
            {{ isSubmitting ? t("moderation.reporting") : t("moderation.reportButton") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
