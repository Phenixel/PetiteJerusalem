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
  <div class="page-gradient">
    <main class="main-content">
      <div class="hero-section">
        <h2 class="hero-title">Page non trouvée</h2>
        <p class="hero-description">La page que vous cherchez n'existe pas.</p>
      </div>

      <div class="cta-section">
        <RouterLink to="/" class="cta-button">Retour à l'accueil</RouterLink>
      </div>
    </main>
  </div>
</template>
