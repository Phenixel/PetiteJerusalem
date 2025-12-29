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
    <Transition name="fade">
      <div
        v-if="isMobileMenuOpen"
        @click="closeMobileMenu"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
      ></div>
    </Transition>

    <Transition name="slide-menu">
      <nav
        v-if="isMobileMenuOpen"
        class="fixed top-0 left-0 w-[85vw] max-w-[320px] h-full z-[9999] overflow-y-auto"
      >
        <div
          class="absolute inset-0 bg-gradient-to-b from-white/98 via-white/95 to-gray-100/98 backdrop-blur-2xl dark:from-slate-900/98 dark:via-slate-900/95 dark:to-slate-800/98"
        ></div>
        <div
          class="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-gray-300/50 via-gray-200/30 to-transparent dark:from-white/20 dark:via-white/10 dark:to-transparent"
        ></div>

        <div class="relative flex flex-col h-full p-6">
          <div class="mb-8 pt-2">
            <h2
              class="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            >
              Petite Jérusalem
            </h2>
            <div
              class="w-12 h-1 bg-gradient-to-r from-primary to-secondary rounded-full mt-2"
            ></div>
          </div>
          <div class="flex flex-col gap-3">
            <RouterLink
              to="/"
              @click="closeMobileMenu"
              class="text-gray-700 font-medium text-base p-4 rounded-2xl bg-black/5 border border-black/10 hover:bg-black/10 hover:border-black/20 hover:text-gray-900 transition-all duration-300 dark:text-white/80 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20 dark:hover:text-white"
              exact-active-class="!bg-primary/20 !border-primary/40 !text-primary dark:!text-white"
            >
              Accueil
            </RouterLink>

            <RouterLink
              to="/share-reading"
              @click="closeMobileMenu"
              class="text-gray-700 font-medium text-base p-4 rounded-2xl bg-black/5 border border-black/10 hover:bg-black/10 hover:border-black/20 hover:text-gray-900 transition-all duration-300 dark:text-white/80 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20 dark:hover:text-white"
              exact-active-class="!bg-primary/20 !border-primary/40 !text-primary dark:!text-white"
            >
              Partage de lectures
            </RouterLink>
          </div>
          <div class="mt-auto pt-6">
            <div
              class="h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent mb-6 dark:via-white/20"
            ></div>

            <div class="space-y-3">
              <button
                v-if="!username"
                @click="goToLogin"
                class="flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-black/5 border border-black/10 rounded-xl font-medium text-gray-700 hover:bg-black/10 hover:text-gray-900 transition-all duration-200 cursor-pointer dark:bg-white/10 dark:border-white/20 dark:text-white/90 dark:hover:bg-white/15 dark:hover:text-white"
              >
                <i class="fa-solid fa-right-to-bracket"></i>
                Se connecter
              </button>
              <template v-else>
                <RouterLink
                  to="/profile"
                  @click="closeMobileMenu"
                  class="flex items-center gap-3 w-full py-3.5 px-4 bg-black/5 border border-black/10 rounded-xl font-medium hover:bg-black/10 transition-all duration-200 text-gray-700 hover:text-gray-900 dark:bg-white/10 dark:border-white/20 dark:text-white/90 dark:hover:bg-white/15 dark:hover:text-white"
                >
                  <i class="fa-solid fa-user"></i>
                  <span class="truncate">{{ username }}</span>
                </RouterLink>
                <button
                  @click="logout"
                  class="flex items-center justify-start gap-3 w-full py-3.5 px-4 bg-black/[0.03] border border-black/5 rounded-xl font-medium hover:bg-black/10 transition-all duration-200 text-gray-500 hover:text-gray-700 cursor-pointer dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                >
                  <i class="fa-solid fa-right-from-bracket"></i>
                  Déconnexion
                </button>
              </template>
            </div>
          </div>
        </div>
      </nav>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-menu-enter-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-menu-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-menu-enter-from,
.slide-menu-leave-to {
  transform: translateX(-100%);
}

.slide-menu-enter-to,
.slide-menu-leave-from {
  transform: translateX(0);
}
</style>
