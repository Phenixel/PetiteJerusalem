<script setup lang="ts">
import { useRouter } from "vue-router";
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { seoService } from "../services/seoService";
import { localDayKey } from "../services/dateService";
import { analyticsService } from "../services/analyticsService";
import { authService, type User } from "../services/authService";
import { countDailyProgress, userPreferencesService } from "../services/userPreferencesService";
import { readingProgressService, type ReadingPosition } from "../services/readingProgressService";
import { isNativeApp } from "../composables/useNativeApp";
import SiteFooter from "../components/SiteFooter.vue";
import AppIcon from "../components/icons/AppIcon.vue";
import DailyReadingCard from "../components/DailyReadingCard.vue";
import IllustrationPartage from "../components/illustrations/IllustrationPartage.vue";
import IllustrationChiourim from "../components/illustrations/IllustrationChiourim.vue";
import IllustrationBibliotheque from "../components/illustrations/IllustrationBibliotheque.vue";

// Chargée à la demande : la carte tire le moteur de calcul des horaires
// (@hebcal/core), qui pèse plus lourd que tout le bundle initial réuni. Elle
// apparaît juste après le rendu de l'accueil, sans le retarder.
const ZmanimCard = defineAsyncComponent(() => import("../components/ZmanimCard.vue"));
const BirkatHalevanaBanner = defineAsyncComponent(
  () => import("../components/BirkatHalevanaBanner.vue"),
);

const router = useRouter();
const { t } = useI18n();

const user = ref<User | null>(null);
let unsubscribeAuth: (() => void) | null = null;

// --- Tableau de bord (connecté) : lecture du jour et horaires du jour. ---
const dashLoading = ref(false);
const readingTotal = ref(0);
const readingDone = ref(0);

const firstName = computed(() => (user.value?.name ?? "").split(" ")[0] || user.value?.name || "");
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? t("home.dashboard.helloEvening") : t("home.dashboard.hello");
});

// Dernière position de lecture (bibliothèque) : le vrai « Reprendre ma lecture ».
const lastReading = ref<ReadingPosition | null>(null);
const resumeLink = computed(() =>
  lastReading.value
    ? { path: lastReading.value.path, query: { verset: String(lastReading.value.line) } }
    : null,
);

function trackResume() {
  if (!lastReading.value) return;
  analyticsService.capture("reading_resumed", {
    text_id: lastReading.value.textId,
    source: "home",
  });
}

// Lecture terminée (ou abandonnée) : la croix retire la position pour ne plus
// la proposer. S'il reste une lecture récente, elle prend le relais.
function dismissResume() {
  const current = lastReading.value;
  if (!current) return;
  readingProgressService.clearPosition(current.textId);
  lastReading.value = readingProgressService.getLastPosition();
  analyticsService.capture("reading_resume_dismissed", {
    text_id: current.textId,
    source: "home",
  });
}

