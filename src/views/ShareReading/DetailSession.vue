<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { SessionService } from '../../services/sessionService'
import { Services } from '../../services/Services'
import type { Session, TextStudy, TextStudyReservation } from '../../models/models'

const route = useRoute()
const sessionService = new SessionService()

// État de la page
const session = ref<Session | null>(null)
const textStudies = ref<TextStudy[]>([])
const reservations = ref<TextStudyReservation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const currentUser = ref<{ id: string; name: string; email: string } | null>(null)

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

// Nettoyer la recherche
const clearSearch = () => {
  searchTerm.value = ''
}

// Computed properties
const groupedTextStudies = computed(() => {
  if (!textStudies.value.length) return {}

  let filteredTexts = textStudies.value

  // Filtrer par terme de recherche si présent
  if (searchTerm.value.trim()) {
    const searchLower = searchTerm.value.toLowerCase()
    filteredTexts = textStudies.value.filter((text) => {
      const hebrewName = text.name
      const frenchName = formatBookName(text.livre)
      const textName = text.name

      return (
        hebrewName.toLowerCase().includes(searchLower) ||
        frenchName.toLowerCase().includes(searchLower) ||
        textName.toLowerCase().includes(searchLower)
      )
    })
  }

  return sessionService.groupTextStudiesByBook(filteredTexts)
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

    // Charger la session
    const sessionData = await sessionService.getSessionById(sessionId)
    if (!sessionData) {
      throw new Error('Session non trouvée')
    }
    session.value = sessionData

    // Charger les textes d'étude du même type
    const textStudiesData = await sessionService.getTextStudiesByType(sessionData.type)
    textStudies.value = textStudiesData

    // Charger les réservations existantes
    const reservationsData = await sessionService.getReservationsBySession(sessionId)
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

    let reservationId: string

    if (currentUser.value) {
      // Utilisateur connecté
      reservationId = await sessionService.createReservation(
        session.value.id,
        textStudyId,
        section,
        currentUser.value.id,
        undefined,
        currentUser.value.name,
        undefined,
      )
    } else {
      // Utilisateur invité
      if (!reservationForm.value.name || !reservationForm.value.email) {
        alert('Veuillez remplir votre nom et email')
        return
      }

      // Pour l'instant, on utilise l'email comme guestId
      // En production, vous pourriez vouloir créer un vrai système de guests
      reservationId = await sessionService.createReservation(
        session.value.id,
        textStudyId,
        section,
        undefined,
        reservationForm.value.email,
        undefined,
        reservationForm.value.name,
      )
    }

    // Créer la nouvelle réservation localement
    const newReservation: TextStudyReservation = {
      id: reservationId,
      sessionId: session.value.id,
      textStudyId,
      section,
      chosenById: currentUser.value?.id,
      chosenByGuestId: currentUser.value ? undefined : reservationForm.value.email,
      chosenByName: currentUser.value?.name || reservationForm.value.name,
      available: false,
      isCompleted: false,
      createdAt: new Date(),
    }

    // Ajouter à la liste locale
    reservations.value.push(newReservation)

    // Pas d'alerte pour une expérience plus fluide
  } catch (err) {
    console.error('Erreur lors de la réservation:', err)
    alert('Erreur lors de la réservation. Veuillez réessayer.')
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
      await sessionService.deleteReservation(reservation.id)

      // Supprimer de la liste locale
      const index = reservations.value.findIndex((r) => r.id === reservation.id)
      if (index > -1) {
        reservations.value.splice(index, 1)
      }

      // Pas d'alerte pour une expérience plus fluide
    }
  } catch (err) {
    console.error("Erreur lors de l'annulation:", err)
    alert("Erreur lors de l'annulation. Veuillez réessayer.")
  }
}

// Vérifier si un texte ou une section est réservé
const isReserved = (textStudyId: string, section?: number) => {
  return sessionService.isTextOrSectionReserved(textStudyId, section, reservations.value)
}

