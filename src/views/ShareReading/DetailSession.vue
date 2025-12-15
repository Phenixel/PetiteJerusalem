<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { SessionService } from '../../services/sessionService'
import type { Session, TextStudy, TextStudyReservation } from '../../models/models'
import type { User } from '../../services/authService'
import GuestForm from '../../components/GuestForm.vue'
import ShareModal from '../../components/ShareModal.vue'
import SessionProgressBar from '../../components/SessionProgressBar.vue'
import BatchSelectionBar from '../../components/BatchSelectionBar.vue'
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

// État des sélections en attente
const selectedItems = ref<Set<string>>(new Set())
const isSubmittingBatch = ref(false)

// Computed properties
const groupedTextStudies = computed(() => {
  if (!textStudies.value.length) return {}
  return sessionService.getGroupedAndFilteredTextStudies(textStudies.value, searchTerm.value)
})

const progressStats = computed(() => {
  if (!textStudies.value.length)
    return {
      total: 0,
      reserved: 0,
      read: 0,
      participants: 0,
      reservedPercentage: 0,
      readPercentage: 0,
    }

  // Calcul du total de sections disponibles
  const total = textStudies.value.reduce((acc, textStudy) => acc + textStudy.totalSections, 0)

  // Calcul du nombre de réservations
  const reserved = reservations.value.length

  // Calcul du nombre de lectures terminées
  const read = reservations.value.filter((r) => r.isCompleted).length

  // Calcul du nombre de participants uniques (utilisateurs ou invités)
  const uniqueParticipants = new Set<string>()
  reservations.value.forEach((r) => {
    if (r.chosenById) {
      uniqueParticipants.add(`user:${r.chosenById}`)
    } else if (r.chosenByGuestId) {
      uniqueParticipants.add(`guest:${r.chosenByGuestId}`)
    }
  })
  const participants = uniqueParticipants.size

  return {
    total,
    reserved,
    read,
    participants,
    reservedPercentage: total > 0 ? (reserved / total) * 100 : 0,
    readPercentage: total > 0 ? (read / total) * 100 : 0,
  }
})

// Vérifier si des éléments sont sélectionnés
const hasSelectedItems = computed(() => selectedItems.value.size > 0)

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
    const key = section ? `${textStudyId}-${section}` : `${textStudyId}-full`
    isReserving.value = key

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
    throw err // Propager l'erreur pour la gestion en lot
  } finally {
    isReserving.value = null
  }
}

// Basculer la sélection d'un item (sélection ou désélection)
const toggleSelection = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`

  // Si c'est déjà réservé, on annule (comportement existant immédiat)
  if (isReserved(textStudyId, section).isReserved) {
    // Nettoyage préventif: si c'était noté comme sélectionné, on l'enlève
    if (selectedItems.value.has(key)) {
      selectedItems.value.delete(key)
    }

    if (confirm('Voulez-vous annuler cette réservation ?')) {
      cancelReservation(textStudyId, section)
    }
    return
  }

  // Sinon, on bascule l'état de sélection
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
}

// Vérifier si un item est sélectionné
const isSelected = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`
  return selectedItems.value.has(key)
}

