<script setup lang="ts">
import { useRouter } from "vue-router";
import {
  onMounted,
  onUnmounted,
  ref,
  computed,
  defineAsyncComponent,
  watch,
  type Component,
} from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../i18n";
import { seoService } from "../services/seoService";
import { SITE_URL } from "../config/site";
import { localeOfPath, sectionPath } from "../content/seoLocales";
import { localDayKey } from "../services/dateService";
import { analyticsService } from "../services/analyticsService";
import { authService, type User } from "../services/authService";
import {
  countDailyProgress,
  userPreferencesService,
  type UserPreferences,
} from "../services/userPreferencesService";
import { isNativeApp } from "../composables/useNativeApp";
import { useHomeAccountCta } from "../composables/useHomeAccountCta";
import SiteFooter from "../components/SiteFooter.vue";
import DailyReadingCard from "../components/DailyReadingCard.vue";
import AppIcon from "../components/icons/AppIcon.vue";
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
const OmerBanner = defineAsyncComponent(() => import("../components/OmerBanner.vue"));
// Le raccourci du sidour : pendant la plage horaire d'un office, l'accueil
// mène au texte. Même moteur d'horaires, même chargement à la demande.
const SidourNowCard = defineAsyncComponent(() => import("../components/SidourNowCard.vue"));

const router = useRouter();
const { t, locale } = useI18n();
const route = useRoute();

/**
 * Le titre et le canonique de l'accueil.
 *
 * L'accueil existe à trois adresses (/, /en, /he) : le canonique est celui de
 * celle qui est ouverte, sur le domaine du site et non sur l'origine courante
 * (qui vaut localhost en préversion). Rejoué quand la langue change : les
 * messages en et he arrivent par import dynamique, parfois après le montage.
 */
function applyHomeMeta(): void {
  const url = `${SITE_URL}${sectionPath("home", localeOfPath(route.path))}`;
  seoService.setMeta({
    title: t("seo.homeTitle"),
    description: t("seo.homeDescription"),
    canonical: url,
    og: { url },
  });
}

const user = ref<User | null>(null);
let unsubscribeAuth: (() => void) | null = null;

// L'invitation à créer un compte : l'accueil la propose une fois, puis plus du
// tout (voir useHomeAccountCta). Elle reste entière ailleurs.
const { dismissed: accountCtaDismissed, dismissHomeAccountCta } = useHomeAccountCta();

function dismissAccountCta() {
  dismissHomeAccountCta();
  analyticsService.capture("home_signup_cta_dismissed");
}

// --- Tableau de bord (connecté) : lecture du jour et horaires du jour. ---
const dashLoading = ref(false);
const readingTotal = ref(0);
const readingDone = ref(0);

const firstName = computed(() => (user.value?.name ?? "").split(" ")[0] || user.value?.name || "");
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? t("home.dashboard.helloEvening") : t("home.dashboard.hello");
});

// Même règle de comptage que la page Lecture quotidienne (chnei mikra
// hebdomadaire exclu, complétions intersectées avec les listes actives).
function applyDashboardCounts(prefs: UserPreferences) {
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
}

async function loadDashboard(u: User) {
  // Copie locale d'abord : les compteurs du jour s'affichent tout de suite,
  // sans squelette, et la lecture Firestore confirme ou corrige ensuite.
  const cached = userPreferencesService.getCachedPreferences(u.id);
  if (cached) applyDashboardCounts(cached);
  dashLoading.value = !cached;
  try {
    applyDashboardCounts(await userPreferencesService.getPreferences(u.id));
  } catch (error) {
    console.error("Erreur lors du chargement du tableau de bord:", error);
  } finally {
    dashLoading.value = false;
  }
}

// Les trois rubriques, chacune sur sa tuile : la bibliothèque en premier,
// c'est ce qu'on vient faire le plus souvent, dans la couleur dominante ;
// le partage à l'encre ; les chiourim dans la couleur qui répond.
const features = computed<
  { illustration: Component; title: string; description: string; route: string; tile: string }[]