// Vérifier si tous les chapitres d'un texte sont réservés par la même personne
const isTextFullyReservedBySamePerson = (textStudyId: string) => {
  const textStudy = textStudies.value.find((t) => t.id === textStudyId)
  if (!textStudy) return { isFullyReserved: false, reservedBy: null }

  const textReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)
  const chapterReservations = textReservations.filter((r) => r.section !== undefined)

  // Si aucun chapitre n'est réservé, le texte n'est pas réservé
  if (chapterReservations.length === 0) {
    return { isFullyReserved: false, reservedBy: null }
  }

  // Vérifier si tous les chapitres sont réservés
  const allChaptersReserved = chapterReservations.length === textStudy.totalSections

  if (!allChaptersReserved) {
    return { isFullyReserved: false, reservedBy: null }
  }

  // Vérifier si tous les chapitres sont réservés par la même personne
  const firstReservation = chapterReservations[0]
  const allSamePerson = chapterReservations.every(
    (r) => r.chosenByName === firstReservation.chosenByName,
  )

  return {
    isFullyReserved: true,
    reservedBy: allSamePerson ? firstReservation.chosenByName : null,
  }
}

// Obtenir le statut d'affichage d'un texte
const getTextDisplayStatus = (textStudyId: string) => {
  const textStudy = textStudies.value.find((t) => t.id === textStudyId)
  if (!textStudy) return { status: 'available', reservedBy: null }

  const textReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)
  const chapterReservations = textReservations.filter((r) => r.section !== undefined)

  if (chapterReservations.length === 0) {
    return { status: 'available', reservedBy: null }
  }

  // Si tous les chapitres sont réservés par la même personne
  const fullyReserved = isTextFullyReservedBySamePerson(textStudyId)
  if (fullyReserved.isFullyReserved && fullyReserved.reservedBy) {
    return { status: 'fully_reserved', reservedBy: fullyReserved.reservedBy }
  }

  // Si certains chapitres sont réservés mais pas tous
  if (chapterReservations.length > 0 && chapterReservations.length < textStudy.totalSections) {
    return { status: 'partially_reserved', reservedBy: null }
  }

  // Si tous les chapitres sont réservés par des personnes différentes
  if (chapterReservations.length === textStudy.totalSections) {
    const uniqueNames = [...new Set(chapterReservations.map((r) => r.chosenByName))]
    return { status: 'fully_reserved', reservedBy: uniqueNames.join(', ') }
  }

  return { status: 'available', reservedBy: null }
}

// Réserver tous les chapitres d'un texte
const reserveAllChapters = async (textStudyId: string) => {
  if (!session.value) return

  try {
    isReserving.value = `${textStudyId}-all`

    const textStudy = textStudies.value.find((t) => t.id === textStudyId)
    if (!textStudy) return

    // Vérifier les réservations existantes pour ce texte
    const existingReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)
    const existingChapters = new Set(
      existingReservations.map((r) => r.section).filter((s) => s !== undefined),
    )

    // Créer des réservations seulement pour les chapitres non réservés
    for (let chapter = 1; chapter <= textStudy.totalSections; chapter++) {
      // Ignorer les chapitres déjà réservés
      if (existingChapters.has(chapter)) {
        continue
      }

      let reservationId: string

      if (currentUser.value) {
        reservationId = await sessionService.createReservation(
          session.value.id,
          textStudyId,
          chapter,
          currentUser.value.id,
          undefined,
          currentUser.value.name,
          undefined,
        )
      } else {
        if (!reservationForm.value.name || !reservationForm.value.email) {
          alert('Veuillez remplir votre nom et email')
          return
        }

        reservationId = await sessionService.createReservation(
          session.value.id,
          textStudyId,
          chapter,
          undefined,
          reservationForm.value.email,
          undefined,
          reservationForm.value.name,
        )
      }

      // Créer la nouvelle réservation localement
      const newReservation: TextStudyReservation = {
        id: reservationId,
        sessionId: session.value.id,
        textStudyId,
        section: chapter,
        chosenById: currentUser.value?.id,
        chosenByGuestId: currentUser.value ? undefined : reservationForm.value.email,
        chosenByName: currentUser.value?.name || reservationForm.value.name,
        available: false,
        isCompleted: false,
        createdAt: new Date(),
      }

      // Ajouter à la liste locale
      reservations.value.push(newReservation)
    }
  } catch (err) {
    console.error('Erreur lors de la réservation de tous les chapitres:', err)
    alert('Erreur lors de la réservation. Veuillez réessayer.')
  } finally {
    isReserving.value = null
  }
}

