<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MockShelf from "./mock/MockShelf.vue";
import MockPinch from "./mock/MockPinch.vue";
import MockReadingMenu from "./mock/MockReadingMenu.vue";
import MockAutoScroll from "./mock/MockAutoScroll.vue";

/**
 * La bibliothèque, et les gestes de la lecture.
 *
 * Montrés plutôt que décrits : aucun de ces gestes ne se devine, et une
 * phrase ne remplace pas de les voir se faire. Chaque capture est un morceau
 * d'application dessiné (voir mock/MockScreen), donc juste dans le thème
 * choisi, en clair comme en sombre, et dans la langue affichée.
 */

const { t } = useI18n();

const gestures = [
  {
    component: MockPinch,
    titleKey: "onboarding.library.pinchTitle",
    textKey: "onboarding.library.pinchText",
  },
  {
    component: MockReadingMenu,
    titleKey: "onboarding.library.menuTitle",
    textKey: "onboarding.library.menuText",
  },
  {
    component: MockAutoScroll,
    titleKey: "onboarding.library.scrollTitle",
    textKey: "onboarding.library.scrollText",
  },
];
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.library.title") }}
    </h1>
    <p class="mb-6 text-lg text-text-secondary">
      {{ t("onboarding.library.intro") }}
    </p>

    <figure class="mb-10">
      <MockShelf />
      <figcaption class="mt-3">
        <span class="block font-semibold text-text-primary">
          {{ t("onboarding.library.corpusTitle") }}
        </span>
        <span class="mt-0.5 block text-sm text-text-secondary">
          {{ t("onboarding.library.corpusText") }}
        </span>
      </figcaption>
    </figure>

    <h2 class="mb-2 text-xl font-bold text-text-primary">
      {{ t("onboarding.library.readingTitle") }}
    </h2>
    <p class="mb-6 text-text-secondary">
      {{ t("onboarding.library.readingIntro") }}
    </p>

    <figure v-for="gesture in gestures" :key="gesture.titleKey" class="mb-8 last:mb-0">
      <component :is="gesture.component" />
      <figcaption class="mt-3">
        <span class="block font-semibold text-text-primary">{{ t(gesture.titleKey) }}</span>
        <span class="mt-0.5 block text-sm text-text-secondary">{{ t(gesture.textKey) }}</span>
      </figcaption>
    </figure>
  </div>
</template>
