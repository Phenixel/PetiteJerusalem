<script setup lang="ts">
// Bandeau d'incitation à créer un compte, affiché uniquement aux visiteurs
// non connectés (beaucoup de fonctionnalités — sessions, lecture quotidienne,
// rappels — passent par un compte). Autonome : il s'occupe de l'état d'auth
// et ne rend rien tant qu'il n'est pas sûr, pour éviter un flash aux
// utilisateurs connectés.
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

const showCta = ref(false);
let unsubscribeAuth: (() => void) | null = null;

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    showCta.value = user === null;
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <div
    v-if="showCta"
    class="card p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-x-5 gap-y-3 text-center sm:text-left"
  >
    <div class="flex-1 min-w-0">
      <p class="font-bold text-text-primary">{{ t("accountCta.title") }}</p>
      <p class="text-sm text-text-secondary leading-relaxed">
        {{ t("accountCta.description") }}
      </p>
    </div>
    <div class="shrink-0 flex flex-wrap items-center justify-center gap-2">
      <RouterLink to="/login?mode=signup" class="btn btn-primary">
        <AppIcon name="user" :size="14" />
        {{ t("accountCta.signup") }}
      </RouterLink>
      <RouterLink to="/login" class="btn btn-soft">
        {{ t("accountCta.login") }}
      </RouterLink>
    </div>
  </div>
</template>
