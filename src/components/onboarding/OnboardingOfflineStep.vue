<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";

// Le sélecteur embarque le catalogue des textes et le service de
// téléchargement : chargé quand cette page s'ouvre, pas avec l'introduction.
const OnboardingOfflinePicker = defineAsyncComponent(() => import("./OnboardingOfflinePicker.vue"));

/**
 * Ce qu'on emporte sur l'appareil.
 *
 * Les Tehilim et les trois offices du jour voyagent avec l'app
 * (src/datas/bundledTexts.json) ; les autres corpus se téléchargent, et
 * personne ne le devinait avant d'être dans le métro. Le seul réglage de
 * l'introduction qui fasse quelque chose, et l'un des plus suivis : on le
 * garde, en une phrase.
 */

const { t } = useI18n();
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.library.offlineTitle") }}
    </h1>
    <p class="mb-8 text-lg text-text-secondary">
      {{ t("onboarding.library.offlineIntro") }}
    </p>

    <OnboardingOfflinePicker />
  </div>
</template>
