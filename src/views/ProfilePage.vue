<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import { analyticsService } from "../services/analyticsService";
import type { User } from "../services/authService";
import { seoService } from "../services/seoService";
import AppIcon from "../components/icons/AppIcon.vue";
import ProfileHeader from "./profilePage/ProfileHeader.vue";
import UserInfoForm from "./profilePage/UserInfoForm.vue";
import SecuritySettings from "./profilePage/SecuritySettings.vue";
import AppearanceTab from "./profilePage/AppearanceTab.vue";
import PreferencesTab from "./profilePage/PreferencesTab.vue";
import { SITE_URL } from "../config/site";

const router = useRouter();
const { t } = useI18n();

/**
 * Le profil du SITE : un menu à gauche, un panneau à droite. L'app native a
 * le sien (profilePage/native/NativeProfileHome.vue), rangé en lignes et en
 * sous-pages : la route choisit l'une ou l'autre (router/routes.ts).
 */

const currentUser = ref<User | null>(null);
// Le profil ne garde que le compte : la lecture du jour vit dans la
// bibliothèque et les sessions suivies/créées dans le partage de lectures
// (les raccourcis du menu y mènent).
type TabId = "my-info" | "security" | "appearance" | "preferences";
const activeTab = ref<TabId>("my-info");
const isLoading = ref(true);

// Les onglets. Pas de Notifications : les rappels d'horaires se programment
// sur le téléphone, un navigateur n'a rien à régler. Les préférences (avis
// suivi pour les horaires, défilement automatique) sont des choix de
// personne, pas des réglages d'appareil : l'onglet existe donc ici aussi.
const visibleTabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: "my-info", label: t("profile.tabs.myInfo") },
  { id: "security", label: t("profile.tabs.security") },
  { id: "appearance", label: t("profile.tabs.appearance") },
  { id: "preferences", label: t("profile.tabs.preferences") },
]);

const userDisplayName = computed(() => currentUser.value?.name || t("common.anonymousUser"));

let unsubscribeAuth: (() => void) | null = null;

// La garde de route ne se rejoue qu'à la navigation : c'est l'abonnement du
// onMounted qui réagit à la déconnexion. On quitte la page (les écritures
// Firestore sont désormais refusées), en `replace` pour que le retour arrière
// ne ramène pas sur un profil auquel on n'a plus accès.
const logout = async () => {
  await authService.logout();
};

const setActiveTab = (tab: TabId) => {
  // Quels onglets du profil sont réellement utilisés (menus latéraux).
  analyticsService.capture("profile_tab_opened", { tab });
  activeTab.value = tab;
  if (window.innerWidth < 1024) {
    setTimeout(() => {
      const element = document.getElementById("profile-content");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }
};

// Les fonctionnalités qui vivaient ici sont désormais dans leurs sections :
// on trace les raccourcis pour vérifier que les habitués les retrouvent.
const trackShortcut = (shortcut: string) => {
  analyticsService.capture("profile_shortcut_clicked", { shortcut });
};

// L'enregistrement lui-même vit dans UserInfoForm (Firebase Auth) : la page
// ne fait que reprendre l'utilisateur à jour, dont son titre dépend.
const updateUserInfo = (user: User) => {
  currentUser.value = user;
};

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
    isLoading.value = false;
    // La page reste réservée aux comptes (même comportement que la garde de
    // route, qui ne se rejoue pas à la déconnexion).
    if (!user) router.replace("/");
  });

  const url = SITE_URL + "/profile";
  seoService.setMeta({
    title: t("seo.profileTitle"),
    description: t("seo.profileDescription"),
    canonical: url,
    og: { url },
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="min-h-screen pb-20">
    <!-- Le temps du verdict de session : le cadre de la page est déjà là,
         l'attente n'occupe que la zone de contenu, sans saut de page. -->
    <div
      v-if="isLoading"
      class="max-w-[1200px] mx-auto px-6 py-16 flex flex-col items-center justify-center text-text-secondary"
      aria-busy="true"
    >
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium">{{ t("profile.loadingProfile") }}</p>
    </div>

    <!-- Sans compte, l'abonnement ci-dessus renvoie à l'accueil. -->
    <div v-else-if="currentUser">
      <ProfileHeader :user-display-name="userDisplayName" />

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav class="lg:sticky lg:top-24 h-fit card p-3">
          <!-- Raccourcis vers les fonctionnalités déplacées dans leurs sections. -->
          <p class="px-4 pt-2 pb-1 text-sm font-semibold text-text-secondary">
            {{ t("profile.shortcuts.title") }}
          </p>
          <ul class="flex flex-col gap-1 mb-4">
            <li>
              <RouterLink
                to="/bibliotheque/lecture-du-jour"
                class="flex items-center gap-3 px-4 py-3 rounded-btn font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors dark:hover:bg-white/10 group"
                @click="trackShortcut('daily_reading')"
              >
                <AppIcon name="book" :size="15" class="text-primary shrink-0" />
                <span class="min-w-0">
                  {{ t("dailyReading.title") }}
                  <span class="block text-xs font-normal text-text-secondary/80">
                    {{ t("profile.shortcuts.dailyReadingHint") }}
                  </span>
                </span>
              </RouterLink>
            </li>
            <li>
              <RouterLink
                to="/share-reading"
                class="flex items-center gap-3 px-4 py-3 rounded-btn font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors dark:hover:bg-white/10 group"
                @click="trackShortcut('my_sessions')"
              >
                <AppIcon name="users" :size="15" class="text-primary shrink-0" />
                <span class="min-w-0">
                  {{ t("home.dashboard.sessionsTitle") }}
                  <span class="block text-xs font-normal text-text-secondary/80">
                    {{ t("profile.shortcuts.mySessionsHint") }}
                  </span>
                </span>
              </RouterLink>
            </li>
          </ul>

          <p class="px-4 pt-1 pb-1 text-sm font-semibold text-text-secondary">
            {{ t("profile.shortcuts.accountTitle") }}
          </p>

          <ul class="flex flex-col gap-1 mb-6">
            <li v-for="tab in visibleTabs" :key="tab.id">
              <button
                @click="setActiveTab(tab.id)"
                :class="[
                  'w-full text-left px-4 py-3 rounded-btn font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ tab.label }}
              </button>
            </li>
          </ul>

          <button @click="logout" class="btn btn-danger w-full">
            <AppIcon name="logout" :size="15" />
            {{ t("common.logout") }}
          </button>
        </nav>

        <div id="profile-content">
          <div v-if="activeTab === 'my-info'">
            <UserInfoForm :user="currentUser" @update="updateUserInfo" />
          </div>

          <div v-if="activeTab === 'security'">
            <SecuritySettings />
          </div>

          <div v-if="activeTab === 'appearance'">
            <AppearanceTab :user-id="currentUser.id" />
          </div>

          <div v-if="activeTab === 'preferences'">
            <PreferencesTab />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
