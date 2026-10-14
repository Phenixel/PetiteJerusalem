<script setup lang="ts">
import { useRouter } from "vue-router";
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../i18n";
import { seoService } from "../services/seoService";
import { SITE_URL } from "../config/site";
import { localeOfPath, sectionPath } from "../content/seoLocales";
import { analyticsService } from "../services/analyticsService";
import { authService, type User } from "../services/authService";
import { isNativeApp } from "../composables/useNativeApp";
import { useHomeAccountCta } from "../composables/useHomeAccountCta";
import { openFeedback } from "../composables/useFeedback";
import SiteFooter from "../components/SiteFooter.vue";
import AppIcon from "../components/icons/AppIcon.vue";
import FeedbackNudge from "../components/FeedbackNudge.vue";
import FeatureTour, { type TourStep } from "../components/FeatureTour.vue";
import { tipsOffered } from "../composables/useFeatureTips";
import HomeDoors from "../components/HomeDoors.vue";
import HomeResume from "../components/HomeResume.vue";
import { useHomeLayout } from "../composables/useHomeLayout";
import { useLongPress } from "../composables/useLongPress";
import HolidayGreeting from "../components/holiday/HolidayGreeting.vue";

// Chargée à la demande : la carte tire le moteur de calcul des horaires
// (@hebcal/core), qui pèse plus lourd que tout le bundle initial réuni. Elle
// apparaît juste après le rendu de l'accueil, sans le retarder.
const ZmanimCard = defineAsyncComponent(() => import("../components/ZmanimCard.vue"));
const BirkatHalevanaBanner = defineAsyncComponent(
  () => import("../components/BirkatHalevanaBanner.vue"),
);
const OmerBanner = defineAsyncComponent(() => import("../components/OmerBanner.vue"));
// Les dates qu'on a inscrites au calendrier, la semaine où elles arrivent.
// Même moteur de calendrier hébraïque, même chargement à la demande.
const OccasionsBanner = defineAsyncComponent(() => import("../components/OccasionsBanner.vue"));
// Le raccourci du sidour : pendant la plage horaire d'un office, l'accueil
// mène au texte. Même moteur d'horaires, même chargement à la demande.
const SidourNowCard = defineAsyncComponent(() => import("../components/SidourNowCard.vue"));
// Les informations de l'équipe : un incident en cours ou une nouveauté pas
// encore vue. Elles tirent Firestore, d'où le chargement à la demande.
const AnnouncementsBanner = defineAsyncComponent(
  () => import("../components/announcements/AnnouncementsBanner.vue"),
);
// Mon parcours : le paquet du jour, la lampe et l'étagère. Ils tirent le
// calendrier hébraïque (les jours de repos), même chargement à la demande.
const ParcoursHub = defineAsyncComponent(
  () => import("../components/parcours/home/ParcoursHub.vue"),
);
const HomeLamp = defineAsyncComponent(() => import("../components/parcours/home/HomeLamp.vue"));
const HomeShelf = defineAsyncComponent(() => import("../components/parcours/home/HomeShelf.vue"));
const HomeHebrewDate = defineAsyncComponent(
  () => import("../components/parcours/home/HomeHebrewDate.vue"),
);

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

/**
 * L'astuce de l'accueil (voir FeatureTour), juste après l'introduction : où
 * l'app se règle à son goût (l'onglet en bas à droite : thème, police, mode
 * sombre), et le compte, à quoi il sert, et qu'il n'est pas obligatoire. Le
 * second pas éclaire le bouton « Créer un compte » quand l'accueil le porte
 * encore ; sinon, la bulle se pose au milieu. Il n'est pas proposé à qui a
 * déjà un compte.
 */
const homeRoot = ref<HTMLElement | null>(null);

const homeTip = computed<TourStep[]>(() => {
  const steps: TourStep[] = [
    {
      key: "settings",
      icon: "settings",
      title: t("tips.home.settings.title"),
      text: t("tips.home.settings.text"),
      target: () => document.querySelector<HTMLElement>('nav a[href^="/profile"]'),
      radius: 14,
      padding: 2,
    },
  ];
  if (!user.value) {
    const signup = () =>
      homeRoot.value?.querySelector<HTMLElement>('a[href="/login?mode=signup"]') ?? null;
    steps.push({
      key: "account",
      icon: "user",
      title: t("tips.home.account.title"),
      text: t("tips.home.account.text"),
      target: signup() ? signup : undefined,
      radius: 9999,
    });
  }
  return steps;
});

function dismissAccountCta() {
  dismissHomeAccountCta();
  analyticsService.capture("home_signup_cta_dismissed");
}

// --- Tableau de bord : Mon parcours et les horaires du jour. Dans l'app, avec
// ou sans compte (le parcours se tient sur le téléphone) ; sur le site, pour
// un compte, le visiteur a la page d'accueil du site. ---
const dashboard = computed(() => user.value !== null || isNativeApp);

/** Le paquet porte les offices du jour : le raccourci du Sidour se tait. */
const officesInDeck = ref(false);
/** Le parcours a commencé : la lune et le 'Omer sont des cartes de la pile. */
const parcoursBegun = ref(false);

