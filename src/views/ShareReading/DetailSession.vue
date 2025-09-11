<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { SessionService } from '../../services/sessionService'
import type { Session, TextStudy, TextStudyReservation } from '../../models/models'
import type { User } from '../../services/authService'
import GuestForm from '../../components/GuestForm.vue'
import { seoService } from '../../services/seoService'

// Déclaration TypeScript pour QRCode
declare global {
  interface Window {
    QRCode: {
      new (
        element: HTMLElement,
        options: {
          text: string
          width: number
          height: number
          colorDark: string
          colorLight: string
          correctLevel: number
        },
      ): void
      CorrectLevel: {
        L: number
        M: number
        Q: number
        H: number
      }
    }
  }
}

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

// === MÉTHODES DÉLÉGUÉES AUX SERVICES ===

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

// Réserver tous les chapitres d'un texte
const reserveAllChapters = async (textStudyId: string) => {
  if (!session.value) return

  try {
    isReserving.value = `${textStudyId}-all`

    const textStudy = textStudies.value.find((t) => t.id === textStudyId)
    if (!textStudy) return

    const newReservations = await sessionService.reserveAllChapters(
      session.value.id,
      textStudyId,
      textStudy,
      currentUser.value,
      reservationForm.value,
    )

    // Ajouter toutes les nouvelles réservations à la liste locale
    reservations.value.push(...newReservations)
    // Synchroniser l'état de session pour refléter immédiatement côté UI
    if (session.value) {
      session.value.reservations = reservations.value
    }
  } catch (err) {
    console.error('Erreur lors de la réservation de tous les chapitres:', err)
    alert(err instanceof Error ? err.message : 'Erreur lors de la réservation. Veuillez réessayer.')
  } finally {
    isReserving.value = null
  }
}

// Annuler toutes les réservations d'un texte
const cancelAllReservations = async (textStudyId: string) => {
  if (!session.value) return

  try {
    isReserving.value = `${textStudyId}-all`

    // Vérifier que l'utilisateur peut supprimer toutes les réservations de ce texte
    const textReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)
    const canDeleteAll = textReservations.every((reservation) =>
      sessionService.canUserDeleteReservation(
        reservation,
        currentUser.value,
        reservationForm.value.email,
      ),
    )

    if (!canDeleteAll) {
      alert('Vous ne pouvez annuler que vos propres réservations.')
      return
    }

    await sessionService.cancelAllReservations(session.value.id, textStudyId)

    // Supprimer de la liste locale
    reservations.value = reservations.value.filter((r) => r.textStudyId !== textStudyId)
    // Synchroniser l'état de session pour refléter immédiatement côté UI
    if (session.value) {
      session.value.reservations = reservations.value
    }
  } catch (err) {
    console.error("Erreur lors de l'annulation de toutes les réservations:", err)
    alert(err instanceof Error ? err.message : "Erreur lors de l'annulation. Veuillez réessayer.")
  } finally {
    isReserving.value = null
  }
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

// Vérifier si toutes les réservations d'un texte peuvent être annulées par l'utilisateur actuel
const canCancelAllReservations = (textStudyId: string) => {
  const textReservations = reservations.value.filter((r) => r.textStudyId === textStudyId)

  if (textReservations.length === 0) return false

  return textReservations.every((reservation) =>
    sessionService.canUserDeleteReservation(
      reservation,
      currentUser.value,
      reservationForm.value.email,
    ),
  )
}

// Fonctions de partage
const openShareModal = () => {
  shareUrl.value = window.location.href
  showShareModal.value = true
  nextTick(() => {
    generateQRCode()
  })
}

const closeShareModal = () => {
  showShareModal.value = false
}

const generateQRCode = async () => {
  const qrContainer = document.getElementById('qr-code')
  if (qrContainer && shareUrl.value) {
    qrContainer.innerHTML = ''

    try {
      // Charger dynamiquement la bibliothèque QRCode
      await new Promise((resolve, reject) => {
        if (window.QRCode) {
          resolve(true)
          return
        }

        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        script.onload = () => resolve(true)
        script.onerror = () => reject(new Error('Erreur lors du chargement de QRCode'))
        document.head.appendChild(script)
      })

      new window.QRCode(qrContainer, {
        text: shareUrl.value,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H,
      })
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error)
      qrContainer.innerHTML =
        '<p style="color: #ff6b6b;">Erreur lors de la génération du QR code</p>'
    }
  }
}

const shareToWhatsApp = () => {
  const message = `Rejoignez-moi pour une session d'étude partagée : ${session.value?.name}\n\n${shareUrl.value}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, '_blank')
}

const shareToSMS = () => {
  const message = `Rejoignez-moi pour une session d'étude partagée : ${session.value?.name}\n\n${shareUrl.value}`
  const smsUrl = `sms:?body=${encodeURIComponent(message)}`
  window.location.href = smsUrl
}

const shareToFacebook = () => {
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl.value)}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    alert('Lien copié dans le presse-papiers !')
  } catch (err) {
    console.error('Erreur lors de la copie:', err)
    // Fallback pour les navigateurs plus anciens
    const textArea = document.createElement('textarea')
    textArea.value = shareUrl.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Lien copié dans le presse-papiers !')
  }
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

                <!-- Bouton de réservation du texte complet -->
                <div class="full-text-reservation">
                  <button
                    @click="
                      getTextDisplayStatus(text.id).status === 'fully_reserved'
                        ? cancelAllReservations(text.id)
                        : reserveAllChapters(text.id)
                    "
                    :disabled="
                      isReserving === `${text.id}-all` ||
                      (getTextDisplayStatus(text.id).status === 'fully_reserved' &&
                        !canCancelAllReservations(text.id))
                    "
                    class="btn-reserve-full"
                    :class="{
                      reserved: getTextDisplayStatus(text.id).status === 'fully_reserved',
                      available: getTextDisplayStatus(text.id).status === 'available',
                      disabled:
                        getTextDisplayStatus(text.id).status === 'fully_reserved' &&
                        !canCancelAllReservations(text.id),
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

    <!-- Modal de partage -->
    <div v-if="showShareModal" class="modal-overlay" @click="closeShareModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Partager cette session</h3>
          <button @click="closeShareModal" class="close-button">✕</button>
        </div>

        <div class="modal-body">
          <div class="share-options">
            <button @click="shareToWhatsApp" class="share-option whatsapp">
              <span class="share-icon">📱</span>
              <span>WhatsApp</span>
            </button>

            <button @click="shareToSMS" class="share-option sms">
              <span class="share-icon">💬</span>
              <span>SMS</span>
            </button>

            <button @click="shareToFacebook" class="share-option facebook">
              <span class="share-icon">📘</span>
              <span>Facebook</span>
            </button>

            <button @click="copyToClipboard" class="share-option copy">
              <span class="share-icon">📋</span>
              <span>Copier le lien</span>
            </button>
          </div>

          <div class="qr-section">
            <h4>Ou scanner le QR code :</h4>
            <div id="qr-code" class="qr-container"></div>
            <p class="qr-description">Scannez ce code pour accéder directement à la session</p>
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
</style>
