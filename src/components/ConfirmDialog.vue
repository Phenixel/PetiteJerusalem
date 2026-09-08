<script setup lang="ts">
// Boîte de confirmation de l'app, montée une seule fois dans App.vue : elle
// affiche la demande en cours de useConfirm (voir ce fichier pour le pourquoi).
// L'enveloppe (voile, Échap, retour Android, fermeture à la navigation, qui
// vaut ici « non ») est celle d'AppModal.
import { useI18n } from "vue-i18n";
import { useConfirmHost } from "../composables/useConfirm";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";

const { t } = useI18n();
const { request, answer } = useConfirmHost();
</script>

<template>
  <AppModal
    :open="request !== null"
    role="alertdialog"
    labelledby="confirm-dialog-title"
    :describedby="request?.message ? 'confirm-dialog-message' : undefined"
    @close="answer(false)"
  >
    <template v-if="request">
      <div class="flex items-start gap-3.5">
        <div
          class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
          :class="
            request.danger
              ? 'bg-red-600/10 text-red-600 dark:text-red-400'
              : 'bg-primary/10 text-primary'
          "
        >
          <AppIcon :name="request.danger ? 'alert-triangle' : 'help'" :size="18" />
        </div>
        <div class="min-w-0 pt-0.5">
          <h3 id="confirm-dialog-title" class="font-bold text-text-primary leading-snug">
            {{ request.title }}
          </h3>
          <p
            v-if="request.message"
            id="confirm-dialog-message"
            class="mt-1.5 text-sm text-text-secondary leading-relaxed"
          >
            {{ request.message }}
          </p>
        </div>
      </div>

      <!-- Le clavier arrive sur le bouton le moins risqué : « Annuler » quand
           l'action est destructrice, sinon la confirmation. -->
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button
          class="btn btn-soft"
          :data-autofocus="request.danger || null"
          @click="answer(false)"
        >
          {{ request.cancelLabel ?? t("common.cancel") }}
        </button>
        <button
          class="btn"
          :class="request.danger ? 'btn-danger' : 'btn-primary'"
          :data-autofocus="!request.danger || null"
          @click="answer(true)"
        >
          {{ request.confirmLabel ?? t("common.confirm") }}
        </button>
      </div>
    </template>
  </AppModal>
</template>
