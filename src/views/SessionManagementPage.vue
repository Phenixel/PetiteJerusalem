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
  <main class="min-h-screen pb-20">
    <!-- Affichage de chargement -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center min-h-[60vh] text-text-secondary"
    >
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">Chargement de la session...</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="session" class="max-w-[1200px] mx-auto px-6 pt-8 animate-[fadeIn_0.5s_ease]">
      <!-- En-tête avec navigation -->
      <div
        class="relative overflow-hidden mb-8 p-8 bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-lg"
      >
        <button
          @click="goBackToProfile"
          class="mb-6 px-4 py-2 bg-white/50 hover:bg-white text-text-secondary hover:text-primary rounded-xl font-medium transition-all flex items-center gap-2 group"
        >
          <i class="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
          Retour au profil
        </button>

        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2 tracking-tight">
              {{ session.name }}
            </h1>
            <p class="text-text-secondary text-lg max-w-2xl">{{ session.description }}</p>
          </div>
          <div class="flex gap-2">
            <span class="px-3 py-1 bg-primary/10 text-primary rounded-lg font-semibold">{{
              sessionService.formatTextType(session.type)
            }}</span>
            <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium"
              >Date limite : {{ sessionService.formatDate(session.dateLimit) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Statistiques de la session -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow"
        >
          <span class="block text-3xl font-bold text-primary mb-1">{{
            sessionStats.totalReservations
          }}</span>
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider"
            >Réservations</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow"
        >
          <span class="block text-3xl font-bold text-green-600 mb-1">{{
            sessionStats.completedReservations
          }}</span>
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider"
            >Terminées</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1"
            >{{ sessionStats.completionRate }}%</span
          >
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider"
            >Progression</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1"
            >{{ sessionStats.reservedTexts }}/{{ sessionStats.totalTexts }}</span
          >
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider"
            >Textes réservés</span
          >
        </div>
        <div
          class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 text-center hover:shadow-md transition-shadow col-span-2 md:col-span-1"
        >
          <span class="block text-3xl font-bold text-text-primary mb-1"
            >{{ sessionStats.reservationRate }}%</span
          >
          <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider"
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
            class="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-text-primary placeholder:text-text-secondary/60"
          />
          <i
            class="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60"
          ></i>
        </div>

        <div class="w-full md:w-64">
          <select
            v-model="selectedBook"
            class="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-text-primary appearance-none cursor-pointer"
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
          <h3 class="text-2xl font-bold text-text-primary mb-6 pl-2 border-l-4 border-primary">
            {{ sessionService.formatBookName(bookName) }}
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="textStudy in texts"
              :key="textStudy.id"
              class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full"
            >
              <!-- En-tête du texte -->
              <div class="p-5 border-b border-black/5 bg-white/30">
                <div class="flex justify-between items-start gap-4 mb-2">
                  <h4 class="font-bold text-lg text-text-primary leading-tight">
                    {{ sessionService.formatBookName(textStudy.name) }}
                  </h4>
                  <span
                    class="px-2 py-1 text-xs font-bold uppercase rounded-md whitespace-nowrap"
                    :class="{
                      'bg-green-100 text-green-700':
                        getTextStatus(textStudy).status === 'available',
                      'bg-red-50 text-red-700':
                        getTextStatus(textStudy).status === 'fully_reserved',
                      'bg-amber-50 text-amber-700':
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

                <div class="flex items-center justify-between text-xs text-text-secondary mt-2">
                  <span class="font-medium bg-white/50 px-2 py-1 rounded"
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
                <h5 class="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  {{ textStudy.totalSections > 1 ? 'Sections :' : 'Gestion :' }}
                </h5>

                <div class="space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                  <div
                    v-for="section in sessionService.generateChapters(textStudy.totalSections)"
                    :key="section"
                    class="flex items-center justify-between p-2 rounded-lg transition-colors text-sm"
                    :class="{
                      'bg-primary/5 border border-primary/10': isSectionReserved(
                        textStudy.id,
                        section,
                      ),
                      'bg-white/40 border border-white/20': !isSectionReserved(
                        textStudy.id,
                        section,
                      ),
                      'bg-green-50/50 border-green-200': getSectionReservation(
                        textStudy.id,
                        section,
                      )?.isCompleted,
                    }"
                  >
                    <div class="flex flex-col min-w-0">
                      <span class="font-medium text-text-primary">
                        {{ textStudy.totalSections > 1 ? `Chapitre ${section}` : 'Texte complet' }}
                      </span>
                      <span
                        v-if="isSectionReserved(textStudy.id, section)"
                        class="text-xs text-text-secondary truncate mt-0.5"
                      >
                        {{ getSectionReservation(textStudy.id, section)?.chosenByName }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 ml-2">
                      <button
                        v-if="!isSectionReserved(textStudy.id, section)"
                        @click="openGuestForm(textStudy, section)"
                        class="w-6 h-6 rounded-full flex items-center justify-center bg-white border border-gray-200 text-text-secondary hover:bg-primary hover:text-white hover:border-primary transition-colors focus:outline-none"
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
                            class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"
                          ></div>
                        </label>

                        <button
                          @click="
                            deleteReservation(getSectionReservation(textStudy.id, section)!.id)
                          "
                          class="w-6 h-6 rounded-full flex items-center justify-center bg-white border border-gray-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors focus:outline-none"
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

    <!-- Modal pour les invités -->
    <div
      v-if="showGuestForm"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease]"
      @click="showGuestForm = false"
    >
      <div
        class="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/50 animate-[scaleIn_0.3s_ease]"
        @click.stop
      >
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-text-primary">Réserver pour un invité</h3>
          <button
            @click="showGuestForm = false"
            class="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 text-text-secondary transition-colors"
          >
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <div class="space-y-4">
          <div class="p-3 bg-primary/10 rounded-xl text-sm text-text-primary mb-2">
            <span class="font-semibold">{{
              sessionService.formatBookName(selectedTextStudy?.name || '')
            }}</span>
            <span v-if="selectedSection"> - Chapitre {{ selectedSection }}</span>
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2"
              >Nom de l'invité</label
            >
            <input
              v-model="guestForm.name"
              type="text"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder="Nom complet"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2"
              >Email de l'invité</label
            >
            <input
              v-model="guestForm.email"
              type="email"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              placeholder="email@example.com"
              required
            />
          </div>

          <div class="flex gap-3 mt-6">
            <button
              @click="showGuestForm = false"
              class="flex-1 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold text-text-secondary transition-colors"
            >
              Annuler
            </button>
            <button
              @click="createGuestReservation"
              class="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-secondary hover:shadow-lg text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!guestForm.name || !guestForm.email"
            >
              Créer
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
