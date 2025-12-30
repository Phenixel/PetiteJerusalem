<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import { sessionService } from "../services/sessionService";
import type { User } from "../services/authService";
import type { Session, TextStudy } from "../models/models";
import { seoService } from "../services/seoService";
import ShareModal from "../components/ShareModal.vue";
import EditSessionModal from "../components/EditSessionModal.vue";
import ProfileHeader from "./profilePage/ProfileHeader.vue";
import ParticipatedSessions from "./profilePage/ParticipatedSessions.vue";
import CreatedSessions from "./profilePage/CreatedSessions.vue";
import UserInfoForm from "./profilePage/UserInfoForm.vue";
import SecuritySettings from "./profilePage/SecuritySettings.vue";

const router = useRouter();
const { t } = useI18n();

const currentUser = ref<User | null>(null);
const activeTab = ref<"sessions-participated" | "sessions-created" | "my-info" | "security">(
  "sessions-participated",
);
const isLoading = ref(true);

const participatedSessions = ref<Session[]>([]);
const createdSessions = ref<Session[]>([]);
const textStudiesMap = ref<Map<string, TextStudy>>(new Map());

const showShareModal = ref(false);
const showEditModal = ref(false);
const selectedSession = ref<Session | null>(null);
const shareUrl = ref("");

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

const loadSessions = async () => {
  if (!currentUser.value) return;

  try {
    const allSessions = await sessionService.getAllSessions();

    participatedSessions.value = allSessions.filter((session) =>
      session.reservations?.some((reservation) => reservation.chosenById === currentUser.value?.id),
    );

    createdSessions.value = allSessions.filter(
      (session) => session.personId === currentUser.value?.id,
    );

    await loadTextStudiesForSessions(participatedSessions.value);
  } catch (error) {
    console.error("Erreur lors du chargement des sessions:", error);
  }
};

const loadTextStudiesForSessions = async (sessions: Session[]) => {
  try {
    const types = [...new Set(sessions.map((s) => s.type))];
    for (const type of types) {
      const textStudies = await sessionService.getTextStudiesByType(type);
      textStudies.forEach((textStudy) => {
        textStudiesMap.value.set(textStudy.id, textStudy);
      });
    }
  } catch (error) {
    console.error("Erreur lors du chargement des textes d'étude:", error);
  }
};

const setActiveTab = (tab: typeof activeTab.value) => {
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

const updateUserInfo = async (data: { name: string; email: string }) => {
  if (!currentUser.value) return;

  try {
    currentUser.value.name = data.name;
    currentUser.value.email = data.email;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
  }
};

const openShareModal = (session: Session) => {
  selectedSession.value = session;
  shareUrl.value = `${window.location.origin}/share-reading/session/${session.id}`;
  showShareModal.value = true;
};

const openEditModal = (session: Session) => {
  selectedSession.value = session;
  showEditModal.value = true;
};

const saveSessionChanges = async (sessionData: {
  name: string;
  description: string;
  dateLimit: string;
}) => {
  if (!selectedSession.value) return;

  try {
    await sessionService.updateSession(selectedSession.value.id, sessionData);

    const sessionIndex = createdSessions.value.findIndex((s) => s.id === selectedSession.value!.id);
    if (sessionIndex > -1) {
      createdSessions.value[sessionIndex] = {
        ...createdSessions.value[sessionIndex],
        name: sessionData.name,
        description: sessionData.description,
        dateLimit: new Date(sessionData.dateLimit),
        updatedAt: new Date(),
      };
    }

    alert(t("profile.sessionUpdatedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    alert(t("profile.sessionUpdateError"));
  }
};

const endSession = async (session: Session) => {
  if (!confirm(t("profile.endSessionConfirm"))) {
    return;
  }

  try {
    await sessionService.endSession(session.id);

    const sessionIndex = createdSessions.value.findIndex((s) => s.id === session.id);
    if (sessionIndex > -1) {
      createdSessions.value[sessionIndex] = {
        ...createdSessions.value[sessionIndex],
        isEnded: true,
        endedAt: new Date(),
        updatedAt: new Date(),
      };
    }

    alert(t("profile.sessionEndedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la fin de session:", error);
    alert(t("profile.sessionEndError"));
  }
};

onMounted(async () => {
  await loadUserData();
  await loadSessions();
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
      <p class="font-medium animate-pulse">{{ t("profile.loadingProfile") }}</p>
    </div>

    <div v-else-if="currentUser">
      <ProfileHeader :user-display-name="userDisplayName" />

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav
          class="lg:sticky lg:top-24 h-fit bg-white/40 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm dark:bg-gray-800/40 dark:border-gray-700"
        >
          <ul class="flex flex-col gap-2 mb-8">
            <li>
              <button
                @click="setActiveTab('sessions-participated')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'sessions-participated'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>{{ t("profile.tabs.participatedSessions") }}</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('sessions-created')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'sessions-created'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>{{ t("profile.tabs.createdSessions") }}</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('my-info')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'my-info'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>{{ t("profile.tabs.myInfo") }}</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('security')"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-xl transition-all text-left font-medium',
                  activeTab === 'security'
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm dark:bg-primary/20'
                    : 'hover:bg-white/50 text-text-secondary hover:text-text-primary hover:translate-x-1 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-gray-200',
                ]"
              >
                <span>{{ t("profile.tabs.security") }}</span>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
              </button>
            </li>
          </ul>

          <button
            @click="authService.logout()"
            class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <i class="fa-solid fa-right-from-bracket"></i>
            {{ t("common.logout") }}
          </button>
        </nav>

        <div id="profile-content">
          <div v-if="activeTab === 'sessions-participated'">
            <ParticipatedSessions
              :sessions="participatedSessions"
              :current-user="currentUser"
              :text-studies-map="textStudiesMap"
            />
          </div>

          <div v-if="activeTab === 'sessions-created'">
            <CreatedSessions
              :sessions="createdSessions"
              :current-user="currentUser"
              @share="openShareModal"
              @edit="openEditModal"
              @end="endSession"
            />
          </div>

          <div v-if="activeTab === 'my-info'">
            <UserInfoForm :user="currentUser" @update="updateUserInfo" />
          </div>

          <div v-if="activeTab === 'security'">
            <SecuritySettings />
          </div>
        </div>
      </div>
    </div>

    <ShareModal
      v-model:show="showShareModal"
      :session-name="selectedSession?.name || ''"
      :share-url="shareUrl"
    />

    <EditSessionModal
      v-model:show="showEditModal"
      :session="selectedSession"
      @save="saveSessionChanges"
    />
  </main>
</template>
