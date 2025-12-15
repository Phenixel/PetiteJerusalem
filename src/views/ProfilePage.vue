<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/authService'
import { SessionService } from '../services/sessionService'
import type { User } from '../services/authService'
import type { Session, TextStudy } from '../models/models'
import { seoService } from '../services/seoService'
import ShareModal from '../components/ShareModal.vue'
import EditSessionModal from '../components/EditSessionModal.vue'

const router = useRouter()
const authService = new AuthService()
const sessionService = new SessionService()

const currentUser = ref<User | null>(null)
const activeTab = ref<'sessions-participated' | 'sessions-created' | 'my-info' | 'security'>(
  'sessions-participated',
)
const isLoading = ref(true)

const participatedSessions = ref<Session[]>([])
const createdSessions = ref<Session[]>([])
const textStudiesMap = ref<Map<string, TextStudy>>(new Map())

const isEditingInfo = ref(false)
const editForm = ref({
  name: '',
  email: '',
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const isChangingPassword = ref(false)
const isDeletingAccount = ref(false)

const showShareModal = ref(false)
const showEditModal = ref(false)
const selectedSession = ref<Session | null>(null)
const shareUrl = ref('')

const userDisplayName = computed(() => currentUser.value?.name || 'Utilisateur')

const loadUserData = async () => {
  try {
    isLoading.value = true
    currentUser.value = await authService.getCurrentUser()

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
    router.push('/')
  } finally {
    isLoading.value = false
  }
}

const loadSessions = async () => {
  if (!currentUser.value) return

  try {
    const allSessions = await sessionService.getAllSessions()

    participatedSessions.value = allSessions.filter((session) =>
      session.reservations?.some((reservation) => reservation.chosenById === currentUser.value?.id),
    )

    createdSessions.value = allSessions.filter(
      (session) => session.personId === currentUser.value?.id,
    )

    await loadTextStudiesForSessions(participatedSessions.value)
  } catch (error) {
    console.error('Erreur lors du chargement des sessions:', error)
  }
}

const isSessionFinished = (session: Session): boolean => {
  if (session.isEnded) return true
  const limit = new Date(session.dateLimit)
  limit.setHours(23, 59, 59, 999)
  return new Date() > limit
}

const ongoingParticipatedSessions = computed(() =>
  participatedSessions.value.filter((s) => !isSessionFinished(s)),
)
const finishedParticipatedSessions = computed(() =>
  participatedSessions.value.filter((s) => isSessionFinished(s)),
)

const ongoingCreatedSessions = computed(() =>
  createdSessions.value.filter((s) => !isSessionFinished(s)),
)
const finishedCreatedSessions = computed(() =>
  createdSessions.value.filter((s) => isSessionFinished(s)),
)

const loadTextStudiesForSessions = async (sessions: Session[]) => {
  try {
    const textStudyIds = new Set<string>()

    sessions.forEach((session) => {
      session.reservations?.forEach((reservation) => {
        textStudyIds.add(reservation.textStudyId)
      })
    })

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

const getTextStudyName = (textStudyId: string): string => {
  const textStudy = textStudiesMap.value.get(textStudyId)
  return textStudy ? textStudy.name : textStudyId
}

const getUserReservationsForSession = (session: Session) => {
  if (!currentUser.value) return []
  return (
    session.reservations?.filter(
      (reservation) => reservation.chosenById === currentUser.value?.id,
    ) || []
  )
}

const toggleReservationCompletion = async (
  sessionId: string,
  reservationId: string,
  isCompleted: boolean,
) => {
  try {
    await sessionService.markReservationAsCompleted(sessionId, reservationId, isCompleted)

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

const goToSession = (sessionId: string) => {
  router.push({ name: 'detail-session', params: { id: sessionId } })
}

const setActiveTab = (tab: typeof activeTab.value) => {
  activeTab.value = tab
}

const saveUserInfo = async () => {
  if (!currentUser.value) return

  try {
    currentUser.value.name = editForm.value.name
    currentUser.value.email = editForm.value.email
    isEditingInfo.value = false
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
  }
}

const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('Les mots de passe ne correspondent pas')
    return
  }

  try {
    isChangingPassword.value = true
    alert('Changement de mot de passe réussi')
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error)
    alert('Erreur lors du changement de mot de passe')
  } finally {
    isChangingPassword.value = false
  }
}

const deleteAccount = async () => {
  if (
    !confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')
  ) {
    return
  }

  try {
    isDeletingAccount.value = true
    await authService.logout()
    window.location.href = '/'
  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error)
    alert('Erreur lors de la suppression du compte')
  } finally {
    isDeletingAccount.value = false
  }
}

const openShareModal = (session: Session) => {
  selectedSession.value = session
  shareUrl.value = `${window.location.origin}/share-reading/session/${session.id}`
  showShareModal.value = true
}

const openEditModal = (session: Session) => {
  selectedSession.value = session
  showEditModal.value = true
}

const openSessionManagement = (session: Session) => {
  router.push({ name: 'session-management', params: { id: session.id } })
}

const saveSessionChanges = async (sessionData: {
  name: string
  description: string
  dateLimit: string
}) => {
  if (!selectedSession.value) return

  try {
    await sessionService.updateSession(selectedSession.value.id, sessionData)

    const sessionIndex = createdSessions.value.findIndex((s) => s.id === selectedSession.value!.id)
    if (sessionIndex > -1) {
      createdSessions.value[sessionIndex] = {
        ...createdSessions.value[sessionIndex],
        name: sessionData.name,
        description: sessionData.description,
        dateLimit: new Date(sessionData.dateLimit),
        updatedAt: new Date(),
      }
    }

    alert('Session mise à jour avec succès')
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    alert('Erreur lors de la mise à jour de la session')
  }
}

const endSession = async (session: Session) => {
  if (
    !confirm('Êtes-vous sûr de vouloir terminer cette session ? Cette action est irréversible.')
  ) {
    return
  }

  try {
    await sessionService.endSession(session.id)

    const sessionIndex = createdSessions.value.findIndex((s) => s.id === session.id)
    if (sessionIndex > -1) {
      createdSessions.value[sessionIndex] = {
        ...createdSessions.value[sessionIndex],
        isEnded: true,
        endedAt: new Date(),
        updatedAt: new Date(),
      }
    }

    alert('Session terminée avec succès')
  } catch (error) {
    console.error('Erreur lors de la fin de session:', error)
    alert('Erreur lors de la fin de session')
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
  <main class="min-h-screen pb-20">
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">Chargement de votre profil...</p>
    </div>

    <div v-else-if="currentUser">
      <div
        class="relative overflow-hidden mb-12 py-16 px-6 md:px-12 bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
      >
        <div
          class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=')] opacity-30"
        ></div>
        <div class="relative z-10 max-w-[1200px] mx-auto">
          <div class="flex items-center gap-4 mb-2">
            <h1 class="text-4xl md:text-5xl font-bold text-white tracking-tight">
              {{ userDisplayName }}
            </h1>
            <span
              class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold tracking-wider uppercase border border-white/20"
              >Membre Actif</span
            >
          </div>
        </div>
      </div>

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav
          class="lg:sticky lg:top-24 h-fit bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm dark:bg-gray-800/40 dark:border-gray-700"
        >
          <ul class="flex flex-col gap-2 mb-8">
            <li>
              <button
                @click="setActiveTab('sessions-participated')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'sessions-participated'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>Sessions Participées</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('sessions-created')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'sessions-created'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>Sessions Créées</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('my-info')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'my-info'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>Mes Informations</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('security')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'security'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>Sécurité</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
          </ul>

          <button
            @click="authService.logout()"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <i class="fa-solid fa-right-from-bracket"></i>
            Déconnexion
          </button>
        </nav>

        <div>
          <div v-if="activeTab === 'sessions-participated'" class="animate-[fadeIn_0.3s_ease]">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">
                Sessions participées
              </h2>
            </div>

            <div
              v-if="participatedSessions.length === 0"
              class="flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/40 text-center dark:bg-gray-800/40 dark:border-gray-700"
            >
              <div
                class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400 text-2xl dark:bg-gray-700 dark:text-gray-500"
              >
                <i class="fa-solid fa-calendar-xmark"></i>
              </div>
              <h3 class="text-xl font-semibold text-text-primary mb-2 dark:text-gray-200">
                Aucune session participée
              </h3>
              <p class="text-text-secondary dark:text-gray-400">
                Vous n'avez pas encore participé à des sessions d'étude.
              </p>
            </div>

            <div v-else>
              <div v-if="ongoingParticipatedSessions.length > 0" class="mb-12">
                <h3
                  class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
                >
                  <i class="fa-solid fa-hourglass-half text-primary"></i> En cours
                </h3>

                <div class="grid gap-6">
                  <div
                    v-for="session in ongoingParticipatedSessions"
                    :key="session.id"
                    class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-6 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700"
                  >
                    <div
                      class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/5 dark:border-white/10"
                    >
                      <div>
                        <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-100">
                          {{ session.name }}
                        </h3>
                        <p class="text-text-secondary text-sm dark:text-gray-400">
                          {{ session.description }}
                        </p>
                      </div>
                      <button
                        @click="goToSession(session.id)"
                        class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <i class="fa-solid fa-external-link-alt text-xs"></i>
                        Voir la session
                      </button>
                    </div>

                    <div class="flex gap-2 mb-6 text-xs">
                      <span
                        class="px-2 py-1 bg-primary/10 text-primary rounded-md font-semibold dark:bg-primary/20"
                        >{{ sessionService.formatTextType(session.type) }}</span
                      >
                      <span
                        class="px-2 py-1 bg-gray-100 text-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-300"
                        >Limite : {{ sessionService.formatDate(session.dateLimit) }}</span
                      >
                    </div>

                    <div
                      class="bg-white/40 rounded-xl p-4 border border-white/40 dark:bg-gray-700/30 dark:border-gray-600/50"
                    >
                      <h4
                        class="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide opacity-70 dark:text-gray-300"
                      >
                        Mes réservations
                      </h4>
                      <div
                        v-if="getUserReservationsForSession(session).length === 0"
                        class="text-sm text-text-secondary italic dark:text-gray-400"
                      >
                        Aucune réservation trouvée
                      </div>
                      <div v-else class="space-y-3">
                        <div
                          v-for="reservation in getUserReservationsForSession(session)"
                          :key="reservation.id"
                          class="flex items-center justify-between p-3 rounded-lg bg-white/60 border border-white/40 transition-all dark:bg-gray-700/50 dark:border-gray-600"
                          :class="{
                            'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20':
                              reservation.isCompleted,
                          }"
                        >
                          <div class="flex flex-col">
                            <span class="font-medium text-text-primary dark:text-gray-200">
                              {{ getTextStudyName(reservation.textStudyId) }}
                              <span
                                v-if="reservation.section"
                                class="text-text-secondary font-normal dark:text-gray-400"
                              >
                                - Chapitre {{ reservation.section }}
                              </span>
                            </span>
                            <span
                              v-if="reservation.isCompleted"
                              class="text-xs text-green-600 font-bold mt-1 flex items-center gap-1 dark:text-green-400"
                            >
                              <i class="fa-solid fa-check-circle"></i> Terminé
                            </span>
                          </div>
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary dark:border-gray-500 dark:bg-gray-600"
                              :checked="reservation.isCompleted"
                              @change="
                                toggleReservationCompletion(
                                  session.id,
                                  reservation.id,
                                  ($event.target as HTMLInputElement).checked,
                                )
                              "
                            />
                            <span class="text-xs font-medium text-text-secondary dark:text-gray-400"
                              >Lu</span
                            >
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="finishedParticipatedSessions.length > 0" class="opacity-80">
                <h3
                  class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
                >
                  <i class="fa-solid fa-check-double text-green-600 dark:text-green-400"></i>
                  Terminées
                </h3>

                <div class="grid gap-6">
                  <div
                    v-for="session in finishedParticipatedSessions"
                    :key="session.id"
                    class="bg-gray-50/60 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 opacity-90 hover:opacity-100 transition-all duration-300 dark:bg-gray-800/40 dark:border-gray-700"
                  >
                    <div
                      class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-black/5 dark:border-white/10"
                    >
                      <div>
                        <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-300">
                          {{ session.name }}
                        </h3>
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded dark:bg-gray-700 dark:text-gray-300"
                          >
                            <i class="fa-solid fa-flag-checkered"></i> Terminée
                          </span>
                        </div>
                      </div>
                      <button
                        @click="goToSession(session.id)"
                        class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <i class="fa-solid fa-eye text-xs"></i>
                        Consulter
                      </button>
                    </div>

                    <div class="text-sm text-text-secondary dark:text-gray-400 mb-2">
                      Vous aviez {{ getUserReservationsForSession(session).length }} réservations
                      dans cette session.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'sessions-created'" class="animate-[fadeIn_0.3s_ease]">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">
                Sessions créées
              </h2>
            </div>

            <div
              v-if="createdSessions.length === 0"
              class="flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/40 text-center dark:bg-gray-800/40 dark:border-gray-700"
            >
              <div
                class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400 text-2xl dark:bg-gray-700 dark:text-gray-500"
              >
                <i class="fa-solid fa-plus-circle"></i>
              </div>
              <h3 class="text-xl font-semibold text-text-primary mb-2 dark:text-gray-200">
                Aucune session créée
              </h3>
              <p class="text-text-secondary mb-6 dark:text-gray-400">
                Créez votre première session d'étude partagée.
              </p>
              <button
                class="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Créer une session
              </button>
            </div>

            <div v-else>
              <div v-if="ongoingCreatedSessions.length > 0" class="mb-12">
                <h3
                  class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
                >
                  <i class="fa-solid fa-play-circle text-primary"></i> En cours
                </h3>

                <div class="grid gap-6">
                  <div
                    v-for="session in ongoingCreatedSessions"
                    :key="session.id"
                    class="relative bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-6 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
                  >
                    <div class="flex items-start justify-between mb-4">
                      <div>
                        <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-100">
                          {{ session.name }}
                        </h3>
                      </div>
                      <div class="flex gap-2">
                        <span
                          class="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-semibold dark:bg-primary/20"
                          >{{ sessionService.formatTextType(session.type) }}</span
                        >
                      </div>
                    </div>

                    <p class="text-text-secondary text-sm mb-6 dark:text-gray-400">
                      {{ session.description }}
                    </p>

                    <div
                      class="flex flex-wrap items-center gap-4 pt-4 border-t border-black/5 dark:border-white/10"
                    >
                      <button
                        v-if="sessionService.canEditSession(session)"
                        @click="openEditModal(session)"
                        class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary dark:hover:bg-gray-700"
                      >
                        <i class="fa-solid fa-edit"></i> Modifier
                      </button>
                      <button
                        v-if="sessionService.canManageSession(session, currentUser)"
                        @click="openSessionManagement(session)"
                        class="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-sm font-medium text-primary transition-colors flex items-center gap-2 dark:bg-primary/20"
                      >
                        <i class="fa-solid fa-cogs"></i> Gérer
                      </button>
                      <button
                        @click="openShareModal(session)"
                        class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary hover:text-primary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary dark:hover:bg-gray-700"
                      >
                        <i class="fa-solid fa-share"></i> Partager
                      </button>
                      <button
                        v-if="sessionService.canEndSession(session)"
                        @click="endSession(session)"
                        class="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-sm font-medium text-red-600 transition-colors flex items-center gap-2 ml-auto dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        <i class="fa-solid fa-flag-checkered"></i> Fin
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Terminées -->
              <div v-if="finishedCreatedSessions.length > 0" class="opacity-80">
                <h3
                  class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2 dark:text-gray-200"
                >
                  <i class="fa-solid fa-stop-circle text-gray-500"></i> Terminées
                </h3>

                <div class="grid gap-6">
                  <div
                    v-for="session in finishedCreatedSessions"
                    :key="session.id"
                    class="relative bg-gray-50/60 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 transition-all duration-300 dark:bg-gray-800/40 dark:border-gray-700"
                  >
                    <div class="flex items-start justify-between mb-4">
                      <div>
                        <h3 class="text-xl font-bold text-text-primary mb-1 dark:text-gray-300">
                          {{ session.name }}
                        </h3>
                        <div
                          class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded mb-2 dark:bg-gray-700 dark:text-gray-300"
                        >
                          <i class="fa-solid fa-flag-checkered"></i> Terminée
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <span
                          class="px-2 py-1 bg-gray-200 text-gray-600 rounded-md text-xs font-semibold dark:bg-gray-700 dark:text-gray-400"
                          >{{ sessionService.formatTextType(session.type) }}</span
                        >
                      </div>
                    </div>

                    <p class="text-text-secondary text-sm mb-6 dark:text-gray-500">
                      {{ session.description }}
                    </p>

                    <div
                      class="flex flex-wrap items-center gap-4 pt-4 border-t border-black/5 dark:border-white/10"
                    >
                      <button
                        v-if="sessionService.canManageSession(session, currentUser)"
                        @click="openSessionManagement(session)"
                        class="px-3 py-1.5 bg-white/50 hover:bg-white border border-gray-200 rounded-lg text-sm font-medium text-text-secondary transition-colors flex items-center gap-2 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <i class="fa-solid fa-eye"></i> Consulter
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'my-info'" class="animate-[fadeIn_0.3s_ease]">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">
                Mes informations
              </h2>
              <button
                v-if="!isEditingInfo"
                @click="isEditingInfo = true"
                class="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-text-secondary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <i class="fa-solid fa-edit mr-2"></i> Modifier
              </button>
              <div v-else class="flex gap-2">
                <button
                  @click="saveUserInfo"
                  class="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Sauvegarder
                </button>
                <button
                  @click="isEditingInfo = false"
                  class="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-text-secondary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Annuler
                </button>
              </div>
            </div>

            <div
              class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-8 max-w-2xl dark:bg-gray-800/60 dark:border-gray-700"
            >
              <div class="space-y-6">
                <div>
                  <label
                    class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                    >Nom d'affichage</label
                  >
                  <input
                    v-model="editForm.name"
                    :disabled="!isEditingInfo"
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-60 disabled:bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700 dark:disabled:bg-gray-900/50"
                    type="text"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                    >Adresse e-mail</label
                  >
                  <input
                    v-model="editForm.email"
                    :disabled="!isEditingInfo"
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-60 disabled:bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700 dark:disabled:bg-gray-900/50"
                    type="email"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                    >ID utilisateur</label
                  >
                  <input
                    :value="currentUser?.id"
                    disabled
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 opacity-60 font-mono text-sm dark:bg-gray-900/50 dark:border-gray-600 dark:text-gray-400"
                    type="text"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'security'" class="animate-[fadeIn_0.3s_ease]">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">Sécurité</h2>
            </div>

            <div class="grid gap-8 max-w-2xl">
              <div
                class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-8 dark:bg-gray-800/60 dark:border-gray-700"
              >
                <h3 class="text-xl font-bold text-text-primary mb-6 dark:text-gray-100">
                  Changer le mot de passe
                </h3>
                <form @submit.prevent="changePassword" class="space-y-4">
                  <div>
                    <label
                      class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                      >Mot de passe actuel</label
                    >
                    <input
                      v-model="passwordForm.currentPassword"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
                      type="password"
                      required
                    />
                  </div>

                  <div>
                    <label
                      class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                      >Nouveau mot de passe</label
                    >
                    <input
                      v-model="passwordForm.newPassword"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
                      type="password"
                      required
                    />
                  </div>

                  <div>
                    <label
                      class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
                      >Confirmer le nouveau mot de passe</label
                    >
                    <input
                      v-model="passwordForm.confirmPassword"
                      class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
                      type="password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    :disabled="isChangingPassword"
                    class="w-full py-3 px-6 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all mt-4 disabled:opacity-70"
                  >
                    {{ isChangingPassword ? 'Changement en cours...' : 'Changer le mot de passe' }}
                  </button>
                </form>
              </div>

              <div
                class="bg-red-50/50 backdrop-blur-sm rounded-2xl border border-red-100 p-8 dark:bg-red-900/10 dark:border-red-900/30"
              >
                <h3 class="text-xl font-bold text-red-700 mb-2 dark:text-red-400">
                  Supprimer le compte
                </h3>
                <p class="text-red-600/80 mb-6 dark:text-red-400/80">
                  Cette action est irréversible. Toutes vos données seront définitivement
                  supprimées.
                </p>
                <button
                  @click="deleteAccount"
                  :disabled="isDeletingAccount"
                  class="px-6 py-3 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-xl font-semibold transition-colors w-full sm:w-auto dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50"
                >
                  {{ isDeletingAccount ? 'Suppression en cours...' : 'Supprimer mon compte' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ShareModal
      v-model:show="showShareModal"
      :session-name="selectedSession?.name || ''"
      :share-url="shareUrl"
    />

    <EditSessionModal
      v-model:show="showEditModal"
      :session="selectedSession"
      @save="saveSessionChanges"
    />
  </main>
</template>
