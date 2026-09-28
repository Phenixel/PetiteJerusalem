<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";

/**
 * La dernière page : ce que contient l'application, en trois lignes, et
 * rien sur la façon de s'en servir. Les gestes se découvrent sur la page où
 * ils servent, par une astuce (voir docs/design.md) : les trois pages d'avant
 * (lecture du jour, bibliothèque, horaires), chacune avec ses captures,
 * étaient celles où l'on passait l'introduction.
 *
 * La lecture du jour, la fonction la moins devinée, a son bouton : il
 * termine l'introduction en y conduisant (voir OnboardingFlow). Secondaire,
 * pour laisser « Terminer » seul en couleur pleine.
 */

const emit = defineEmits<{ (e: "compose"): void }>();

const { t } = useI18n();

const points = [
  {
    icon: "book-open",
    titleKey: "onboarding.essentials.libraryTitle",
    textKey: "onboarding.essentials.libraryText",
  },
  {
    icon: "clock",
    titleKey: "onboarding.essentials.zmanimTitle",
    textKey: "onboarding.essentials.zmanimText",
  },
  {
    icon: "check-double",
    titleKey: "onboarding.essentials.dailyTitle",
    textKey: "onboarding.essentials.dailyText",
  },
] as const;
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.essentials.title") }}
    </h1>
    <p class="mb-8 text-lg text-text-secondary">
      {{ t("onboarding.essentials.intro") }}
    </p>

    <ul class="space-y-5">
      <li v-for="point in points" :key="point.titleKey" class="flex items-start gap-4">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <AppIcon :name="point.icon" :size="18" />
        </span>
        <span class="min-w-0">
          <span class="block font-semibold text-text-primary">{{ t(point.titleKey) }}</span>
          <span class="mt-0.5 block text-sm text-text-secondary">{{ t(point.textKey) }}</span>
        </span>
      </li>
    </ul>

    <button type="button" class="btn btn-soft mt-8 w-full sm:w-auto" @click="emit('compose')">
      <AppIcon name="circle-plus" :size="16" />
      {{ t("onboarding.essentials.compose") }}
    </button>
  </div>
</template>
