<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Troisième page : la lecture quotidienne. C'est la fonctionnalité la moins
 * devinée de l'application (« ma liste de textes du jour, suivie et cochée »),
 * d'où l'explication avant la proposition d'en composer une.
 *
 * Le bouton mène à la page de la lecture du jour, qui demande un compte : le
 * routeur s'en charge (requiresAuth), et la note le dit d'avance aux visiteurs
 * qui n'en ont pas encore.
 */

const props = defineProps<{ loggedIn: boolean }>();
const emit = defineEmits<{ (e: "create"): void }>();

const { t } = useI18n();

const points = [
  {
    icon: "list",
    titleKey: "onboarding.daily.composeTitle",
    textKey: "onboarding.daily.composeText",
  },
  {
    icon: "check-double",
    titleKey: "onboarding.daily.trackTitle",
    textKey: "onboarding.daily.trackText",
  },
  {
    icon: "bell",
    titleKey: "onboarding.daily.remindTitle",
    textKey: "onboarding.daily.remindText",
  },
] as const;
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.daily.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.daily.intro") }}
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

    <button type="button" class="btn btn-primary w-full sm:w-auto" @click="emit('create')">
      <AppIcon name="circle-plus" :size="16" />
      {{ t("onboarding.daily.cta") }}
    </button>

    <p v-if="!props.loggedIn" class="text-sm text-text-secondary mt-4">
      {{ t("onboarding.daily.accountHint") }}
    </p>
    <p class="text-sm text-text-secondary mt-4 flex items-start gap-1.5">
      <AppIcon name="info" :size="14" class="mt-0.5" />
      {{ t("onboarding.daily.laterHint") }}
    </p>
  </div>
</template>
