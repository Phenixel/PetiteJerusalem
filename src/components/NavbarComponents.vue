<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { authService } from "../services/authService";
import { isAdminEmail } from "../config/admin";
import { useDarkMode } from "../composables/useDarkMode";
import { isNativeApp } from "../composables/useNativeApp";
import LanguageSelector from "./LanguageSelector.vue";
import AppIcon from "./icons/AppIcon.vue";

const router = useRouter();
const username = ref<string | null>(null);
// Lien vers le backoffice, affiché uniquement pour le compte admin (garde
// UX : la vraie protection reste la garde de route + les rules Firebase).
const isAdmin = ref(false);
const isMobileMenuOpen = ref(false);
let unsubscribeAuth: (() => void) | null = null;

useDarkMode();

const navLinks = [
  { to: "/", labelKey: "common.home", exact: true },
  { to: "/share-reading", labelKey: "common.shareReading", exact: true },
  { to: "/bibliotheque", labelKey: "study.title", exact: true },
  { to: "/chiourim", labelKey: "common.chiourim", exact: true },
];

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;

  if (isMobileMenuOpen.value) {
    document.body.classList.add("menu-open");
  } else {
    document.body.classList.remove("menu-open");
  }
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
  document.body.classList.remove("menu-open");
}

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    username.value = user?.name ?? null;
    isAdmin.value = isAdminEmail(user?.email);
  });
});

onUnmounted(() => {
  if (unsubscribeAuth) {
    unsubscribeAuth();
  }
});

async function logout() {
  await authService.logout();
  username.value = null;
  closeMobileMenu();
  router.push("/");
}
function goToLogin() {
  const currentPath = router.currentRoute.value.path;
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
  closeMobileMenu();
}
</script>

