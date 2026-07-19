<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session } from "../../models/models";
import type { EnumTypeTextStudy } from "../../models/typeTextStudy";
import SessionCard from "../../components/SessionCard.vue";
import SignupPromptModal from "../../components/SignupPromptModal.vue";
import AccountCta from "../../components/AccountCta.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";
import { authService } from "../../services/authService";

const router = useRouter();
const { t } = useI18n();

const sessions = ref<Session[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const isAuthenticated = ref(false);
// Visitors without an account can still click "create a session": instead of a
// disabled button they get a prompt inviting them to sign in / sign up.
const showAuthPrompt = ref(false);
let unsubscribeAuth: (() => void) | null = null;

// Search & type filter over the session list.
const searchTerm = ref("");
const selectedType = ref<EnumTypeTextStudy | "">("");

// Animated "how it works" timeline: plays once when scrolled into view.
const timelineRef = ref<HTMLElement | null>(null);
const timelineInView = ref(false);
let timelineObserver: IntersectionObserver | null = null;

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
const finishedSessions = computed(() => filteredSessions.value.filter((s) => isSessionFinished(s)));

const clearFilters = () => {
  searchTerm.value = "";
  selectedType.value = "";
};

// Visual "how it works" steps shown between the create button and the session list.
const howItWorksSteps = computed(() => [
  {
    icon: "circle-plus" as const,
    title: t("shareReading.howItWorks.step1Title"),
    description: t("shareReading.howItWorks.step1Desc"),
  },
  {
    icon: "book-open" as const,
    title: t("shareReading.howItWorks.step2Title"),
    description: t("shareReading.howItWorks.step2Desc"),
  },
  {
    icon: "share" as const,
    title: t("shareReading.howItWorks.step3Title"),
    description: t("shareReading.howItWorks.step3Desc"),
  },
  {
    icon: "flag" as const,
    title: t("shareReading.howItWorks.step4Title"),
    description: t("shareReading.howItWorks.step4Desc"),
  },
]);

onMounted(() => {
  loadSessions();
  unsubscribeAuth = authService.onAuthChanged((user) => {
    isAuthenticated.value = !!user;
  });
  const url = window.location.origin + "/share-reading";
  seoService.setMeta({
    title: t("seo.shareReadingTitle"),
    description: t("seo.shareReadingDescription"),
    canonical: url,
    og: { url },
  });

  setupTimelineReveal();
});

// Play the timeline animation once: immediately if it's already on screen at
// load, otherwise the first time it scrolls into view. Falls back to simply
// showing it if observers are unavailable.
function setupTimelineReveal() {
  const el = timelineRef.value;
  const activate = () => {
    timelineInView.value = true;
    timelineObserver?.disconnect();
    timelineObserver = null;
  };

  if (!el || typeof IntersectionObserver === "undefined") {
    activate();
    return;
  }

  // Already on screen at load: activate now (the CSS animation plays as the
  // class is applied). Otherwise wait for it to scroll into view.
  const rect = el.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    activate();
    return;
  }

  timelineObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) activate();
    },
    { threshold: 0.2 },
  );
  timelineObserver.observe(el);
}

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth();
  timelineObserver?.disconnect();
});

const handleSessionClick = (session: Session) => {
  router.push(`/share-reading/session/${session.slug || session.id}`);
};

// Logged-in users go straight to the form; visitors get the sign-in prompt.
const handleCreateClick = () => {
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
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
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

    <!-- Comment ça marche : timeline animée -->
    <section class="max-w-5xl mx-auto mb-16">
      <div class="text-center mb-10">
        <h3 class="text-2xl md:text-3xl font-bold text-text-primary">
          {{ t("shareReading.howItWorks.title") }}
        </h3>
        <p class="text-text-secondary max-w-2xl mx-auto mt-2">
          {{ t("shareReading.howItWorks.subtitle") }}
        </p>
      </div>

      <ol ref="timelineRef" class="timeline" :class="{ 'is-active': timelineInView }">
        <li
          v-for="(step, index) in howItWorksSteps"
          :key="step.title"
          class="timeline__step"
          :style="{ '--i': index }"
        >
          <span class="timeline__connector bg-black/[0.08] dark:bg-white/[0.12]" aria-hidden="true">
            <span class="timeline__fill"></span>
            <span class="timeline__runner"></span>
          </span>
          <span class="timeline__node">
            <AppIcon :name="step.icon" :size="20" />
          </span>
          <div class="timeline__content">
            <h4 class="timeline__title text-text-primary">{{ step.title }}</h4>
            <p class="timeline__desc text-text-secondary">
              {{ step.description }}
            </p>
          </div>
        </li>
      </ol>
    </section>

    <div class="relative max-w-7xl mx-auto">
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

        <!-- Sessions terminées -->
        <div v-if="finishedSessions.length > 0" class="animate-[fadeIn_0.5s_ease] opacity-80">
          <h3 class="text-2xl font-bold text-text-primary mb-6 flex items-baseline gap-3">
            {{ t("shareReading.archives") }}
            <span class="text-sm font-normal text-text-secondary">{{
              finishedSessions.length
            }}</span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <SessionCard
              v-for="session in finishedSessions"
              :key="session.id"
              :session="session"
              @click="handleSessionClick"
              class="h-full grayscale-[0.3] hover:grayscale-0 transition-all duration-300"
            />
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
  </main>
</template>

<style scoped>
/* Animated "how it works" timeline.
   Mobile = vertical, desktop (>=768px) = horizontal. The connecting line fills
   step by step and a dot travels along it as each node lights up;
   the whole sequence plays once when the timeline scrolls into view. */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.timeline__step {
  position: relative;
  display: grid;
  grid-template-columns: 3rem 1fr;
  column-gap: 1.25rem;
  padding-bottom: 2.5rem;
}
.timeline__step:last-child {
  padding-bottom: 0;
}

/* --- node --- */
.timeline__node {
  position: relative;
  z-index: 2;
  grid-column: 1;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--color-primary);
  /* idle state before activation */
  filter: grayscale(1);
  opacity: 0.4;
  transform: scale(0.88);
}
/* --- text --- */
.timeline__content {
  grid-column: 2;
  align-self: center;
}
/* Title/description colors are set via Tailwind utilities in the template
   (text-text-*) so dark mode adapts via the flipped CSS variables. */
