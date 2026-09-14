<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { useBottomChromeHeight } from "../composables/useBottomChrome";
import { useConsent } from "../composables/useConsent";
import { openFeedback } from "../composables/useFeedback";
import { isOnboardingOpen } from "../composables/useOnboarding";
import { hasOpenOverlay } from "../composables/useOverlayStack";
import { analyticsService } from "../services/analyticsService";
import {
  markNudgeAnswered,
  markNudgeShown,
  readNudgeState,
  shouldOfferFeedbackNudge,
  usageDayCount,
} from "../services/feedbackNudge";

/**
 * « Tout se passe bien ? » : la relance du formulaire de support.
 *
 * Elle ne vit que sur l'accueil (c'est là qu'elle est montée), donc jamais
 * pendant une lecture. Elle attend quelques secondes après l'arrivée, puis ne
 * se montre que si rien d'autre ne réclame l'attention : ni l'introduction,
 * ni une fenêtre ouverte, ni la bannière de consentement encore sans réponse,
 * ni un chiour en cours d'écoute. Quitter l'accueil avant qu'elle n'apparaisse
 * l'annule sans trace ; la règle du « quand » est dans feedbackNudge.ts.
 */

const { t } = useI18n();
const route = useRoute();
const { choice: consentChoice } = useConsent();
const miniPlayerVisible = useMiniPlayerVisible();
// Posée au-dessus des barres du bas (bottom bar native, mini-lecteur).
const bottomOffset = useBottomChromeHeight("1rem");

/** Le temps de voir la page avant qu'on lui pose une question. */
const DELAY_MS = 4000;

/** L'accueil, dans chacune de ses langues : « home », « home-en », « home-he ». */
const isHomeRoute = () => /^home(-|$)/.test(String(route.name ?? ""));

const visible = ref(false);
let timer: number | null = null;

onMounted(() => {
  const wanted = shouldOfferFeedbackNudge({
    usageDays: usageDayCount(),
    state: readNudgeState(),
    now: new Date(),
  });
  if (!wanted) return;
  timer = window.setTimeout(() => {
    timer = null;
    const quiet =
      isHomeRoute() &&
      !document.hidden &&
      !isOnboardingOpen.value &&
      !hasOpenOverlay() &&
      consentChoice.value !== null &&
      !miniPlayerVisible.value;
    if (!quiet) return;
    visible.value = true;
    markNudgeShown();
    analyticsService.capture("feedback_nudge_shown");
  }, DELAY_MS);
});

onBeforeUnmount(() => {
  if (timer !== null) window.clearTimeout(timer);
});

function answer(kind: "fine" | "feedback"): void {
  visible.value = false;
  markNudgeAnswered();
  analyticsService.capture("feedback_nudge_answered", { answer: kind });
  if (kind === "feedback") openFeedback();
}
</script>

<template>
  <Transition name="nudge">
    <div
      v-if="visible"
      class="card fixed inset-x-4 z-40 mx-auto max-w-sm p-5 [box-shadow:var(--shadow-pop)] sm:inset-x-auto sm:end-6"
      :style="{ bottom: bottomOffset }"
      role="dialog"
      aria-labelledby="feedback-nudge-title"
    >
      <p id="feedback-nudge-title" class="font-bold text-text-primary">
        {{ t("feedback.nudge.title") }}
      </p>
      <p class="mt-1 text-sm leading-relaxed text-text-secondary">
        {{ t("feedback.nudge.body") }}
      </p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-soft btn-sm" @click="answer('fine')">
          {{ t("feedback.nudge.fine") }}
        </button>
        <button type="button" class="btn btn-primary btn-sm" @click="answer('feedback')">
          {{ t("feedback.nudge.tell") }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nudge-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.nudge-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.nudge-enter-from,
.nudge-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
@media (prefers-reduced-motion: reduce) {
  .nudge-enter-active,
  .nudge-leave-active {
    transition: none;
  }
}
</style>
