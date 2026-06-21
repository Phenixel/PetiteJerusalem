<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session } from "../../models/models";
import SessionCard from "../../components/SessionCard.vue";
import { seoService } from "../../services/seoService";
import { authService } from "../../services/authService";

const router = useRouter();
const { t } = useI18n();

const sessions = ref<Session[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const isAuthenticated = ref(false);
let unsubscribeAuth: (() => void) | null = null;

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

const ongoingSessions = computed(() => sessions.value.filter((s) => !isSessionFinished(s)));
const finishedSessions = computed(() => sessions.value.filter((s) => isSessionFinished(s)));

// Visual "how it works" steps shown between the create button and the session list.
const howItWorksSteps = computed(() => [
  {
    icon: "fa-circle-plus",
    title: t("shareReading.howItWorks.step1Title"),
    description: t("shareReading.howItWorks.step1Desc"),
  },
  {
    icon: "fa-book-open",
    title: t("shareReading.howItWorks.step2Title"),
    description: t("shareReading.howItWorks.step2Desc"),
  },
  {
    icon: "fa-share-nodes",
    title: t("shareReading.howItWorks.step3Title"),
    description: t("shareReading.howItWorks.step3Desc"),
  },
  {
    icon: "fa-flag-checkered",
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
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="text-center mb-16 animate-[fadeIn_0.5s_ease]">
      <h2
        class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4 tracking-tight"
      >
        {{ t("shareReading.title") }}
      </h2>
      <p class="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed dark:text-gray-300">
        {{ t("shareReading.subtitle") }}
      </p>

      <button
        @click="router.push('/share-reading/new-session')"
        class="mt-8 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        :disabled="!isAuthenticated"
        :title="t('shareReading.createSession')"
      >
        <i class="fa-solid fa-plus mr-2"></i>
        {{ t("shareReading.createSession") }}
      </button>
      <div v-if="!isAuthenticated" class="mt-4 text-sm text-text-secondary/80 dark:text-gray-400">
        <small>{{ t("shareReading.authRequired") }}</small>
      </div>
    </div>

    <!-- Comment ça marche : timeline animée -->
    <section class="max-w-5xl mx-auto mb-16">
      <div class="text-center mb-10">
        <h3
          class="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent pb-1"
        >
          {{ t("shareReading.howItWorks.title") }}
        </h3>
        <p class="text-text-secondary max-w-2xl mx-auto mt-2 dark:text-gray-400">
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
          <span class="timeline__connector" aria-hidden="true">
            <span class="timeline__fill"></span>
            <span class="timeline__runner"></span>
          </span>
          <span class="timeline__node">
            <i :class="['fa-solid', step.icon]" aria-hidden="true"></i>
          </span>
          <div class="timeline__content">
            <h4 class="timeline__title">{{ step.title }}</h4>
            <p class="timeline__desc">{{ step.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <div class="relative">
      <!-- État de chargement -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-2xl dark:bg-gray-900/60"
      >
        <div
          class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        ></div>
        <p class="text-text-secondary font-medium animate-pulse dark:text-gray-300">
          {{ t("shareReading.loadingSessions") }}
        </p>
      </div>

      <!-- État d'erreur -->
      <div
        v-if="error"
        class="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
      >
        <div
          class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mb-4 dark:bg-red-900/20 dark:text-red-400"
        >
          <i class="fa-solid fa-exclamation-triangle"></i>
        </div>
        <p class="text-red-700 font-medium mb-6 dark:text-red-400">{{ error }}</p>
        <button
          @click="loadSessions"
          class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
        >
          {{ t("common.retry") }}
        </button>
      </div>

      <!-- Liste des sessions -->
      <div v-else-if="sessions.length > 0">
        <!-- Sessions en cours -->
        <div class="mb-16 animate-[fadeIn_0.5s_ease]">
          <h3
            class="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3 dark:text-gray-100"
          >
            <i class="fa-solid fa-fire text-orange-500"></i>
            {{ t("shareReading.ongoingSessions") }}
            <span
              class="text-sm font-normal text-text-secondary bg-gray-100 px-3 py-1 rounded-full dark:bg-gray-800 dark:text-gray-400"
              >{{ ongoingSessions.length }}</span
            >
          </h3>

          <div
            v-if="ongoingSessions.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <SessionCard
              v-for="session in ongoingSessions"
              :key="session.id"
              :session="session"
              @click="handleSessionClick"
              class="h-full"
            />
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center py-12 bg-white/40 backdrop-blur-sm rounded-xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
          >
            <p class="text-text-secondary text-lg dark:text-gray-400">
              {{ t("shareReading.noOngoingSessions") }}
            </p>
          </div>
        </div>

        <!-- Sessions terminées -->
        <div v-if="finishedSessions.length > 0" class="animate-[fadeIn_0.5s_ease] opacity-80">
          <div class="flex items-center gap-4 mb-6">
            <h3
              class="text-2xl font-bold text-text-primary flex items-center gap-3 dark:text-gray-100"
            >
              <i class="fa-solid fa-history text-gray-500"></i>
              {{ t("shareReading.archives") }}
            </h3>
            <div class="h-px flex-grow bg-gradient-to-r from-gray-200 to-transparent"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 text-center bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
      >
        <div class="text-6xl mb-6">📚</div>
        <h4 class="text-2xl font-bold text-text-primary mb-2 dark:text-gray-200">
          {{ t("shareReading.noSessions") }}
        </h4>
        <p class="text-text-secondary dark:text-gray-400">
          {{ t("shareReading.createFirstSession") }}
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Animated "how it works" timeline.
   Mobile = vertical, desktop (>=768px) = horizontal. The connecting line fills
   step by step and a glowing dot travels along it as each node lights up;
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
  font-size: 1.05rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 4px 14px rgba(29, 111, 219, 0.25);
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
.timeline__title {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--color-text-primary);
  margin-bottom: 0.2rem;
}
.timeline__desc {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-secondary);
}
:global(:root.dark) .timeline__title {
  color: #f3f4f6;
}
:global(:root.dark) .timeline__desc {
  color: #9ca3af;
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
  background: rgba(0, 0, 0, 0.08);
  border-radius: 9999px;
}
:global(:root.dark) .timeline__connector {
  background: rgba(255, 255, 255, 0.12);
}
.timeline__step:last-child .timeline__connector {
  display: none;
}
.timeline__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(var(--color-primary), var(--color-secondary));
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
  box-shadow: 0 0 10px 2px rgba(6, 182, 212, 0.6);
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
    font-size: 1.25rem;
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
