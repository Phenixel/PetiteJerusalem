<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/authService'
import { SessionService } from '../services/sessionService'
import type { User } from '../services/authService'
import type { Session, TextStudy } from '../models/models'
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
const textStudiesMap = ref<Map<string, TextStudy>>(new Map())

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

    // Charger les détails des textes d'étude pour les sessions participées
    await loadTextStudiesForSessions(participatedSessions.value)
  } catch (error) {
    console.error('Erreur lors du chargement des sessions:', error)
  }
}

// Charger les textes d'étude pour les sessions
const loadTextStudiesForSessions = async (sessions: Session[]) => {
  try {
    const textStudyIds = new Set<string>()

    // Collecter tous les IDs de textes d'étude uniques
    sessions.forEach((session) => {
      session.reservations?.forEach((reservation) => {
        textStudyIds.add(reservation.textStudyId)
      })
    })

    // Charger les textes d'étude par type
    const types = [...new Set(sessions.map((s) => s.type))]
    for (const type of types) {
      const textStudies = await sessionService.getTextStudiesByType(type)
      textStudies.forEach((textStudy) => {
        textStudiesMap.value.set(textStudy.id, textStudy)
      })
    }
  } catch (error) {
    console.error("Erreur lors du chargement des textes d'étude:", error)
  }
}

// Obtenir le nom d'un texte d'étude
const getTextStudyName = (textStudyId: string): string => {
  const textStudy = textStudiesMap.value.get(textStudyId)
  return textStudy ? textStudy.name : textStudyId
}

// Obtenir les réservations de l'utilisateur pour une session
const getUserReservationsForSession = (session: Session) => {
  if (!currentUser.value) return []
  return (
    session.reservations?.filter(
      (reservation) => reservation.chosenById === currentUser.value?.id,
    ) || []
  )
}

// Marquer une réservation comme complétée
const toggleReservationCompletion = async (
  sessionId: string,
  reservationId: string,
  isCompleted: boolean,
) => {
  try {
    await sessionService.markReservationAsCompleted(sessionId, reservationId, isCompleted)

    // Mettre à jour l'état local
    const session = participatedSessions.value.find((s) => s.id === sessionId)
    if (session) {
      const reservation = session.reservations?.find((r) => r.id === reservationId)
      if (reservation) {
        reservation.isCompleted = isCompleted
      }
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation:', error)
    alert('Erreur lors de la mise à jour de la réservation')
  }
}

// Naviguer vers une session
const goToSession = (sessionId: string) => {
  router.push({ name: 'detail-session', params: { id: sessionId } })
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
    title: `Mon profil | Petite Jerusalem`,
    description: "Gérez vos informations, consultez vos sessions d'étude participées et créées.",
    canonical: url,
    og: { url },
  })
})
</script>

<template>
  <main class="main-content">
    <!-- Affichage de chargement -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement de votre profil...</p>
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
                  <div class="session-card-header">
                    <h3>{{ session.name }}</h3>
                    <button @click="goToSession(session.id)" class="btn btn--glass btn-sm">
                      <i class="fa-solid fa-external-link-alt"></i>
                      Voir la session
                    </button>
                  </div>
                  <p class="session-description">{{ session.description }}</p>
                  <div class="session-meta">
                    <span class="badge">{{ sessionService.formatTextType(session.type) }}</span>
                    <span class="badge"
                      >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
                    >
                  </div>

                  <!-- Réservations de l'utilisateur -->
                  <div class="user-reservations">
                    <h4>Mes réservations :</h4>
                    <div
                      v-if="getUserReservationsForSession(session).length === 0"
                      class="no-reservations"
                    >
                      <p>Aucune réservation trouvée</p>
                    </div>
                    <div v-else class="reservations-list">
                      <div
                        v-for="reservation in getUserReservationsForSession(session)"
                        :key="reservation.id"
                        class="reservation-item"
                        :class="{ completed: reservation.isCompleted }"
                      >
                        <div class="reservation-info">
                          <span class="reservation-text">
                            {{ getTextStudyName(reservation.textStudyId) }}
                            <span v-if="reservation.section" class="reservation-section">
                              - Chapitre {{ reservation.section }}
                            </span>
                          </span>
                          <span v-if="reservation.isCompleted" class="completion-badge">
                            <i class="fa-solid fa-check-circle"></i>
                            Terminé
                          </span>
                        </div>
                        <div class="reservation-actions">
                          <label class="switch">
                            <input
                              type="checkbox"
                              :checked="reservation.isCompleted"
                              @change="
                                toggleReservationCompletion(
                                  session.id,
                                  reservation.id,
                                  ($event.target as HTMLInputElement).checked,
                                )
                              "
                            />
                            <span class="slider"></span>
                          </label>
                          <span class="switch-label">Marqué comme lu</span>
                        </div>
                      </div>
                    </div>
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
/* Styles spécifiques à la page de profil uniquement */
.profile-header {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: var(--text-light);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
  border-radius: var(--border-radius-lg);
  position: relative;
  overflow: hidden;
}

