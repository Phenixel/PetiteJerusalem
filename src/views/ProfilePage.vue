<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import { sessionService } from "../services/sessionService";
import type { User } from "../services/authService";
import type { Session, TextStudy } from "../models/models";
import { seoService } from "../services/seoService";
import { SITE_URL } from "../content/seoPages";
import ShareModal from "../components/ShareModal.vue";
import EditSessionModal from "../components/EditSessionModal.vue";
import AppIcon from "../components/icons/AppIcon.vue";
import ProfileHeader from "./profilePage/ProfileHeader.vue";
import ParticipatedSessions from "./profilePage/ParticipatedSessions.vue";
import CreatedSessions from "./profilePage/CreatedSessions.vue";
import UserInfoForm from "./profilePage/UserInfoForm.vue";
import SecuritySettings from "./profilePage/SecuritySettings.vue";
import PreferencesTab from "./profilePage/PreferencesTab.vue";
import DailyReading from "./profilePage/DailyReading.vue";
import AboutTab from "./profilePage/AboutTab.vue";
import { useToast } from "../composables/useToast";
import { isNativeApp } from "../composables/useNativeApp";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const currentUser = ref<User | null>(null);
const activeTab = ref<
  | "daily-reading"
  | "sessions-participated"
  | "sessions-created"
  | "my-info"
  | "security"
  | "preferences"
  | "about"
>("daily-reading");
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
      session.reservations?.some(
        (reservation) =>
          reservation.chosenById === currentUser.value?.id ||
          reservation.chosenByGuestId === currentUser.value?.email,
      ),
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
  // Domaine canonique : window.location.origin vaut localhost (ou
  // capacitor://localhost) en dev et dans l'app native → lien inutilisable.
  shareUrl.value = `${SITE_URL}/share-reading/session/${session.slug || session.id}`;
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
  guestEmailRequired: boolean;
}) => {
  if (!selectedSession.value) return;

  try {
    await sessionService.updateSession(selectedSession.value.id, {
      ...sessionData,
      slug: selectedSession.value.slug,
    });

    const sessionIndex = createdSessions.value.findIndex((s) => s.id === selectedSession.value!.id);
    if (sessionIndex > -1) {
      createdSessions.value[sessionIndex] = {
        ...createdSessions.value[sessionIndex],
        name: sessionData.name,
        description: sessionData.description,
        dateLimit: new Date(sessionData.dateLimit),
        guestEmailRequired: sessionData.guestEmailRequired,
        updatedAt: new Date(),
      };
    }

    toast.success(t("profile.sessionUpdatedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    toast.errorFromException(error, t("profile.sessionUpdateError"));
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

    toast.success(t("profile.sessionEndedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la fin de session:", error);
    toast.errorFromException(error, t("profile.sessionEndError"));
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
      <p class="font-medium">{{ t("profile.loadingProfile") }}</p>
    </div>

    <div v-else-if="currentUser">
      <ProfileHeader :user-display-name="userDisplayName" />

      <div class="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <nav class="lg:sticky lg:top-24 h-fit card p-3">
          <ul class="flex flex-col gap-1 mb-6">
            <li>
              <button
                @click="setActiveTab('daily-reading')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'daily-reading'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.dailyReading") }}
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('sessions-participated')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'sessions-participated'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.participatedSessions") }}
              </button>
            </li>
            <li>
              <button
                @click="setActiveTab('sessions-created')"
                :class="[
                  'w-full text-left px-4 py-3 rounded-lg font-medium transition-colors',
                  activeTab === 'sessions-created'
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
                ]"
              >
                {{ t("profile.tabs.createdSessions") }}
              </button>
            </li>
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

          <button @click="authService.logout()" class="btn btn-danger w-full">
            <AppIcon name="logout" :size="15" />
            {{ t("common.logout") }}
          </button>
        </nav>

        <div id="profile-content">
          <div v-if="activeTab === 'daily-reading'">
            <DailyReading :user-id="currentUser.id" />
          </div>

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

          <div v-if="activeTab === 'preferences'">
            <PreferencesTab :user-id="currentUser.id" />
          </div>

          <div v-if="activeTab === 'about'">
            <AboutTab />
          </div>
        </div>
      </div>
    </div>

    <ShareModal
      v-model:show="showShareModal"
      :session-name="selectedSession?.name || ''"
      :share-url="shareUrl"
      :session-type="selectedSession?.type"
    />

    <EditSessionModal
      v-model:show="showEditModal"
      :session="selectedSession"
      @save="saveSessionChanges"
    />
  </main>
</template>
