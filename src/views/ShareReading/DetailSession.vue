<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { SessionService } from '../../services/sessionService'
import type { Session, TextStudy, TextStudyReservation } from '../../models/models'
import type { User } from '../../services/authService'
import GuestForm from '../../components/GuestForm.vue'
import ShareModal from '../../components/ShareModal.vue'
import { seoService } from '../../services/seoService'

const route = useRoute()
const sessionService = new SessionService()

// État de la page
const session = ref<Session | null>(null)
const textStudies = ref<TextStudy[]>([])
const reservations = ref<TextStudyReservation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const currentUser = ref<User | null>(null)

// État d'expansion des textes
const expandedTexts = ref<Set<string>>(new Set())

// Données du formulaire de réservation
const reservationForm = ref({
  name: '',
  email: '',
})

// État des réservations en cours
const isReserving = ref<string | null>(null)

// Terme de recherche
const searchTerm = ref('')

// État du modal de partage
const showShareModal = ref(false)
const shareUrl = ref('')

// Computed properties
const groupedTextStudies = computed(() => {
  if (!textStudies.value.length) return {}
  return sessionService.getGroupedAndFilteredTextStudies(textStudies.value, searchTerm.value)
})

// Gérer l'expansion des textes
const toggleTextExpansion = (textId: string) => {
  if (expandedTexts.value.has(textId)) {
    expandedTexts.value.delete(textId)
  } else {
    expandedTexts.value.add(textId)
  }
}

const isTextExpanded = (textId: string) => {
  return expandedTexts.value.has(textId)
}

// Charger les données de la session
const loadSessionData = async () => {
  try {
    isLoading.value = true
    error.value = null

    const sessionId = route.params.id as string
    if (!sessionId) {
      throw new Error('ID de session manquant')
    }

    // Charger toutes les données d'un coup
    const {
      session: sessionData,
      textStudies: textStudiesData,
      reservations: reservationsData,
    } = await sessionService.loadSessionData(sessionId)

    session.value = sessionData
    textStudies.value = textStudiesData
    reservations.value = reservationsData
  } catch (err) {
    console.error('Erreur lors du chargement des données:', err)
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
  } finally {
    isLoading.value = false
  }
}

// Réserver un texte ou une section
const reserveTextOrSection = async (textStudyId: string, section?: number) => {
  if (!session.value) return

  try {
    isReserving.value = `${textStudyId}-${section || 'full'}`

    const reservationId = await sessionService.createReservationForUser(
      session.value.id,
      textStudyId,
      section,
      currentUser.value,
      reservationForm.value,
    )

    // Créer la nouvelle réservation localement
    const newReservation = sessionService.createLocalReservation(
      reservationId,
      textStudyId,
      section,
      currentUser.value,
      reservationForm.value,
    )

    // Ajouter à la liste locale
    reservations.value.push(newReservation)
    // Synchroniser l'état de session pour refléter immédiatement côté UI
    if (session.value) {
      session.value.reservations = reservations.value
    }
  } catch (err) {
    console.error('Erreur lors de la réservation:', err)
    alert(err instanceof Error ? err.message : 'Erreur lors de la réservation. Veuillez réessayer.')
  } finally {
    isReserving.value = null
  }
}

// Annuler une réservation
const cancelReservation = async (textStudyId: string, section?: number) => {
  if (!session.value) return

  try {
    const reservation = reservations.value.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    )

    if (reservation) {
      // Vérifier si l'utilisateur peut supprimer cette réservation
      const canDelete = sessionService.canUserDeleteReservation(
        reservation,
        currentUser.value,
        reservationForm.value.email,
      )

      if (!canDelete) {
        alert('Vous ne pouvez annuler que vos propres réservations.')
        return
      }

      await sessionService.deleteReservation(session.value.id, reservation.id)

      // Supprimer de la liste locale
      const index = reservations.value.findIndex((r) => r.id === reservation.id)
      if (index > -1) {
        reservations.value.splice(index, 1)
      }

      // Synchroniser l'état de session pour refléter immédiatement côté UI
      if (session.value) {
        session.value.reservations = reservations.value
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'annulation:", err)
    alert("Erreur lors de l'annulation. Veuillez réessayer.")
  }
}
// Vérifier si un texte ou une section est réservé
const isReserved = (textStudyId: string, section?: number) => {
  if (!session.value) return { isReserved: false }
  return sessionService.isTextOrSectionReserved(textStudyId, section, session.value)
}

// Obtenir le statut d'affichage d'un texte
const getTextDisplayStatus = (textStudyId: string) => {
  const textStudy = textStudies.value.find((t) => t.id === textStudyId)
  if (!textStudy || !session.value) return { status: 'available', reservedBy: null }

  return sessionService.getTextDisplayStatus(textStudyId, textStudy, session.value)
}

// Générer la liste des chapitres
const generateChapters = (totalSections: number) => {
  return sessionService.generateChapters(totalSections)
}

// Formater le nom du livre pour l'affichage
const formatBookName = (bookName: string) => {
  return sessionService.formatBookName(bookName)
}

// Nettoyer la recherche
const clearSearch = () => {
  searchTerm.value = ''
}

// Vérifier si une réservation peut être annulée par l'utilisateur actuel
const canCancelReservation = (textStudyId: string, section?: number) => {
  const reservation = reservations.value.find(
    (r) => r.textStudyId === textStudyId && r.section === section,
  )

  if (!reservation) return false

  return sessionService.canUserDeleteReservation(
    reservation,
    currentUser.value,
    reservationForm.value.email,
  )
}

// Marquer une réservation comme complétée
const toggleReservationCompletion = async (textStudyId: string, section: number) => {
  if (!session.value) return

  try {
    const reservation = reservations.value.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    )

    if (!reservation) return

    const newCompletionStatus = !reservation.isCompleted
    await sessionService.markReservationAsCompleted(
      session.value.id,
      reservation.id,
      newCompletionStatus,
    )

    // Mettre à jour l'état local
    reservation.isCompleted = newCompletionStatus
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation:', error)
    alert('Erreur lors de la mise à jour de la réservation')
  }
}

