<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockDailyReading from "./mock/MockDailyReading.vue";

/**
 * Troisième page : la lecture quotidienne. C'est la fonctionnalité la moins
 * devinée de l'application (« ma liste de textes du jour, suivie et cochée »),
 * d'où la capture qui la montre en train de se cocher, avant la proposition
 * d'en composer une.
 *
 * Le bouton ne quitte pas l'introduction : il retient le souhait, et c'est le
 * dernier bouton du parcours qui y conduit (voir OnboardingFlow). La page
 * demandant un compte, y aller d'ici emmenait vers la connexion et laissait
 * l'introduction derrière soi, vue à moitié et notée comme faite.
 */

const props = defineProps<{ loggedIn: boolean; chosen: boolean }>();
const emit = defineEmits<{ (e: "toggle"): void }>();

const { t } = useI18n();

const points = [
  { titleKey: "onboarding.daily.composeTitle", textKey: "onboarding.daily.composeText" },
  { titleKey: "onboarding.daily.trackTitle", textKey: "onboarding.daily.trackText" },
  { titleKey: "onboarding.daily.remindTitle", textKey: "onboarding.daily.remindText" },
] as const;
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.daily.title") }}
    </h1>
    <p class="mb-6 text-lg text-text-secondary">
      {{ t("onboarding.daily.intro") }}
    </p>

    <MockDailyReading class="mb-8" />

    <dl class="mb-8 space-y-4">
      <div v-for="point in points" :key="point.titleKey">
        <dt class="font-semibold text-text-primary">{{ t(point.titleKey) }}</dt>
        <dd class="mt-0.5 text-sm text-text-secondary">{{ t(point.textKey) }}</dd>
      </div>
    </dl>

    <button
      type="button"
      class="btn w-full sm:w-auto"
      :class="props.chosen ? 'btn-soft' : 'btn-primary'"
      :aria-pressed="props.chosen"
      @click="emit('toggle')"
    >
      <AppIcon :name="props.chosen ? 'check' : 'circle-plus'" :size="16" />
      {{ props.chosen ? t("onboarding.daily.ctaChosen") : t("onboarding.daily.cta") }}
    </button>

    <p v-if="props.chosen" class="mt-4 text-sm text-text-secondary">
      {{ t("onboarding.daily.ctaChosenHint") }}
    </p>
    <template v-else>
      <p v-if="!props.loggedIn" class="mt-4 text-sm text-text-secondary">
        {{ t("onboarding.daily.accountHint") }}
      </p>
      <p class="mt-4 text-sm text-text-secondary">
        {{ t("onboarding.daily.laterHint") }}
      </p>
    </template>
  </div>
</template>
