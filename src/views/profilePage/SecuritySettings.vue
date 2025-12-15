<script setup lang="ts">
import { ref } from 'vue'
import { authService } from '../../services/authService'

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const isChangingPassword = ref(false)
const isDeletingAccount = ref(false)

const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('Les mots de passe ne correspondent pas')
    return
  }

  try {
    isChangingPassword.value = true
    // TODO: Implement actual password change via service
    await new Promise((resolve) => setTimeout(resolve, 1000))
    alert('Changement de mot de passe réussi')
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)
    alert('Erreur lors du changement de mot de passe')
  } finally {
    isChangingPassword.value = false
  }
}

const deleteAccount = async () => {
  if (
    !confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')
  ) {
    return
  }

  try {
    isDeletingAccount.value = true
    // TODO: Implement actual account deletion service
    await authService.logout()
    window.location.href = '/'
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error)
    alert('Erreur lors de la suppression du compte')
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

    <div class="grid gap-8 max-w-2xl">
      <div
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
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
              >Confirmer le nouveau mot de passe</label
            >
            <input
              v-model="passwordForm.confirmPassword"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              type="password"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="isChangingPassword"
            class="w-full py-3 px-6 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all mt-4 disabled:opacity-70"
          >
            {{ isChangingPassword ? 'Changement en cours...' : 'Changer le mot de passe' }}
          </button>
        </form>
      </div>

      <div
        class="bg-red-50/50 backdrop-blur-sm rounded-2xl border border-red-100 p-8 dark:bg-red-900/10 dark:border-red-900/30"
      >
        <h3 class="text-xl font-bold text-red-700 mb-2 dark:text-red-400">Supprimer le compte</h3>
        <p class="text-red-600/80 mb-6 dark:text-red-400/80">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées.
        </p>
        <button
          @click="deleteAccount"
          :disabled="isDeletingAccount"
          class="px-6 py-3 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-xl font-semibold transition-colors w-full sm:w-auto dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          {{ isDeletingAccount ? 'Suppression en cours...' : 'Supprimer mon compte' }}
        </button>
      </div>
    </div>
  </div>
</template>
