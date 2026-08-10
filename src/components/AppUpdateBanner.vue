<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { appUpdateService, latestVersion, updateAvailable } from "../services/appUpdateService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Bandeau « une nouvelle version est disponible », en tête de l'app native.
 *
 * Dans le flux (pas de position fixe) : il pousse le contenu sans recouvrir
 * la navigation, et disparaît dès qu'il est refusé — jusqu'à la version
 * suivante. La détection vit dans services/appUpdateService.ts.
 */

const { t } = useI18n();
</script>

<template>
  <Transition name="update-slide">
    <div v-if="updateAvailable" class="px-4 pt-4">
      <div class="mx-auto max-w-2xl card p-4" role="status" aria-live="polite">
        <div class="flex items-start gap-3">
          <AppIcon name="download" :size="18" class="mt-0.5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-text-primary">{{ t("appUpdate.title") }}</p>
            <p class="text-sm text-text-secondary">
              {{ t("appUpdate.message", { version: latestVersion }) }}
            </p>
          </div>
          <!-- Le bouton d'action passe sous le texte : sur un écran étroit,
               une seule ligne écraserait le message à deux mots par ligne. -->
          <button
            class="icon-btn -mt-1 shrink-0"
            type="button"
            :aria-label="t('appUpdate.dismiss')"
            @click="appUpdateService.dismiss()"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>
        <div class="mt-3 flex justify-end">
          <button class="btn btn-primary" type="button" @click="appUpdateService.openStore()">
            <AppIcon name="external-link" :size="15" />
            {{ t("appUpdate.action") }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update-slide-enter-active,
.update-slide-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s ease;
}

.update-slide-enter-from,
.update-slide-leave-to {
  transform: translateY(-0.75rem);
  opacity: 0;
}
</style>
