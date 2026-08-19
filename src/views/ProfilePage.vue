<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
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
import PreferencesTab from "./profilePage/PreferencesTab.vue";
import AboutTab from "./profilePage/AboutTab.vue";
import { isNativeApp } from "../composables/useNativeApp";

const router = useRouter();
const { t } = useI18n();

const currentUser = ref<User | null>(null);
// Le profil ne garde que le compte : la lecture du jour vit dans la
// bibliothèque et les sessions suivies/créées dans le partage de lectures
// (les raccourcis du menu y mènent).
const activeTab = ref<"my-info" | "security" | "preferences" | "about">("my-info");
const isLoading = ref(true);

const userDisplayName = computed(() => currentUser.value?.name || "Utilisateur");

const loadUserData = async () => {
  try {
    isLoading.value = true;
    currentUser.value = await authService.getCurrentUser();

    if (!currentUser.value) {
      router.push("/");
      return;
    }
  } catch (error) {
    console.error("Erreur lors du chargement des données utilisateur:", error);
    router.push("/");
  } finally {
    isLoading.value = false;
  }
};

// La garde de route ne se rejoue qu'à la navigation : sans redirection, la page
// profil reste affichée après la déconnexion, avec ses menus, alors que toutes
// les écritures Firestore sont désormais refusées (préférences, infos perso...).
// On quitte donc la page tout de suite, en `replace` pour que le retour arrière
// ne ramène pas sur un profil auquel on n'a plus accès.
const logout = async () => {
  await authService.logout();
  router.replace("/");
};

const setActiveTab = (tab: typeof activeTab.value) => {
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

onMounted(async () => {
  await loadUserData();
  const url = window.location.origin + "/profile";
  seoService.setMeta({
    title: t("seo.profileTitle"),
    description: t("seo.profileDescription"),
    canonical: url,
    og: { url },
  });
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

    <div v-else-if="currentUser">
      <ProfileHeader :user-display-name="userDisplayName" />

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav class="lg:sticky lg:top-24 h-fit card p-3">
          <!-- Raccourcis vers les fonctionnalités déplacées dans leurs sections. -->
          <p class="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/70">
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

          <p class="px-4 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/70">
            {{ t("profile.shortcuts.accountTitle") }}
          </p>
          <ul class="flex flex-col gap-1 mb-6">
            <li>
              <button
                @click="setActiveTab('my-info')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'my-info'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.myInfo") }}
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('security')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'security'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.security") }}
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('preferences')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'preferences'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.preferences") }}
              </button>
            </li>
            <!-- App native uniquement : reprend l'essentiel du footer du site. -->
            <li v-if="isNativeApp">
              <button
                @click="setActiveTab('about')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'about'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.about") }}
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

          <div v-if="activeTab === 'preferences'">
            <PreferencesTab :user-id="currentUser.id" />
          </div>

          <div v-if="activeTab === 'about'">
            <AboutTab />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
