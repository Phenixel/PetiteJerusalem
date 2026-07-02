<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { authService } from "../../services/authService";
import { useRouter } from "vue-router";
import AppIcon from "../../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();

const passwordForm = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const isChangingPassword = ref(false);
const isDeletingAccount = ref(false);
const showDeleteConfirmation = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const isGoogleUser = ref(false);
const hasPasswordProvider = ref(false);

onMounted(() => {
  isGoogleUser.value = authService.isGoogleUser();
  hasPasswordProvider.value = authService.hasPasswordProvider();
});

const isPasswordValid = computed(() => {
  return (
    passwordForm.value.newPassword.length >= 6 &&
    passwordForm.value.newPassword === passwordForm.value.confirmPassword
  );
});

const clearMessages = () => {
  successMessage.value = "";
  errorMessage.value = "";
};

const changePassword = async () => {
  clearMessages();

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    errorMessage.value = t("security.passwordsDoNotMatch");
    return;
  }

  if (passwordForm.value.newPassword.length < 6) {
    errorMessage.value = t("security.passwordMinError");
    return;
  }

  try {
    isChangingPassword.value = true;
    await authService.changePassword(
      passwordForm.value.currentPassword,
      passwordForm.value.newPassword,
    );
    successMessage.value = t("security.passwordChangedSuccess");
    passwordForm.value = { currentPassword: "", newPassword: "", confirmPassword: "" };
  } catch (error) {
    console.error("Erreur lors du changement de mot de passe:", error);
    if (error instanceof Error) {
      if (
        error.message.includes("auth/wrong-password") ||
        error.message.includes("auth/invalid-credential")
      ) {
        errorMessage.value = t("security.wrongPassword");
      } else if (error.message.includes("auth/requires-recent-login")) {
        errorMessage.value = t("security.requiresRecentLogin");
      } else {
        errorMessage.value = t("security.passwordChangeError");
      }
    }
  } finally {
    isChangingPassword.value = false;
  }
};

const confirmDeleteAccount = () => {
  clearMessages();
  showDeleteConfirmation.value = true;
};

const cancelDelete = () => {
  showDeleteConfirmation.value = false;
};

const deleteAccount = async () => {
  clearMessages();

  try {
    isDeletingAccount.value = true;

    if (isGoogleUser.value && !hasPasswordProvider.value) {
      await authService.reauthenticateWithGoogle();
    }

    await authService.deleteAccount();
    router.push("/");
  } catch (error) {
    console.error("Erreur lors de la suppression du compte:", error);
    if (error instanceof Error) {
      if (error.message.includes("auth/requires-recent-login")) {
        errorMessage.value = t("security.deleteRecentLogin");
      } else if (error.message.includes("auth/popup-closed-by-user")) {
        errorMessage.value = t("security.authCancelled");
      } else {
        errorMessage.value = t("security.deleteError");
      }
    }
  } finally {
    isDeletingAccount.value = false;
  }
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary">
        {{ t("security.title") }}
      </h2>
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

    <div class="grid gap-10 max-w-2xl">
      <!-- Changement de mot de passe - seulement pour les comptes email/password -->
      <div v-if="hasPasswordProvider" class="card p-8">
        <h3 class="text-xl font-bold text-text-primary mb-6">
          {{ t("security.changePassword") }}
        </h3>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("security.currentPassword")
            }}</label>
            <input
              v-model="passwordForm.currentPassword"
              class="field"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("security.newPassword")
            }}</label>
            <input
              v-model="passwordForm.newPassword"
              class="field"
              type="password"
              autocomplete="new-password"
              minlength="6"
              required
            />
            <p class="text-xs text-text-secondary mt-1">
              {{ t("security.minChars") }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("security.confirmNewPassword")
            }}</label>
            <input
              v-model="passwordForm.confirmPassword"
              class="field"
              type="password"
              autocomplete="new-password"
              required
            />
            <p
              v-if="
                passwordForm.confirmPassword &&
                passwordForm.newPassword !== passwordForm.confirmPassword
              "
              class="text-xs text-red-500 mt-1"
            >
              {{ t("security.passwordsDoNotMatch") }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="isChangingPassword || !isPasswordValid"
            class="btn btn-primary w-full mt-4"
          >
            <AppIcon v-if="isChangingPassword" name="spinner" :size="15" class="animate-spin" />
            {{
              isChangingPassword ? t("security.changingPassword") : t("security.changePasswordBtn")
            }}
          </button>
        </form>
      </div>

      <!-- Info compte Google - pas de changement de mot de passe -->
      <div v-else-if="isGoogleUser">
        <h3 class="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
          <AppIcon name="google" :size="18" />
          {{ t("security.googleAccount") }}
        </h3>
        <p class="text-text-secondary">
          {{ t("security.googleAccountDesc") }}
        </p>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-soft mt-4"
        >
          <AppIcon name="external-link" :size="14" />
          {{ t("security.googleSettings") }}
        </a>
      </div>

      <!-- Suppression du compte -->
      <div>
        <h3 class="text-xl font-bold text-text-primary mb-2">
          {{ t("security.deleteAccount") }}
        </h3>
        <p class="text-text-secondary mb-6">
          {{ t("security.deleteAccountWarning") }}
        </p>

        <!-- Formulaire de confirmation -->
        <div v-if="showDeleteConfirmation" class="space-y-4 mb-4">
          <p class="text-sm font-medium text-red-700 dark:text-red-300 flex items-start gap-2">
            <AppIcon name="alert-triangle" :size="16" class="mt-0.5" />
            <span v-if="isGoogleUser && !hasPasswordProvider">
              {{ t("security.deleteConfirmGoogle") }}
            </span>
            <span v-else> {{ t("security.deleteConfirmPassword") }} </span>
          </p>

          <div class="flex gap-3">
            <button
              @click="deleteAccount"
              :disabled="isDeletingAccount"
              class="btn btn-danger flex-1"
            >
              <AppIcon v-if="isDeletingAccount" name="spinner" :size="15" class="animate-spin" />
              <AppIcon v-else-if="isGoogleUser && !hasPasswordProvider" name="google" :size="14" />
              {{
                isDeletingAccount
                  ? t("common.deleting")
                  : isGoogleUser && !hasPasswordProvider
                    ? t("security.confirmWithGoogle")
                    : t("security.confirmDeletion")
              }}
            </button>
            <button @click="cancelDelete" type="button" class="btn btn-soft">
              {{ t("common.cancel") }}
            </button>
          </div>
        </div>

        <button v-else @click="confirmDeleteAccount" class="btn btn-danger w-full sm:w-auto">
          {{ t("security.deleteMyAccount") }}
        </button>
      </div>
    </div>
  </div>
</template>
