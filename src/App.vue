<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Navbar from './components/NavbarComponents.vue'
import SiteFooter from './components/SiteFooter.vue'
import ScrollToTop from './components/ScrollToTop.vue'
import { RouterView } from 'vue-router'
import { authService } from './services/authService'

const router = useRouter()
const route = useRoute()

const isHome = computed(() => route.name === 'home')

onMounted(async () => {
  try {
    const user = await authService.getGoogleRedirectResult()
    if (user) {
      const redirectPath = authService.getAndClearRedirectPath() || '/profile'
      router.push(redirectPath)
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de la redirection Google:', error)
  }
})
</script>

<template>
  <div
    class="min-h-screen flex flex-col text-text-primary transition-colors duration-300 dark:bg-gray-900 dark:text-gray-100"
  >
    <Navbar />
    <RouterView />
    <SiteFooter v-if="!isHome" />
    <ScrollToTop />
  </div>
</template>
