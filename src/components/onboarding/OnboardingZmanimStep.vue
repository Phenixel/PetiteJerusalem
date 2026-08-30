<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockZmanim from "./mock/MockZmanim.vue";

/**
 * Les horaires (zmanim). Une section entière de l'application que rien
 * n'annonce : elle vit derrière le bouton rond de la barre du bas, et son
 * point le moins évident est qu'elle ne demande rien à personne, ni au réseau
 * ni à un serveur de position.
 */

const { t } = useI18n();

const points = [
  { titleKey: "onboarding.zmanim.deviceTitle", textKey: "onboarding.zmanim.deviceText" },
  { titleKey: "onboarding.zmanim.placeTitle", textKey: "onboarding.zmanim.placeText" },
  { titleKey: "onboarding.zmanim.shabbatTitle", textKey: "onboarding.zmanim.shabbatText" },
] as const;
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.zmanim.title") }}
    </h1>
    <p class="mb-6 text-lg text-text-secondary">
      {{ t("onboarding.zmanim.intro") }}
    </p>

    <MockZmanim class="mb-8" />

    <dl class="mb-8 space-y-4">
      <div v-for="point in points" :key="point.titleKey">
        <dt class="font-semibold text-text-primary">{{ t(point.titleKey) }}</dt>
        <dd class="mt-0.5 text-sm text-text-secondary">{{ t(point.textKey) }}</dd>
      </div>
    </dl>

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
