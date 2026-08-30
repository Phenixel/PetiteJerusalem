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

/**
 * Les trois gestes de la lecture. Aucun ne se devine : le pincement change la
 * taille du texte au lieu de zoomer la page, le menu se cache derrière un
 * rond posé sur le texte, et le double appui fait descendre la page tout
 * seul. Chaque icône est celle que le lecteur verra à l'écran.
 */
const gestures = [
  {
    icon: "text-size",
    titleKey: "onboarding.library.pinchTitle",
    textKey: "onboarding.library.pinchText",
  },
  {
    icon: "list",
    titleKey: "onboarding.library.menuTitle",
    textKey: "onboarding.library.menuText",
  },
  {
    icon: "chevron-down",
    titleKey: "onboarding.library.scrollTitle",
    textKey: "onboarding.library.scrollText",
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

    <!-- Les gestes de la lecture : ils valent pour tous les textes. -->
    <h2 class="mb-2 text-xl font-bold text-text-primary">
      {{ t("onboarding.library.readingTitle") }}
    </h2>
    <p class="mb-4 text-text-secondary">
      {{ t("onboarding.library.readingIntro") }}
    </p>
    <ul class="mb-10 space-y-4">
      <li v-for="gesture in gestures" :key="gesture.titleKey" class="flex items-start gap-3">
        <span
          class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <AppIcon :name="gesture.icon" :size="16" />
        </span>
        <span>
          <span class="block font-semibold text-text-primary">{{ t(gesture.titleKey) }}</span>
          <span class="block text-sm text-text-secondary">{{ t(gesture.textKey) }}</span>
        </span>
      </li>
    </ul>

    <OnboardingOfflinePicker />
  </div>
</template>
