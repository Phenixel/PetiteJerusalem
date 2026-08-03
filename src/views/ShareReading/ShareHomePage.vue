<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session, TextStudy } from "../../models/models";
import type { EnumTypeTextStudy } from "../../models/typeTextStudy";
import SessionCard from "../../components/SessionCard.vue";
import SignupPromptModal from "../../components/SignupPromptModal.vue";
import AccountCta from "../../components/AccountCta.vue";
import HowItWorksTimeline from "../../components/HowItWorksTimeline.vue";
import ShareModal from "../../components/ShareModal.vue";
import EditSessionModal from "../../components/EditSessionModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import MyParticipatedSessions from "./MyParticipatedSessions.vue";
import MyCreatedSessions from "./MyCreatedSessions.vue";
import { seoService } from "../../services/seoService";
import { authService, type User } from "../../services/authService";
import { analyticsService } from "../../services/analyticsService";
import { isNativeApp } from "../../composables/useNativeApp";
import { useToast } from "../../composables/useToast";
import { SITE_URL } from "../../config/site";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const sessions = ref<Session[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const isAuthenticated = computed(() => currentUser.value !== null);
// Visitors without an account can still click "create a session": instead of a
// disabled button they get a prompt inviting them to sign in / sign up.
const showAuthPrompt = ref(false);
let unsubscribeAuth: (() => void) | null = null;

// Search & type filter over the session list.
const searchTerm = ref("");
const selectedType = ref<EnumTypeTextStudy | "">("");

const loadSessions = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    const fetchedSessions = await sessionService.getAllSessions();
    sessions.value = sessionService.sortSessionsByDate(fetchedSessions);
  } catch (err) {
    console.error("Erreur lors du chargement des sessions:", err);
    error.value = err instanceof Error ? err.message : "Erreur lors du chargement des sessions";
  } finally {
    isLoading.value = false;
  }
};

const isSessionFinished = (session: Session): boolean => {
  if (session.isEnded) return true;
  const limit = new Date(session.dateLimit);
  limit.setHours(23, 59, 59, 999);
  return new Date() > limit;
};

// --- « Mes sessions » : celles que je suis (participation ou création),
// affichées avant le reste — c'est ce qu'on vient chercher en revenant.
// Les sessions terminées où je participais disparaissent de l'affichage
// (les données restent en base) ; celles que j'ai créées restent
// accessibles derrière un « Afficher les terminées » dans la liste. ---
const participatedSessions = computed(() => {
  const u = currentUser.value;
  if (!u) return [];
  return sessions.value.filter(
    (s) =>
      !isSessionFinished(s) &&
      s.reservations?.some((r) => r.chosenById === u.id || r.chosenByGuestId === u.email),
  );
});

const createdSessions = computed(() => {
  const u = currentUser.value;
  if (!u) return [];
  return sessions.value.filter((s) => s.personId === u.id);
});

// Le compteur de l'onglet ne compte que les sessions en cours (les terminées
// sont repliées derrière « Afficher les terminées »).
const createdOngoingCount = computed(
  () => createdSessions.value.filter((s) => !isSessionFinished(s)).length,
);

const hasMySessions = computed(
  () => participatedSessions.value.length > 0 || createdSessions.value.length > 0,
);

// Sous-onglet de « Mes sessions » : participation d'abord (le cas le plus
// courant), création sinon.
const myTab = ref<"participated" | "created">("participated");
const myTabInitialized = ref(false);

function switchMyTab(tab: "participated" | "created") {
  myTab.value = tab;
  analyticsService.capture("share_home_my_sessions_tab", { tab });
}

// Les noms des textes réservés (affichés par ParticipatedSessions).
const textStudiesMap = ref<Map<string, TextStudy>>(new Map());