.profile-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.05)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
  pointer-events: none;
}

.profile-info {
  position: relative;
  z-index: 1;
}

.profile-title {
  font-size: var(--text-4xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-sm) 0;
  background: linear-gradient(45deg, #fff, #f0f0f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.profile-id {
  font-size: var(--text-lg);
  opacity: 0.8;
  margin: 0 0 var(--spacing-md) 0;
  font-family: monospace;
}

.profile-badge {
  display: inline-block;
}

/* Contenu principal du profil */
.profile-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--spacing-2xl);
  max-width: 1200px;
  margin: 0 auto;
}

/* Menu latéral */
.profile-sidebar {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  height: fit-content;
  position: sticky;
  top: var(--spacing-xl);
}

.profile-menu {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--spacing-2xl) 0;
}

.profile-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-sm);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-md);
  color: var(--text-light);
  font-weight: 600;
  font-size: var(--text-base);
  cursor: pointer;
  transition: var(--transition-normal);
  text-align: left;
}

.profile-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateX(5px);
}

.profile-menu-item.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: var(--primary-color);
  color: var(--text-light);
  box-shadow: 0 0 0 1px var(--primary-color);
}

.profile-menu-item i {
  font-size: var(--text-sm);
  opacity: 0.7;
}

/* Contenu principal */
.profile-main {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-2xl);
  min-height: 600px;
}

/* En-tête des onglets */
.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.tab-header h2 {
  color: var(--text-light);
  font-size: var(--text-2xl);
  margin: 0;
}

.tab-tabs {
  display: flex;
  gap: var(--spacing-sm);
}

.tab-tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-sm);
  color: var(--text-light);
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-normal);
}

.tab-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-tab.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

/* Contenu des onglets */
.tab-content {
  animation: fadeInUp 0.3s ease-out;
}

/* Grille des sessions */
.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--spacing-lg);
}

/* Formulaire d'informations */
.info-form {
  max-width: 500px;
}

.edit-actions {
  display: flex;
  gap: var(--spacing-md);
}

/* Sections de sécurité */
.security-sections {
  max-width: 600px;
}

.security-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.security-section.danger {
  border-color: rgba(244, 67, 54, 0.3);
  background: rgba(244, 67, 54, 0.05);
}

.security-section h3 {
  color: var(--text-light);
  font-size: var(--text-lg);
  margin: 0 0 var(--spacing-md) 0;
}

.security-section p {
  color: var(--text-light);
  opacity: 0.8;
  margin: 0 0 var(--spacing-lg) 0;
}

.password-form {
  max-width: 400px;
}

/* Bouton de danger */
.btn--danger {
  background: linear-gradient(45deg, #f44336, #d32f2f);
  border: none;
  color: white;
}

.btn--danger:hover {
  background: linear-gradient(45deg, #d32f2f, #b71c1c);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Responsive */
@media (max-width: 768px) {
  .profile-content {
    grid-template-columns: 1fr;
    gap: var(--spacing-lg);
  }

  .profile-sidebar {
    position: static;
    order: 2;
  }

  .profile-main {
    order: 1;
  }

  .tab-header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .sessions-grid {
    grid-template-columns: 1fr;
  }

  .profile-title {
    font-size: var(--text-2xl);
  }
}
</style>
