<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../../composables/useNativeApp";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Dernière page : la bibliothèque, et ce que « télécharger » veut dire.
 *
 * Dans l'app native, les corpus volumineux ne voyagent pas dans le binaire
 * (scripts/prune-native-bundle.mjs) : un texte n'est lisible sans connexion
 * que s'il a été téléchargé. Personne ne le devinait avant d'être dans le
 * métro. D'où la page de téléchargement simplifiée qui suit les explications.
 *
 * Sur le web il n'y a rien à télécharger (le site sert les textes) : la page
 * se réduit à la présentation de la bibliothèque, et le sélecteur, chargé à la
 * demande, n'y arrive même pas.
 */

const OnboardingOfflinePicker = defineAsyncComponent(() => import("./OnboardingOfflinePicker.vue"));

const emit = defineEmits<{ (e: "open-library"): void }>();

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

    <!-- App native : la page de téléchargement simplifiée. -->
    <OnboardingOfflinePicker v-if="isNativeApp" />

    <!-- Web : rien à télécharger, le site sert les textes. -->
    <template v-else>
      <button type="button" class="btn btn-primary w-full sm:w-auto" @click="emit('open-library')">
        <AppIcon name="book-open" :size="16" />
        {{ t("onboarding.library.open") }}
      </button>
      <p class="text-sm text-text-secondary mt-4 flex items-start gap-1.5">
        <AppIcon name="info" :size="14" class="mt-0.5" />
        {{ t("onboarding.library.webOfflineNote") }}
      </p>
    </template>
  </div>
</template>
