<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SessionService } from '../services/sessionService'
import { ReservationService, type ReservationForm } from '../services/reservationService'
import { AuthService } from '../services/authService'
import type { Session, TextStudy } from '../models/models'
import type { User } from '../services/authService'
import { seoService } from '../services/seoService'

const router = useRouter()
const route = useRoute()
const sessionService = new SessionService()
const reservationService = new ReservationService()
const authService = new AuthService()

// État du composant
const isLoading = ref(true)
const currentUser = ref<User | null>(null)
const session = ref<Session | null>(null)
const textStudies = ref<TextStudy[]>([])
const searchTerm = ref('')
const selectedBook = ref<string>('')
const showGuestForm = ref(false)
const selectedTextStudy = ref<TextStudy | null>(null)
const selectedSection = ref<number | undefined>(undefined)

// Formulaire pour les invités
const guestForm = ref<ReservationForm>({
  name: '',
  email: '',
})

// Charger les données
const loadData = async () => {
  try {
    isLoading.value = true

    // Charger l'utilisateur actuel
    currentUser.value = await authService.getCurrentUser()
    if (!currentUser.value) {
      router.push('/')
      return
    }

    // Charger la session
    const sessionId = route.params.id as string
    session.value = await sessionService.getSessionById(sessionId)

    if (!session.value) {
      router.push('/profile')
      return
    }

    // Vérifier que l'utilisateur peut gérer cette session
    if (!sessionService.canManageSession(session.value, currentUser.value)) {
      router.push('/profile')
      return
    }

    // Charger les textes d'étude
    textStudies.value = await sessionService.getTextStudiesByType(session.value.type)

    // Configuration SEO
    const url = window.location.origin + `/session-management/${sessionId}`
    seoService.setMeta({
      title: `Gestion de session - ${session.value.name} | Petite Jerusalem`,
      description: `Gérez les réservations et le suivi de la session "${session.value.name}".`,
      canonical: url,
      og: { url },
    })
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error)
    router.push('/profile')
  } finally {
    isLoading.value = false
  }
}

// Textes filtrés et groupés
const filteredTextStudies = computed(() => {
  let filtered = textStudies.value

  // Filtrage par recherche
  if (searchTerm.value) {
    filtered = sessionService.filterTextStudiesBySearch(filtered, searchTerm.value)
  }

  // Filtrage par livre
  if (selectedBook.value) {
    filtered = filtered.filter((text) => text.livre === selectedBook.value)
  }

  return filtered
})

const groupedTextStudies = computed(() => {
  return sessionService.groupTextStudiesByBook(filteredTextStudies.value)
})

// Obtenir les livres uniques
const availableBooks = computed(() => {
  const books = new Set(textStudies.value.map((text) => text.livre))
  return Array.from(books).sort()
})

// Obtenir le statut d'un texte
const getTextStatus = (textStudy: TextStudy) => {
  return reservationService.getTextDisplayStatus(textStudy.id, textStudy, session.value!)
}

// Obtenir les réservations d'un texte
const getTextReservations = (textStudyId: string) => {
  return session.value?.reservations?.filter((r) => r.textStudyId === textStudyId) || []
}

// Vérifier si une section est réservée
const isSectionReserved = (textStudyId: string, section: number) => {
  return (
    session.value?.reservations?.some(
      (r) => r.textStudyId === textStudyId && r.section === section,
    ) || false
  )
}

// Obtenir la réservation d'une section
const getSectionReservation = (textStudyId: string, section: number) => {
  return session.value?.reservations?.find(
    (r) => r.textStudyId === textStudyId && r.section === section,
  )
}

// Ouvrir le formulaire d'invité
const openGuestForm = (textStudy: TextStudy, section?: number) => {
  selectedTextStudy.value = textStudy
  selectedSection.value = section
  showGuestForm.value = true
  guestForm.value = { name: '', email: '' }
}

// Créer une réservation pour un invité
const createGuestReservation = async () => {
  if (
    !selectedTextStudy.value ||
    !guestForm.value.name ||
    !guestForm.value.email ||
    !session.value
  ) {
    return
  }

  try {
    isLoading.value = true
    await reservationService.createReservation(
      session.value.id,
      selectedTextStudy.value.id,
      selectedSection.value,
      undefined, // userId
      guestForm.value.email, // guestId
      undefined, // userName
      guestForm.value.name, // guestName
    )

    // Recharger la session
    await reloadSession()
    showGuestForm.value = false
  } catch (error) {
    console.error('Erreur lors de la création de la réservation:', error)
    alert('Erreur lors de la création de la réservation')
  } finally {
    isLoading.value = false
  }
}

