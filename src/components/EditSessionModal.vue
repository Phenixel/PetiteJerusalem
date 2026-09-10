<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../models/models";
import type { SessionEditData } from "../composables/useSessionEditing";
import { useOverlay } from "../composables/useOverlayStack";
import { useToast } from "../composables/useToast";
import { localDayKey } from "../services/dateService";
import AppIcon from "./icons/AppIcon.vue";
import AppDateField from "./AppDateField.vue";

const { t } = useI18n();
const toast = useToast();

interface Props {
  show: boolean;
  session: Session | null;
  /**
   * La sauvegarde elle-même, fournie par l'écran hôte : la modale l'attend
   * et ne se ferme que sur un succès. Avant, elle émettait un événement et se
   * fermait aussitôt : l'écriture échouait dans le vide, la saisie était
   * perdue avec elle, et l'état « Sauvegarde... » n'apparaissait jamais.
   */
  save: (data: SessionEditData) => Promise<boolean>;
}

interface Emits {
  (e: "update:show", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const editForm = ref<SessionEditData>({
  name: "",
  description: "",
  dateLimit: "",
  guestEmailRequired: false,
});

const isLoading = ref(false);

const closeModal = () => {
  if (isLoading.value) return;
  emit("update:show", false);
};

// Le bouton retour d'Android ferme la modale avant de quitter la page.
useOverlay(toRef(props, "show"), closeModal);

const saveSession = async () => {
  if (isLoading.value) return;

  if (!editForm.value.name.trim()) {
    toast.error(t("editModal.sessionNameRequired"));
    return;
  }

  if (!editForm.value.dateLimit) {
    toast.error(t("editModal.dateLimitRequired"));
    return;
  }

  isLoading.value = true;
  try {
    const saved = await props.save({
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
      dateLimit: editForm.value.dateLimit,
      guestEmailRequired: editForm.value.guestEmailRequired,
    });
    // En cas d'échec, l'hôte a déjà prévenu ; la modale garde la saisie pour
    // un nouvel essai.
    if (saved) emit("update:show", false);
  } finally {
    isLoading.value = false;
  }
};

// Le formulaire repart de la session à chaque ouverture, et à chaque
// changement de session : une modification abandonnée ne doit pas réapparaître.
const resetForm = () => {
  const session = props.session;
  if (!session) return;
  editForm.value = {
    name: session.name,
    description: session.description || "",
    // Le jour LOCAL (localDayKey), jamais toISOString : la date lue en UTC
    // recule d'un jour à l'ouest de Greenwich, et la date limite se décalait
    // du fuseau à chaque enregistrement.
    dateLimit:
      session.dateLimit instanceof Date ? localDayKey(session.dateLimit) : session.dateLimit,
    guestEmailRequired: session.guestEmailRequired === true,
  };
};

watch([() => props.session, () => props.show], resetForm, { immediate: true });
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="closeModal">
    <div class="modal-panel !max-w-lg animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-lg font-bold text-text-primary">
          {{ t("editModal.title") }}
        </h3>
        <button
          @click="closeModal"
          class="icon-btn"
          :aria-label="t('common.close')"
          :disabled="isLoading"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <form @submit.prevent="saveSession" class="space-y-4">
        <div>
          <label class="block text-sm font-semibold text-text-primary mb-2"
            >{{ t("editModal.sessionName") }} *</label
          >
          <input
            v-model="editForm.name"
            class="field"
            type="text"
            required
            :placeholder="t('editModal.sessionNamePlaceholder')"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-primary mb-2">{{
            t("common.description")
          }}</label>
          <textarea
            v-model="editForm.description"
            class="field resize-y"
            :placeholder="t('editModal.descriptionPlaceholder')"
            rows="3"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-primary mb-2"
            >{{ t("common.dateLimit") }} *</label
          >
          <!-- Un jour, pas un horaire : la journée limite compte entière,
               quelle que soit l'heure enregistrée (voir endOfLocalDay). Le
               champ datetime-local laissait choisir une heure qui n'avait
               aucun effet. -->
          <AppDateField v-model="editForm.dateLimit" :label="t('common.dateLimit')" />
        </div>

        <div>
          <label class="inline-flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="editForm.guestEmailRequired"
              class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer shrink-0"
            />
            <span>
              <span class="block text-sm font-semibold text-text-primary">
                {{ t("newSession.requireGuestEmail") }}
              </span>
              <span class="block text-xs text-text-secondary mt-0.5">
                {{ t("newSession.requireGuestEmailHint") }}
              </span>
            </span>
          </label>
        </div>

        <div class="flex gap-3 justify-end pt-2">
          <button type="button" @click="closeModal" class="btn btn-soft" :disabled="isLoading">
            {{ t("common.cancel") }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            <AppIcon v-if="isLoading" name="spinner" :size="15" class="animate-spin" />
            {{ isLoading ? t("common.saving") : t("common.save") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
