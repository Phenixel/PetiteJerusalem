<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { seoService } from '../services/seoService'

const router = useRouter()

const features = [
  {
    icon: '📚',
    title: 'Partage de Lectures',
    description: 'Échangez et découvrez des textes sacrés avec la communauté',
    status: 'available',
    route: 'share-reading',
  },
  {
    icon: '⚖️',
    title: 'Halakhot Quotidiennes',
    description: 'Recevez vos lois quotidiennes personnalisées',
    status: 'coming-soon',
    route: 'halakhot-quotidiennes',
  },
  {
    icon: '📖',
    title: 'Suivi Personnel',
    description: 'Suivez vos progrès dans vos études et lectures',
    status: 'coming-soon',
    route: 'suivi-personnel',
  },
]

onMounted(() => {
  const url = window.location.origin + '/'
  seoService.setMeta({
    title: 'Accueil | Petite Jerusalem',
    description:
      "Votre centre spirituel numérique: partage de lectures, halakhot quotidiennes et suivi d'étude.",
    canonical: url,
    og: { url },
  })
})
</script>

<template>
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
        @click="router.push(feature.route)"
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
      <h3>🕯️ À la mémoire de 🕯️</h3>
      <p class="welcome-message">
        Ce site est dédié à l'élévation de l'âme de Fortunée Bat Henriette et Mongia Bat Joulina
      </p>
    </div>
  </main>
</template>
