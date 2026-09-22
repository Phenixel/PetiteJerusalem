<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";
import { useToast } from "../composables/useToast";
import { feedbackPrefill, isFeedbackOpen, closeFeedback } from "../composables/useFeedback";
import { analyticsService } from "../services/analyticsService";
import {
  feedbackContext,
  sendFeedback,
  type FeedbackContext,
  type FeedbackKind,
} from "../services/feedbackService";

/**
 * Le formulaire de support : une idée, un bug, une erreur dans un texte, ou
 * autre chose. Il remplace le formulaire Notion externe et alimente la même
 * base (Cloud Function `submitFeedback`).
 *
 * La personne dit de quoi il s'agit et donne des détails ; elle laisse un
 * moyen de la recontacter seulement si elle coche la case. Le support, la
 * plateforme et la version partent avec le message, et la fenêtre le dit :
 * on n'envoie rien à son insu.
 */

const { t } = useI18n();
const toast = useToast();

const KINDS: FeedbackKind[] = ["idea", "bug", "error", "other"];

const kind = ref<FeedbackKind>("idea");
const otherKind = ref("");
const details = ref("");
const canContact = ref(false);
const contact = ref("");
const isSubmitting = ref(false);

const context = ref<FeedbackContext | null>(null);
onMounted(async () => {
  context.value = await feedbackContext();
});

/** « Application iOS, version 1.4.2 (37) » : ce qui part avec le message. */
const contextLabel = computed(() => {
  const ctx = context.value;
  if (!ctx) return "";
  const support = t(`feedback.context.${ctx.support}`);
  const platform = ctx.support === "app" ? ` ${t(`feedback.context.${ctx.platform}`)}` : "";
  return `${support}${platform}, ${t("feedback.context.version", { version: ctx.version })}`;
});

/**
 * Le champ des détails : quand l'ouverture l'a pré-rempli (un signalement
 * parti d'un passage de texte), le clavier y va directement, curseur APRÈS ce
 * qui est déjà écrit. Le focus seul ne suffit pas : selon les navigateurs, il
 * laisse le curseur au tout début, c'est-à-dire devant l'emplacement du
 * passage, que la personne se met alors à écraser.
 */
const detailsField = ref<HTMLTextAreaElement | null>(null);
const isPrefilled = ref(false);

// `immediate` : la fenêtre n'est montée qu'à la première ouverture (voir
// App.vue), et l'état est donc DÉJÀ ouvert quand ce suivi se pose. Sans lui,
// la toute première ouverture n'appliquait rien, et une amorce se perdait.
watch(
  isFeedbackOpen,
  (open) => {
    if (!open) return;
    const prefill = feedbackPrefill.value;
    isPrefilled.value = prefill !== null;
    kind.value = prefill?.kind ?? "idea";
    otherKind.value = "";
    details.value = prefill?.details ?? "";
    canContact.value = false;
    contact.value = "";
    if (!prefill) return;
    void nextTick(() => {
      const field = detailsField.value;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  },
  { immediate: true },
);

const canSubmit = computed(
  () => details.value.trim().length > 0 && (!canContact.value || contact.value.trim().length > 0),
);

async function submit(): Promise<void> {
  if (!canSubmit.value || isSubmitting.value) return;
  try {
    isSubmitting.value = true;
    await sendFeedback({
      kind: kind.value,
      otherKind: kind.value === "other" ? otherKind.value.trim() : "",
      details: details.value.trim(),
      contact: canContact.value ? contact.value.trim() : "",
    });
    analyticsService.capture("feedback_sent", { kind: kind.value, contact: canContact.value });
    toast.success(t("feedback.success"));
    closeFeedback();
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de support:", error);
    toast.errorFromException(error, t("feedback.error"));
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="isFeedbackOpen"
    labelledby="feedback-title"
    panel-class="modal-panel !max-w-md animate-[scaleIn_0.3s_ease]"
    @close="closeFeedback"
  >
    <div class="flex justify-between items-center mb-2">
      <h3 id="feedback-title" class="text-xl font-bold text-text-primary">
        {{ t("feedback.title") }}
      </h3>
      <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="closeFeedback">
        <AppIcon name="x" :size="16" />
      </button>
    </div>
    <p class="text-sm text-text-secondary mb-5">
      {{ t("feedback.subtitle") }}
    </p>

    <form class="space-y-5" @submit.prevent="submit">
      <fieldset>
        <legend class="block text-sm font-semibold text-text-secondary mb-2">
          {{ t("feedback.kindLabel") }}
        </legend>
        <div class="space-y-1.5">
          <label
            v-for="option in KINDS"
            :key="option"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            :class="
              kind === option
                ? 'bg-primary/10 text-text-primary'
                : 'hover:bg-black/[0.03] dark:hover:bg-white/5'
            "
          >
            <input
              type="radio"
              name="feedback-kind"
              class="w-4 h-4 accent-primary cursor-pointer shrink-0"
              :value="option"
              v-model="kind"
              :data-autofocus="!isPrefilled && option === 'idea' ? '' : undefined"
            />
            <span class="text-sm font-medium">{{ t(`feedback.kinds.${option}`) }}</span>
          </label>
        </div>
      </fieldset>

      <div v-if="kind === 'other'">
        <label for="feedback-other" class="block text-sm font-semibold text-text-secondary mb-2">
          {{ t("feedback.otherLabel") }}
        </label>
        <input
          id="feedback-other"
          v-model="otherKind"
          type="text"
          class="field"
          maxlength="200"
          :placeholder="t('feedback.otherPlaceholder')"
        />
      </div>

      <div>
        <label for="feedback-details" class="block text-sm font-semibold text-text-secondary mb-2">
          {{ t("feedback.detailsLabel") }}
        </label>
        <textarea
          id="feedback-details"
          ref="detailsField"
          v-model="details"
          :data-autofocus="isPrefilled ? '' : undefined"
          class="field resize-y"
          rows="4"
          maxlength="2000"
          required
          :placeholder="t('feedback.detailsPlaceholder')"
        ></textarea>
      </div>

      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            v-model="canContact"
            class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer shrink-0"
          />
          <span>
            <span class="block text-sm font-semibold text-text-primary">
              {{ t("feedback.contactToggle") }}
            </span>
            <span class="block text-xs text-text-secondary mt-0.5">
              {{ t("feedback.contactHint") }}
            </span>
          </span>
        </label>
        <div v-if="canContact">
          <label
            for="feedback-contact"
            class="block text-sm font-semibold text-text-secondary mb-2"
          >
            {{ t("feedback.contactLabel") }}
          </label>
          <input
            id="feedback-contact"
            v-model="contact"
            type="text"
            class="field"
            maxlength="200"
            autocomplete="email"
            inputmode="email"
            :placeholder="t('feedback.contactPlaceholder')"
          />
        </div>
      </div>

      <!-- Ce qu'on joint sans le demander : dit en clair, pour que rien ne
           parte à l'insu de la personne. -->
      <p v-if="contextLabel" class="text-xs text-text-secondary">
        {{ t("feedback.contextNote", { context: contextLabel }) }}
      </p>

      <div class="flex gap-3 pt-1">
        <button type="button" class="btn btn-soft flex-1" @click="closeFeedback">
          {{ t("common.cancel") }}
        </button>
        <button type="submit" class="btn btn-primary flex-1" :disabled="isSubmitting || !canSubmit">
          <AppIcon v-if="isSubmitting" name="spinner" :size="15" class="animate-spin" />
          <AppIcon v-else name="message" :size="15" />
          {{ isSubmitting ? t("feedback.sending") : t("feedback.send") }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
