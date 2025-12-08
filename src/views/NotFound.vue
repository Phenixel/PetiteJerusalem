<script setup lang="ts">
import { onMounted } from 'vue'
import { seoService } from '../services/seoService'

onMounted(() => {
  const url = window.location.origin + window.location.pathname
  seoService.setMeta({
    title: 'Page non trouvée | Petite Jerusalem',
    description: "La page demandée n'existe pas.",
    canonical: url,
    robots: 'noindex, follow',
    og: { url },
  })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 text-center">
    <main
      class="max-w-md w-full bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-12"
    >
      <div class="mb-8">
        <h2 class="text-8xl font-black text-primary/20 mb-4 select-none">404</h2>
        <h3 class="text-2xl font-bold text-text-primary mb-4">Page non trouvée</h3>
        <p class="text-text-secondary">La page que vous cherchez n'existe pas ou a été déplacée.</p>
      </div>

      <div>
        <RouterLink
          to="/"
          class="inline-flex items-center px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full justify-center sm:w-auto"
        >
          <i class="fa-solid fa-home mr-2"></i>
          Retour à l'accueil
        </RouterLink>
      </div>
    </main>
  </div>
</template>