// Fonctions de partage
const openShareModal = () => {
  shareUrl.value = window.location.href
  showShareModal.value = true
}

onMounted(async () => {
  currentUser.value = await sessionService.getCurrentUser()

  await loadSessionData()

  if (session.value) {
    const url = window.location.origin + `/share-reading/session/${session.value.id}`
    seoService.setMeta({
      title: `${session.value.name} | Session d'étude | Petite Jerusalem`,
      description: session.value.description || 'Session de lecture partagée.',
      canonical: url,
      og: { url },
    })
  }
})

watch(session, (s) => {
  if (!s) return
  const url = window.location.origin + `/share-reading/session/${s.id}`
  seoService.setMeta({
    title: `${s.name} | Session d'étude | Petite Jerusalem`,
    description: s.description || 'Session de lecture partagée.',
    canonical: url,
    og: { url },
  })
})
</script>

<template>
  <main class="main-content">
    <!-- État de chargement -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement de la session...</p>
    </div>

    <!-- État d'erreur -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="loadSessionData" class="btn-gradient">Réessayer</button>
    </div>

    <!-- Contenu de la session -->
    <div v-else-if="session" class="session-detail">
      <!-- En-tête de la session -->
      <div class="hero-section">
        <h2 class="hero-title">{{ session.name }}</h2>
        <p class="hero-description">{{ session.description }}</p>
        <div class="session-meta">
          <span class="badge session-type">{{ sessionService.formatTextType(session.type) }}</span>
          <span class="badge session-date"
            >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
          >
          <span class="badge session-creator">Créé par : {{ session.creatorName }}</span>
          <button
            @click="openShareModal"
            class="badge badge--clickable"
            title="Partager cette session"
          >
            📤 Partager
          </button>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions-section">
        <h3>Instructions de réservation</h3>
        <ul>
          <li>Cochez les cases pour réserver une section ou un texte</li>
          <li>
            Si vous avez déjà réservé une section ou un texte, vous pouvez le décocher pour annuler
            votre réservation
          </li>
          <li>Cliquez sur la carte du texte pour voir les sections disponibles</li>
        </ul>
      </div>

      <!-- Formulaire de réservation pour invités (composant unifié) -->
      <div v-if="!currentUser" style="margin-bottom: var(--spacing-2xl)">
        <GuestForm v-model:reservationForm="reservationForm" />
      </div>

      <!-- Barre de recherche -->
      <div class="search-section">
        <div class="search-container">
          <div class="search-input-wrapper">
            <input
              type="text"
              v-model="searchTerm"
              placeholder="Rechercher un texte, un livre ou un chapitre..."
              class="search-input"
            />
            <button
              v-if="searchTerm"
              @click="clearSearch"
              class="clear-search-btn"
              title="Effacer la recherche"
            >
              ✕
            </button>
          </div>
          <div v-if="searchTerm" class="search-info">Recherche : "{{ searchTerm }}"</div>
        </div>
      </div>

      <!-- Liste des textes groupés par livre -->
      <div class="texts-section">
        <div v-for="(texts, bookName) in groupedTextStudies" :key="bookName" class="book-group">
          <h3 class="book-title">{{ formatBookName(bookName) }}</h3>

          <div class="texts-grid">
            <div v-for="text in texts" :key="text.id" class="text-card">
              <!-- En-tête du texte -->
              <div class="text-header">
                <div class="text-title-container">
                  <h4 class="text-title">{{ text.name }}</h4>
                  <!-- Case à cocher directe pour les textes à un seul chapitre -->
                  <label
                    v-if="text.totalSections === 1"
                    class="title-checkbox"
                    :class="{
                      disabled:
                        isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1),
                    }"
                  >
                    <input
                      type="checkbox"
                      :checked="isReserved(text.id, 1).isReserved"
                      @change="
                        isReserved(text.id, 1).isReserved
                          ? cancelReservation(text.id, 1)
                          : reserveTextOrSection(text.id, 1)
                      "
                      :disabled="
                        isReserving === `${text.id}-1` ||
                        (isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1))
                      "
                    />
                  </label>
                </div>
                <div class="text-actions">
                  <a
                    :href="text.link"
                    target="_blank"
                    class="text-link"
                    title="Voir le texte sur Sefaria"
                  >
                    🔗
                  </a>
                  <button
                    v-if="text.totalSections > 1"
                    @click="toggleTextExpansion(text.id)"
                    class="expand-button"
                    :class="{ expanded: isTextExpanded(text.id) }"
                  >
                    {{ isTextExpanded(text.id) ? '▼' : '▶' }}
                  </button>
                </div>
              </div>

              <!-- Statut global du texte -->
              <div class="text-status">
                <!-- Pour les textes à un seul chapitre, vérifier le statut de complétion -->
                <div
                  v-if="text.totalSections === 1 && isReserved(text.id, 1).isReserved"
                  class="single-chapter-status"
                >
                  <span
                    class="section-status"
                    :class="{
                      reserved: !reservations.find(
                        (r) => r.textStudyId === text.id && r.section === 1,
                      )?.isCompleted,
                      completed: reservations.find(
                        (r) => r.textStudyId === text.id && r.section === 1,
                      )?.isCompleted,
                    }"
                  >
                    {{
                      reservations.find((r) => r.textStudyId === text.id && r.section === 1)
                        ?.isCompleted
                        ? `Lu par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                        : `Réservé par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                    }}
                  </span>

                  <!-- Switch pour marquer comme lu (seulement si c'est notre réservation) -->
                  <div v-if="canCancelReservation(text.id, 1)" class="completion-toggle">
                    <label class="switch">
                      <input
                        type="checkbox"
                        :checked="
                          reservations.find((r) => r.textStudyId === text.id && r.section === 1)
                            ?.isCompleted || false
                        "
                        @change="toggleReservationCompletion(text.id, 1)"
                      />
                      <span class="slider"></span>
                    </label>
                    <span class="switch-label">Marqué comme lu</span>
                  </div>
                </div>
                <!-- Pour les textes à plusieurs chapitres, utiliser la logique existante -->
                <span
                  v-else-if="
                    text.totalSections > 1 &&
                    getTextDisplayStatus(text.id).status === 'fully_reserved'
                  "
                  class="status-reserved"
                >
                  Réservé par {{ getTextDisplayStatus(text.id).reservedBy || "quelqu'un" }}
                </span>
                <span
                  v-else-if="
                    text.totalSections > 1 &&
                    getTextDisplayStatus(text.id).status === 'partially_reserved'
                  "
                  class="status-partially-reserved"
                >
                  En cours
                </span>
                <span v-else class="status-available">Disponible</span>
              </div>

              <!-- Sections du texte (expandable) - seulement si plus d'un chapitre -->
              <div v-if="text.totalSections > 1 && isTextExpanded(text.id)" class="text-sections">
                <div class="sections-header">
                  <h5>Sections disponibles ({{ text.totalSections }})</h5>
                </div>

                <div class="sections-list">
                  <div
                    v-for="chapter in generateChapters(text.totalSections)"
                    :key="chapter"
                    class="section-item"
                  >
                    <label
                      class="section-checkbox"
                      :class="{
                        disabled:
                          isReserved(text.id, chapter).isReserved &&
                          !canCancelReservation(text.id, chapter),
                      }"
                    >
                      <input
                        type="checkbox"
                        :checked="isReserved(text.id, chapter).isReserved"
                        @change="
                          isReserved(text.id, chapter).isReserved
                            ? cancelReservation(text.id, chapter)
                            : reserveTextOrSection(text.id, chapter)
                        "
                        :disabled="
                          isReserving === `${text.id}-${chapter}` ||
                          (isReserved(text.id, chapter).isReserved &&
                            !canCancelReservation(text.id, chapter))
                        "
                      />
                      <span class="section-label">Chapitre {{ chapter }}</span>
                    </label>

                    <div
                      v-if="isReserved(text.id, chapter).isReserved"
                      class="section-status-container"
                    >
                      <span
                        class="section-status"
                        :class="{
                          reserved: !reservations.find(
                            (r) => r.textStudyId === text.id && r.section === chapter,
                          )?.isCompleted,
                          completed: reservations.find(
                            (r) => r.textStudyId === text.id && r.section === chapter,
                          )?.isCompleted,
                        }"
                      >
                        {{
                          reservations.find(
                            (r) => r.textStudyId === text.id && r.section === chapter,
                          )?.isCompleted
                            ? `Lu par ${isReserved(text.id, chapter).reservedBy || "quelqu'un"}`
                            : `Réservé par ${isReserved(text.id, chapter).reservedBy || "quelqu'un"}`
                        }}
                      </span>
                    </div>
                    <span v-else class="section-status available"> Disponible </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de partage -->
    <ShareModal
      v-model:show="showShareModal"
      :session-name="session?.name || ''"
      :share-url="shareUrl"
    />
  </main>
</template>
<style scoped>
.session-detail {
  max-width: 1200px;
  margin: 0 auto;
}

/* Styles spécifiques pour les textes à un seul chapitre */
.single-chapter-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.completion-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .single-chapter-status {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .completion-toggle {
    align-self: flex-end;
  }
}
</style>