<template>
  <!-- App native : pas de bandeau de site (effet « site web embarqué ») ; la
       navigation passe par la bottom bar (BottomTabBar dans App.vue). -->
  <header
    v-if="!isNativeApp"
    class="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-bg-beige/90 backdrop-blur-md dark:bg-gray-900/90 transition-colors duration-300"
  >
    <RouterLink to="/" class="group">
      <h1
        class="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
      >
        {{ $t("navbar.title") }}
      </h1>
      <p class="text-sm text-text-secondary mt-1 group-hover:text-primary transition-colors">
        {{ $t("navbar.subtitle") }}
      </p>
    </RouterLink>

    <!-- Bouton hamburger pour mobile -->
    <button
      @click="toggleMobileMenu"
      class="flex flex-col justify-around w-8 h-6 bg-transparent border-none cursor-pointer p-0 z-[1000] md:hidden text-text-primary"
      :class="{ 'fixed right-6 top-6': isMobileMenuOpen }"
      :aria-label="$t('navbar.mainMenu')"
    >
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ 'rotate-45 translate-x-[6px] translate-y-[6px]': isMobileMenuOpen }"
      ></span>
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ 'opacity-0': isMobileMenuOpen }"
      ></span>
      <span
        class="w-full h-[3px] bg-current rounded-sm transition-all duration-300 origin-center"
        :class="{ '-rotate-45 translate-x-[6px] -translate-y-[6px]': isMobileMenuOpen }"
      ></span>
    </button>

    <!-- Navigation desktop -->
    <nav class="hidden md:flex items-center gap-8">
      <div class="flex gap-2 items-center">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          exact-active-class="nav-link-active"
          >{{ $t(link.labelKey) }}</RouterLink
        >
      </div>
      <div class="flex items-center gap-3">
        <button v-if="!username" @click="goToLogin" class="btn btn-soft">
          {{ $t("common.login") }}
        </button>
        <div v-else class="flex items-center gap-2 font-medium text-text-primary">
          <RouterLink v-if="isAdmin" to="/admin" class="btn btn-soft">
            <AppIcon name="settings" :size="15" />
            {{ $t("admin.title") }}
          </RouterLink>
          <RouterLink
            to="/profile"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors dark:hover:bg-white/10"
          >
            <AppIcon name="user" :size="16" />
            <span>{{ username }}</span>
          </RouterLink>
          <button
            @click="logout"
            class="icon-btn"
            :aria-label="$t('common.logout')"
            :title="$t('common.logout')"
          >
            <AppIcon name="logout" :size="18" />
          </button>
        </div>
      </div>
    </nav>
  </header>

  <!-- Menu mobile et overlay -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isMobileMenuOpen"
        @click="closeMobileMenu"
        class="fixed inset-0 bg-black/40 z-[9998]"
      ></div>
    </Transition>

    <Transition name="slide-menu">
      <nav
        v-if="isMobileMenuOpen"
        class="fixed top-0 left-0 w-[85vw] max-w-[320px] h-dvh z-[9999] overflow-y-auto bg-surface shadow-pop"
      >
        <!-- min-h + pb safe-area : le bloc profil/déconnexion (mt-auto) reste
             atteignable même quand le contenu dépasse l'écran (petits écrans,
             texte agrandi) et n'est pas masqué par la barre système Android. -->
        <div
          class="relative flex flex-col min-h-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <div class="mb-8 pt-2">
            <h2
              class="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            >
              {{ $t("navbar.title") }}
            </h2>
          </div>
          <div class="flex flex-col gap-1">
            <RouterLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              @click="closeMobileMenu"
              class="mobile-link"
              exact-active-class="mobile-link-active"
            >
              {{ $t(link.labelKey) }}
            </RouterLink>
          </div>

          <!-- Language selector in mobile menu -->
          <div class="mt-8">
            <p class="text-xs text-text-secondary mb-2 px-1">
              {{ $t("common.language") }}
            </p>
            <LanguageSelector />
          </div>

          <div class="mt-auto pt-6">
            <div class="space-y-2">
              <button v-if="!username" @click="goToLogin" class="btn btn-soft w-full">
                <AppIcon name="login" :size="16" />
                {{ $t("common.login") }}
              </button>
              <template v-else>
                <RouterLink
                  v-if="isAdmin"
                  to="/admin"
                  @click="closeMobileMenu"
                  class="btn btn-soft w-full !justify-start"
                >
                  <AppIcon name="settings" :size="16" />
                  {{ $t("admin.title") }}
                </RouterLink>
                <RouterLink
                  to="/profile"
                  @click="closeMobileMenu"
                  class="btn btn-soft w-full !justify-start"
                >
                  <AppIcon name="user" :size="16" />
                  <span class="truncate">{{ username }}</span>
                </RouterLink>
                <button
                  @click="logout"
                  class="btn w-full !justify-start text-text-secondary hover:text-text-primary"
                  :aria-label="$t('common.logout')"
                  :title="$t('common.logout')"
                >
                  <AppIcon name="logout" :size="16" />
                  {{ $t("common.logout") }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </nav>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Desktop links: quiet text, the active page gets a short underline bar
   instead of a pill background. */
.nav-link {
  position: relative;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
}
.nav-link:hover {
  color: var(--color-text-primary);
}
.nav-link::after {
  content: "";
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.1rem;
  height: 2px;
  border-radius: 2px;
  background: var(--color-primary);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.25s ease;
}
.nav-link-active {
  color: var(--color-text-primary);
}
.nav-link-active::after {
  transform: scaleX(1);
}

/* Mobile links: flat rows, active = primary tint. */
.mobile-link {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  font-weight: 500;
  color: var(--color-text-primary);
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}
.mobile-link:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.mobile-link-active {
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  font-weight: 600;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-menu-enter-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-menu-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-menu-enter-from,
.slide-menu-leave-to {
  transform: translateX(-100%);
}

.slide-menu-enter-to,
.slide-menu-leave-from {
  transform: translateX(0);
}
</style>
