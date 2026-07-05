<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import Navbar from "./components/NavbarComponents.vue";
import StoneWallBackground from "./components/StoneWallBackground.vue";
import SiteFooter from "./components/SiteFooter.vue";
import ScrollToTop from "./components/ScrollToTop.vue";
import ToastContainer from "./components/ToastContainer.vue";
import { RouterView } from "vue-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useTheme } from "./composables/useTheme";
import { useFonts } from "./composables/useFonts";

const route = useRoute();
const { loadTheme, resetTheme } = useTheme();
const { loadFonts, resetFonts } = useFonts();

const isHome = computed(() => route.name === "home");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadTheme(user.uid);
    loadFonts(user.uid);
  } else {
    resetTheme();
    resetFonts();
  }
});
</script>

<template>
  <!-- The stone wall sits at z-index:-1, so this root div must stay
       transparent (the dark background lives on <body>) or it would hide it. -->
  <div
    class="min-h-screen flex flex-col text-text-primary transition-colors duration-300 dark:text-gray-100"
  >
    <StoneWallBackground />
    <Navbar />
    <RouterView />
    <SiteFooter v-if="!isHome" />
    <ScrollToTop />
    <ToastContainer />
  </div>
</template>
