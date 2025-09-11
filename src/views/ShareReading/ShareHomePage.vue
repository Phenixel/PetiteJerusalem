<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { SessionService } from '../../services/sessionService'
import type { Session } from '../../models/models'
import SessionCard from '../../components/SessionCard.vue'
import { seoService } from '../../services/seoService'
import { AuthService } from '../../services/authService'

const router = useRouter()
const sessionService = new SessionService()
const authService = new AuthService()

const sessions = ref<Session[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isAuthenticated = ref(false)
let unsubscribeAuth: (() => void) | null = null

// Charger les sessions depuis Firestore
const loadSessions = async () => {
  try {
    isLoading.value = true
    error.value = null
    const fetchedSessions = await sessionService.getAllSessions()
    // Trier les sessions par date de création (plus récentes en premier)
    sessions.value = sessionService.sortSessionsByDate(fetchedSessions)
  } catch (err) {
    console.error('Erreur lors du chargement des sessions:', err)
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des sessions'
  } finally {
    isLoading.value = false
  }
}

// Charger les sessions au montage du composant
onMounted(() => {
  loadSessions()
  // Écouter l'état d'authentification et mettre à jour isAuthenticated
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
  // Naviguer vers la page de détail de la session
  router.push(`/share-reading/session/${session.id}`)
}
</script>

<template>
  <main class="main-content">
    <div class="hero-section">
      <h2 class="hero-title">Partage de Lectures</h2>
      <p class="hero-description">Échangez et découvrez des textes sacrés avec la communauté</p>

      <button
        @click="router.push('/share-reading/new-session')"
        class="btn-gradient"
        :disabled="!isAuthenticated"
        style="margin-top: var(--spacing-xl)"
        title="Créer une session"
      >
        Créer une session
      </button>
      <div v-if="!isAuthenticated" style="margin-top: var(--spacing-sm)">
        <small>Vous devez avoir un compte et être connecté pour créer une session.</small>
      </div>
    </div>

    <div class="hero-section">
      <!-- État de chargement -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Chargement des sessions...</p>
      </div>

      <!-- État d'erreur -->
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="loadSessions" class="btn-gradient">Réessayer</button>
      </div>

      <!-- Liste des sessions -->
      <div v-else-if="sessions.length > 0" class="cards-list">
        <SessionCard
          v-for="session in sessions"
          :key="session.id"
          :session="session"
          @click="handleSessionClick"
        />
      </div>

      <!-- Aucune session -->
      <div v-else class="no-sessions">
        <div class="no-sessions-icon">📚</div>
        <h4>Aucune session existante</h4>
        <p>Créez la première session de partage de lectures !</p>
      </div>
    </div>
  </main>
</template>

<style scoped></style>