>(() => [
  {
    illustration: IllustrationBibliotheque,
    title: t("home.features.study.title"),
    description: t("home.features.study.description"),
    route: "bibliotheque",
    tile: "bg-primary",
  },
  {
    illustration: IllustrationPartage,
    title: t("home.features.shareReading.title"),
    description: t("home.features.shareReading.description"),
    route: "share-reading",
    tile: "tile-ink",
  },
  {
    illustration: IllustrationChiourim,
    title: t("home.features.chiourim.title"),
    description: t("home.features.chiourim.description"),
    route: "chiourim",
    tile: "bg-tertiary",
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
  applyHomeMeta();
});

watch([locale, localeMessagesReady, () => route.path], applyHomeMeta);

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="flex-1 container mx-auto px-4 py-6 md:py-10 flex flex-col justify-center">
    <!-- ===== Connecté : accueil personnalisé, hors carte ===== -->
    <template v-if="user">
      <div class="w-full max-w-6xl mx-auto mb-8">
        <h2 class="text-4xl md:text-5xl text-text-primary">
          {{ greeting }}, <span class="hl">{{ firstName }}</span>
        </h2>
        <p class="text-text-secondary mt-3 text-lg">{{ t("home.dashboard.subtitle") }}</p>
      </div>

      <!-- C'est le temps d'une prière : le sidour à un geste, avec l'heure
           limite. Absent entre deux offices. -->
      <SidourNowCard class="w-full max-w-6xl mx-auto mb-5" />

      <!-- La bénédiction de la lune : une fenêtre de quelques nuits par mois,
           qui se rate faute de rappel. Absente le reste du temps. -->
      <BirkatHalevanaBanner class="w-full max-w-6xl mx-auto" />
      <OmerBanner class="w-full max-w-6xl mx-auto" />

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
            @click="trackCard('daily_reading')"
          />

          <!-- Horaires du jour : calculés sur l'appareil, rien à charger.
               Le partage de lectures reste à un clic (navbar, footer, tuiles
               plus bas). -->
          <ZmanimCard @click="trackCard('zmanim')" />
        </template>
      </div>
    </template>

    <!-- ===== Non connecté : le titre et l'action à gauche, la tuile du jour
         à droite. Le texte reste à gauche sur téléphone aussi : une page se
         lit, elle ne se centre pas. ===== -->
    <div
      v-else
      class="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[7fr_5fr] gap-8 md:gap-12 items-center mb-10 md:mb-14"
    >
      <div class="space-y-5">
        <i18n-t
          keypath="home.heroTitleHl"
          tag="h2"
          class="text-[2.6rem] md:text-6xl text-text-primary max-w-2xl"
        >
          <template #hl>
            <mark class="hl">{{ t("home.heroTitleHlWord") }}</mark>
          </template>
        </i18n-t>
        <p class="text-lg md:text-xl text-text-secondary leading-relaxed max-w-xl">
          {{ t("home.heroDescription") }}
        </p>
        <!-- L'action première est de lire : la bibliothèque s'ouvre sans
             compte. Créer un compte vient en second, jusqu'à ce qu'« Ignorer »
             le retire de l'accueil ; le reste du site continue de le proposer
             au moment où le compte sert à quelque chose. -->
        <div class="flex flex-wrap items-center gap-3 pt-1">
          <RouterLink
            to="/bibliotheque"
            class="btn btn-ink !px-6 !py-3 !text-base"
            @click="trackCard('hero_library')"
          >
            <AppIcon name="book-open" :size="18" />
            {{ t("home.heroCta") }}
          </RouterLink>
          <RouterLink
            v-if="!accountCtaDismissed"
            to="/login?mode=signup"
            class="btn btn-soft !px-6 !py-3 !text-base"
            @click="trackCard('signup_cta')"
          >
            {{ t("accountCta.signup") }}
          </RouterLink>
          <button
            v-if="!accountCtaDismissed"
            type="button"
            class="px-2 py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-primary"
            @click="dismissAccountCta"
          >
            {{ t("accountCta.dismiss") }}
          </button>
        </div>
      </div>

      <ZmanimCard @click="trackCard('zmanim')" />
    </div>

    <SidourNowCard v-if="!user" class="w-full max-w-6xl mx-auto mb-5" />

    <BirkatHalevanaBanner v-if="!user" class="w-full max-w-6xl mx-auto" />
    <OmerBanner v-if="!user" class="w-full max-w-6xl mx-auto" />

    <div class="w-full max-w-6xl mx-auto">
      <!-- Les trois rubriques, en tuiles de couleur : trois arches côte à
           côte sur grand écran, trois bandeaux empilés sur téléphone.
           L'illustration est dessinée en clair sur l'aplat, son accent au
           soleil ; au survol, c'est le dessin lui-même qui s'anime. -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12">
        <button
          v-for="feature in features"
          :key="feature.title"
          class="feature-card tile card-hover md:arch group flex md:flex-col items-center gap-5 md:gap-2 p-5 md:px-6 md:pt-10 md:pb-7 text-left md:text-center cursor-pointer"
          :class="feature.tile"
          @click="
            trackCard(`feature_${feature.route}`);
            router.push(feature.route);
          "
        >
          <div class="w-20 h-20 md:w-28 md:h-28 md:mb-4 shrink-0 order-last md:order-first">
            <component :is="feature.illustration" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-2xl md:text-3xl mb-1.5">
              {{ feature.title }}
            </h3>
            <p class="text-sm md:text-base leading-relaxed opacity-80">
              {{ feature.description }}
            </p>
          </div>
        </button>
      </div>

      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-text-secondary">{{ t("home.memorial.title") }}</p>
        <p class="mt-1 text-text-primary">
          {{ t("home.memorial.dedication") }}
        </p>
      </div>
    </div>
  </main>

  <!-- App native : pas de footer de site (l'essentiel vit dans le profil). -->
  <SiteFooter v-if="!isNativeApp" />
</template>
