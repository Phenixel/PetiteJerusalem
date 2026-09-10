<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import { reservationService } from "../../services/reservationService";
import { TextTypeService } from "../../services/textTypeService";
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
import { moderationService } from "../../services/moderationService";
import { isNativeApp } from "../../composables/useNativeApp";
import PageTabs from "../../components/PageTabs.vue";
import { LIBRARY_TABS } from "../../config/pageTabs";
import { liveValue } from "../../composables/liveInput";
import { useSessionEditing, type SessionEditData } from "../../composables/useSessionEditing";
import { SITE_URL } from "../../config/site";

const router = useRouter();
const { t } = useI18n();
const sessionEditing = useSessionEditing("share_home");

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
    error.value = t("shareReading.loadError");
  } finally {
    isLoading.value = false;
  }
};

const isSessionFinished = (session: Session) => sessionService.isSessionFinished(session);

// --- « Mes sessions » : celles que je suis (participation ou création),
// affichées avant le reste, c'est ce qu'on vient chercher en revenant.
// Les sessions terminées où je participais disparaissent de l'affichage
// (les données restent en base) ; celles que j'ai créées restent
// accessibles derrière un « Afficher les terminées » dans la liste. ---
const participatedSessions = computed(() => {
  const u = currentUser.value;
  if (!u) return [];
  return sessions.value.filter(
    (s) =>
      !isSessionFinished(s) &&
      s.hidden !== true &&
      s.reservations?.some((r) => reservationService.isOwnReservation(r, u)),
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
  // Domaine canonique : SITE_URL vaut localhost (ou
  // capacitor://localhost) en dev et dans l'app native → lien inutilisable.
  shareUrl.value = `${SITE_URL}/share-reading/session/${session.slug || session.id}`;
  showShareModal.value = true;
};

const openEditModal = (session: Session) => {
  selectedSession.value = session;
  analyticsService.capture("session_edit_started", {
    session_id: session.id,
    text_type: session.type,
    source: "share_home",
  });
  showEditModal.value = true;
};

const replaceSession = (updated: Session) => {
  const index = sessions.value.findIndex((s) => s.id === updated.id);
  if (index > -1) sessions.value[index] = updated;
};

const saveSessionChanges = async (sessionData: SessionEditData): Promise<boolean> => {
  const edited = selectedSession.value;
  if (!edited) return false;

  const saved = await sessionEditing.saveSession(edited, sessionData);
  if (saved) replaceSession(sessionEditing.edited(edited, sessionData));
  return saved;
};

const endSession = async (session: Session) => {
  if (await sessionEditing.endSession(session)) replaceSession(sessionEditing.ended(session));
};

const availableTypes = computed(() => {
  const types = new Set<EnumTypeTextStudy>();
  for (const s of sessions.value) types.add(s.type);
  return Array.from(types);
});

const filteredSessions = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  // Modération : les sessions masquées et celles des créateurs bloqués par
  // le visiteur ne figurent pas dans la liste publique.
  const blockedCreators = new Set(moderationService.getBlockedCreatorIds());
  return sessions.value.filter((s) => {
    if (s.hidden === true || blockedCreators.has(s.personId)) return false;
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

// Arrivée sur le tableau de bord du partage. L'événement est attendu par le
// dashboard « Funnel chaîne partagée » depuis le 11 août mais n'a jamais été
// posé : la tuile « découverte vs tableau de bord » est vide depuis. Il part
// à la première résolution de l'auth, pas au montage : `variant` n'a de sens
// qu'une fois qu'on sait si le visiteur a un compte, et Firebase répond après
// le premier rendu.
let hasTrackedHomeView = false;

onMounted(() => {
  loadSessions();
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
    if (hasTrackedHomeView) return;
    hasTrackedHomeView = true;
    analyticsService.capture("share_home_viewed", {
      // Les deux visages de la page depuis la refonte du 4 août : la liste
      // publique pour un visiteur, « Mes sessions » en tête pour un compte.
      variant: user ? "dashboard" : "discovery",
    });
  });
  const url = SITE_URL + "/share-reading";
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
    <div class="animate-[fadeIn_0.5s_ease] text-center" :class="isNativeApp ? 'mb-8' : 'mb-16'">
      <!-- App native : le partage est le second onglet de la bibliothèque, et
           les onglets tiennent lieu de titre (voir PageTabs). -->
      <PageTabs
        v-if="isNativeApp"
        :tabs="LIBRARY_TABS"
        event="library_tab_switched"
        :label="t('study.title')"
      />
      <!-- Le seul h1 de la page. -->
      <h1
        class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight"
        :class="isNativeApp ? 'sr-only' : ''"
      >
        {{ t("shareReading.title") }}
      </h1>
      <!-- Le sous-titre explicatif ne sert que le site : SEO + découverte. -->
      <p v-if="!isNativeApp" class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("shareReading.subtitle") }}
      </p>

      <button
        @click="handleCreateClick"
        class="btn btn-primary !px-8 !py-3"
        :class="isNativeApp ? 'mt-2' : 'mt-8'"
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

    <!-- Connecté : la timeline explicative vit entre « Mes sessions » et la
         liste publique. -->
    <HowItWorksTimeline v-if="isAuthenticated" class="mb-16" />

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
            :value="searchTerm"
            @input="searchTerm = liveValue($event)"
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
            {{ TextTypeService.formatType(type) }}
          </button>
        </div>
      </div>

      <!-- État de chargement -->
      <div v-if="isLoading" class="absolute inset-0 flex flex-col items-center justify-center z-10">
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

      <AccountCta class="max-w-3xl mx-auto mt-12" />
    </div>

    <ShareModal
      v-model:show="showShareModal"
      :session-name="selectedSession?.name || ''"
      :share-url="shareUrl"
      :session-type="selectedSession?.type"
      content-type="session"
      :content-id="selectedSession?.id ?? null"
    />

    <EditSessionModal
      v-model:show="showEditModal"
      :session="selectedSession"
      :save="saveSessionChanges"
    />
  </main>
</template>