// Annuler toutes les réservations d'un texte
const cancelAllReservations = async (textStudyId: string) => {
  if (!session.value) return

  try {
    isReserving.value = `${textStudyId}-all`

    const textReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)

    // Supprimer toutes les réservations de ce texte
    for (const reservation of textReservations) {
      await sessionService.deleteReservation(reservation.id)
    }

    // Supprimer de la liste locale
    reservations.value = reservations.value.filter((r) => r.textStudyId !== textStudyId)
  } catch (err) {
    console.error("Erreur lors de l'annulation de toutes les réservations:", err)
    alert("Erreur lors de l'annulation. Veuillez réessayer.")
  } finally {
    isReserving.value = null
  }
}

// Générer la liste des chapitres
const generateChapters = (totalSections: number) => {
  return Array.from({ length: totalSections }, (_, i) => i + 1)
}

// Formater le nom du livre pour l'affichage
const formatBookName = (bookName: string) => {
  // Extraire le nom français entre parenthèses
  const match = bookName.match(/\((.*?)\)/)
  return match ? match[1] : bookName
}

// Initialisation
onMounted(async () => {
  // Vérifier l'authentification
  currentUser.value = await Services.getCurrentUser()

  // Charger les données
  await loadSessionData()
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
          <span class="session-type">{{ sessionService.formatTextType(session.type) }}</span>
          <span class="session-date"
            >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
          >
          <span class="session-creator">Créé par : {{ session.creatorName }}</span>
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

      <!-- Formulaire de réservation pour invités -->
      <div v-if="!currentUser" class="guest-form-section">
        <h3>Vos informations</h3>
        <div class="form-container">
          <div class="form-group">
            <label for="guest-name" class="form-label">Nom</label>
            <input
              type="text"
              id="guest-name"
              v-model="reservationForm.name"
              placeholder="Votre nom"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="guest-email" class="form-label">Email</label>
            <input
              type="email"
              id="guest-email"
              v-model="reservationForm.email"
              placeholder="votre@email.com"
              class="form-input"
            />
          </div>
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
                <h4 class="text-title">{{ text.name }}</h4>
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
                <span
                  v-if="getTextDisplayStatus(text.id).status === 'fully_reserved'"
                  class="status-reserved"
                >
                  Réservé par {{ getTextDisplayStatus(text.id).reservedBy || "quelqu'un" }}
                </span>
                <span
                  v-else-if="getTextDisplayStatus(text.id).status === 'partially_reserved'"
                  class="status-partially-reserved"
                >
                  En cours
                </span>
                <span v-else class="status-available">Disponible</span>
              </div>

              <!-- Sections du texte (expandable) -->
              <div v-if="isTextExpanded(text.id)" class="text-sections">
                <div class="sections-header">
                  <h5>Sections disponibles ({{ text.totalSections }})</h5>
                </div>

                <div class="sections-list">
                  <div
                    v-for="chapter in generateChapters(text.totalSections)"
                    :key="chapter"
                    class="section-item"
                  >
                    <label class="section-checkbox">
                      <input
                        type="checkbox"
                        :checked="isReserved(text.id, chapter).isReserved"
                        @change="
                          isReserved(text.id, chapter).isReserved
                            ? cancelReservation(text.id, chapter)
                            : reserveTextOrSection(text.id, chapter)
                        "
                        :disabled="isReserving === `${text.id}-${chapter}`"
                      />
                      <span class="section-label">Chapitre {{ chapter }}</span>
                    </label>

                    <span
                      v-if="isReserved(text.id, chapter).isReserved"
                      class="section-status reserved"
                    >
                      Réservé par {{ isReserved(text.id, chapter).reservedBy || "quelqu'un" }}
                    </span>
                    <span v-else class="section-status available"> Disponible </span>
                  </div>
                </div>

                <!-- Bouton de réservation du texte complet -->
                <div class="full-text-reservation">
                  <button
                    @click="
                      getTextDisplayStatus(text.id).status === 'fully_reserved'
                        ? cancelAllReservations(text.id)
                        : reserveAllChapters(text.id)
                    "
                    :disabled="isReserving === `${text.id}-all`"
                    class="btn-reserve-full"
                    :class="{
                      reserved: getTextDisplayStatus(text.id).status === 'fully_reserved',
                      available: getTextDisplayStatus(text.id).status === 'available',
                    }"
                  >
                    {{
                      getTextDisplayStatus(text.id).status === 'fully_reserved'
                        ? 'Annuler la réservation'
                        : 'Réserver le texte complet'
                    }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
<style scoped>
.session-detail {
  max-width: 1200px;
  margin: 0 auto;
}

.session-meta {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: var(--spacing-lg);
}

.session-type,
.session-date,
.session-creator {
  background: rgba(255, 255, 255, 0.1);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-sm);
  font-size: var(--text-sm);
  backdrop-filter: blur(10px);
}

.instructions-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.instructions-section h3 {
  color: var(--text-light);
  margin-bottom: var(--spacing-md);
}

.instructions-section ul {
  list-style: none;
  padding: 0;
}

.instructions-section li {
  color: var(--text-light);
  opacity: 0.9;
  margin-bottom: var(--spacing-sm);
  padding-left: var(--spacing-md);
  position: relative;
}

.instructions-section li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent-color);
}

