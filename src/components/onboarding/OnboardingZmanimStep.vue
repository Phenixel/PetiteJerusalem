<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Les horaires (zmanim). Une section entière de l'application que rien
 * n'annonce : elle vit derrière le bouton rond de la barre du bas, et son
 * point le moins évident est qu'elle ne demande rien à personne, ni au
 * réseau ni à un serveur de position.
 */

const { t } = useI18n();

const points = [
  {
    icon: "locate",
    titleKey: "onboarding.zmanim.deviceTitle",
    textKey: "onboarding.zmanim.deviceText",
  },
  {
    icon: "map-pin",
    titleKey: "onboarding.zmanim.placeTitle",
    textKey: "onboarding.zmanim.placeText",
  },
  {
    icon: "candle",
    titleKey: "onboarding.zmanim.shabbatTitle",
    textKey: "onboarding.zmanim.shabbatText",
  },
] as const;
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.zmanim.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.zmanim.intro") }}
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

    <!-- Où les trouver : le bouton rond de la barre du bas, qui les ouvre en
         surcouche et les referme au second appui. -->
    <p class="flex items-start gap-2 text-sm text-text-secondary">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white"
      >
        <AppIcon name="clock" :size="13" />
      </span>
      {{ t("onboarding.zmanim.hint") }}
    </p>
  </div>
</template>
