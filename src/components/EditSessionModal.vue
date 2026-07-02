<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../models/models";
import { useToast } from "../composables/useToast";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
const toast = useToast();

interface Props {
  show: boolean;
  session: Session | null;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "save", sessionData: { name: string; description: string; dateLimit: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const editForm = ref({
  name: "",
  description: "",
  dateLimit: "",
});

const isLoading = ref(false);

const closeModal = () => {
  emit("update:show", false);
};

const saveSession = async () => {
  if (!editForm.value.name.trim()) {
    toast.error(t("editModal.sessionNameRequired"));
    return;
  }

  if (!editForm.value.dateLimit) {
    toast.error(t("editModal.dateLimitRequired"));
    return;
  }

  try {
    isLoading.value = true;
    emit("save", {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
      dateLimit: editForm.value.dateLimit,
    });
    closeModal();
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    toast.errorFromException(error, t("editModal.saveError"));
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.session,
  (newSession) => {
    if (newSession) {
      editForm.value = {
        name: newSession.name,
        description: newSession.description || "",
        dateLimit:
          newSession.dateLimit instanceof Date
            ? newSession.dateLimit.toISOString().slice(0, 16)
            : newSession.dateLimit,
      };
    }
  },
  { immediate: true },
);

watch(
  () => props.show,
  (newValue) => {
    if (!newValue && props.session) {
      editForm.value = {
        name: props.session.name,
        description: props.session.description || "",
        dateLimit:
          props.session.dateLimit instanceof Date
            ? props.session.dateLimit.toISOString().slice(0, 16)
            : props.session.dateLimit,
      };
    }
  },
);
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="closeModal">
    <div class="modal-panel !max-w-lg animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-lg font-bold text-text-primary">
          {{ t("editModal.title") }}
        </h3>
        <button @click="closeModal" class="icon-btn" :aria-label="t('common.close')">
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
          <input v-model="editForm.dateLimit" class="field" type="datetime-local" required />
        </div>

        <div class="flex gap-3 justify-end pt-2">
          <button type="button" @click="closeModal" class="btn btn-soft" :disabled="isLoading">
            {{ t("common.cancel") }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            {{ isLoading ? t("common.saving") : t("common.save") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
