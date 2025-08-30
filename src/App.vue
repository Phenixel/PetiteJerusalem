<script setup lang="ts">
import Navbar from './components/NavbarComponents.vue'
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="page-gradient">
    <Navbar />
    <RouterView />
  </div>
</template>