const loadTextStudiesForSessions = async (sessionsList: Session[]) => {
  try {
    const types = [...new Set(sessionsList.map((s) => s.type))];
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

// --- Actions du créateur (partager, modifier, terminer) : reprises du profil. ---
const showShareModal = ref(false);
const showEditModal = ref(false);
const selectedSession = ref<Session | null>(null);
const shareUrl = ref("");

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

    const sessionIndex = sessions.value.findIndex((s) => s.id === selectedSession.value!.id);
    if (sessionIndex > -1) {
      sessions.value[sessionIndex] = {
        ...sessions.value[sessionIndex],
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

    const sessionIndex = sessions.value.findIndex((s) => s.id === session.id);
    if (sessionIndex > -1) {
      sessions.value[sessionIndex] = {
        ...sessions.value[sessionIndex],
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

const availableTypes = computed(() => {
  const types = new Set<EnumTypeTextStudy>();
  for (const s of sessions.value) types.add(s.type);
  return Array.from(types);
});

const filteredSessions = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return sessions.value.filter((s) => {
    if (selectedType.value && s.type !== selectedType.value) return false;
    if (!term) return true;
    return (
      s.name.toLowerCase().includes(term) ||
      (s.creatorName || "").toLowerCase().includes(term) ||
      (s.description || "").toLowerCase().includes(term)
    );
  });
});

const hasActiveFilter = computed(() => searchTerm.value.trim() !== "" || selectedType.value !== "");

const ongoingSessions = computed(() => filteredSessions.value.filter((s) => !isSessionFinished(s)));

const clearFilters = () => {
  searchTerm.value = "";
  selectedType.value = "";
};

onMounted(() => {
  loadSessions();
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
  });
  const url = window.location.origin + "/share-reading";
  seoService.setMeta({
    title: t("seo.shareReadingTitle"),
    description: t("seo.shareReadingDescription"),
    canonical: url,
    og: { url },
  });
});

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth();
});

// Une fois sessions + utilisateur connus (deux chargements asynchrones) :
// ouvrir « Mes sessions » sur le bon sous-onglet (participation si j'en ai,
// sinon mes créations) et charger les noms de textes des réservations.
watch(
  [currentUser, isLoading],
  () => {
    if (myTabInitialized.value) return;
    if (!currentUser.value || isLoading.value) return;
    myTabInitialized.value = true;
    if (participatedSessions.value.length === 0 && createdSessions.value.length > 0) {
      myTab.value = "created";
    }
    void loadTextStudiesForSessions(participatedSessions.value);
  },
  { immediate: true },
);

const handleSessionClick = (session: Session) => {
  router.push(`/share-reading/session/${session.slug || session.id}`);
};

