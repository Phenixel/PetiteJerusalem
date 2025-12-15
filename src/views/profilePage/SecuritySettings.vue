<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { authService } from '../../services/authService'
import { useRouter } from 'vue-router'

const router = useRouter()

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const isChangingPassword = ref(false)
const isDeletingAccount = ref(false)
const showDeleteConfirmation = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const isGoogleUser = ref(false)
const hasPasswordProvider = ref(false)

onMounted(() => {
  isGoogleUser.value = authService.isGoogleUser()
  hasPasswordProvider.value = authService.hasPasswordProvider()
})

const isPasswordValid = computed(() => {
  return (
    passwordForm.value.newPassword.length >= 6 &&
    passwordForm.value.newPassword === passwordForm.value.confirmPassword
  )
})

const clearMessages = () => {
  successMessage.value = ''
  errorMessage.value = ''
}

const changePassword = async () => {
  clearMessages()

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    errorMessage.value = 'Les mots de passe ne correspondent pas'
    return
  }

  if (passwordForm.value.newPassword.length < 6) {
    errorMessage.value = 'Le nouveau mot de passe doit contenir au moins 6 caractères'
    return
  }

  try {
    isChangingPassword.value = true
    await authService.changePassword(
      passwordForm.value.currentPassword,
      passwordForm.value.newPassword,
    )
    successMessage.value = 'Mot de passe modifié avec succès'
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)
    if (error instanceof Error) {
      if (
        error.message.includes('auth/wrong-password') ||
        error.message.includes('auth/invalid-credential')
      ) {
        errorMessage.value = 'Mot de passe actuel incorrect'
      } else if (error.message.includes('auth/requires-recent-login')) {
        errorMessage.value = 'Veuillez vous reconnecter avant de changer votre mot de passe'
      } else {
        errorMessage.value = 'Erreur lors du changement de mot de passe'
      }
    }
  } finally {
    isChangingPassword.value = false
  }
}

const confirmDeleteAccount = () => {
  clearMessages()
  showDeleteConfirmation.value = true
}

const cancelDelete = () => {
  showDeleteConfirmation.value = false
}

const deleteAccount = async () => {
  clearMessages()

  try {
    isDeletingAccount.value = true

    if (isGoogleUser.value && !hasPasswordProvider.value) {
      await authService.reauthenticateWithGoogle()
    }

    await authService.deleteAccount()
    router.push('/')
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error)
    if (error instanceof Error) {
      if (error.message.includes('auth/requires-recent-login')) {
        errorMessage.value = 'Veuillez vous reconnecter avant de supprimer votre compte'
      } else if (error.message.includes('auth/popup-closed-by-user')) {
        errorMessage.value = 'Authentification annulée'
      } else {
        errorMessage.value = 'Erreur lors de la suppression du compte'
      }
    }
  } finally {
    isDeletingAccount.value = false
  }
}
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">Sécurité</h2>
    </div>

    <!-- Messages de feedback -->
    <div
      v-if="successMessage"
      class="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
    >
      <i class="fa-solid fa-check-circle mr-2"></i>
      {{ successMessage }}
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
    >
      <i class="fa-solid fa-exclamation-circle mr-2"></i>
      {{ errorMessage }}
    </div>

    <div class="grid gap-8 max-w-2xl">
      <!-- Changement de mot de passe - seulement pour les comptes email/password -->
      <div
        v-if="hasPasswordProvider"
        class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-8 dark:bg-gray-800/60 dark:border-gray-700"
      >
        <h3 class="text-xl font-bold text-text-primary mb-6 dark:text-gray-100">
          Changer le mot de passe
        </h3>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
              >Mot de passe actuel</label
            >
            <input
              v-model="passwordForm.currentPassword"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
              >Nouveau mot de passe</label
            >
            <input
              v-model="passwordForm.newPassword"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              type="password"
              autocomplete="new-password"
              minlength="6"
              required
            />
            <p class="text-xs text-text-secondary mt-1 dark:text-gray-500">Minimum 6 caractères</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
              >Confirmer le nouveau mot de passe</label
            >
            <input
              v-model="passwordForm.confirmPassword"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
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
              Les mots de passe ne correspondent pas
            </p>
          </div>

          <button
            type="submit"
            :disabled="isChangingPassword || !isPasswordValid"
            class="w-full py-3 px-6 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isChangingPassword">
              <i class="fa-solid fa-spinner fa-spin mr-2"></i>
              Changement en cours...
            </span>
            <span v-else>Changer le mot de passe</span>
          </button>
        </form>
      </div>

      <!-- Info compte Google - pas de changement de mot de passe -->
      <div
        v-else-if="isGoogleUser"
        class="bg-blue-50/50 backdrop-blur-sm rounded-2xl border border-blue-100 p-8 dark:bg-blue-900/10 dark:border-blue-900/30"
      >
        <div class="flex items-center gap-3 mb-4">
          <div
            class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm dark:bg-gray-800"
          >
            <i class="fa-brands fa-google text-xl text-blue-500"></i>
          </div>
          <h3 class="text-xl font-bold text-blue-700 dark:text-blue-400">Compte Google</h3>
        </div>
        <p class="text-blue-600/80 dark:text-blue-400/80">
          Votre compte est lié à Google. Vous ne pouvez pas changer votre mot de passe ici. Pour
          modifier vos paramètres de sécurité, rendez-vous dans les paramètres de votre compte
          Google.
        </p>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <i class="fa-solid fa-external-link-alt"></i>
          Paramètres Google
        </a>
      </div>

      <!-- Suppression du compte -->
      <div
        class="bg-red-50/50 backdrop-blur-sm rounded-2xl border border-red-100 p-8 dark:bg-red-900/10 dark:border-red-900/30"
      >
        <h3 class="text-xl font-bold text-red-700 mb-2 dark:text-red-400">Supprimer le compte</h3>
        <p class="text-red-600/80 mb-6 dark:text-red-400/80">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées.
        </p>

        <!-- Formulaire de confirmation -->
        <div v-if="showDeleteConfirmation" class="space-y-4 mb-4">
          <div
            class="p-4 bg-red-100/50 rounded-xl border border-red-200 dark:bg-red-900/20 dark:border-red-800"
          >
            <p class="text-sm text-red-700 font-medium dark:text-red-300">
              <i class="fa-solid fa-warning mr-2"></i>
              <span v-if="isGoogleUser && !hasPasswordProvider">
                Pour confirmer, vous devrez vous ré-authentifier avec Google.
              </span>
              <span v-else> Confirmez-vous vouloir supprimer définitivement votre compte ? </span>
            </p>
          </div>

          <div class="flex gap-3">
            <button
              @click="deleteAccount"
              :disabled="isDeletingAccount"
              class="flex-1 py-3 px-6 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
            >
              <span v-if="isDeletingAccount">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Suppression...
              </span>
              <span v-else-if="isGoogleUser && !hasPasswordProvider">
                <i class="fa-brands fa-google mr-2"></i>
                Confirmer avec Google
              </span>
              <span v-else>Confirmer la suppression</span>
            </button>
            <button
              @click="cancelDelete"
              type="button"
              class="py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Annuler
            </button>
          </div>
        </div>

        <button
          v-else
          @click="confirmDeleteAccount"
          class="px-6 py-3 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-xl font-semibold transition-colors w-full sm:w-auto dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          Supprimer mon compte
        </button>
      </div>
    </div>
  </div>
</template>
