<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { sessionService } from '../../services/sessionService'
import type { Session } from '../../models/models'
import SessionCard from '../../components/SessionCard.vue'
import { seoService } from '../../services/seoService'
import { authService } from '../../services/authService'

const router = useRouter()

const sessions = ref<Session[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isAuthenticated = ref(false)
let unsubscribeAuth: (() => void) | null = null

const loadSessions = async () => {
  try {
    isLoading.value = true
    error.value = null
    const fetchedSessions = await sessionService.getAllSessions()
    sessions.value = sessionService.sortSessionsByDate(fetchedSessions)
  } catch (err) {
    console.error('Erreur lors du chargement des sessions:', err)
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des sessions'
  } finally {
    isLoading.value = false
  }
}

const isSessionFinished = (session: Session): boolean => {
  if (session.isEnded) return true
  const limit = new Date(session.dateLimit)
  limit.setHours(23, 59, 59, 999)
  return new Date() > limit
}

const ongoingSessions = computed(() => sessions.value.filter((s) => !isSessionFinished(s)))
const finishedSessions = computed(() => sessions.value.filter((s) => isSessionFinished(s)))

onMounted(() => {
  loadSessions()
  unsubscribeAuth = authService.onAuthChanged((user) => {
    isAuthenticated.value = !!user
  })
  const url = window.location.origin + '/share-reading'
  seoService.setMeta({
    title: 'Partage de Lectures | Petite Jerusalem',
    description:
      'Découvrez et créez des sessions de lecture partagée. Réservez des textes et étudiez avec la communauté.',
    canonical: url,
    og: { url },
  })
})

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth()
})

const handleSessionClick = (session: Session) => {
  router.push(`/share-reading/session/${session.id}`)
}
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="text-center mb-16 animate-[fadeIn_0.5s_ease]">
      <h2
        class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4 tracking-tight"
      >
        Partage de Lectures
      </h2>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        Échangez et découvrez des textes sacrés avec la communauté
      </p>

      <button
        @click="router.push('/share-reading/new-session')"
        class="mt-8 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        :disabled="!isAuthenticated"
        title="Créer une session"
      >
        <i class="fa-solid fa-plus mr-2"></i>
        Créer une session
      </button>
      <div v-if="!isAuthenticated" class="mt-4 text-sm text-text-secondary/80">
        <small>Vous devez avoir un compte et être connecté pour créer une session.</small>
      </div>
    </div>

    <div class="relative">
      <!-- État de chargement -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-2xl dark:bg-gray-900/60"
      >
        <div
          class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        ></div>
        <p class="text-text-secondary font-medium animate-pulse dark:text-gray-300">
          Chargement des sessions...
        </p>
      </div>

      <!-- État d'erreur -->
      <div
        v-if="error"
        class="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
      >
        <div
          class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4 dark:bg-red-900/20 dark:text-red-400"
        >
          <i class="fa-solid fa-exclamation-triangle"></i>
        </div>
        <p class="text-red-700 font-medium mb-6 dark:text-red-400">{{ error }}</p>
        <button
          @click="loadSessions"
          class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
        >
          Réessayer
        </button>
      </div>

      <!-- Liste des sessions -->
      <div v-else-if="sessions.length > 0">
        <!-- Sessions en cours -->
        <div class="mb-16 animate-[fadeIn_0.5s_ease]">
          <h3
            class="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3 dark:text-gray-100"
          >
            <i class="fa-solid fa-fire text-orange-500"></i>
            Sessions en cours
            <span
              class="text-sm font-normal text-text-secondary bg-gray-100 px-3 py-1 rounded-full dark:bg-gray-800 dark:text-gray-400"
              >{{ ongoingSessions.length }}</span
            >
          </h3>

          <div
            v-if="ongoingSessions.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <SessionCard
              v-for="session in ongoingSessions"
              :key="session.id"
              :session="session"
              @click="handleSessionClick"
              class="h-full"
            />
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center py-12 bg-white/40 backdrop-blur-sm rounded-xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
          >
            <p class="text-text-secondary text-lg dark:text-gray-400">
              Aucune session en cours pour le moment.
            </p>
          </div>
        </div>

        <!-- Sessions terminées -->
        <div v-if="finishedSessions.length > 0" class="animate-[fadeIn_0.5s_ease] opacity-80">
          <div class="flex items-center gap-4 mb-6">
            <h3
              class="text-2xl font-bold text-text-primary flex items-center gap-3 dark:text-gray-100"
            >
              <i class="fa-solid fa-history text-gray-500"></i>
              Archives
            </h3>
            <div class="h-px flex-grow bg-gradient-to-r from-gray-200 to-transparent"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SessionCard
              v-for="session in finishedSessions"
              :key="session.id"
              :session="session"
              @click="handleSessionClick"
              class="h-full grayscale-[0.3] hover:grayscale-0 transition-all duration-300"
            />
          </div>
        </div>
      </div>

      <!-- Aucune session -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 text-center bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
      >
        <div class="text-6xl mb-6">📚</div>
        <h4 class="text-2xl font-bold text-text-primary mb-2 dark:text-gray-200">
          Aucune session existante
        </h4>
        <p class="text-text-secondary dark:text-gray-400">
          Créez la première session de partage de lectures !
        </p>
      </div>
    </div>
  </main>
</template>
