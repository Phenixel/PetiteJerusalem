<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockDailyReading from "./mock/MockDailyReading.vue";

/**
 * Troisième page : la lecture quotidienne. C'est la fonctionnalité la moins
 * devinée de l'application (« ma liste de textes du jour, suivie et cochée »),
 * d'où la capture qui la montre en train de se cocher, avant la proposition
 * d'en composer une.
 *
 * Le bouton mène à la page de la lecture du jour, qui demande un compte : le
 * routeur s'en charge (requiresAuth), et la note le dit d'avance aux visiteurs
 * qui n'en ont pas encore.
 */

const props = defineProps<{ loggedIn: boolean }>();
const emit = defineEmits<{ (e: "create"): void }>();

const { t } = useI18n();

const points = [
  { titleKey: "onboarding.daily.composeTitle", textKey: "onboarding.daily.composeText" },
  { titleKey: "onboarding.daily.trackTitle", textKey: "onboarding.daily.trackText" },
  { titleKey: "onboarding.daily.remindTitle", textKey: "onboarding.daily.remindText" },
] as const;
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.daily.title") }}
    </h1>
    <p class="mb-6 text-lg text-text-secondary">
      {{ t("onboarding.daily.intro") }}
    </p>

    <MockDailyReading class="mb-8" />

    <dl class="mb-8 space-y-4">
      <div v-for="point in points" :key="point.titleKey">
        <dt class="font-semibold text-text-primary">{{ t(point.titleKey) }}</dt>
        <dd class="mt-0.5 text-sm text-text-secondary">{{ t(point.textKey) }}</dd>
      </div>
    </dl>

    <button type="button" class="btn btn-primary w-full sm:w-auto" @click="emit('create')">
      <AppIcon name="circle-plus" :size="16" />
      {{ t("onboarding.daily.cta") }}
    </button>

    <p v-if="!props.loggedIn" class="mt-4 text-sm text-text-secondary">
      {{ t("onboarding.daily.accountHint") }}
    </p>
    <p class="mt-4 text-sm text-text-secondary">
      {{ t("onboarding.daily.laterHint") }}
    </p>
  </div>
</template>
