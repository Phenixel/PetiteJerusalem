<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import OnboardingOfflinePicker from "./OnboardingOfflinePicker.vue";

/**
 * Dernière page : la bibliothèque, et ce que « télécharger » veut dire.
 *
 * Les corpus volumineux ne voyagent pas dans le binaire natif
 * (scripts/prune-native-bundle.mjs) : un texte n'est lisible sans connexion
 * que s'il a été téléchargé. Personne ne le devinait avant d'être dans le
 * métro. D'où la page de téléchargement simplifiée qui suit les explications.
 */

const { t } = useI18n();

const points = [
  {
    icon: "book-open",
    titleKey: "onboarding.library.corpusTitle",
    textKey: "onboarding.library.corpusText",
  },
  {
    icon: "search",
    titleKey: "onboarding.library.searchTitle",
    textKey: "onboarding.library.searchText",
  },
  {
    icon: "bookmark",
    titleKey: "onboarding.library.resumeTitle",
    textKey: "onboarding.library.resumeText",
  },
] as const;
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.library.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.library.intro") }}
    </p>

    <ul class="space-y-4 mb-8">
      <li v-for="point in points" :key="point.titleKey" class="card p-4 flex items-start gap-4">
        <span
          class="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center"
        >
          <AppIcon :name="point.icon" :size="19" />
        </span>
        <span>
          <span class="block font-semibold text-text-primary">{{ t(point.titleKey) }}</span>
          <span class="block text-sm text-text-secondary mt-1">{{ t(point.textKey) }}</span>
        </span>
      </li>
    </ul>

    <OnboardingOfflinePicker />
  </div>
</template>