// Logged-in users go straight to the form; visitors get the sign-in prompt.
const handleCreateClick = () => {
  analyticsService.capture("create_chain_cta_clicked", {
    source: "share_home",
    is_authenticated: isAuthenticated.value,
  });
  if (isAuthenticated.value) {
    router.push("/share-reading/new-session");
  } else {
    showAuthPrompt.value = true;
  }
};
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="text-center mb-16 animate-[fadeIn_0.5s_ease]">
      <h2 class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">
        {{ t("shareReading.title") }}
      </h2>
      <!-- Le sous-titre explicatif ne sert que le site : SEO + découverte. -->
      <p v-if="!isNativeApp" class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("shareReading.subtitle") }}
      </p>

      <button
        @click="handleCreateClick"
        class="btn btn-primary mt-8 !px-8 !py-3"
        :title="t('shareReading.createSession')"
      >
        <AppIcon name="plus" :size="16" />
        {{ t("shareReading.createSession") }}
      </button>
    </div>

    <!-- Invitation à se connecter pour les visiteurs sans compte -->
    <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />

    <!-- Visiteur : comment ça marche, avant la liste (découverte). Les
         connectés retrouvent la timeline en bas de page. -->
    <HowItWorksTimeline v-if="!isAuthenticated" class="mb-16" />

    <!-- ===== Mes sessions : ce que je suis venu retrouver ===== -->
    <section
      v-if="isAuthenticated && myTabInitialized && hasMySessions"
      class="max-w-7xl mx-auto mb-16 animate-[fadeIn_0.5s_ease]"
    >
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 class="text-2xl font-bold text-text-primary flex items-center gap-2.5">
          <AppIcon name="user" :size="20" class="text-primary" />
          {{ t("shareReading.mySessions") }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <button
            class="chip !px-4 !py-2 transition-colors"
            :class="
              myTab === 'participated'
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            @click="switchMyTab('participated')"
          >
            {{ t("shareReading.myParticipated") }}
            <span class="opacity-75">{{ participatedSessions.length }}</span>
          </button>
          <button
            class="chip !px-4 !py-2 transition-colors"
            :class="
              myTab === 'created'
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            @click="switchMyTab('created')"
          >
            {{ t("shareReading.myCreated") }}
            <span class="opacity-75">{{ createdOngoingCount }}</span>
          </button>
        </div>
      </div>

      <div class="card px-5 py-2 md:px-6 md:py-3">
        <MyParticipatedSessions
          v-if="myTab === 'participated'"
          :sessions="participatedSessions"
          :current-user="currentUser"
          :text-studies-map="textStudiesMap"
        />
        <MyCreatedSessions
          v-else
          :sessions="createdSessions"
          :current-user="currentUser"
          @share="openShareModal"
          @edit="openEditModal"
          @end="endSession"
        />
      </div>
    </section>

    <div class="relative max-w-7xl mx-auto">
      <!-- Titre de la liste publique : la distingue de « Mes sessions ». -->
      <h3
        v-if="isAuthenticated && hasMySessions && sessions.length > 0"
        class="text-2xl font-bold text-text-primary mb-6 flex items-center gap-2.5"
      >
        <AppIcon name="users" :size="20" class="text-primary" />
        {{ t("shareReading.allSessions") }}
      </h3>

      <!-- Recherche et filtres -->
      <div v-if="sessions.length > 0" class="flex flex-col md:flex-row gap-3 mb-10 md:items-center">
        <div class="relative flex-1 max-w-md">
          <AppIcon
            name="search"
            :size="16"
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
          />
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="t('shareReading.searchPlaceholder')"
            class="field !pl-11"
          />
          <button
            v-if="searchTerm"
            @click="searchTerm = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
            :aria-label="t('shareReading.clearFilters')"
          >
            <AppIcon name="x" :size="14" />
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="chip transition-colors"
            :class="
              selectedType === ''
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            @click="selectedType = ''"
          >
            {{ t("shareReading.allTypes") }}
          </button>
          <button
            v-for="type in availableTypes"
            :key="type"
            class="chip transition-colors"
            :class="
              selectedType === type
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
            "
            @click="selectedType = selectedType === type ? '' : type"
          >
            {{ sessionService.formatTextType(type) }}
          </button>
        </div>
      </div>

      <!-- État de chargement -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex flex-col items-center justify-center z-10"
      >
        <div
          class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        ></div>
        <p class="text-text-secondary font-medium">
          {{ t("shareReading.loadingSessions") }}
        </p>
      </div>

      <!-- État d'erreur -->
      <div v-if="error" class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
        <p class="text-text-primary font-medium mb-6">{{ error }}</p>
        <button @click="loadSessions" class="btn btn-soft">
          {{ t("common.retry") }}
        </button>
      </div>

      <!-- Liste des sessions -->
      <div v-else-if="sessions.length > 0">
        <!-- Sessions en cours -->
        <div class="mb-16 animate-[fadeIn_0.5s_ease]">
          <h3 class="text-2xl font-bold text-text-primary mb-6 flex items-baseline gap-3">
            {{ t("shareReading.ongoingSessions") }}
            <span class="text-sm font-normal text-text-secondary">{{
              ongoingSessions.length
            }}</span>
          </h3>

          <div
            v-if="ongoingSessions.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <SessionCard
              v-for="session in ongoingSessions"
              :key="session.id"
              :session="session"
              @click="handleSessionClick"
              class="h-full"
            />
          </div>
          <div v-else class="py-12 text-center">
            <p class="text-text-secondary text-lg">
              {{
                hasActiveFilter
                  ? t("shareReading.noSearchResults")
                  : t("shareReading.noOngoingSessions")
              }}
            </p>
            <button v-if="hasActiveFilter" @click="clearFilters" class="btn btn-soft mt-4">
              {{ t("shareReading.clearFilters") }}
            </button>
          </div>
        </div>

      </div>

      <!-- Aucune session -->
      <div v-else class="flex flex-col items-center justify-center py-20 text-center">
        <AppIcon name="book-open" :size="40" class="text-primary/50 mb-6" :stroke-width="1.75" />
        <h4 class="text-2xl font-bold text-text-primary mb-2">
          {{ t("shareReading.noSessions") }}
        </h4>
        <p class="text-text-secondary">
          {{ t("shareReading.createFirstSession") }}
        </p>
      </div>

      <!-- Connecté : la timeline explicative vit en bas de page. -->
      <HowItWorksTimeline v-if="isAuthenticated" class="mt-20" />

      <AccountCta class="max-w-3xl mx-auto mt-12" />
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
