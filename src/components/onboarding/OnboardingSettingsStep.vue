<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppearanceSettings from "../settings/AppearanceSettings.vue";

/**
 * Les réglages qu'on veut dès la première minute : la langue, clair ou
 * sombre, le thème. Les polices et les thèmes des fêtes attendent dans le
 * profil, onglet Préférences : ils ne changent rien au premier jour, et la
 * page d'avant, qui les proposait tous, était celle qu'on passait le plus.
 */

defineProps<{ userId: string | null }>();

const { t } = useI18n();
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.settings.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-6">
      {{ t("onboarding.settings.intro") }}
    </p>

    <AppearanceSettings :user-id="userId" essentials />
  </div>
</template>
