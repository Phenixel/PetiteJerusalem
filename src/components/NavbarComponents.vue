<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authService } from '../services/authService'
import { useDarkMode } from '../composables/useDarkMode'

const router = useRouter()
const route = useRoute()
const username = ref<string | null>(null)
const isMobileMenuOpen = ref(false)
let unsubscribeAuth: (() => void) | null = null

useDarkMode()

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value

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

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    username.value = user?.name ?? null
  })
})

onUnmounted(() => {
  if (unsubscribeAuth) {
    unsubscribeAuth()
  }
})

async function logout() {
  await authService.logout()
  username.value = null
  closeMobileMenu()
  router.push('/')
}
function goToLogin() {
  const currentPath = route.path
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
  closeMobileMenu()
}
</script>

<template>
  <header
    class="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/30 backdrop-blur-md border-b border-white/20 dark:bg-gray-900/80 dark:border-gray-800 transition-colors duration-300"
  >
    <RouterLink to="/" class="group">
      <h1
        class="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
      >
        Petite Jérusalem
      </h1>
      <p class="text-sm text-text-secondary mt-1 group-hover:text-primary transition-colors">
        Hub de référence pour la communauté juive
      </p>
    </RouterLink>

    <!-- Bouton hamburger pour mobile -->
    <button
      @click="toggleMobileMenu"
      class="flex flex-col justify-around w-8 h-6 bg-transparent border-none cursor-pointer p-0 z-[1000] md:hidden text-text-primary dark:text-white"
      :class="{ 'fixed right-6 top-6': isMobileMenuOpen }"
      aria-label="Menu principal"
    >
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ 'rotate-45 translate-x-[6px] translate-y-[6px]': isMobileMenuOpen }"
      ></span>
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ 'opacity-0': isMobileMenuOpen }"
      ></span>
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ '-rotate-45 translate-x-[6px] -translate-y-[6px]': isMobileMenuOpen }"
      ></span>
    </button>

    <!-- Navigation desktop -->
    <nav class="hidden md:flex items-center gap-8">
      <div class="flex gap-6 items-center">
        <RouterLink
          to="/"
          @click="closeMobileMenu"
          class="text-text-primary font-medium px-4 py-2 rounded-lg hover:bg-black/5 hover:text-primary transition-colors dark:text-gray-100 dark:hover:bg-gray-800"
          exact-active-class="bg-black/5 text-primary dark:bg-gray-800"
          >Accueil</RouterLink
        >
        <RouterLink
          to="/share-reading"
          @click="closeMobileMenu"
          class="text-text-primary font-medium px-4 py-2 rounded-lg hover:bg-black/5 hover:text-primary transition-colors dark:text-gray-100 dark:hover:bg-gray-800"
          exact-active-class="bg-black/5 text-primary dark:bg-gray-800"
          >Partage de lectures</RouterLink
        >
      </div>
      <div class="flex items-center gap-4">
        <button
          v-if="!username"
          @click="goToLogin"
          class="px-4 py-2 bg-white/20 border border-white/30 backdrop-blur-sm rounded-lg hover:bg-white/30 hover:-translate-y-0.5 transition-all text-text-primary font-medium dark:text-gray-100 dark:bg-gray-800/50 dark:border-gray-700 dark:hover:bg-gray-700"
        >
          Se connecter
        </button>
        <div
          v-else
          class="flex items-center gap-4 font-medium text-text-primary dark:text-gray-100"
        >
          <RouterLink
            to="/profile"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors dark:hover:bg-gray-800"
          >
            <span><i class="fa-solid fa-user"></i> {{ username }}</span>
          </RouterLink>
          <button
            @click="logout"
            class="flex items-center justify-center w-9 h-9 bg-white/20 border border-white/30 backdrop-blur-sm rounded-lg hover:bg-white/30 hover:-translate-y-0.5 transition-all text-text-primary dark:text-gray-100 dark:bg-gray-800/50 dark:border-gray-700 dark:hover:bg-gray-700"
            aria-label="Se déconnecter"
            title="Se déconnecter"
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
    <div
      v-if="isMobileMenuOpen"
      @click="closeMobileMenu"
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998]"
    ></div>

    <!-- Menu mobile -->
    <nav
      v-if="isMobileMenuOpen"
      class="fixed top-0 left-0 w-80 h-full bg-bg-primary/95 backdrop-blur-xl border-r border-white/30 p-8 shadow-2xl z-[9999] overflow-y-auto animate-[slideInLeft_0.4s_ease-out] dark:bg-gray-900/95 dark:border-gray-700"
    >
      <div class="flex flex-col h-full">
        <!-- Navigation mobile -->
        <div class="flex flex-col gap-4 mb-8 mt-12">
          <RouterLink
            to="/"
            @click="closeMobileMenu"
            class="text-text-primary font-semibold text-lg p-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 hover:text-primary hover:translate-x-1 transition-all dark:text-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-700"
            exact-active-class="bg-primary/10 border-primary text-primary dark:bg-primary/20"
          >
            Accueil</RouterLink
          >
          <RouterLink
            to="/share-reading"
            @click="closeMobileMenu"
            class="text-text-primary font-semibold text-lg p-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 hover:text-primary hover:translate-x-1 transition-all dark:text-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-700"
            exact-active-class="bg-primary/10 border-primary text-primary dark:bg-primary/20"
          >
            Partage de lectures
          </RouterLink>
        </div>

        <!-- Section d'authentification mobile -->
        <div
          class="mt-auto pt-8 border-t border-white/20 bg-gradient-to-br from-primary to-secondary rounded-xl p-6 text-white"
        >
          <button
            v-if="!username"
            @click="goToLogin"
            class="w-full py-3 px-6 bg-white/20 border border-white/30 rounded-xl font-semibold hover:translate-y-[-2px] hover:shadow-lg transition-all"
          >
            Se connecter
          </button>
          <div v-else>
            <RouterLink
              to="/profile"
              @click="closeMobileMenu"
              class="flex items-center justify-center gap-2 w-full py-3 px-6 mb-4 bg-white/20 border border-white/30 rounded-xl font-semibold hover:bg-white/30 transition-all text-white"
            >
              <i class="fa-solid fa-user"></i>
              <span>{{ username }}</span>
            </RouterLink>
            <button
              @click="logout"
              class="flex items-center justify-center gap-2 w-full py-3 px-6 bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all text-white"
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
