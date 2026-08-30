<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useConsent } from "../composables/useConsent";
import { isOnboardingOpen } from "../composables/useOnboarding";
import { isNativeApp } from "../composables/useNativeApp";
import { useLocalePath } from "../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

/**
 * Bannière de consentement à la mesure d'audience (PostHog). Affichée tant
 * qu'aucun choix n'a été fait ; réouvrable via « Gérer les cookies » (footer,
 * onglet À propos). Le suivi ne démarre qu'après « Accepter » (analyticsService).
 *
 * À la toute première ouverture, c'est l'introduction qui pose la question, sur
 * une page entière et avec les explications qui vont avec : la bannière se tait
 * tant qu'elle est à l'écran, pour ne pas demander deux fois la même chose.
 */

const { t } = useI18n();
const { choice, setChoice } = useConsent();
</script>

<template>
  <Transition name="consent-slide">
    <div
      v-if="choice === null && !isOnboardingOpen"
      class="fixed inset-x-0 z-50 p-4"
      :class="isNativeApp ? 'bottom-[calc(3.5rem+var(--safe-bottom))]' : 'bottom-0'"
      role="dialog"
      aria-live="polite"
      :aria-label="t('consent.title')"
    >
      <div class="mx-auto max-w-2xl card p-5 shadow-lg">
        <p class="font-semibold text-text-primary mb-1">{{ t("consent.title") }}</p>
        <p class="text-sm text-text-secondary mb-4">
          {{ t("consent.message") }}
          <RouterLink :to="localePath('confidentialite')" class="underline hover:text-primary">
            {{ t("consent.learnMore") }}
          </RouterLink>
        </p>
        <div class="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button class="btn btn-soft" type="button" @click="setChoice('denied')">
            {{ t("consent.decline") }}
          </button>
          <button class="btn btn-primary" type="button" @click="setChoice('granted')">
            {{ t("consent.accept") }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.consent-slide-enter-active,
.consent-slide-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s ease;
}

.consent-slide-enter-from,
.consent-slide-leave-to {
  transform: translateY(1.5rem);
  opacity: 0;
}
</style>
