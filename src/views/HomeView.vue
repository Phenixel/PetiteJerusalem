<script setup lang="ts">
import { useRouter } from "vue-router";
import { onMounted, onUnmounted, ref, computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { seoService } from "../services/seoService";
import { authService, type User } from "../services/authService";
import { userPreferencesService } from "../services/userPreferencesService";
import { sessionService } from "../services/sessionService";
import { isNativeApp } from "../composables/useNativeApp";
import SiteFooter from "../components/SiteFooter.vue";
import AppIcon from "../components/icons/AppIcon.vue";
import IllustrationPartage from "../components/illustrations/IllustrationPartage.vue";
import IllustrationChiourim from "../components/illustrations/IllustrationChiourim.vue";
import IllustrationBibliotheque from "../components/illustrations/IllustrationBibliotheque.vue";

const router = useRouter();
const { t } = useI18n();

const user = ref<User | null>(null);
let unsubscribeAuth: (() => void) | null = null;

// --- Tableau de bord (connecté) : lecture du jour + sessions qui se terminent. ---
const dashLoading = ref(false);
const readingTotal = ref(0);
const readingDone = ref(0);
const activeSessionsCount = ref(0);
const endingSoon = ref<{ id: string; name: string; path: string; daysLeft: number }[]>([]);

const firstName = computed(() => (user.value?.name ?? "").split(" ")[0] || user.value?.name || "");
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? t("home.dashboard.helloEvening") : t("home.dashboard.hello");
});
const readingPct = computed(() =>
  readingTotal.value === 0 ? 0 : Math.round((readingDone.value / readingTotal.value) * 100),
);
const readingAllDone = computed(
  () => readingTotal.value > 0 && readingDone.value >= readingTotal.value,
);

/** Local calendar day (YYYY-MM-DD) — même convention que DailyReading. */
function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

async function loadDashboard(u: User) {
  dashLoading.value = true;
  try {
    const [prefs, sessions] = await Promise.all([
      userPreferencesService.getPreferences(u.id),
      sessionService.getAllSessions().catch(() => []),
    ]);

    readingTotal.value = (prefs.dailyReadingIds ?? []).length;
    const progress = prefs.dailyReadingProgress;
    readingDone.value =
      progress && progress.date === todayKey() ? progress.completedIds.length : 0;

    // Sessions où l'utilisateur est impliqué (créées ou avec une réservation).
    const mine = sessions.filter(
      (s) =>
        !s.isEnded &&
        (s.personId === u.id ||
          s.reservations?.some(
            (r) => r.chosenById === u.id || r.chosenByGuestId === u.email,
          )),
    );
    activeSessionsCount.value = mine.length;

    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    endingSoon.value = mine
      .map((s) => ({ s, msLeft: new Date(s.dateLimit).getTime() - now }))
      .filter((x) => x.msLeft > 0 && x.msLeft <= week)
      .sort((a, b) => a.msLeft - b.msLeft)
      .slice(0, 3)
      .map(({ s, msLeft }) => ({
        id: s.id,
        name: s.name,
        path: `/share-reading/session/${s.slug || s.id}`,
        daysLeft: Math.ceil(msLeft / (24 * 3600 * 1000)),
      }));
  } catch (error) {
    console.error("Erreur lors du chargement du tableau de bord:", error);
  } finally {
    dashLoading.value = false;
  }
}

const features = computed<
  { illustration: Component; title: string; description: string; route: string }[]