// Marquer une réservation comme terminée
const toggleReservationCompletion = async (reservationId: string, isCompleted: boolean) => {
  if (!session.value) return

  try {
    await sessionService.markReservationAsCompleted(session.value.id, reservationId, isCompleted)
    await reloadSession()
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    alert('Erreur lors de la mise à jour')
  }
}

// Supprimer une réservation
const deleteReservation = async (reservationId: string) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) {
    return
  }

  if (!session.value) return

  try {
    await sessionService.deleteReservation(session.value.id, reservationId)
    await reloadSession()
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    alert('Erreur lors de la suppression')
  }
}

// Recharger la session
const reloadSession = async () => {
  if (!session.value) return

  try {
    const updatedSession = await sessionService.getSessionById(session.value.id)
    if (updatedSession) {
      session.value = updatedSession
    }
  } catch (error) {
    console.error('Erreur lors du rechargement de la session:', error)
  }
}

// Statistiques de la session
const sessionStats = computed(() => {
  if (!session.value)
    return {
      totalReservations: 0,
      completedReservations: 0,
      completionRate: 0,
      totalTexts: 0,
      reservedTexts: 0,
      reservationRate: 0,
    }

  const reservations = session.value.reservations || []
  const totalReservations = reservations.length
  const completedReservations = reservations.filter((r) => r.isCompleted).length
  const completionRate =
    totalReservations > 0 ? (completedReservations / totalReservations) * 100 : 0

  // Calculer le taux de réservation des textes
  const totalTexts = textStudies.value.length
  const reservedTexts = textStudies.value.filter((textStudy) => {
    const status = getTextStatus(textStudy)
    return status.status === 'fully_reserved' || status.status === 'partially_reserved'
  }).length
  const reservationRate = totalTexts > 0 ? (reservedTexts / totalTexts) * 100 : 0

  return {
    totalReservations,
    completedReservations,
    completionRate: Math.round(completionRate),
    totalTexts,
    reservedTexts,
    reservationRate: Math.round(reservationRate),
  }
})