/** L'ordre des blocs sous le paquet, et ceux qu'on a masqués (useHomeLayout). */
const { layout: homeLayout } = useHomeLayout();

// Un appui long sur un bloc (au doigt) ouvre le réglage de l'accueil. Le
// paquet a le sien (la fiche de la carte), et la barre de la journée s'y
// touche : ils n'en sont pas.
const editPress = useLongPress(
  (target) => !target.closest(".dk, .day-bar, .deck-more, input"),
  () => void router.push("/accueil/modifier"),
);

const firstName = computed(
  () => (user.value?.name ?? "").split(" ")[0] || user.value?.name || t("common.anonymousUser"),
);
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? t("home.dashboard.helloEvening") : t("home.dashboard.hello");
});

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
  });
  applyHomeMeta();
});

watch([locale, localeMessagesReady, () => route.path], applyHomeMeta);

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main ref="homeRoot" class="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center">
    <!-- Le temps d'une fête : ses ornements et un souhait, en tête de page,
         connecté ou non (voir HolidayGreeting). Rien le reste de l'année. -->
    <HolidayGreeting class="mb-6 md:mb-8" />

    <!-- ===== Tableau de bord : connecté, ou dans l'app avec ou sans compte ===== -->
    <template v-if="dashboard">
      <!-- La salutation et la date hébraïque, la lampe du parcours à côté
           (P2-Accueil) : la flamme est un objet, pas une icône. -->
      <div class="w-full max-w-6xl mx-auto enter-rise">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 pt-1">
            <h1
              class="text-[30px] leading-[1.15] md:text-5xl font-bold text-text-primary tracking-tight"
            >
              <template v-if="user">
                {{ greeting }},
                <span class="text-primary">{{ firstName }}</span>
              </template>
              <template v-else>{{ greeting }}</template>
            </h1>
            <HomeHebrewDate class="mt-1.5 min-h-5 text-sm text-text-secondary" />
          </div>
          <HomeLamp class="flex-none" />
        </div>
        <!-- App sans compte : tout marche sur le téléphone ; le compte, pour
             le garder d'un appareil à l'autre, se propose jusqu'à ce
             qu'« Ignorer » le retire de l'accueil. -->
        <div
          v-if="!user && !accountCtaDismissed"
          class="mt-3 flex flex-wrap items-center gap-2 enter-rise"
          style="--enter-delay: 0.1s"
        >
          <RouterLink
            to="/login?mode=signup"
            class="btn btn-primary"
            @click="trackCard('signup_cta')"
          >
            {{ t("accountCta.signup") }}
          </RouterLink>
          <RouterLink to="/login" class="btn btn-soft" @click="trackCard('login_cta')">
            {{ t("accountCta.login") }}
          </RouterLink>
          <button
            type="button"
            class="px-2 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            @click="dismissAccountCta"
          >
            {{ t("accountCta.dismiss") }}
          </button>
        </div>
        <!-- Un mot de l'équipe : un incident en cours, une nouveauté pas
             encore lue. En tête, parce qu'un incident explique peut-être ce
             qui ne marche pas plus bas. -->
        <AnnouncementsBanner class="mt-4" />
      </div>

      <!-- Le paquet du jour, toujours en tête ; dessous, les blocs dans l'ordre
           qu'on leur a donné (P2-AccueilModifier). Un appui long sur un bloc,
           ou « Modifier l'accueil » en bas, ouvre leur réglage. Un bloc qui
           n'a rien à dire s'efface de lui-même. -->
      <div
        class="home-blocks w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 md:items-start gap-[26px] md:gap-6"
        v-bind="editPress"
      >
        <!-- Mon parcours : le paquet du jour, sa barre, le portefeuille. -->
        <ParcoursHub
          class="dash-card"
          @offices="(covered) => (officesInDeck = covered)"
          @begun="(begun) => (parcoursBegun = begun)"
        />

        <template v-for="block in homeLayout.order" :key="block">
          <div v-if="block === 'horaires'" class="flex flex-col gap-3">
            <!-- Horaires du jour : calculés sur l'appareil, rien à charger. -->
            <ZmanimCard
              class="dash-card"
              style="--enter-delay: 0.1s"
              place-first
              @click="trackCard('zmanim')"
            />

            <!-- C'est le temps d'une prière : le sidour à un geste, avec l'heure
                 limite. Absent entre deux offices, et quand le paquet du
                 parcours porte déjà les offices. -->
            <SidourNowCard v-if="!officesInDeck" />

            <!-- La bénédiction de la lune : une fenêtre de quelques nuits par
                 mois, qui se rate faute de rappel. Absente le reste du temps,
                 et quand le parcours a commencé : sa carte est dans la pile,
                 avec celle du 'Omer. -->
            <template v-if="!parcoursBegun">
              <BirkatHalevanaBanner />
              <OmerBanner />
            </template>
          </div>

          <!-- L'étagère du parcours : un volume par objectif qui se lit. -->
          <HomeShelf v-else-if="block === 'volumes'" class="md:col-span-2" />

          <!-- Les trois portes du site. -->
          <HomeDoors v-else-if="block === 'portes'" class="md:col-span-2" @open="trackCard" />

          <!-- Reprendre la dernière lecture, au verset près. -->
          <HomeResume v-else-if="block === 'reprendre'" @open="trackCard('resume')" />

          <!-- Ce qu'on a inscrit soi-même au calendrier : un anniversaire, un
               leilouy nichmat. Absent le reste de l'année. -->
          <OccasionsBanner v-else-if="block === 'dates'" />
        </template>
      </div>

      <p class="mt-[22px] mb-10 text-center">
        <RouterLink
          to="/accueil/modifier"
          class="text-[13px] font-semibold text-text-secondary underline underline-offset-4"
        >
          {{ t("home.edit.link") }}
        </RouterLink>
      </p>
    </template>

    <!-- ===== Site, sans compte : invitation à gauche, horaires du jour à
         droite, à la place qu'occupent les cartes du tableau de bord ===== -->
    <div
      v-else
      class="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-center mb-10"
    >
      <div class="space-y-4 text-center md:text-start">
        <h1
          class="text-4xl md:text-6xl font-bold text-text-primary tracking-tight leading-[1.05] enter-rise"
        >
          {{ t("home.heroTitle") }}
        </h1>
        <p
          class="text-lg md:text-xl text-text-secondary leading-relaxed enter-rise"
          style="--enter-delay: 0.1s"
        >
          {{ t("home.heroDescription") }}
        </p>
        <!-- Créer un compte : proposé jusqu'à ce qu'« Ignorer » le retire de
             l'accueil. Le reste du site continue de le proposer, au moment où
             le compte sert à quelque chose. -->
        <div
          v-if="!accountCtaDismissed"
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
          <button
            type="button"
            class="px-2 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            @click="dismissAccountCta"
          >
            {{ t("accountCta.dismiss") }}
          </button>
        </div>
      </div>

      <!-- Les horaires du jour et, dessous, les raccourcis du moment : la
           colonne de droite porte tout ce qui dépend de l'heure qu'il est,
           l'accroche garde la gauche. -->
      <div class="flex flex-col gap-4">
        <AnnouncementsBanner />
        <ZmanimCard class="dash-card" style="--enter-delay: 0.3s" @click="trackCard('zmanim')" />
        <SidourNowCard />
        <BirkatHalevanaBanner />
        <OmerBanner />
        <OccasionsBanner />
      </div>
    </div>

    <div class="w-full max-w-6xl mx-auto">
      <!-- Les trois portes du site (HomeDoors). Sur le tableau de bord, elles
           sont un bloc qu'on range ou qu'on masque, avec les autres. -->
      <HomeDoors v-if="!dashboard" class="mb-10" @open="trackCard" />

      <div class="text-center max-w-2xl mx-auto enter-rise" style="--enter-delay: 0.4s">
        <p class="font-serif italic text-text-secondary">{{ t("home.memorial.title") }}</p>
        <p class="mt-1 font-serif italic text-text-primary">
          {{ t("home.memorial.dedication") }}
        </p>
      </div>

      <!-- Les informations de l'équipe, toutes, à un lien : l'accueil ne les
           met en avant que quand il y a du nouveau (AnnouncementsBanner). -->
      <p class="mt-10 text-center text-sm enter-rise" style="--enter-delay: 0.45s">
        <RouterLink
          to="/informations"
          class="inline-flex items-center gap-1.5 font-medium text-text-primary underline decoration-line underline-offset-4 hover:text-primary transition-colors"
          @click="trackCard('announcements')"
        >
          <AppIcon name="bell" :size="14" />
          {{ t("announcements.homeLink") }}
        </RouterLink>
      </p>

      <!-- Le formulaire de support, tout en bas : discret (une ligne en
           petit, gris) mais visible, là où l'on arrive après avoir tout vu. -->
      <p
        class="mt-4 text-center text-sm text-text-secondary enter-rise"
        style="--enter-delay: 0.5s"
      >
        {{ t("feedback.homePrompt") }}
        <button
          type="button"
          class="font-medium text-text-primary underline decoration-line underline-offset-4 hover:text-primary transition-colors"
          @click="openFeedback()"
        >
          {{ t("feedback.homeLink") }}
        </button>
      </p>
    </div>

    <!-- L'astuce de l'accueil, une fois : les réglages, puis le compte (homeTip). -->
    <FeatureTour v-if="tipsOffered" tip="home-settings" :steps="homeTip" />
  </main>

  <!-- App native : pas de footer de site (l'essentiel vit dans le profil). -->
  <SiteFooter v-if="!isNativeApp" />

  <!-- « Tout se passe bien ? » : la relance du formulaire de support, sur
       l'accueil seulement (jamais pendant une lecture), après quelques jours
       d'usage, et seulement quand rien d'autre ne réclame l'attention. -->
  <FeedbackNudge />
</template>

<style scoped>
/* Staggered entrance: cards, greeting/hero and memorial all rise into place. */
/* L'appui long ouvre le réglage de l'accueil : pas l'aperçu du lien que le
   système proposerait. */
.home-blocks {
  -webkit-touch-callout: none;
}
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
  .dash-card,
  .enter-rise {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
