<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Navbar from "./components/NavbarComponents.vue";
import StoneWallBackground from "./components/StoneWallBackground.vue";
import SiteFooter from "./components/SiteFooter.vue";
import ScrollToTop from "./components/ScrollToTop.vue";
import ToastContainer from "./components/ToastContainer.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ConsentBanner from "./components/ConsentBanner.vue";
import GlobalAudioPlayer from "./components/GlobalAudioPlayer.vue";
import OfflineNotice from "./components/OfflineNotice.vue";
import BottomTabBar from "./components/BottomTabBar.vue";
import AppUpdateBanner from "./components/AppUpdateBanner.vue";
import { useMiniPlayerVisible } from "./composables/useAudioPlayer";
import { useOnline } from "./composables/useOnline";
import { isNativeApp } from "./composables/useNativeApp";
import { useNativeStatusBar } from "./composables/useNativeStatusBar";
import { useLocale } from "./composables/useLocale";
import { RouterView } from "vue-router";
import { authService } from "./services/authService";
import { useTheme } from "./composables/useTheme";
import { useFonts } from "./composables/useFonts";

const route = useRoute();
const router = useRouter();
const { loadTheme, loadGuestTheme } = useTheme();
const { loadFonts, loadGuestFonts } = useFonts();

// App native : les horaires (et leur calendrier) se posent au-dessus de la
// page en cours, comme un modal plein écran ; le bouton rond de la barre
// basse les ouvre et les referme (BottomTabBar). La transition tient la page
// quittée en place sous le cercle d'ouverture (useRevealOrigin), et replie la
// page des horaires en cercle vers le bouton à la fermeture. Les styles
// vivent plus bas ; le routeur retarde de son côté la remise à zéro du
// défilement (voir router/index.ts).
const isOverlayPath = (path: string) => /^\/(horaires|calendrier)/.test(path);
const pageTransition = ref("");
router.afterEach((to, from) => {
  pageTransition.value = !isNativeApp
    ? ""
    : isOverlayPath(to.path) && !isOverlayPath(from.path)
      ? "zmanim-open"
      : isOverlayPath(from.path) && !isOverlayPath(to.path)
        ? "zmanim-close"
        : "";
});

const isHome = computed(() => route.name === "home");
const isMiniPlayerVisible = useMiniPlayerVisible();

// Pages de lecture (meta.plainBackground) : le mur de pierre disparaît pour
// laisser le texte seul sur le fond uni. v-show plutôt que v-if : le mur n'est
// pas re-généré (re-rasterisé, en mode canvas) à chaque aller-retour.
const showStoneWall = computed(() => !route.meta.plainBackground);

// Hors ligne : les pages qui dépendent du réseau (sessions, chiourim, profil…)
// affichent un message clair au lieu d'échouer en silence. Les pages marquées
// meta.offlineOk (bibliothèque, lecture, contenus embarqués) restent servies.
const online = useOnline();
const showOfflineNotice = computed(() => !online.value && !route.meta.offlineOk);

// La barre système Android prend la couleur du fond de l'app (no-op sur web/iOS).
useNativeStatusBar();

// Applique dir/lang au document dès la racine : dans l'app native, le
// LanguageSelector (navbar/footer) n'est pas monté, personne d'autre ne le fait.
useLocale();

// Réserve la place des zones système (safe-areas, app native en edge-to-edge)
// et des barres fixes du bas : bottom bar native, mini-lecteur audio.
const chromePadClass = computed(() => {
  if (isNativeApp) {
    const bottom = isMiniPlayerVisible.value
      ? "pb-[calc(8.5rem+var(--safe-bottom))]"
      : "pb-[calc(3.5rem+var(--safe-bottom))]";
    return `pt-[var(--safe-top)] ${bottom}`;
  }
  return isMiniPlayerVisible.value ? "pb-20" : "";
});

// Réglages d'appareil appliqués d'entrée, en synchrone : un visiteur sans
// compte retrouve son thème et ses polices (réglages de l'app native) avant
// le premier rendu. Pour un compte, l'abonnement juste en dessous repasse aux
// valeurs du compte dans le même tick, avant tout affichage.
loadGuestTheme();
loadGuestFonts();