// Retour au profil
const goBackToProfile = () => {
  router.push('/profile')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <main class="session-management-page">
    <!-- Affichage de chargement -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement de la session...</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="session" class="session-management">
      <!-- En-tête avec navigation -->
      <div class="page-header">
        <button @click="goBackToProfile" class="btn btn--secondary btn-sm">
          <i class="fa-solid fa-arrow-left"></i>
          Retour au profil
        </button>

        <div class="session-info">
          <h1>{{ session.name }}</h1>
          <p class="session-description">{{ session.description }}</p>
          <div class="session-meta">
            <span class="badge">{{ sessionService.formatTextType(session.type) }}</span>
            <span class="badge"
              >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Statistiques de la session -->
      <div class="stats-container">
        <div class="stat-item">
          <span class="stat-number">{{ sessionStats.totalReservations }}</span>
          <span class="stat-label">Réservations</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ sessionStats.completedReservations }}</span>
          <span class="stat-label">Terminées</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ sessionStats.completionRate }}%</span>
          <span class="stat-label">Progression</span>
        </div>
        <div class="stat-item">
          <span class="stat-number"
            >{{ sessionStats.reservedTexts }}/{{ sessionStats.totalTexts }}</span
          >
          <span class="stat-label">Textes réservés</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ sessionStats.reservationRate }}%</span>
          <span class="stat-label">Taux de réservation</span>
        </div>
      </div>

      <!-- Filtres et recherche -->
      <div class="filters-container">
        <div class="search-container">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Rechercher un texte..."
            class="search-input"
          />
          <i class="fa-solid fa-search search-icon"></i>
        </div>

        <div class="filter-container">
          <select v-model="selectedBook" class="filter-select">
            <option value="">Tous les livres</option>
            <option v-for="book in availableBooks" :key="book" :value="book">
              {{ sessionService.formatBookName(book) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Liste des textes groupés par livre -->
      <div class="content-section">
        <div v-for="(texts, bookName) in groupedTextStudies" :key="bookName" class="book-group">
          <h3 class="section-title">{{ sessionService.formatBookName(bookName) }}</h3>

          <div class="content-grid">
            <div v-for="textStudy in texts" :key="textStudy.id" class="management-card">
              <!-- En-tête du texte -->
              <div class="card-header">
                <h4 class="card-title">{{ sessionService.formatBookName(textStudy.name) }}</h4>
                <div class="text-status">
                  <span
                    :class="`status-${getTextStatus(textStudy).status.replace('_', '-')}`"
                    class="status-badge"
                  >
                    {{
                      getTextStatus(textStudy).status === 'available'
                        ? 'Disponible'
                        : getTextStatus(textStudy).status === 'fully_reserved'
                          ? 'Réservé'
                          : 'Partiellement réservé'
                    }}
                  </span>
                </div>
              </div>

              <!-- Informations sur les réservations -->
              <div class="card-info">
                <p class="reservations-count">
                  {{ getTextReservations(textStudy.id).length }} réservation(s)
                </p>
                <p v-if="getTextStatus(textStudy).reservedBy" class="reserved-by">
                  Réservé par : {{ getTextStatus(textStudy).reservedBy }}
                </p>
              </div>

              <!-- Gestion des réservations -->
              <div class="sections-container">
                <h5 v-if="textStudy.totalSections > 1">Sections :</h5>
                <h5 v-else>Gestion :</h5>
                <div class="sections-list">
                  <div
                    v-for="section in sessionService.generateChapters(textStudy.totalSections)"
                    :key="section"
                    class="section-item"
                    :class="{
                      reserved: isSectionReserved(textStudy.id, section),
                      completed: getSectionReservation(textStudy.id, section)?.isCompleted,
                    }"
                  >
                    <div class="section-info">
                      <span class="section-number">
                        {{ textStudy.totalSections > 1 ? `Chapitre ${section}` : 'Texte complet' }}
                      </span>
                      <span
                        v-if="isSectionReserved(textStudy.id, section)"
                        class="section-reserved-by"
                      >
                        {{ getSectionReservation(textStudy.id, section)?.chosenByName }}
                      </span>
                    </div>

                    <div class="section-actions">
                      <button
                        v-if="!isSectionReserved(textStudy.id, section)"
                        @click="openGuestForm(textStudy, section)"
                        class="btn btn--glass btn-sm"
                      >
                        <i class="fa-solid fa-plus"></i>
                        {{ textStudy.totalSections > 1 ? 'Réserver' : 'Réserver le texte' }}
                      </button>

                      <div v-else class="reservation-controls">
                        <label class="switch">
                          <input
                            type="checkbox"
                            :checked="getSectionReservation(textStudy.id, section)?.isCompleted"
                            @change="
                              toggleReservationCompletion(
                                getSectionReservation(textStudy.id, section)!.id,
                                ($event.target as HTMLInputElement).checked,
                              )
                            "
                          />
                          <span class="slider"></span>
                        </label>
                        <span class="switch-label">Terminé</span>

                        <button
                          @click="
                            deleteReservation(getSectionReservation(textStudy.id, section)!.id)
                          "
                          class="btn btn--danger btn-sm"
                        >
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal pour les invités -->
    <div v-if="showGuestForm" class="modal-overlay" @click="showGuestForm = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Réserver pour un invité</h3>
          <button @click="showGuestForm = false" class="close-button">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="guest-form">
            <div class="form-group">
              <label class="form-label">Nom de l'invité</label>
              <input
                v-model="guestForm.name"
                type="text"
                class="form-input"
                placeholder="Nom complet"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Email de l'invité</label>
              <input
                v-model="guestForm.email"
                type="email"
                class="form-input"
                placeholder="email@example.com"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Texte à réserver</label>
              <p class="form-info">
                {{ sessionService.formatBookName(selectedTextStudy?.name || '') }}
                <span v-if="selectedSection"> - Chapitre {{ selectedSection }}</span>
              </p>
            </div>

            <div class="form-actions">
              <button @click="showGuestForm = false" class="btn btn--secondary">Annuler</button>
              <button
                @click="createGuestReservation"
                class="btn btn--gradient"
                :disabled="!guestForm.name || !guestForm.email"
              >
                Créer la réservation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.session-management-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: var(--text-light);
  font-family: var(--font-family-primary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-light);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid var(--text-light);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-md);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.session-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-lg);
}

.session-info h1 {
  color: var(--text-light);
  font-size: var(--text-3xl);
  margin: 0 0 var(--spacing-sm) 0;
}

.session-description {
  color: var(--text-light);
  opacity: 0.8;
  margin: 0 0 var(--spacing-md) 0;
}

.session-meta {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.book-group {
  margin-bottom: var(--spacing-2xl);
}

.reservations-count {
  color: var(--text-light);
  opacity: 0.8;
  font-size: var(--text-sm);
  margin: 0 0 var(--spacing-xs) 0;
}

.reserved-by {
  color: var(--text-light);
  opacity: 0.7;
  font-size: var(--text-xs);
  margin: 0;
}

.guest-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-info {
  margin: 0;
  padding: var(--spacing-sm);
  background: rgba(102, 126, 234, 0.1);
  border-radius: var(--border-radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .session-management {
    padding: var(--spacing-lg);
  }

  .page-header {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }

  .stat-item {
    text-align: center;
  }

  .stat-number {
    margin-bottom: var(--spacing-xs);
  }

  .filters-container {
    flex-direction: column;
    align-items: stretch;
  }

  .search-container {
    max-width: none;
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .section-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .section-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
