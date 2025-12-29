<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { seoService } from '../services/seoService'

const { t } = useI18n()

onMounted(() => {
  const url = window.location.origin + window.location.pathname
  seoService.setMeta({
    title: t('seo.notFoundTitle'),
    description: t('seo.notFoundDescription'),
    canonical: url,
    robots: 'noindex, follow',
    og: { url },
  })
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 text-center">
    <main
      class="max-w-md w-full bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-12 dark:bg-gray-800/60 dark:border-gray-700"
    >
      <div class="mb-8">
        <h2 class="text-8xl font-black text-primary/20 mb-4 select-none">404</h2>
        <h3 class="text-2xl font-bold text-text-primary mb-4 dark:text-gray-100">
          {{ t('notFound.title') }}
        </h3>
        <p class="text-text-secondary dark:text-gray-400">{{ t('notFound.message') }}</p>
      </div>

      <div>
        <RouterLink
          to="/"
          class="inline-flex items-center px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full justify-center sm:w-auto"
        >
          <i class="fa-solid fa-home mr-2"></i>
          {{ t('notFound.backToHome') }}
        </RouterLink>
      </div>
    </main>
  </div>
</template>
