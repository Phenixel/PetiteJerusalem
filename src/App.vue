<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Navbar from './components/NavbarComponents.vue'
import SiteFooter from './components/SiteFooter.vue'
import { RouterView } from 'vue-router'
import { AuthService } from './services/authService'

const router = useRouter()
const route = useRoute()
const authService = new AuthService()

const isHome = computed(() => route.name === 'home')

// Gérer la redirection après connexion Google
onMounted(async () => {
  try {
    const user = await authService.getGoogleRedirectResult()
    if (user) {
      // Récupérer la page d'origine sauvegardée
      const redirectPath = authService.getAndClearRedirectPath() || '/profile'
      router.push(redirectPath)
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de la redirection Google:', error)
  }
})
</script>

<template>
  <div class="page-gradient">
    <Navbar />
    <RouterView />
    <SiteFooter v-if="!isHome" />
  </div>
</template>
