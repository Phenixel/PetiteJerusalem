<script setup lang="ts">
// Carte d'incitation à créer un compte, affichée uniquement aux visiteurs
// non connectés (beaucoup de fonctionnalités — sessions, lecture quotidienne,
// rappels — passent par un compte). Même langage visuel que les cartes de
// l'accueil : titre gras, texte secondaire, illustration animée à droite
// (la classe .feature-card déclenche ses animations de survol).
// Autonome : le composant s'occupe de l'état d'auth et ne rend rien tant
// qu'il n'est pas sûr, pour éviter un flash aux utilisateurs connectés.
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import IllustrationProfil from "./illustrations/IllustrationProfil.vue";

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
  <div v-if="showCta" class="feature-card card flex items-center gap-5 p-6 text-left">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-bold mb-1.5 text-text-primary">
        {{ t("accountCta.title") }}
      </h3>
      <p class="text-text-secondary text-sm leading-relaxed mb-4">
        {{ t("accountCta.description") }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <RouterLink to="/login?mode=signup" class="btn btn-primary">
          {{ t("accountCta.signup") }}
        </RouterLink>
        <RouterLink to="/login" class="btn btn-soft">
          {{ t("accountCta.login") }}
        </RouterLink>
      </div>
    </div>
    <div class="w-24 h-24 sm:w-28 sm:h-28 md:w-24 md:h-24 lg:w-28 lg:h-28 shrink-0 text-primary">
      <IllustrationProfil />
    </div>
  </div>
</template>
