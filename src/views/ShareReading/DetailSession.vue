<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { sessionService } from '../../services/sessionService'
import type { Session, TextStudy, TextStudyReservation } from '../../models/models'
import type { User } from '../../services/authService'
import GuestForm from '../../components/GuestForm.vue'
import ShareModal from '../../components/ShareModal.vue'
import SessionProgressBar from '../../components/SessionProgressBar.vue'
import BatchSelectionBar from '../../components/BatchSelectionBar.vue'
import { seoService } from '../../services/seoService'
import SessionHeader from './detailSession/SessionHeader.vue'
import SessionInstructions from './detailSession/SessionInstructions.vue'
import TextStudiesList from './detailSession/TextStudiesList.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const session = ref<Session | null>(null)
const textStudies = ref<TextStudy[]>([])
const reservations = ref<TextStudyReservation[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const currentUser = ref<User | null>(null)

const reservationForm = ref({
  name: '',
  email: '',
})

const isReserving = ref<string | null>(null)

const searchTerm = ref('')

const showShareModal = ref(false)
const shareUrl = ref('')

const selectedItems = ref<Set<string>>(new Set())
const isSubmittingBatch = ref(false)

const groupedTextStudies = computed(() => {
  if (!textStudies.value.length) return {}

  let filtered = textStudies.value
  if (searchTerm.value.trim()) {
    filtered = sessionService.filterTextStudiesBySearch(filtered, searchTerm.value)
  }

  if (currentUser.value) {
    const myReservedTextIds = new Set<string>()

    reservations.value.forEach((r) => {
      if (sessionService.canUserDeleteReservation(r, currentUser.value, '')) {
        myReservedTextIds.add(r.textStudyId)
      }
    })

    const myTexts: TextStudy[] = []
    const otherTexts: TextStudy[] = []

    filtered.forEach((text) => {
      if (myReservedTextIds.has(text.id)) {
        myTexts.push(text)
      } else {
        otherTexts.push(text)
      }
    })

    const groupedOthers = sessionService.groupTextStudiesByBook(otherTexts)

    if (myTexts.length > 0) {
      return {
        [t('detailSession.myReservations')]: myTexts,
        ...groupedOthers,
      }
    }

    return groupedOthers
  }

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

  const total = textStudies.value.reduce((acc, textStudy) => acc + textStudy.totalSections, 0)

  const reserved = reservations.value.length

  const read = reservations.value.filter((r) => r.isCompleted).length

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

const hasSelectedItems = computed(() => selectedItems.value.size > 0)

const confirmButtonLabel = computed(() => {
  return !currentUser.value
    ? t('detailSession.confirmAsGuest')
    : t('detailSession.confirmReservation')
})

const loadSessionData = async () => {
  try {
    isLoading.value = true
    error.value = null

    const sessionId = route.params.id as string
    if (!sessionId) {
      throw new Error('ID de session manquant')
    }

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

const reserveTextOrSection = async (textStudyId: string, section?: number) => {
  if (!session.value) return

  try {
    const reservationId = await sessionService.createReservationForUser(
      session.value.id,
      textStudyId,
      section,
      currentUser.value,
      reservationForm.value,
    )

    const newReservation = sessionService.createLocalReservation(
      reservationId,
      textStudyId,
      section,
      currentUser.value,
      reservationForm.value,
    )

    reservations.value.push(newReservation)
  } catch (err) {
    console.error('Erreur lors de la réservation:', err)
    alert(err instanceof Error ? err.message : t('detailSession.reservationError'))
    throw err
  }
}

const isReserved = (textStudyId: string, section?: number) => {
  if (!session.value) return { isReserved: false }
  return sessionService.isTextOrSectionReserved(textStudyId, section, session.value)
}

const handleItemClick = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`

  if (isReserved(textStudyId, section).isReserved) {
    if (selectedItems.value.has(key)) {
      selectedItems.value.delete(key)
    }

    if (confirm(t('detailSession.cancelReservationConfirm'))) {
      cancelReservation(textStudyId, section)
    }
    return
  }

  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
}

const confirmReservations = async () => {
  if (!session.value || selectedItems.value.size === 0) return

  if (!currentUser.value && (!reservationForm.value.name || !reservationForm.value.email)) {
    alert(t('detailSession.fillNameAndEmail'))
    const formElement = document.getElementById('guest-form')
    if (formElement) {
      const offset = 120
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

    for (const item of itemsToReserve) {
      if (isReserved(item.textId, item.section).isReserved) continue

      const key = item.section ? `${item.textId}-${item.section}` : `${item.textId}-full`
      isReserving.value = key
      try {
        await reserveTextOrSection(item.textId, item.section)
      } finally {
        isReserving.value = null
      }
    }

    selectedItems.value.clear()
  } catch (err) {
    console.error('Erreur lors de la confirmation globale:', err)
  } finally {
    isSubmittingBatch.value = false
  }
}

const cancelReservation = async (textStudyId: string, section?: number) => {
  if (!session.value) return

  try {
    const reservation = reservations.value.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    )

    if (reservation) {
      const canDelete = sessionService.canUserDeleteReservation(
        reservation,
        currentUser.value,
        reservationForm.value.email,
      )

      if (!canDelete) {
        alert(t('detailSession.canOnlyCancelOwn'))
        return
      }

      await sessionService.deleteReservation(session.value.id, reservation.id)

      const index = reservations.value.findIndex((r) => r.id === reservation.id)
      if (index > -1) {
        reservations.value.splice(index, 1)
      }

      if (session.value) {
        session.value.reservations = reservations.value
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'annulation:", err)
    alert(t('detailSession.cancelError'))
  }
}

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

    reservation.isCompleted = newCompletionStatus
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation:', error)
    alert(t('detailSession.updateError'))
  }
}

const clearSearch = () => {
  searchTerm.value = ''
}

const openShareModal = () => {
  shareUrl.value = window.location.href
  showShareModal.value = true
}

const isOwner = computed(() => {
  if (!currentUser.value || !session.value) return false
  return currentUser.value.id === session.value.personId
})

const goToManagement = () => {
  if (session.value) {
    router.push(`/session-management/${session.value.id}`)
  }
}

onMounted(async () => {
  currentUser.value = await sessionService.getCurrentUser()

  await loadSessionData()

  if (session.value) {
    const url = window.location.origin + `/share-reading/session/${session.value.id}`
    seoService.setMeta({
      title: `${session.value.name} | ${t('seo.sessionTitle')}`,
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
    title: `${s.name} | ${t('seo.sessionTitle')}`,
    description: s.description || 'Session de lecture partagée.',
    canonical: url,
    og: { url },
  })
})
</script>

<template>
  <main class="mx-auto px-6 py-8 flex-1 w-full">
    <!-- État de chargement -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">{{ t('detailSession.loadingSession') }}</p>
    </div>

    <!-- État d'erreur -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
    >
      <p class="text-red-700 font-medium mb-4 dark:text-red-400">{{ error }}</p>
      <button
        @click="loadSessionData"
        class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Contenu de la session -->
    <div v-else-if="session" class="animate-[fadeIn_0.5s_ease]">
      <SessionHeader
        :session="session"
        :is-owner="isOwner"
        @share="openShareModal"
        @manage="goToManagement"
      />

      <!-- Barre de progression -->
      <SessionProgressBar
        :total="progressStats.total"
        :reserved="progressStats.reserved"
        :read="progressStats.read"
        :participants="progressStats.participants"
      />

      <SessionInstructions />

      <!-- Formulaire de réservation pour invités (composant unifié) -->
      <div
        id="guest-form"
        v-if="!currentUser"
        class="mb-8 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm dark:bg-gray-800/60 dark:border-gray-700"
      >
        <h3 class="font-bold text-lg text-text-primary mb-4 dark:text-gray-100">
          {{ t('detailSession.guestTitle') }}
        </h3>
        <GuestForm v-model:reservationForm="reservationForm" />
      </div>

      <!-- Barre de recherche -->
      <div class="sticky top-4 z-20 mb-8">
        <div class="relative max-w-xl mx-auto">
          <input
            type="text"
            v-model="searchTerm"
            :placeholder="t('detailSession.searchPlaceholder')"
            class="w-full pl-12 pr-10 py-4 bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none dark:bg-gray-800/90 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-800"
          />
          <i class="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <button
            v-if="searchTerm"
            @click="clearSearch"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
            :title="t('detailSession.clearSearch')"
          >
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div
          v-if="searchTerm"
          class="text-center mt-2 text-sm text-text-secondary bg-white/50 backdrop-blur py-1 px-3 rounded-full inline-block mx-auto left-0 right-0 w-fit relative dark:bg-gray-700/50 dark:text-gray-300"
        >
          {{ t('detailSession.searchFor') }} : "{{ searchTerm }}"
        </div>
      </div>

      <!-- Liste des textes groupés par livre -->
      <TextStudiesList
        :grouped-text-studies="groupedTextStudies"
        :session="session"
        :reservations="reservations"
        :current-user="currentUser"
        :guest-email="reservationForm.email"
        :selected-items="selectedItems"
        :is-reserving="isReserving"
        @item-click="handleItemClick"
        @toggle-completion="toggleReservationCompletion"
      />
    </div>

    <!-- Sticky Bottom Bar pour Confirmation -->
    <BatchSelectionBar
      v-if="hasSelectedItems"
      :count="selectedItems.size"
      :loading="isSubmittingBatch"
      :label="confirmButtonLabel"
      :button-text="t('common.confirm')"
      :button-loading-text="t('detailSession.reserving')"
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