.timeline__title {
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 0.2rem;
}
.timeline__desc {
  font-size: 0.875rem;
  line-height: 1.55;
}

/* --- connector (mobile: vertical) --- */
.timeline__connector {
  position: absolute;
  z-index: 1;
  inset-inline-start: 1.5rem;
  top: 3rem;
  width: 3px;
  height: calc(100% - 3rem);
  transform: translateX(-50%);
  border-radius: 9999px;
  /* track color set via Tailwind (bg-black/[0.08] dark:bg-white/[0.12]) */
}
.timeline__step:last-child .timeline__connector {
  display: none;
}
.timeline__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-primary);
  transform: scaleY(0);
  transform-origin: top center;
}
.timeline__runner {
  position: absolute;
  inset-inline-start: 50%;
  top: 0;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
  transform: translate(-50%, -50%);
  background: var(--color-secondary);
  opacity: 0;
}

/* --- activation (plays once when .is-active is added) --- */
.timeline.is-active .timeline__node {
  animation: tl-node 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: calc(var(--i) * 0.5s);
}
.timeline.is-active .timeline__fill {
  animation: tl-fill-y 0.5s ease forwards;
  animation-delay: calc(var(--i) * 0.5s + 0.25s);
}
.timeline.is-active .timeline__runner {
  animation: tl-run-y 0.55s ease forwards;
  animation-delay: calc(var(--i) * 0.5s + 0.25s);
}

@keyframes tl-node {
  0% {
    filter: grayscale(1);
    opacity: 0.4;
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.12);
  }
  100% {
    filter: grayscale(0);
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes tl-fill-y {
  to {
    transform: scaleY(1);
  }
}
@keyframes tl-run-y {
  0% {
    top: 0;
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}
@keyframes tl-fill-x {
  to {
    transform: scaleX(1);
  }
}
@keyframes tl-run-x {
  0% {
    inset-inline-start: 0;
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    inset-inline-start: 100%;
    opacity: 0;
  }
}

/* --- desktop: horizontal --- */
@media (min-width: 768px) {
  .timeline {
    flex-direction: row;
    align-items: flex-start;
  }
  .timeline__step {
    flex: 1;
    grid-template-columns: none;
    grid-template-rows: 3.5rem auto;
    row-gap: 1.1rem;
    justify-items: center;
    text-align: center;
    padding-bottom: 0;
    padding-inline: 0.5rem;
  }
  .timeline__node {
    grid-column: auto;
    grid-row: 1;
    width: 3.5rem;
    height: 3.5rem;
  }
  .timeline__content {
    grid-column: auto;
    grid-row: 2;
  }
  .timeline__connector {
    top: 1.75rem;
    inset-inline-start: 50%;
    width: 100%;
    height: 3px;
    transform: translateY(-50%);
  }
  .timeline__fill {
    transform: scaleX(0);
    transform-origin: left center;
  }
  .timeline__runner {
    inset-inline-start: 0;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  .timeline.is-active .timeline__fill {
    animation-name: tl-fill-x;
  }
  .timeline.is-active .timeline__runner {
    animation-name: tl-run-x;
  }
}

/* --- respect reduced-motion: show the final state, no movement --- */
@media (prefers-reduced-motion: reduce) {
  .timeline__node {
    filter: none;
    opacity: 1;
    transform: scale(1);
    animation: none;
  }
  .timeline__fill {
    transform: none;
    animation: none;
  }
  .timeline__runner {
    display: none;
  }
}
</style>