/* Styles pour la barre de recherche */
.search-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.search-container {
  max-width: 600px;
  margin: 0 auto;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--border-radius-lg);
  color: var(--text-light);
  font-size: var(--text-lg);
  transition: var(--transition-normal);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.search-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.clear-search-btn {
  position: absolute;
  right: var(--spacing-md);
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: var(--text-light);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  transition: var(--transition-normal);
}

.clear-search-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.search-info {
  text-align: center;
  margin-top: var(--spacing-md);
  color: var(--text-light);
  opacity: 0.8;
  font-style: italic;
}

.guest-form-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.guest-form-section h3 {
  color: var(--text-light);
  margin-bottom: var(--spacing-lg);
}

.book-group {
  margin-bottom: var(--spacing-2xl);
}

.book-title {
  color: var(--text-light);
  font-size: var(--text-2xl);
  margin-bottom: var(--spacing-lg);
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  backdrop-filter: blur(10px);
}

.texts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-lg);
}

.text-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);
  transition: var(--transition-normal);
}

.text-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.text-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-md);
}

.text-title {
  color: var(--text-light);
  font-size: var(--text-lg);
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

.text-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.text-link {
  color: var(--text-light);
  font-size: var(--text-lg);
  text-decoration: none;
  opacity: 0.8;
  transition: var(--transition-normal);
}

.text-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

.expand-button {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--text-light);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: var(--transition-normal);
  font-size: var(--text-sm);
}

.expand-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.expand-button.expanded {
  background: rgba(102, 126, 234, 0.3);
  border-color: var(--primary-color);
}

.text-status {
  margin-bottom: var(--spacing-md);
}

.status-reserved {
  color: #ff6b6b;
  font-weight: 500;
  font-size: var(--text-sm);
}

.status-partially-reserved {
  color: #ff9800;
  font-weight: 500;
  font-size: var(--text-sm);
}

.status-available {
  color: #4caf50;
  font-weight: 500;
  font-size: var(--text-sm);
}

.text-sections {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: var(--spacing-md);
}

.sections-header h5 {
  color: var(--text-light);
  margin-bottom: var(--spacing-md);
  font-size: var(--text-base);
}

.sections-list {
  margin-bottom: var(--spacing-lg);
}

.section-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-item:last-child {
  border-bottom: none;
}

.section-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.section-checkbox input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color);
}

.section-label {
  color: var(--text-light);
  font-size: var(--text-sm);
}

.section-status {
  font-size: var(--text-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  font-weight: 500;
}

.section-status.reserved {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.4);
}

.section-status.available {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.full-text-reservation {
  text-align: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-reserve-full {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-normal);
}

.btn-reserve-full.reserved {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.4);
}

.btn-reserve-full.available {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.btn-reserve-full:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-reserve-full:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .texts-grid {
    grid-template-columns: 1fr;
  }

  .session-meta {
    flex-direction: column;
    align-items: center;
  }

  .text-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .search-input {
    font-size: var(--text-base);
    padding: var(--spacing-sm) var(--spacing-md);
  }
}
</style>
