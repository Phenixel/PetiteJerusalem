<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useLocalePath } from "../../composables/useLocalePath";
import type { ConsentChoice } from "../../composables/useConsent";

/**
 * Première page de l'introduction : la mesure d'audience, expliquée avant
 * d'être proposée. Elle remplace la bannière du bas pour qui découvre
 * l'application : le choix se fait en connaissance de cause, sur un écran
 * entier, plutôt qu'au pied d'une page qu'on n'a pas encore lue.
 *
 * Aucun bouton « plus tard » : ePrivacy demande un choix explicite, et rien
 * n'est mesuré tant qu'il n'est pas fait (analyticsService).
 */

const { t } = useI18n();
const { localePath } = useLocalePath();

const emit = defineEmits<{ (e: "choose", choice: ConsentChoice): void }>();

const points = [
  { titleKey: "onboarding.consent.whatTitle", textKey: "onboarding.consent.whatText" },
  { titleKey: "onboarding.consent.whyTitle", textKey: "onboarding.consent.whyText" },
  { titleKey: "onboarding.consent.neverTitle", textKey: "onboarding.consent.neverText" },
] as const;
</script>

<template>
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-primary mb-2">
      {{ t("onboarding.consent.welcome") }}
    </p>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.consent.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.consent.intro") }}
    </p>

    <dl class="mb-8 space-y-4">
      <div v-for="point in points" :key="point.titleKey">
        <dt class="font-semibold text-text-primary">{{ t(point.titleKey) }}</dt>
        <dd class="mt-0.5 text-sm text-text-secondary">{{ t(point.textKey) }}</dd>
      </div>
    </dl>

    <div class="flex flex-col sm:flex-row gap-3">
      <button type="button" class="btn btn-soft flex-1" @click="emit('choose', 'denied')">
        {{ t("onboarding.consent.decline") }}
      </button>
      <button type="button" class="btn btn-primary flex-1" @click="emit('choose', 'granted')">
        {{ t("onboarding.consent.accept") }}
      </button>
    </div>

    <p class="text-sm text-text-secondary mt-5">
      {{ t("onboarding.consent.changeHint") }}
      <RouterLink :to="localePath('confidentialite')" class="underline hover:text-primary">
        {{ t("onboarding.consent.learnMore") }}
      </RouterLink>
    </p>
  </div>
</template>