>(() => [
  {
    illustration: IllustrationPartage,
    title: t("home.features.shareReading.title"),
    description: t("home.features.shareReading.description"),
    route: "share-reading",
  },
  {
    illustration: IllustrationChiourim,
    title: t("home.features.chiourim.title"),
    description: t("home.features.chiourim.description"),
    route: "chiourim",
  },
  {
    illustration: IllustrationBibliotheque,
    title: t("home.features.study.title"),
    description: t("home.features.study.description"),
    route: "bibliotheque",
  },
]);

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((u) => {
    user.value = u;
    if (u) {
      loadDashboard(u);
    } else {
      readingTotal.value = 0;
      readingDone.value = 0;
      activeSessionsCount.value = 0;
      endingSoon.value = [];
    }
  });
  const url = window.location.origin + "/";
  seoService.setMeta({
    title: t("seo.homeTitle"),
    description: t("seo.homeDescription"),
    canonical: url,
    og: { url },
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center">
    <!-- ===== Connecté : accueil personnalisé, hors carte ===== -->
    <template v-if="user">
      <div class="w-full max-w-6xl mx-auto mb-8 enter-rise">
        <h2 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
          {{ greeting }},
          <span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{{
            firstName
          }}</span>
        </h2>
        <p class="text-text-secondary mt-1.5">{{ t("home.dashboard.subtitle") }}</p>
      </div>

      <div class="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-10">
        <!-- Squelettes pendant le chargement -->
        <template v-if="dashLoading">
          <div class="card p-6 h-36 animate-pulse"></div>
          <div class="card p-6 h-36 animate-pulse"></div>
        </template>

        <template v-else>
          <!-- Lecture quotidienne : où j'en suis aujourd'hui -->
          <RouterLink to="/profile" class="dash-card card card-hover p-6 block group">
            <div class="flex items-center justify-between gap-3 mb-4">
              <h3
                class="font-bold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
              >
                <AppIcon name="book" :size="17" class="text-primary" />
                {{ t("dailyReading.title") }}
              </h3>
              <AppIcon
                name="chevron-right"
                :size="15"
                class="text-text-secondary/50 rtl:rotate-180"
              />
            </div>

            <!-- Liste vide : inviter à la composer -->
            <p v-if="readingTotal === 0" class="text-sm text-text-secondary leading-relaxed">
              {{ t("home.dashboard.readingEmpty") }}
            </p>

            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium" :class="readingAllDone ? 'text-green-600 dark:text-green-400' : 'text-text-primary'">
                  <template v-if="readingAllDone">
                    {{ t("dailyReading.allReadTitle") }}
                  </template>
                  <template v-else>
                    {{ t("dailyReading.progress", { done: readingDone, total: readingTotal }) }}
                  </template>
                </span>
                <span class="text-sm font-semibold text-primary">{{ readingPct }}%</span>
              </div>
              <div class="h-2 w-full rounded-full bg-black/5 overflow-hidden dark:bg-white/10">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-500"
                  :style="{ width: `${readingPct}%` }"
                ></div>
              </div>
            </template>

            <p class="mt-4 text-sm font-medium text-primary flex items-center gap-1.5">
              {{ readingTotal === 0 ? t("home.dashboard.readingSetupCta") : t("home.dashboard.readingCta") }}
            </p>
          </RouterLink>

          <!-- Sessions : celles qui se terminent bientôt -->
          <div class="dash-card card p-6" style="--enter-delay: 0.1s">
            <h3 class="font-bold text-text-primary flex items-center gap-2.5 mb-4">
              <AppIcon name="calendar" :size="17" class="text-primary" />
              {{ t("home.dashboard.sessionsTitle") }}
            </h3>

            <!-- Des sessions se terminent cette semaine : les lister -->
            <ul v-if="endingSoon.length > 0" class="flex flex-col divide-y divide-line">
              <li v-for="session in endingSoon" :key="session.id">
                <RouterLink
                  :to="session.path"
                  class="flex items-center justify-between gap-3 py-2 text-sm group"
                >
                  <span class="min-w-0 truncate font-medium text-text-primary group-hover:text-primary transition-colors">
                    {{ session.name }}
                  </span>
                  <span
                    class="shrink-0 flex items-center gap-1.5"
                    :class="session.daysLeft <= 1 ? 'text-accent-secondary font-semibold' : 'text-text-secondary'"
                  >
                    <AppIcon name="hourglass" :size="13" />
                    {{
                      session.daysLeft <= 1
                        ? t("home.dashboard.endsToday")
                        : t("home.dashboard.endsInDays", { count: session.daysLeft })
                    }}
                  </span>
                </RouterLink>
              </li>
            </ul>

            <!-- Rien d'urgent -->
            <p v-else-if="activeSessionsCount > 0" class="text-sm text-text-secondary leading-relaxed">
              {{ t("home.dashboard.noEndingSoon", { count: activeSessionsCount }) }}
            </p>
            <p v-else class="text-sm text-text-secondary leading-relaxed">
              {{ t("home.dashboard.noSessions") }}
            </p>

            <RouterLink
              to="/share-reading"
              class="mt-4 text-sm font-medium text-primary flex items-center gap-1.5 hover:underline"
            >
              {{ t("home.dashboard.sessionsCta") }}
            </RouterLink>
          </div>
        </template>
      </div>
    </template>

    <!-- ===== Non connecté : hero de bienvenue, CTA hors carte ===== -->
    <div v-else class="text-center mb-10 space-y-4">
      <h2 class="text-3xl md:text-5xl font-bold text-text-primary tracking-tight enter-rise">
        {{ t("home.heroTitle") }}
      </h2>
      <p
        class="text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed enter-rise"
        style="--enter-delay: 0.1s"
      >
        {{ t("home.heroDescription") }}
      </p>
      <div
        class="flex flex-wrap items-center justify-center gap-3 pt-2 enter-rise"
        style="--enter-delay: 0.2s"
      >
        <RouterLink to="/login?mode=signup" class="btn btn-primary !px-7 !py-3">
          {{ t("accountCta.signup") }}
        </RouterLink>
        <RouterLink to="/login" class="btn btn-soft !px-7 !py-3">
          {{ t("accountCta.login") }}
        </RouterLink>
      </div>
    </div>

    <div class="w-full max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10 items-stretch">
        <button
          v-for="(feature, index) in features"
          :key="feature.title"
          class="feature-card card card-hover group flex items-center gap-5 p-6 text-left cursor-pointer"
          :style="{ '--enter-delay': `${index * 0.12}s` }"
          @click="router.push(feature.route)"
        >
          <!-- Texte à gauche, illustration à droite, tout reste dans la carte
               (une ligne par carte sur mobile, trois cartes côte à côte sur
               desktop). Au repos, seule la micro-animation interne du SVG vit ;
               au survol, c'est le dessin lui-même qui s'anime (aucun zoom). -->
          <div class="flex-1 min-w-0">
            <h3
              class="text-lg font-bold mb-1.5 text-text-primary group-hover:text-primary transition-colors"
            >
              {{ feature.title }}
            </h3>
            <p class="text-text-secondary text-sm leading-relaxed">
              {{ feature.description }}
            </p>
          </div>
          <div class="w-24 h-24 sm:w-28 sm:h-28 md:w-24 md:h-24 lg:w-28 lg:h-28 shrink-0 text-primary">
            <component :is="feature.illustration" />
          </div>
        </button>
      </div>

      <div class="text-center max-w-2xl mx-auto enter-rise" style="--enter-delay: 0.4s">
        <p class="font-serif italic text-text-secondary">{{ t("home.memorial.title") }}</p>
        <p class="mt-1 font-serif italic text-text-primary">
          {{ t("home.memorial.dedication") }}
        </p>
      </div>
    </div>
  </main>

  <!-- App native : pas de footer de site (l'essentiel vit dans le profil). -->
  <SiteFooter v-if="!isNativeApp" />
</template>

<style scoped>
/* Staggered entrance: cards, greeting/hero and memorial all rise into place. */
.feature-card,
.dash-card,
.enter-rise {
  opacity: 0;
  transform: translateY(14px);
  animation: card-enter 0.55s ease-out forwards;
  animation-delay: var(--enter-delay, 0s);
}

@keyframes card-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feature-card,
  .dash-card,
  .enter-rise {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
