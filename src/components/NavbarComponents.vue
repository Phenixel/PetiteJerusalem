<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { app } from '../../firebase'
import { getAuth, onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth'

const router = useRouter()
const route = useRoute()
const username = ref<string | null>(null)
const isMobileMenuOpen = ref(false)

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value

  // Empêcher/permettre le scroll du body
  if (isMobileMenuOpen.value) {
    document.body.classList.add('menu-open')
  } else {
    document.body.classList.remove('menu-open')
  }
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
  document.body.classList.remove('menu-open')
}

onAuthStateChanged(getAuth(app), async (firebaseUser: FirebaseUser | null) => {
  username.value = firebaseUser?.displayName ?? null
})

async function logout() {
  await signOut(getAuth(app))
  username.value = null
  closeMobileMenu()
  router.push('/')
}

function goToLogin() {
  // Sauvegarder la page actuelle pour redirection après connexion
  const currentPath = route.path
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
  closeMobileMenu()
}
</script>

<template>
  <header class="header">
    <RouterLink to="/" class="logo">
      <h1>Petite Jérusalem</h1>
      <p class="tagline">Hub de référence pour la communauté juive</p>
    </RouterLink>

    <!-- Bouton hamburger pour mobile -->
    <button
      @click="toggleMobileMenu"
      class="hamburger-button"
      :class="{ active: isMobileMenuOpen }"
      aria-label="Menu principal"
    >
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>

    <!-- Navigation desktop -->
    <nav class="nav-desktop">
      <div class="links">
        <RouterLink to="/" @click="closeMobileMenu">Accueil</RouterLink>
        <RouterLink to="/share-reading" @click="closeMobileMenu">Partage de lectures</RouterLink>
      </div>
      <div class="auth-section">
        <button v-if="!username" @click="goToLogin" class="btn btn--glass btn-md">
          Se connecter
        </button>
        <div v-else class="user-info">
          <RouterLink to="/profile" class="user-name-link">
            <span><i class="fa-solid fa-user"></i> {{ username }}</span>
          </RouterLink>
          <button
            @click="logout"
            class="btn btn--glass btn--icon btn-md"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            data-tooltip="Se déconnecter"
          >
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </nav>
  </header>

  <!-- Menu mobile et overlay -->
  <Teleport to="body">
    <!-- Overlay -->
    <div v-if="isMobileMenuOpen" @click="closeMobileMenu" class="mobile-overlay"></div>

    <!-- Menu mobile -->
    <nav
      v-if="isMobileMenuOpen"
      class="nav-mobile"
      :style="{
        transform: 'translateX(0)',
        opacity: '1',
        visibility: 'visible',
      }"
    >
      <div class="mobile-menu-container">
        <!-- Navigation mobile -->
        <div class="mobile-links">
          <RouterLink to="/" @click="closeMobileMenu" class="mobile-link"> Accueil</RouterLink>
          <RouterLink to="/share-reading" @click="closeMobileMenu" class="mobile-link">
            Partage de lectures
          </RouterLink>
        </div>

        <!-- Section d'authentification mobile -->
        <div class="mobile-auth-section">
          <button v-if="!username" @click="goToLogin" class="btn btn--gradient btn-lg w-100">
            Se connecter
          </button>
          <div v-else>
            <RouterLink
              to="/profile"
              @click="closeMobileMenu"
              class="btn btn--glass btn-lg w-100"
              style="margin-bottom: var(--spacing-md)"
            >
              <i class="fa-solid fa-user"></i>
              <span>{{ username }}</span>
            </RouterLink>
            <button
              @click="logout"
              class="btn btn--gradient btn-lg w-100"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <i class="fa-solid fa-right-from-bracket"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  </Teleport>
</template>
