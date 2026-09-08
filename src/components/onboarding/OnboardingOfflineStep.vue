<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";

// Le sélecteur embarque le catalogue des textes et le service de
// téléchargement : chargé quand cette page s'ouvre, pas avec l'introduction.
const OnboardingOfflinePicker = defineAsyncComponent(() => import("./OnboardingOfflinePicker.vue"));

/**
 * Ce qu'on emporte sur l'appareil.
 *
 * Les corpus volumineux ne voyagent pas dans le binaire natif
 * (scripts/prune-native-bundle.mjs) : un texte n'est lisible sans connexion
 * que s'il a été téléchargé, et personne ne le devinait avant d'être dans le
 * métro. Sa propre page, parce que c'est la seule de l'introduction où l'on
 * fait quelque chose.
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