// Confirmer toutes les réservations sélectionnées
const confirmReservations = async () => {
  if (!session.value || selectedItems.value.size === 0) return

  // Validation invité
  if (!currentUser.value && (!reservationForm.value.name || !reservationForm.value.email)) {
    alert('Veuillez remplir votre nom et email pour confirmer les réservations.')
    // Scroll vers le formulaire invité si nécessaire
    const formElement = document.getElementById('guest-form')
    if (formElement) {
      const offset = 120 // Compte pour la navbar + marge
      const elementPosition = formElement.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
    return
  }

  try {
    isSubmittingBatch.value = true
    const itemsToReserve = Array.from(selectedItems.value).map((key) => {
      const [textId, sectionStr] = key.split('#')
      return {
        textId,
        section: sectionStr === 'full' ? undefined : parseInt(sectionStr),
      }
    })

    // Exécuter les réservations en série pour éviter les race conditions ou surcharge
    // Idéalement, le backend devrait supporter une route batch, mais on utilise l'existant pour l'instant
    for (const item of itemsToReserve) {
      // Vérification de sécurité : ne pas réserver si déjà réservé (cas de retry après erreur partielle)
      if (isReserved(item.textId, item.section).isReserved) continue

      await reserveTextOrSection(item.textId, item.section)
    }

    // Vider la sélection après succès
    selectedItems.value.clear()
  } catch (err) {
    console.error('Erreur lors de la confirmation globale:', err)
    // On ne vide pas la sélection en cas d'erreur pour permettre de réessayer les items restants
  } finally {
    isSubmittingBatch.value = false
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

// Helper pour obtenir une réservation spécifique pour le template
const getReservation = (textStudyId: string, section?: number) => {
  return reservations.value.find((r) => r.textStudyId === textStudyId && r.section === section)
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
  <main class="mx-auto px-6 py-8 min-h-screen">
    <!-- État de chargement -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">Chargement de la session...</p>
    </div>

    <!-- État d'erreur -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-2xl border border-red-100"
    >
      <p class="text-red-700 font-medium mb-4">{{ error }}</p>
      <button
        @click="loadSessionData"
        class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
      >
        Réessayer
      </button>
    </div>

    <!-- Contenu de la session -->
    <div v-else-if="session" class="animate-[fadeIn_0.5s_ease]">
      <!-- En-tête de la session -->
      <div class="mb-12 text-center max-w-3xl mx-auto">
        <h2
          class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight dark:text-gray-100"
        >
          {{ session.name }}
        </h2>
        <p class="text-text-secondary text-lg mb-6 dark:text-gray-300">{{ session.description }}</p>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <span
            class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold dark:bg-primary/20 dark:text-primary-light"
            >{{ sessionService.formatTextType(session.type) }}</span
          >
          <span
            class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-300"
            >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
          >
          <span
            class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-300"
            >Créé par : {{ session.creatorName }}</span
          >
          <button
            @click="openShareModal"
            class="px-3 py-1 bg-white border border-gray-200 hover:border-primary hover:text-primary rounded-full text-sm font-medium transition-colors flex items-center gap-1 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-primary dark:hover:border-primary"
            title="Partager cette session"
          >
            <i class="fa-solid fa-share-nodes"></i> Partager
          </button>
        </div>
      </div>

      <!-- Barre de progression -->
      <SessionProgressBar
        :total="progressStats.total"
        :reserved="progressStats.reserved"
        :read="progressStats.read"
        :participants="progressStats.participants"
      />

      <!-- Instructions -->
      <div
        class="mb-8 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100 dark:from-blue-900/10 dark:to-indigo-900/10 dark:border-blue-800/30"
      >
        <h3 class="font-bold text-lg text-blue-900 mb-3 flex items-center gap-2 dark:text-blue-200">
          <i class="fa-solid fa-circle-info"></i> Instructions
        </h3>
        <ul class="list-disc list-inside space-y-2 text-blue-800/80 text-sm dark:text-blue-300">
          <li>Cochez les cases pour réserver une section ou un texte</li>
          <li>Vous pouvez décocher vos propres réservations pour les annuler</li>
          <li>Cliquez sur la carte du texte pour voir les sections disponibles</li>
        </ul>
      </div>

      <!-- Formulaire de réservation pour invités (composant unifié) -->
      <div
        id="guest-form"
        v-if="!currentUser"
        class="mb-8 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm dark:bg-gray-800/60 dark:border-gray-700"
      >
        <h3 class="font-bold text-lg text-text-primary mb-4 dark:text-gray-100">Invité ?</h3>
        <GuestForm v-model:reservationForm="reservationForm" />
      </div>

      <!-- Barre de recherche -->
      <div class="sticky top-4 z-20 mb-8">
        <div class="relative max-w-xl mx-auto">
          <input
            type="text"
            v-model="searchTerm"
            placeholder="Rechercher un texte, un livre ou un chapitre..."
            class="w-full pl-12 pr-10 py-4 bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none dark:bg-gray-800/90 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-800"
          />
          <i class="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <button
            v-if="searchTerm"
            @click="clearSearch"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
            title="Effacer la recherche"
          >
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div
          v-if="searchTerm"
          class="text-center mt-2 text-sm text-text-secondary bg-white/50 backdrop-blur py-1 px-3 rounded-full inline-block mx-auto left-0 right-0 w-fit relative"
        >
          Recherche : "{{ searchTerm }}"
        </div>
      </div>

      <!-- Liste des textes groupés par livre -->
      <div class="space-y-12">
        <div
          v-for="(texts, bookName) in groupedTextStudies"
          :key="bookName"
          class="animate-[fadeIn_0.5s_ease]"
        >
          <h3
            class="text-2xl font-bold text-text-primary mb-6 pl-4 border-l-4 border-primary dark:text-gray-100"
          >
            {{ formatBookName(bookName) }}
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div
              v-for="text in texts"
              :key="text.id"
              class="flex flex-col bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
              :class="{
                'ring-2 ring-primary/50 dark:ring-primary/40':
                  isSelected(text.id, 1) ||
                  (text.totalSections > 1 &&
                    generateChapters(text.totalSections).some((c) => isSelected(text.id, c))),
              }"
            >
              <!-- En-tête du texte -->
              <div
                class="p-5 border-b border-black/5 bg-white/40 rounded-t-2xl dark:bg-gray-800/40 dark:border-white/5"
              >
                <div class="flex justify-between items-start gap-3 mb-2">
                  <div class="flex-1 min-w-0">
                    <h4
                      class="font-bold text-lg text-text-primary leading-tight truncate mb-1 dark:text-gray-100"
                      :title="text.name"
                    >
                      {{ text.name }}
                    </h4>
                    <!-- Case à cocher directe pour les textes à un seul chapitre -->
                    <label
                      v-if="text.totalSections === 1"
                      class="inline-flex items-center gap-2 cursor-pointer mt-1"
                      :class="{
                        'opacity-60 cursor-not-allowed':
                          isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1),
                      }"
                    >
                      <input
                        type="checkbox"
                        class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary"
                        :checked="isReserved(text.id, 1).isReserved || isSelected(text.id, 1)"
                        @change="toggleSelection(text.id, 1)"
                        :disabled="
                          isReserving === `${text.id}-1` ||
                          (isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1))
                        "
                      />
                      <span class="text-sm font-medium text-text-secondary dark:text-gray-400">
                        {{ isSelected(text.id, 1) ? 'Sélectionné' : 'Réserver' }}
                      </span>
                    </label>
                  </div>

                  <div class="flex items-center gap-2 self-start">
                    <a
                      v-if="text.link"
                      :href="text.link"
                      target="_blank"
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-text-secondary hover:text-primary hover:border-primary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary"
                      title="Voir le texte sur Sefaria"
                    >
                      <i class="fa-solid fa-book-open text-xs"></i>
                    </a>
                    <button
                      v-if="text.totalSections > 1"
                      @click="toggleTextExpansion(text.id)"
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-text-secondary hover:bg-gray-50 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                      :class="{
                        'bg-gray-100 ring-2 ring-gray-200 dark:bg-gray-600 dark:ring-gray-500':
                          isTextExpanded(text.id),
                      }"
                    >
                      <i
                        class="fa-solid"
                        :class="isTextExpanded(text.id) ? 'fa-chevron-up' : 'fa-chevron-down'"
                      ></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Statut global du texte -->
              <div class="p-4 bg-white/20 dark:bg-gray-800/20">
                <!-- Pour les textes à un seul chapitre, vérifier le statut de complétion -->
                <div
                  v-if="text.totalSections === 1 && isReserved(text.id, 1).isReserved"
                  class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <span
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2"
                    :class="{
                      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200':
                        !getReservation(text.id, 1)?.isCompleted,
                      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300':
                        getReservation(text.id, 1)?.isCompleted,
                    }"
                  >
                    <i
                      class="fa-solid"
                      :class="
                        getReservation(text.id, 1)?.isCompleted
                          ? 'fa-check-circle'
                          : 'fa-user-clock'
                      "
                    ></i>
                    {{
                      getReservation(text.id, 1)?.isCompleted
                        ? `Lu par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                        : `Réservé par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                    }}
                  </span>

                  <!-- Switch pour marquer comme lu (seulement si c'est notre réservation) -->
                  <div
                    v-if="canCancelReservation(text.id, 1)"
                    class="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg border border-white/50 dark:bg-white/10 dark:border-white/10"
                  >
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="sr-only peer"
                        :checked="getReservation(text.id, 1)?.isCompleted || false"
                        @change="toggleReservationCompletion(text.id, 1)"
                      />
                      <div
                        class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 dark:bg-gray-600 dark:after:border-gray-500"
                      ></div>
                    </label>
                    <span class="text-xs font-medium text-text-secondary dark:text-gray-400"
                      >Terminé</span
                    >
                  </div>
                </div>
                <!-- Pour les textes à plusieurs chapitres -->
                <div v-else-if="text.totalSections > 1">
                  <div
                    v-if="getTextDisplayStatus(text.id).status === 'fully_reserved'"
                    class="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-semibold w-fit dark:bg-red-900/30 dark:text-red-300"
                  >
                    Réservé par {{ getTextDisplayStatus(text.id).reservedBy || "quelqu'un" }}
                  </div>
                  <div
                    v-else-if="getTextDisplayStatus(text.id).status === 'partially_reserved'"
                    class="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold w-fit dark:bg-amber-900/30 dark:text-amber-200"
                  >
                    Partiellement réservé
                  </div>
                  <div
                    v-else
                    class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold w-fit dark:bg-green-900/30 dark:text-green-300"
                  >
                    Disponible
                  </div>
                </div>
                <div
                  v-else
                  class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold w-fit dark:bg-green-900/30 dark:text-green-300"
                >
                  Disponible
                </div>
              </div>

              <!-- Sections du texte (expandable) - seulement si plus d'un chapitre -->
              <div
                v-if="text.totalSections > 1 && isTextExpanded(text.id)"
                class="bg-white/30 border-t border-black/5 animate-[fadeIn_0.3s_ease] dark:bg-gray-800/30 dark:border-white/5"
              >
                <div
                  class="px-5 py-3 bg-gray-50/50 border-b border-gray-100 dark:bg-gray-700/30 dark:border-gray-700"
                >
                  <h5
                    class="text-xs font-bold text-text-secondary uppercase tracking-wider dark:text-gray-400"
                  >
                    Sections disponibles ({{ text.totalSections }})
                  </h5>
                </div>

                <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                  <div
                    v-for="chapter in generateChapters(text.totalSections)"
                    :key="chapter"
                    class="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg hover:bg-white/50 transition-colors gap-2 dark:hover:bg-gray-700/50"
                  >
                    <label
                      class="flex items-center gap-3 cursor-pointer p-2 rounded-lg w-full sm:w-auto"
                      :class="{
                        'opacity-60 cursor-not-allowed':
                          isReserved(text.id, chapter).isReserved &&
                          !canCancelReservation(text.id, chapter),
                        'hover:bg-primary/5': !isReserved(text.id, chapter).isReserved,
                      }"
                    >
                      <input
                        type="checkbox"
                        class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary"
                        :checked="
                          isReserved(text.id, chapter).isReserved || isSelected(text.id, chapter)
                        "
                        @change="toggleSelection(text.id, chapter)"
                        :disabled="
                          isReserving === `${text.id}-${chapter}` ||
                          (isReserved(text.id, chapter).isReserved &&
                            !canCancelReservation(text.id, chapter))
                        "
                      />
                      <span class="font-medium text-text-primary dark:text-gray-200"
                        >Chapitre {{ chapter }}</span
                      >
                    </label>

                    <div
                      v-if="isReserved(text.id, chapter).isReserved"
                      class="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 sm:ml-auto"
                      :class="{
                        'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200':
                          !getReservation(text.id, chapter)?.isCompleted,
                        'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300':
                          getReservation(text.id, chapter)?.isCompleted,
                      }"
                    >
                      <i
                        class="fa-solid"
                        :class="
                          getReservation(text.id, chapter)?.isCompleted
                            ? 'fa-check-circle'
                            : 'fa-user-clock'
                        "
                      ></i>
                      {{
                        getReservation(text.id, chapter)?.isCompleted
                          ? `Lu par ${isReserved(text.id, chapter).reservedBy || "quelqu'un"}`
                          : `Réservé par ${isReserved(text.id, chapter).reservedBy || "quelqu'un"}`
                      }}
                    </div>
                    <span
                      v-else-if="isSelected(text.id, chapter)"
                      class="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold sm:ml-auto dark:bg-primary/20 dark:text-primary-light animate-pulse"
                    >
                      Sélectionné
                    </span>
                    <span
                      v-else
                      class="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold sm:ml-auto dark:bg-green-900/30 dark:text-green-300"
                    >
                      Disponible
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Bar pour Confirmation -->
    <BatchSelectionBar
      v-if="hasSelectedItems"
      :count="selectedItems.size"
      :loading="isSubmittingBatch"
      :label="!currentUser ? 'Finaliser en tant qu\'invité' : 'Confirmer la réservation'"
      :button-text="'Confirmer'"
      :button-loading-text="'Réservation...'"
      @confirm="confirmReservations"
    />

    <!-- Modal de partage -->
    <ShareModal
      v-model:show="showShareModal"
      :session-name="session?.name || ''"
      :share-url="shareUrl"
    />
  </main>
</template>
