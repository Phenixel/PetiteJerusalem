<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { authService } from "../../services/authService";
import type { User } from "../../services/authService";
import { ModerationError } from "../../services/moderationService";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t } = useI18n();

const props = defineProps<{
  user: User;
}>();

// Le parent tient l'utilisateur affiché (le titre de la page en vit) : il
// reçoit celui que Firebase renvoie une fois le nom enregistré.
const emit = defineEmits<{
  (e: "update", user: User): void;
}>();

const isEditing = ref(false);
const isSaving = ref(false);
const successMessage = ref("");
const errorMessage = ref("");
const name = ref(props.user?.name || "");

watch(
  () => props.user,
  (newUser) => {
    if (newUser) {
      name.value = newUser.name;
    }
  },
  { immediate: true },
);

const clearMessages = () => {
  successMessage.value = "";
  errorMessage.value = "";
};

const startEdit = () => {
  clearMessages();
  name.value = props.user?.name || "";
  isEditing.value = true;
};

const cancelEdit = () => {
  clearMessages();
  name.value = props.user?.name || "";
  isEditing.value = false;
};

const save = async () => {
  clearMessages();

  const trimmed = name.value.trim();
  if (!trimmed) {
    errorMessage.value = t("profile.nameRequired");
    return;
  }

  // Rien à enregistrer : on referme sans appeler Firebase.
  if (trimmed === props.user.name) {
    isEditing.value = false;
    return;
  }

  try {
    isSaving.value = true;
    const updated = await authService.updateDisplayName(trimmed);
    analyticsService.capture("profile_name_updated");
    emit("update", updated);
    successMessage.value = t("profile.nameUpdated");
    // Le mode édition ne se referme qu'en cas de succès : sinon la saisie
    // disparaîtrait avec l'échec, sans rien avoir enregistré.
    isEditing.value = false;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du nom d'affichage:", error);
    // Terme refusé par la modération : son message dit lequel, bien plus
    // utile que le message générique.
    errorMessage.value =
      error instanceof ModerationError ? error.message : t("profile.nameUpdateError");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary">
        {{ t("profile.myInformation") }}
      </h2>
      <button v-if="!isEditing" @click="startEdit" class="btn btn-soft">
        <AppIcon name="pencil" :size="14" /> {{ t("common.edit") }}
      </button>
      <div v-else class="flex gap-2">
        <button @click="save" :disabled="isSaving" class="btn btn-primary disabled:opacity-60">
          {{ isSaving ? t("common.saving") : t("common.save") }}
        </button>
        <button @click="cancelEdit" :disabled="isSaving" class="btn btn-soft disabled:opacity-60">
          {{ t("common.cancel") }}
        </button>
      </div>
    </div>

    <!-- Messages de feedback -->
    <p
      v-if="successMessage"
      class="mb-6 flex items-center gap-2 font-medium text-green-700 dark:text-green-300"
    >
      <AppIcon name="circle-check" :size="16" />
      {{ successMessage }}
    </p>

    <p
      v-if="errorMessage"
      class="mb-6 flex items-center gap-2 font-medium text-red-700 dark:text-red-300"
    >
      <AppIcon name="alert-circle" :size="16" />
      {{ errorMessage }}
    </p>

    <div class="card p-8 max-w-2xl">
      <form @submit.prevent="save" class="space-y-6">
        <div>
          <label
            for="profile-display-name"
            class="block text-sm font-semibold text-text-secondary mb-2"
            >{{ t("profile.displayName") }}</label
          >
          <input
            id="profile-display-name"
            v-model="name"
            :disabled="!isEditing || isSaving"
            class="field disabled:opacity-60"
            type="text"
            autocomplete="name"
            maxlength="60"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("common.emailAddress")
          }}</label>
          <div class="field text-text-secondary">
            {{ user.email }}
          </div>
          <p class="text-xs text-text-secondary mt-1">
            {{ t("profile.emailReadOnly") }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("profile.userId")
          }}</label>
          <div class="field font-mono text-sm text-text-secondary">
            {{ user.id }}
          </div>
        </div>

        <!-- Bouton caché : il donne à la touche Entrée de quoi valider. -->
        <button v-if="isEditing" type="submit" class="hidden" :disabled="isSaving"></button>
      </form>
    </div>
  </div>
</template>
