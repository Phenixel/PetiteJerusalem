<script setup lang="ts">
import { app, googleAuthProvider } from '../../firebase'
import {
  getAuth,
  onAuthStateChanged,
  signInWithRedirect,
  type User as FirebaseUser,
} from 'firebase/auth'
import { ref } from 'vue'

function connectWithGoogle() {
  signInWithRedirect(getAuth(app), googleAuthProvider)
}

const username = ref<string | null>(null)

onAuthStateChanged(getAuth(app), async (firebaseUser: FirebaseUser | null) => {
  username.value = firebaseUser?.email ?? null
})

const features = [
  {
    icon: '📚',
    title: 'Partage de Lectures',
    description: 'Échangez et découvrez des textes sacrés avec la communauté',
    status: 'available',
  },
  {
    icon: '⚖️',
    title: 'Halakhot Quotidiennes',
    description: 'Recevez vos lois quotidiennes personnalisées',
    status: 'coming-soon',
  },
  {
    icon: '📖',
    title: 'Suivi Personnel',
    description: 'Suivez vos progrès dans vos études et lectures',
    status: 'coming-soon',
  },
]
</script>

<template>
  <div class="page-gradient">
    <header class="header">
      <div class="logo">
        <h1>Petite Jérusalem</h1>
        <p class="tagline">Hub de référence pour la communauté juive</p>
      </div>
      <div class="auth-section">
        <button v-if="!username" @click="connectWithGoogle" class="auth-button">
          Se connecter avec Google
        </button>
        <div v-else class="user-info">
          <span>Bienvenue, {{ username }}</span>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="hero-section">
        <h2 class="hero-title">Votre centre spirituel numérique</h2>
        <p class="hero-description">
          Une plateforme moderne dédiée à l'étude, au partage et à la croissance spirituelle de la
          communauté juive francophone.
        </p>
      </div>

      <div class="features-grid">
        <div
          v-for="feature in features"
          :key="feature.title"
          :class="['feature-card', { 'coming-soon': feature.status === 'coming-soon' }]"
        >
          <div class="feature-icon">{{ feature.icon }}</div>
          <h3 class="feature-title">
            {{ feature.title }}
            <br v-if="feature.status === 'coming-soon'" />
            <span v-if="feature.status === 'coming-soon'" class="coming-soon-badge">Bientôt</span>
          </h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      </div>

      <div class="cta-section">
        <h3>Prêt à commencer votre voyage spirituel ?</h3>
        <button v-if="!username" @click="connectWithGoogle" class="cta-button">
          Rejoindre la communauté
        </button>
        <p v-else class="welcome-message">Explorez les fonctionnalités disponibles ci-dessus</p>
      </div>
    </main>
  </div>
</template>