// authService, et non onAuthStateChanged directement : avant le premier
// verdict de Firebase, il rejoue le dernier compte connu, si bien que le
// thème et les polices du compte (servis par leur copie locale) s'appliquent
// dès le premier rendu au lieu d'arriver quelques secondes plus tard.
authService.onAuthChanged((user) => {
  if (user) {
    loadTheme(user.id);
    loadFonts(user.id);
  } else {
    // Sans compte (ou déconnecté) : les réglages de l'appareil.
    loadGuestTheme();
    loadGuestFonts();
  }
});
</script>

<template>
  <!-- The stone wall sits at z-index:-1, so this root div must stay
       transparent (the dark background lives on <body>) or it would hide it. -->
  <div
    class="min-h-screen flex flex-col text-text-primary transition-colors duration-300 dark:text-gray-100"
    :class="chromePadClass"
  >
    <StoneWallBackground v-show="showStoneWall" />
    <Navbar />
    <!-- App native seulement : ne s'affiche que si le binaire installé est
         antérieur à la version publiée sur le store (appUpdateService). -->
    <AppUpdateBanner />
    <OfflineNotice v-if="showOfflineNotice" />
    <!-- App native seulement : la Transition porte la surcouche des horaires.
         Le web garde le RouterView nu (des vues multi-racines s'accommodent
         mal d'une Transition, et la surcouche ne concerne que l'app). -->
    <RouterView v-else-if="isNativeApp" v-slot="{ Component }">
      <Transition :name="pageTransition">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <RouterView v-else />
    <!-- App native : pas de footer de site ; l'essentiel (à propos, mentions
         légales…) vit dans l'onglet À propos du profil. -->
    <SiteFooter v-if="!isHome && !isNativeApp" />
    <ScrollToTop />
    <ToastContainer />
    <ConfirmDialog />
    <ConsentBanner />
    <GlobalAudioPlayer />
    <BottomTabBar v-if="isNativeApp" />
  </div>
</template>

<style scoped>
/* App native : les horaires en surcouche (voir pageTransition dans le script).
   Les classes s'appliquent aux racines des pages : un enfant reçoit aussi
   l'attribut de scope de son parent. La page épinglée reçoit le fond de
   l'app : sans lui, la page d'en dessous transparaîtrait au travers. */
.zmanim-open-enter-active,
.zmanim-close-leave-active {
  position: fixed;
  top: var(--safe-top);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  overflow: hidden;
  background-color: var(--color-bg-beige);
}
:root.dark .zmanim-open-enter-active,
:root.dark .zmanim-close-leave-active {
  background-color: #111827; /* gray-900, le fond sombre du body */
}
/* Ouverture : la page arrive entière, c'est useRevealOrigin qui la dévoile en
   cercle ; l'animation ne sert qu'à l'épingler le temps du cercle, pendant
   que la page quittée reste montée dessous (zmanim-open-leave-active). */
.zmanim-open-enter-active,
.zmanim-open-leave-active {
  animation: zmanim-hold 0.45s;
}
/* Fermeture : le cercle se replie vers le bouton rond de la barre basse,
   la page recouverte réapparaît dessous, défilement retrouvé. */
.zmanim-close-leave-active {
  animation: zmanim-collapse 0.32s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
}
@keyframes zmanim-hold {
  from {
    opacity: 1;
  }
  to {
    opacity: 1;
  }
}
@keyframes zmanim-collapse {
  from {
    clip-path: circle(120vmax at 50% calc(100% - 2.2rem));
  }
  to {
    clip-path: circle(1.6rem at 50% calc(100% - 2.2rem));
    opacity: 0.3;
  }
}
@media (prefers-reduced-motion: reduce) {
  .zmanim-open-enter-active,
  .zmanim-open-leave-active,
  .zmanim-close-leave-active {
    animation: none;
  }
}
</style>
