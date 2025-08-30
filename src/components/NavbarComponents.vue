<script setup lang="ts">
import { ref } from 'vue'
import { app, googleAuthProvider } from '../../firebase'
import {
  getAuth,
  onAuthStateChanged,
  signInWithRedirect,
  type User as FirebaseUser,
} from 'firebase/auth'

function connectWithGoogle() {
  signInWithRedirect(getAuth(app), googleAuthProvider)
}

const username = ref<string | null>(null)

onAuthStateChanged(getAuth(app), async (firebaseUser: FirebaseUser | null) => {
  username.value = firebaseUser?.email ?? null
})
</script>

<template>
  <header class="header">
    <div class="logo">
      <h1>Petite Jérusalem</h1>
      <p class="tagline">Hub de référence pour la communauté juive</p>
    </div>
    <div class="links">
      <RouterLink to="/">Accueil</RouterLink>
      <RouterLink to="/share-reading">Partage de lectures</RouterLink>
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
</template>
