<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import { analyticsService } from "../services/analyticsService";
import type { User } from "../services/authService";
import { seoService } from "../services/seoService";
import AppIcon from "../components/icons/AppIcon.vue";
import type { IconName } from "../components/icons/registry";
import ProfileHeader from "./profilePage/ProfileHeader.vue";
import UserInfoForm from "./profilePage/UserInfoForm.vue";
import SecuritySettings from "./profilePage/SecuritySettings.vue";
import PreferencesTab from "./profilePage/PreferencesTab.vue";
import AboutTab from "./profilePage/AboutTab.vue";
import { isNativeApp } from "../composables/useNativeApp";
import { SITE_URL } from "../config/site";

const router = useRouter();
const { t } = useI18n();

const currentUser = ref<User | null>(null);
// Le profil ne garde que le compte : la lecture du jour vit dans la
// bibliothèque et les sessions suivies/créées dans le partage de lectures
// (les raccourcis du menu y mènent).
type TabId = "my-info" | "security" | "preferences" | "about";
const activeTab = ref<TabId>("my-info");
const isLoading = ref(true);

// Onglets selon l'état : les onglets de compte n'existent que connecté (sans
// compte, la page est une page de réglages) ; l'onglet À propos n'existe que
// dans l'app native (il reprend l'essentiel du footer du site).
const visibleTabs = computed<{ id: TabId; label: string }[]>(() => {
  const tabs: { id: TabId; label: string }[] = [];
  if (currentUser.value) {
    tabs.push(
      { id: "my-info", label: t("profile.tabs.myInfo") },
      { id: "security", label: t("profile.tabs.security") },
    );
  }
  tabs.push({ id: "preferences", label: t("profile.tabs.preferences") });
  if (isNativeApp) tabs.push({ id: "about", label: t("profile.tabs.about") });
  return tabs;
});

const userDisplayName = computed(() => currentUser.value?.name || "Utilisateur");

// Ce que le compte apporte, énuméré dans le bandeau d'invitation. Chaque
// entrée correspond à une fonctionnalité réellement portée par le compte :
// les sessions suivies, la lecture du jour, les rappels, la synchronisation.
const guestBenefits = computed<{ icon: IconName; label: string }[]>(() => [
  { icon: "users", label: t("profile.guestBenefits.sessions") },
  { icon: "book", label: t("profile.guestBenefits.dailyReading") },
  { icon: "bell", label: t("profile.guestBenefits.reminders") },
  { icon: "bookmark", label: t("profile.guestBenefits.sync") },
]);

let unsubscribeAuth: (() => void) | null = null;

// La garde de route ne se rejoue qu'à la navigation : c'est l'abonnement du
// onMounted qui réagit à la déconnexion. Sur le web, on quitte la page (les
// écritures Firestore sont désormais refusées), en `replace` pour que le
// retour arrière ne ramène pas sur un profil auquel on n'a plus accès. Dans
// l'app native, la page reste : elle bascule en réglages d'appareil.
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
    if (!user) {
      // Sur le web, la page reste réservée aux comptes (même comportement que
      // la garde de route, qui ne se rejoue pas à la déconnexion).
      if (!isNativeApp) {
        router.replace("/");
        return;
      }
      // App native, sans compte : les onglets de compte n'existent pas.
      if (activeTab.value === "my-info" || activeTab.value === "security") {
        activeTab.value = "preferences";
      }
    }
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
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium">{{ t("profile.loadingProfile") }}</p>
    </div>

    <!-- Connecté (partout), ou sans compte dans l'app native : la page sert
         alors de page de réglages. Sur le web sans compte, l'abonnement
         ci-dessus renvoie à l'accueil. -->
    <div v-else-if="currentUser || isNativeApp">
      <ProfileHeader v-if="currentUser" :user-display-name="userDisplayName" />

      <!-- Sans compte : le bandeau de tête EST l'invitation, en version
           compacte : le titre de la page, une ligne qui dit où vivent les
           réglages, et les deux boutons de connexion. Les réglages gardent
           leur cadre dédié en dessous. -->
      <div v-else class="bg-gradient-to-br from-primary to-secondary py-8 px-6 md:px-12 mb-8">
        <div class="max-w-[1200px] mx-auto">
          <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {{ t("profile.guestTitle") }}
          </h1>
          <p class="mt-1.5 text-sm leading-relaxed text-white/85 max-w-md">
            {{ t("profile.guestSettingsHint") }}
          </p>
          <ul class="mt-3 space-y-1.5 text-sm leading-relaxed text-white/90 max-w-md">
            <li
              v-for="benefit in guestBenefits"
              :key="benefit.icon"
              class="flex items-start gap-2.5"
            >
              <AppIcon :name="benefit.icon" :size="15" class="mt-1 shrink-0 text-white/80" />
              <span>{{ benefit.label }}</span>
            </li>
          </ul>
          <div class="mt-5 flex flex-wrap gap-2.5">
            <RouterLink
              to="/login?mode=signup"
              class="btn bg-white !text-primary font-semibold hover:bg-white/90"
            >
              {{ t("accountCta.signup") }}
            </RouterLink>
            <RouterLink to="/login" class="btn border border-white/50 text-white hover:bg-white/10">
              {{ t("accountCta.login") }}
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav class="lg:sticky lg:top-24 h-fit card p-3">
          <template v-if="currentUser">
            <!-- Raccourcis vers les fonctionnalités déplacées dans leurs sections. -->
            <p
              class="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/70"
            >
              {{ t("profile.shortcuts.title") }}
            </p>
            <ul class="flex flex-col gap-1 mb-4">
              <li>
                <RouterLink
                  to="/bibliotheque/lecture-du-jour"
                  class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors dark:hover:bg-white/10 group"
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
                  class="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors dark:hover:bg-white/10 group"
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

            <p
              class="px-4 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/70"
            >
              {{ t("profile.shortcuts.accountTitle") }}
            </p>
          </template>

          <ul class="flex flex-col gap-1" :class="currentUser ? 'mb-6' : 'mb-2'">
            <li v-for="tab in visibleTabs" :key="tab.id">
              <button
                @click="setActiveTab(tab.id)"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ tab.label }}
              </button>
            </li>
          </ul>

          <button v-if="currentUser" @click="logout" class="btn btn-danger w-full">
            <AppIcon name="logout" :size="15" />
            {{ t("common.logout") }}
          </button>
        </nav>

        <div id="profile-content">
          <div v-if="activeTab === 'my-info' && currentUser">
            <UserInfoForm :user="currentUser" @update="updateUserInfo" />
          </div>

          <div v-if="activeTab === 'security' && currentUser">
            <SecuritySettings />
          </div>

          <div v-if="activeTab === 'preferences'">
            <PreferencesTab :user-id="currentUser?.id ?? null" />
          </div>

          <div v-if="activeTab === 'about'">
            <AboutTab />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
