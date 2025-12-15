<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Navbar from './components/NavbarComponents.vue'
import SiteFooter from './components/SiteFooter.vue'
import ScrollToTop from './components/ScrollToTop.vue'
import { RouterView } from 'vue-router'

const route = useRoute()

const isHome = computed(() => route.name === 'home')

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
