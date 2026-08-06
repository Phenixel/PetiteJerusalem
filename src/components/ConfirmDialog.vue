<script setup lang="ts">
// Boîte de confirmation de l'app, montée une seule fois dans App.vue : elle
// affiche la demande en cours de useConfirm (voir ce fichier pour le pourquoi).
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useConfirmHost } from "../composables/useConfirm";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
const route = useRoute();
const { request, answer } = useConfirmHost();

// Une navigation pendant que la question est posée (retour matériel Android,
// lien, notification) la laisserait à l'écran par-dessus la page suivante :
// elle se referme, sans confirmer.
watch(
  () => route.fullPath,
  () => {
    if (request.value) answer(false);
  },
);

const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);

// Le clavier arrive sur le bouton le moins risqué : « Annuler » quand l'action
// est destructrice, sinon la confirmation.
watch(request, async (current) => {
  if (!current) return;
  await nextTick();
  (current.danger ? cancelButton.value : confirmButton.value)?.focus();
});

/** Échap ferme sans confirmer, comme la boîte du système. */
function onKeydown(event: KeyboardEvent) {
  if (request.value && event.key === "Escape") answer(false);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="request" class="modal-overlay" @click="answer(false)">
        <div
          class="modal-panel animate-[scaleIn_0.3s_ease]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          @click.stop
        >
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

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <button ref="cancelButton" class="btn btn-soft" @click="answer(false)">
              {{ request.cancelLabel ?? t("common.cancel") }}
            </button>
            <button
              ref="confirmButton"
              class="btn"
              :class="request.danger ? 'btn-danger' : 'btn-primary'"
              @click="answer(true)"
            >
              {{ request.confirmLabel ?? t("common.confirm") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* fadeIn est défini globalement dans main.css */
.modal-enter-active {
  animation: fadeIn 0.2s ease;
}
.modal-leave-active {
  animation: fadeIn 0.2s ease reverse;
}
</style>
