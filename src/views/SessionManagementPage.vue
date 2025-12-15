<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SessionService } from '../services/sessionService'
import { ReservationService, type ReservationForm } from '../services/reservationService'
import { AuthService } from '../services/authService'
import type { Session, TextStudy } from '../models/models'
import type { User } from '../services/authService'
import { seoService } from '../services/seoService'

import BatchSelectionBar from '../components/BatchSelectionBar.vue'

const router = useRouter()
const route = useRoute()
const sessionService = new SessionService()
const reservationService = new ReservationService()
const authService = new AuthService()

const isLoading = ref(true)
const currentUser = ref<User | null>(null)
const session = ref<Session | null>(null)
const textStudies = ref<TextStudy[]>([])
const searchTerm = ref('')
const selectedBook = ref<string>('')
const showGuestForm = ref(false)
const selectedTextStudy = ref<TextStudy | null>(null)
const selectedSection = ref<number | undefined>(undefined)

const selectedItems = ref<Set<string>>(new Set())
const isSubmittingBatch = ref(false)

const guestForm = ref<ReservationForm>({
  name: '',
  email: '',
})

const loadData = async () => {
  try {
    isLoading.value = true

    currentUser.value = await authService.getCurrentUser()
    if (!currentUser.value) {
      router.push('/')
      return
    }

    const sessionId = route.params.id as string
    session.value = await sessionService.getSessionById(sessionId)

    if (!session.value) {
      router.push('/profile')
      return
    }

    if (!sessionService.canManageSession(session.value, currentUser.value)) {
      router.push('/profile')
      return
    }

    textStudies.value = await sessionService.getTextStudiesByType(session.value.type)

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

const filteredTextStudies = computed(() => {
  let filtered = textStudies.value

  if (searchTerm.value) {
    filtered = sessionService.filterTextStudiesBySearch(filtered, searchTerm.value)
  }

  if (selectedBook.value) {
    filtered = filtered.filter((text) => text.livre === selectedBook.value)
  }

  return filtered
})

const groupedTextStudies = computed(() => {
  return sessionService.groupTextStudiesByBook(filteredTextStudies.value)
})

const availableBooks = computed(() => {
  const books = new Set(textStudies.value.map((text) => text.livre))
  return Array.from(books).sort()
})

const getTextStatus = (textStudy: TextStudy) => {
  return reservationService.getTextDisplayStatus(textStudy.id, textStudy, session.value!)
}

const getTextReservations = (textStudyId: string) => {
  return session.value?.reservations?.filter((r) => r.textStudyId === textStudyId) || []
}

const isSectionReserved = (textStudyId: string, section: number) => {
  return (
    session.value?.reservations?.some(
      (r) => r.textStudyId === textStudyId && r.section === section,
    ) || false
  )
}

const getSectionReservation = (textStudyId: string, section: number) => {
  return session.value?.reservations?.find(
    (r) => r.textStudyId === textStudyId && r.section === section,
  )
}

const openGuestForm = (textStudy: TextStudy, section?: number) => {
  selectedTextStudy.value = textStudy
  selectedSection.value = section
  showGuestForm.value = true
  guestForm.value = { name: '', email: '' }
}

const createGuestReservation = async () => {
  if (!guestForm.value.name || !guestForm.value.email || !session.value) {
    return
  }

  try {
    isLoading.value = true

    if (selectedItems.value.size > 0) {
      isSubmittingBatch.value = true
      const itemsToReserve = Array.from(selectedItems.value).map((key) => {
        const [textId, sectionStr] = key.split('#')
        return {
          textId,
          section: sectionStr === 'full' ? undefined : parseInt(sectionStr),
        }
      })

      for (const item of itemsToReserve) {
        if (item.section && isSectionReserved(item.textId, item.section)) continue

        await reservationService.createReservation(
          session.value.id,
          item.textId,
          item.section,
          undefined, // userId
          guestForm.value.email, // guestId (email as ID for guests mostly)
          undefined, // userName
          guestForm.value.name, // guestName
        )
      }

      selectedItems.value.clear()
    } else if (selectedTextStudy.value) {
      await reservationService.createReservation(
        session.value.id,
        selectedTextStudy.value.id,
        selectedSection.value,
        undefined, // userId
        guestForm.value.email, // guestId
        undefined, // userName
        guestForm.value.name, // guestName
      )
    }

    await reloadSession()
    showGuestForm.value = false
  } catch (error) {
    console.error('Erreur lors de la création de la réservation:', error)
    alert('Erreur lors de la création de la réservation')
  } finally {
    isLoading.value = false
    isSubmittingBatch.value = false
  }
}

const toggleSelection = (textId: string, section?: number) => {
  const key = section ? `${textId}#${section}` : `${textId}#full`
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
}

const isSelected = (textId: string, section: number) => {
  const key = `${textId}#${section}`
  return selectedItems.value.has(key)
}

const openBatchGuestForm = () => {
  selectedTextStudy.value = null
  selectedSection.value = undefined
  showGuestForm.value = true
}

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

const goBackToProfile = () => {
  router.push('/profile')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <main class="min-h-screen pb-20">
    <!-- Affichage de chargement -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">Chargement de la session...</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="session" class="mx-auto px-6 pt-8 animate-[fadeIn_0.5s_ease]">
      <!-- En-tête avec navigation -->
      <div
        class="relative overflow-hidden mb-8 p-8 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-lg dark:bg-gray-800/40 dark:border-gray-700"
      >
        <button
          @click="goBackToProfile"
          class="mb-6 px-4 py-2 bg-white/50 hover:bg-white text-text-secondary hover:text-primary rounded-xl font-medium transition-all flex items-center gap-2 group dark:bg-gray-700/50 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-primary"
        >
          <i class="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Retour au profil
        </button>

        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1
              class="text-3xl md:text-4xl font-bold text-text-primary mb-2 tracking-tight dark:text-gray-100"
            >
              {{ session.name }}
            </h1>
            <p class="text-text-secondary text-lg max-w-2xl dark:text-gray-300">
              {{ session.description }}
            </p>
          </div>
          <div class="flex gap-2">
            <span
              class="px-3 py-1 bg-primary/10 text-primary rounded-lg font-semibold dark:bg-primary/20 dark:text-primary-light"
              >{{ sessionService.formatTextType(session.type) }}</span
            >
            <span
              class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium dark:bg-gray-800 dark:text-gray-300"
              >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Statistiques de la session -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow dark:bg-gray-800/60 dark:border-gray-700"
        >
          <span class="block text-3xl font-bold text-primary mb-1 dark:text-primary-light">{{
            sessionStats.totalReservations
          }}</span>
          <span
            class="text-xs font-semibold text-text-secondary uppercase tracking-wider dark:text-gray-400"
            >Réservations</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow dark:bg-gray-800/60 dark:border-gray-700"
        >
          <span class="block text-3xl font-bold text-green-600 mb-1 dark:text-green-400">{{
            sessionStats.completedReservations
          }}</span>
          <span
            class="text-xs font-semibold text-text-secondary uppercase tracking-wider dark:text-gray-400"
            >Terminées</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow dark:bg-gray-800/60 dark:border-gray-700"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1 dark:text-gray-100"
            >{{ sessionStats.completionRate }}%</span
          >
          <span
            class="text-xs font-semibold text-text-secondary uppercase tracking-wider dark:text-gray-400"
            >Progression</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow dark:bg-gray-800/60 dark:border-gray-700"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1 dark:text-gray-100"
            >{{ sessionStats.reservedTexts }}/{{ sessionStats.totalTexts }}</span
          >
          <span
            class="text-xs font-semibold text-text-secondary uppercase tracking-wider dark:text-gray-400"
            >Textes réservés</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow col-span-2 md:col-span-1 dark:bg-gray-800/60 dark:border-gray-700"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1 dark:text-gray-100"
            >{{ sessionStats.reservationRate }}%</span
          >
          <span
            class="text-xs font-semibold text-text-secondary uppercase tracking-wider dark:text-gray-400"
            >Taux de réservation</span
          >
        </div>
      </div>

      <!-- Filtres et recherche -->
      <div class="flex flex-col md:flex-row gap-4 mb-8">
        <div class="relative flex-1">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Rechercher un texte..."
            class="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-text-primary placeholder:text-text-secondary/60 dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-100 dark:focus:bg-gray-800 dark:placeholder-gray-400"
          />
          <i
            class="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 dark:text-gray-400"
          ></i>
        </div>

        <div class="w-full md:w-64">
          <select
            v-model="selectedBook"
            class="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-text-primary appearance-none cursor-pointer dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-100 dark:focus:bg-gray-800"
          >
            <option value="">Tous les livres</option>
            <option v-for="book in availableBooks" :key="book" :value="book">
              {{ sessionService.formatBookName(book) }}
            </option>
          </select>
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
            class="text-2xl font-bold text-text-primary mb-6 pl-2 border-l-4 border-primary dark:text-gray-100"
          >
            {{ sessionService.formatBookName(bookName) }}
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="textStudy in texts"
              :key="textStudy.id"
              class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
            >
              <!-- En-tête du texte -->
              <div
                class="p-5 border-b border-black/5 bg-white/30 dark:bg-gray-800/30 dark:border-white/5"
              >
                <div class="flex justify-between items-start gap-4 mb-2">
                  <h4 class="font-bold text-lg text-text-primary leading-tight dark:text-gray-100">
                    {{ sessionService.formatBookName(textStudy.name) }}
                  </h4>
                  <span
                    class="px-2 py-1 text-xs font-bold uppercase rounded-md whitespace-nowrap"
                    :class="{
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300':
                        getTextStatus(textStudy).status === 'available',
                      'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300':
                        getTextStatus(textStudy).status === 'fully_reserved',
                      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200':
                        getTextStatus(textStudy).status === 'partially_reserved',
                    }"
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

                <div
                  class="flex items-center justify-between text-xs text-text-secondary mt-2 dark:text-gray-400"
                >
                  <span
                    class="font-medium bg-white/50 px-2 py-1 rounded dark:bg-gray-700/50 dark:text-gray-300"
                    >{{ getTextReservations(textStudy.id).length }} réservation(s)</span
                  >
                  <span
                    v-if="getTextStatus(textStudy).reservedBy"
                    class="truncate max-w-[120px]"
                    :title="getTextStatus(textStudy).reservedBy || ''"
                  >
                    Par : {{ getTextStatus(textStudy).reservedBy }}
                  </span>
                </div>
              </div>

              <!-- Gestion des réservations -->
              <div class="p-5 flex-1 flex flex-col">
                <h5
                  class="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 dark:text-gray-400"
                >
                  {{ textStudy.totalSections > 1 ? 'Sections :' : 'Gestion :' }}
                </h5>

                <div class="space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                  <div
                    v-for="section in sessionService.generateChapters(textStudy.totalSections)"
                    :key="section"
                    class="flex items-center justify-between p-2 rounded-lg transition-colors text-sm"
                    :class="{
                      'bg-primary/5 border border-primary/10 dark:bg-primary/10 dark:border-primary/20':
                        isSectionReserved(textStudy.id, section),
                      'bg-white/40 border border-white/20 dark:bg-gray-700/30 dark:border-gray-600':
                        !isSectionReserved(textStudy.id, section),
                      'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800':
                        getSectionReservation(textStudy.id, section)?.isCompleted,
                    }"
                  >
                    <div class="flex flex-col min-w-0">
                      <span class="font-medium text-text-primary dark:text-gray-200">
                        {{ textStudy.totalSections > 1 ? `Chapitre ${section}` : 'Texte complet' }}
                      </span>
                      <span
                        v-if="isSectionReserved(textStudy.id, section)"
                        class="text-xs text-text-secondary truncate mt-0.5 dark:text-gray-400"
                      >
                        {{ getSectionReservation(textStudy.id, section)?.chosenByName }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 ml-2">
                      <input
                        v-if="!isSectionReserved(textStudy.id, section)"
                        type="checkbox"
                        class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary cursor-pointer mr-1"
                        :checked="isSelected(textStudy.id, section)"
                        @change="toggleSelection(textStudy.id, section)"
                      />

                      <button
                        v-if="!isSectionReserved(textStudy.id, section)"
                        @click="openGuestForm(textStudy, section)"
                        class="w-6 h-6 rounded-full flex items-center justify-center bg-white border border-gray-200 text-text-secondary hover:bg-primary hover:text-white hover:border-primary transition-colors focus:outline-none dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-primary dark:hover:text-white"
                        title="Réserver pour un invité"
                      >
                        <i class="fa-solid fa-plus text-xs"></i>
                      </button>

                      <div v-else class="flex items-center gap-2">
                        <label
                          class="relative inline-flex items-center cursor-pointer"
                          title="Marquer comme terminé"
                        >
                          <input
                            type="checkbox"
                            class="sr-only peer"
                            :checked="getSectionReservation(textStudy.id, section)?.isCompleted"
                            @change="
                              toggleReservationCompletion(
                                getSectionReservation(textStudy.id, section)!.id,
                                ($event.target as HTMLInputElement).checked,
                              )
                            "
                          />
                          <div
                            class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 dark:bg-gray-600 dark:peer-checked:bg-green-600 dark:after:border-gray-500"
                          ></div>
                        </label>

                        <button
                          @click="
                            deleteReservation(getSectionReservation(textStudy.id, section)!.id)
                          "
                          class="w-6 h-6 rounded-full flex items-center justify-center bg-white border border-gray-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors focus:outline-none dark:bg-gray-600 dark:border-gray-500 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                          title="Supprimer la réservation"
                        >
                          <i class="fa-solid fa-trash text-xs"></i>
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

    <!-- Sticky Bottom Bar pour Batch -->
    <BatchSelectionBar
      :count="selectedItems.size"
      :loading="isSubmittingBatch"
      :label="'Attribuer à un invité'"
      :button-text="'Réserver'"
      :button-loading-text="'Traitement...'"
      @confirm="openBatchGuestForm"
    />

    <!-- Modal pour les invités -->
    <div
      v-if="showGuestForm"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease]"
      @click="showGuestForm = false"
    >
      <div
        class="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/50 animate-[scaleIn_0.3s_ease] dark:bg-gray-800/95 dark:border-gray-700/50"
        @click.stop
      >
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-text-primary dark:text-gray-100">
            {{
              selectedItems.size > 0
                ? `Réserver ${selectedItems.size} textes`
                : 'Réserver pour un invité'
            }}
          </h3>
          <button
            @click="showGuestForm = false"
            class="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 text-text-secondary transition-colors dark:bg-white/10 dark:hover:bg-white/20 dark:text-gray-300"
          >
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="space-y-4">
          <div
            v-if="selectedTextStudy"
            class="p-3 bg-primary/10 rounded-xl text-sm text-text-primary mb-2 dark:bg-primary/20 dark:text-white"
          >
            <span class="font-semibold">{{
              sessionService.formatBookName(selectedTextStudy?.name || '')
            }}</span>
            <span v-if="selectedSection"> - Chapitre {{ selectedSection }}</span>
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-300"
              >Nom de l'invité</label
            >
            <input
              v-model="guestForm.name"
              type="text"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-700"
              placeholder="Nom complet"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-300"
              >Email de l'invité</label
            >
            <input
              v-model="guestForm.email"
              type="email"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-700"
              placeholder="email@example.com"
              required
            />
          </div>

          <div class="flex gap-3 mt-6">
            <button
              @click="showGuestForm = false"
              class="flex-1 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold text-text-secondary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Annuler
            </button>
            <button
              @click="createGuestReservation"
              class="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-secondary hover:shadow-lg text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              :disabled="!guestForm.name || !guestForm.email || isLoading"
            >
              <i v-if="isLoading" class="fa-solid fa-circle-notch fa-spin"></i>
              {{ isLoading ? 'Création...' : 'Créer' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
