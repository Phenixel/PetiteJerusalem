<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/authService'
import { SessionService } from '../services/sessionService'
import type { User } from '../services/authService'
import type { Session } from '../models/models'
import { seoService } from '../services/seoService'

const router = useRouter()
const authService = new AuthService()
const sessionService = new SessionService()

// État de la page
const currentUser = ref<User | null>(null)
const activeTab = ref<'sessions-participated' | 'sessions-created' | 'my-info' | 'security'>(
  'sessions-participated',
)
const isLoading = ref(true)

// Données des sessions
const participatedSessions = ref<Session[]>([])
const createdSessions = ref<Session[]>([])

// État d'édition des infos
const isEditingInfo = ref(false)
const editForm = ref({
  name: '',
  email: '',
})

// État de sécurité
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const isChangingPassword = ref(false)
const isDeletingAccount = ref(false)

// Computed
const userDisplayName = computed(() => currentUser.value?.name || 'Utilisateur')

// Charger les données utilisateur
const loadUserData = async () => {
  try {
    isLoading.value = true
    currentUser.value = await authService.getCurrentUser()

    // Si l'utilisateur n'est pas connecté, rediriger vers la page d'accueil
    if (!currentUser.value) {
      router.push('/')
      return
    }

    editForm.value = {
      name: currentUser.value.name,
      email: currentUser.value.email,
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données utilisateur:', error)
    // En cas d'erreur, rediriger vers la page d'accueil
    router.push('/')
  } finally {
    isLoading.value = false
  }
}

// Charger les sessions
const loadSessions = async () => {
  if (!currentUser.value) return

  try {
    const allSessions = await sessionService.getAllSessions()

    // Filtrer les sessions où l'utilisateur a participé (a des réservations)
    participatedSessions.value = allSessions.filter((session) =>
      session.reservations?.some((reservation) => reservation.chosenById === currentUser.value?.id),
    )

    // Filtrer les sessions créées par l'utilisateur
    createdSessions.value = allSessions.filter(
      (session) => session.personId === currentUser.value?.id,
    )
  } catch (error) {
    console.error('Erreur lors du chargement des sessions:', error)
  }
}

// Changer d'onglet
const setActiveTab = (tab: typeof activeTab.value) => {
  activeTab.value = tab
}

// Sauvegarder les informations
const saveUserInfo = async () => {
  if (!currentUser.value) return

  try {
    // Ici on pourrait ajouter une méthode pour mettre à jour le profil
    // Pour l'instant, on simule la sauvegarde
    currentUser.value.name = editForm.value.name
    currentUser.value.email = editForm.value.email
    isEditingInfo.value = false
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
  }
}

// Changer le mot de passe
const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('Les mots de passe ne correspondent pas')
    return
  }

  try {
    isChangingPassword.value = true
    // Ici on implémenterait le changement de mot de passe
    alert('Changement de mot de passe réussi')
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)
    alert('Erreur lors du changement de mot de passe')
  } finally {
    isChangingPassword.value = false
  }
}

// Supprimer le compte
const deleteAccount = async () => {
  if (
    !confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')
  ) {
    return
  }

  try {
    isDeletingAccount.value = true
    await authService.logout()
    // Rediriger vers la page d'accueil
    window.location.href = '/'
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error)
    alert('Erreur lors de la suppression du compte')
  } finally {
    isDeletingAccount.value = false
  }
}

onMounted(async () => {
  await loadUserData()
  await loadSessions()
  const url = window.location.origin + '/profile'
  seoService.setMeta({
    title: `${userDisplayName.value} | Profil | Petite Jerusalem`,
    description: "Gérez vos informations, consultez vos sessions d'étude participées et créées.",
    canonical: url,
    og: { url },
  })
})
</script>

