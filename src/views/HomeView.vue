<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { seoService } from '../services/seoService'
import SiteFooter from '../components/SiteFooter.vue'

const router = useRouter()
const { t } = useI18n()

const features = computed(() => [
  {
    icon: '📚',
    title: t('home.features.shareReading.title'),
    description: t('home.features.shareReading.description'),
    status: 'available',
    route: 'share-reading',
  },
  {
    icon: '⚖️',
    title: t('home.features.dailyHalakhot.title'),
    description: t('home.features.dailyHalakhot.description'),
    status: 'coming-soon',
    route: 'halakhot-quotidiennes',
  },
  {
    icon: '📖',
    title: t('home.features.personalTracking.title'),
    description: t('home.features.personalTracking.description'),
    status: 'coming-soon',
    route: 'suivi-personnel',
  },
])

onMounted(() => {
  const url = window.location.origin + '/'
  seoService.setMeta({
    title: t('seo.homeTitle'),
    description: t('seo.homeDescription'),
    canonical: url,
    og: { url },
  })
})
</script>

<template>
  <main class="flex-1 container mx-auto px-4 py-4 flex flex-col justify-center">
    <div class="text-center mb-8 space-y-2">
      <h2
        class="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent pb-1"
      >
        {{ t('home.heroTitle') }}
      </h2>
      <p
        class="text-base md:text-lg text-text-secondary/90 max-w-2xl mx-auto leading-relaxed font-light dark:text-gray-300"
      >
        {{ t('home.heroDescription') }}
      </p>
    </div>

    <div class="w-full max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-stretch">
        <div
          v-for="feature in features"
          :key="feature.title"
          :class="[
            'relative p-6 rounded-2xl backdrop-blur-md border border-white/60 transition-all duration-300 group flex flex-col items-center text-center',
            feature.status === 'coming-soon'
              ? 'bg-white/20 opacity-70 cursor-default dark:bg-gray-800/30'
              : 'bg-white/60 hover:-translate-y-1 hover:shadow-lg hover:bg-white/80 cursor-pointer dark:bg-gray-800/50 dark:hover:bg-gray-800/80 dark:border-gray-700',
          ]"
          @click="feature.status !== 'coming-soon' && router.push(feature.route)"
        >
          <div
            class="text-4xl mb-4 transform transition-transform duration-300 group-hover:scale-110"
          >
            {{ feature.icon }}
          </div>
          <h3
            class="text-xl font-bold mb-2 text-text-primary flex items-center justify-center gap-2 dark:text-gray-100"
          >
            {{ feature.title }}
            <span
              v-if="feature.status === 'coming-soon'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
              >{{ t('home.comingSoon') }}</span
            >
          </h3>
          <p class="text-text-secondary text-base leading-relaxed max-w-xs dark:text-gray-400">
            {{ feature.description }}
          </p>
        </div>
      </div>

      <div
        class="text-center bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/60 w-full shadow-sm dark:bg-gray-800/40 dark:border-gray-700"
      >
        <h3 class="text-lg font-serif italic text-text-primary mb-2 dark:text-gray-200">
          {{ t('home.memorial.title') }}
        </h3>
        <p class="text-base text-text-primary/80 font-serif italic dark:text-gray-300">
          {{ t('home.memorial.dedication') }}
        </p>
      </div>
    </div>
  </main>

  <SiteFooter />
</template>
