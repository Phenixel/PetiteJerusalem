<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import Navbar from "./components/NavbarComponents.vue";
import StoneWallBackground from "./components/StoneWallBackground.vue";
import SiteFooter from "./components/SiteFooter.vue";
import ScrollToTop from "./components/ScrollToTop.vue";
import ToastContainer from "./components/ToastContainer.vue";
import GlobalAudioPlayer from "./components/GlobalAudioPlayer.vue";
import OfflineNotice from "./components/OfflineNotice.vue";
import { useMiniPlayerVisible } from "./composables/useAudioPlayer";
import { useOnline } from "./composables/useOnline";
import { RouterView } from "vue-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useTheme } from "./composables/useTheme";
import { useFonts } from "./composables/useFonts";

const route = useRoute();
const { loadTheme, resetTheme } = useTheme();
const { loadFonts, resetFonts } = useFonts();

const isHome = computed(() => route.name === "home");
const isMiniPlayerVisible = useMiniPlayerVisible();

// Hors ligne : les pages qui dépendent du réseau (sessions, chiourim, profil…)
// affichent un message clair au lieu d'échouer en silence. Les pages marquées
// meta.offlineOk (bibliothèque, lecture, contenus embarqués) restent servies.
const online = useOnline();
const showOfflineNotice = computed(() => !online.value && !route.meta.offlineOk);

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
    :class="{ 'pb-20': isMiniPlayerVisible }"
  >
    <StoneWallBackground />
    <Navbar />
    <OfflineNotice v-if="showOfflineNotice" />
    <RouterView v-else />
    <SiteFooter v-if="!isHome" />
    <ScrollToTop />
    <ToastContainer />
    <GlobalAudioPlayer />
  </div>
</template>