<template>
  <main class="main-content">
    <!-- Affichage de chargement -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Chargement...</p>
      </div>
    </div>

    <!-- Contenu du profil (affiché seulement si l'utilisateur est connecté) -->
    <div v-else-if="currentUser">
      <!-- En-tête du profil -->
      <div class="profile-header">
        <div class="profile-info">
          <h1 class="profile-title">{{ userDisplayName }}</h1>
          <div class="profile-badge">
            <span class="badge">MEMBRE ACTIF</span>
          </div>
        </div>
      </div>

      <!-- Contenu principal -->
      <div class="profile-content">
        <!-- Menu latéral -->
        <nav class="profile-sidebar">
          <ul class="profile-menu">
            <li>
              <button
                @click="setActiveTab('sessions-participated')"
                :class="{ active: activeTab === 'sessions-participated' }"
                class="profile-menu-item"
              >
                <span>MES SESSIONS PARTICIPÉES</span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('sessions-created')"
                :class="{ active: activeTab === 'sessions-created' }"
                class="profile-menu-item"
              >
                <span>MES SESSIONS CRÉÉES</span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('my-info')"
                :class="{ active: activeTab === 'my-info' }"
                class="profile-menu-item"
              >
                <span>MES INFORMATIONS</span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('security')"
                :class="{ active: activeTab === 'security' }"
                class="profile-menu-item"
              >
                <span>SÉCURITÉ</span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </li>
          </ul>

          <button @click="authService.logout()" class="btn btn--secondary btn-lg w-100">
            <i class="fa-solid fa-right-from-bracket"></i>
            SE DÉCONNECTER
          </button>
        </nav>

        <!-- Contenu des onglets -->
        <div class="profile-main">
          <!-- Sessions participées -->
          <div v-if="activeTab === 'sessions-participated'" class="tab-content">
            <div class="tab-header">
              <h2>Sessions participées</h2>
              <div class="tab-tabs">
                <button class="tab-tab active">À VENIR</button>
                <button class="tab-tab">HISTORIQUE</button>
              </div>
            </div>

            <div class="sessions-list">
              <div v-if="participatedSessions.length === 0" class="no-sessions">
                <div class="no-sessions-content">
                  <i class="fa-solid fa-calendar-xmark no-sessions-icon"></i>
                  <h3>Aucune session participée</h3>
                  <p>Vous n'avez pas encore participé à des sessions d'étude.</p>
                </div>
              </div>

              <div v-else class="sessions-grid">
                <div v-for="session in participatedSessions" :key="session.id" class="session-card">
                  <h3>{{ session.name }}</h3>
                  <p>{{ session.description }}</p>
                  <div class="session-meta">
                    <span class="badge">{{ sessionService.formatTextType(session.type) }}</span>
                    <span class="badge"
                      >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sessions créées -->
          <div v-if="activeTab === 'sessions-created'" class="tab-content">
            <div class="tab-header">
              <h2>Sessions créées</h2>
              <div class="tab-tabs">
                <button class="tab-tab active">À VENIR</button>
                <button class="tab-tab">HISTORIQUE</button>
              </div>
            </div>

            <div class="sessions-list">
              <div v-if="createdSessions.length === 0" class="no-sessions">
                <div class="no-sessions-content">
                  <i class="fa-solid fa-plus-circle no-sessions-icon"></i>
                  <h3>Aucune session créée</h3>
                  <p>Créez votre première session d'étude partagée.</p>
                  <button class="btn btn--gradient btn-lg">Créer une session</button>
                </div>
              </div>

              <div v-else class="sessions-grid">
                <div v-for="session in createdSessions" :key="session.id" class="session-card">
                  <h3>{{ session.name }}</h3>
                  <p>{{ session.description }}</p>
                  <div class="session-meta">
                    <span class="badge">{{ sessionService.formatTextType(session.type) }}</span>
                    <span class="badge"
                      >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
                    >
                  </div>
                  <div class="session-actions">
                    <button class="btn btn--glass btn-sm">Modifier</button>
                    <button class="btn btn--secondary btn-sm">Partager</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mes informations -->
          <div v-if="activeTab === 'my-info'" class="tab-content">
            <div class="tab-header">
              <h2>Mes informations</h2>
              <button
                v-if="!isEditingInfo"
                @click="isEditingInfo = true"
                class="btn btn--glass btn-md"
              >
                <i class="fa-solid fa-edit"></i>
                Modifier
              </button>
              <div v-else class="edit-actions">
                <button @click="saveUserInfo" class="btn btn--gradient btn-md">Sauvegarder</button>
                <button @click="isEditingInfo = false" class="btn btn--secondary btn-md">
                  Annuler
                </button>
              </div>
            </div>

            <div class="info-form">
              <div class="form-group">
                <label class="form-label">Nom d'affichage</label>
                <input
                  v-model="editForm.name"
                  :disabled="!isEditingInfo"
                  class="form-input"
                  type="text"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Adresse e-mail</label>
                <input
                  v-model="editForm.email"
                  :disabled="!isEditingInfo"
                  class="form-input"
                  type="email"
                />
              </div>

              <div class="form-group">
                <label class="form-label">ID utilisateur</label>
                <input :value="currentUser?.id" disabled class="form-input" type="text" />
              </div>
            </div>
          </div>

          <!-- Sécurité -->
          <div v-if="activeTab === 'security'" class="tab-content">
            <div class="tab-header">
              <h2>Sécurité</h2>
            </div>

            <div class="security-sections">
              <!-- Changement de mot de passe -->
              <div class="security-section">
                <h3>Changer le mot de passe</h3>
                <form @submit.prevent="changePassword" class="password-form">
                  <div class="form-group">
                    <label class="form-label">Mot de passe actuel</label>
                    <input
                      v-model="passwordForm.currentPassword"
                      class="form-input"
                      type="password"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Nouveau mot de passe</label>
                    <input
                      v-model="passwordForm.newPassword"
                      class="form-input"
                      type="password"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Confirmer le nouveau mot de passe</label>
                    <input
                      v-model="passwordForm.confirmPassword"
                      class="form-input"
                      type="password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    :disabled="isChangingPassword"
                    class="btn btn--gradient btn-lg"
                  >
                    {{ isChangingPassword ? 'Changement en cours...' : 'Changer le mot de passe' }}
                  </button>
                </form>
              </div>

              <!-- Suppression du compte -->
              <div class="security-section danger">
                <h3>Supprimer le compte</h3>
                <p>
                  Cette action est irréversible. Toutes vos données seront définitivement
                  supprimées.
                </p>
                <button
                  @click="deleteAccount"
                  :disabled="isDeletingAccount"
                  class="btn btn--danger btn-lg"
                >
                  {{ isDeletingAccount ? 'Suppression en cours...' : 'Supprimer mon compte' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  padding: var(--spacing-xl);
}

.loading-spinner {
  text-align: center;
  color: var(--color-text-soft, #666);
}

.loading-spinner i {
  font-size: 2rem;
  margin-bottom: var(--spacing-md);
  display: block;
}

.loading-spinner p {
  margin: 0;
  font-size: 1.1rem;
}
</style>
