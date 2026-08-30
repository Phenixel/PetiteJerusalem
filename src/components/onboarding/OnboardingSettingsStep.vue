<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppearanceSettings from "../settings/AppearanceSettings.vue";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Deuxième page : l'apparence, en une seule page et sans défilement caché.
 * Les langues, les apparences claire et sombre, les thèmes et les polices de
 * chaque écriture sont côte à côte : on les compare d'un regard, au lieu de
 * les découvrir les uns après les autres.
 *
 * Les réglages sont exactement ceux de l'onglet Préférences du profil
 * (AppearanceSettings), sans les explications de la page de réglages : ici,
 * c'est le titre de la page qui les porte.
 */

defineProps<{ userId: string | null }>();

const { t } = useI18n();
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.settings.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.settings.intro") }}
    </p>

    <AppearanceSettings :user-id="userId" />

    <p class="text-sm text-text-secondary mt-8 flex items-start gap-1.5">
      <AppIcon name="info" :size="14" class="mt-0.5" />
      {{ t("onboarding.settings.hint") }}
    </p>
  </div>
</template>
