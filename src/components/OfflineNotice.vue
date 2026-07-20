<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../composables/useNativeApp";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

function retry() {
  window.location.reload();
}
</script>

<!-- Affiché à la place du contenu quand la page a besoin du réseau et que
     l'appareil est hors ligne (voir App.vue). La bibliothèque, elle, reste
     accessible : dans l'app native les textes téléchargés se lisent sans
     connexion, d'où le lien proposé. -->
<template>
  <main class="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
    <AppIcon name="signal" :size="40" class="text-text-secondary/40 mb-6" />
    <h1 class="text-2xl font-bold text-text-primary mb-3">{{ t("offline.title") }}</h1>
    <p class="text-text-secondary max-w-md leading-relaxed mb-8">
      {{ t("offline.description") }}
    </p>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <button class="btn btn-primary" @click="retry()">
        <AppIcon name="rotate" :size="15" />
        {{ t("offline.retry") }}
      </button>
      <RouterLink v-if="isNativeApp" to="/bibliotheque" class="btn btn-soft">
        {{ t("offline.library") }}
      </RouterLink>
    </div>
  </main>
</template>