async function loadDashboard(u: User) {
  dashLoading.value = true;
  try {
    const prefs = await userPreferencesService.getPreferences(u.id);

    // Même règle de comptage que la page Lecture quotidienne (chnei mikra
    // hebdomadaire exclu, complétions intersectées avec les listes actives).
    const progress = prefs.dailyReadingProgress;
    const isToday = progress?.date === localDayKey();
    const counts = countDailyProgress({
      textIds: prefs.dailyReadingIds ?? [],
      options: prefs.dailyReadingOptions ?? [],
      completedTextIds: isToday ? (progress.completedIds ?? []) : [],
      completedOptions: isToday ? (progress.completedOptions ?? []) : [],
    });
    readingTotal.value = counts.total;
    readingDone.value = counts.done;
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

// Ce que voit un visiteur qui (re)vient : la landing anonyme ou le tableau de
// bord connecté. Une seule capture, au premier état d'auth connu.
let hasTrackedHomeView = false;

/** Clic sur un bloc de l'accueil : dit ce que les gens viennent y chercher. */
const trackCard = (card: string) => {
  analyticsService.capture("home_card_clicked", {
    card,
    variant: user.value ? "dashboard" : "landing",
  });
};

onMounted(() => {
  // Position locale tout de suite, affinée quand la synchro du compte aboutit.
  lastReading.value = readingProgressService.getLastPosition();
  void readingProgressService.ensureSynced().then(() => {
    lastReading.value = readingProgressService.getLastPosition();
  });
  unsubscribeAuth = authService.onAuthChanged((u) => {
    user.value = u;
    if (!hasTrackedHomeView) {
      hasTrackedHomeView = true;
      analyticsService.capture("home_viewed", { variant: u ? "dashboard" : "landing" });
    }
    if (u) {
      loadDashboard(u);
    } else {
      readingTotal.value = 0;
      readingDone.value = 0;
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

      <!-- Reprendre la dernière lecture de la bibliothèque, au verset près -->
      <RouterLink
        v-if="lastReading && resumeLink"
        :to="resumeLink"
        class="dash-card card card-hover w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3 mb-5 group"
        @click="trackResume()"
      >
        <span class="flex items-center gap-2.5 min-w-0">
          <AppIcon name="book-open" :size="17" class="text-primary flex-shrink-0" />
          <span
            class="font-medium text-text-primary truncate group-hover:text-primary transition-colors"
          >
            {{ t("home.dashboard.resumeCta", { label: lastReading.label }) }}
          </span>
        </span>
        <span class="flex items-center gap-1 flex-shrink-0">
          <AppIcon name="chevron-right" :size="15" class="text-text-secondary/50 rtl:rotate-180" />
          <button
            @click.prevent.stop="dismissResume"
            class="p-1.5 -m-0.5 rounded-full text-text-secondary/60 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            :title="t('home.dashboard.resumeDismiss')"
            :aria-label="t('home.dashboard.resumeDismiss')"
          >
            <AppIcon name="x" :size="14" />
          </button>
        </span>
      </RouterLink>

      <!-- La bénédiction de la lune : une fenêtre de quelques nuits par mois,
           qui se rate faute de rappel. Absente le reste du temps. -->
      <BirkatHalevanaBanner class="w-full max-w-6xl mx-auto" />

      <div class="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-10">
        <!-- Squelettes pendant le chargement -->
        <template v-if="dashLoading">
          <div class="card p-6 h-36 animate-pulse"></div>
          <div class="card p-6 h-36 animate-pulse"></div>
        </template>

        <template v-else>
          <!-- Lecture quotidienne : où j'en suis aujourd'hui (carte partagée
               avec la bibliothèque) -->
          <DailyReadingCard
            :done="readingDone"
            :total="readingTotal"
            class="dash-card"
            @click="trackCard('daily_reading')"
          />

          <!-- Horaires du jour : calculés sur l'appareil, rien à charger.
               Le partage de lectures reste à un clic (navbar, footer, cartes
               de découverte plus bas). -->
          <ZmanimCard class="dash-card" style="--enter-delay: 0.1s" @click="trackCard('zmanim')" />
        </template>
      </div>
    </template>

    <!-- ===== Non connecté : invitation à gauche, horaires du jour à droite,
         à la place qu'occupent les cartes du tableau de bord ===== -->
    <div
      v-else
      class="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-center mb-10"
    >
      <div class="space-y-4 text-center md:text-start">
        <h2 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight enter-rise">
          {{ t("home.heroTitle") }}
        </h2>
        <p
          class="text-base md:text-lg text-text-secondary leading-relaxed enter-rise"
          style="--enter-delay: 0.1s"
        >
          {{ t("home.heroDescription") }}
        </p>
        <div
          class="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 enter-rise"
          style="--enter-delay: 0.2s"
        >
          <RouterLink
            to="/login?mode=signup"
            class="btn btn-primary !px-7 !py-3"
            @click="trackCard('signup_cta')"
          >
            {{ t("accountCta.signup") }}
          </RouterLink>
          <RouterLink to="/login" class="btn btn-soft !px-7 !py-3" @click="trackCard('login_cta')">
            {{ t("accountCta.login") }}
          </RouterLink>
        </div>
      </div>

      <ZmanimCard class="dash-card" style="--enter-delay: 0.3s" @click="trackCard('zmanim')" />
    </div>

    <BirkatHalevanaBanner v-if="!user" class="w-full max-w-6xl mx-auto" />

    <div class="w-full max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10 items-stretch">
        <button
          v-for="(feature, index) in features"
          :key="feature.title"
          class="feature-card card card-hover group flex items-center gap-5 p-6 text-left cursor-pointer"
          :style="{ '--enter-delay': `${index * 0.12}s` }"
          @click="
            trackCard(`feature_${feature.route}`);
            router.push(feature.route);
          "
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
          <div
            class="w-24 h-24 sm:w-28 sm:h-28 md:w-24 md:h-24 lg:w-28 lg:h-28 shrink-0 text-primary"
          >
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
