<script setup lang="ts">
import { useRouter } from "vue-router";
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent, watch, nextTick } from "vue";
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
import FeedbackNudge from "../components/FeedbackNudge.vue";
import FeatureTour, { type TourStep } from "../components/FeatureTour.vue";
import { tipsOffered } from "../composables/useFeatureTips";
import { useParcoursTours } from "../composables/useParcoursTours";
import HomeDoors from "../components/HomeDoors.vue";
import HomeResume from "../components/HomeResume.vue";
import { HOME_BLOCKS, useHomeLayout, type HomeBlock } from "../composables/useHomeLayout";
import { useHomeArrange } from "../composables/useHomeArrange";
import type { PinnedBook } from "../content/pinnedBooks";
import { haptic } from "../services/haptics";
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
// The books pinned to the home page, and how they are chosen: they read the
// catalog of texts, loaded on demand.
const HomePinnedBooks = defineAsyncComponent(() => import("../components/HomePinnedBooks.vue"));
const HomePinnedEditor = defineAsyncComponent(() => import("../components/HomePinnedEditor.vue"));
// The audio courses to resume: they read the catalog of courses (Firestore).
const HomeListeningResume = defineAsyncComponent(
  () => import("../components/chiourim/HomeListeningResume.vue"),
);
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

/** Le tutoriel de Mon parcours, sur l'accueil : la pile, la journée, la lumière, l'étagère. */
const parcoursTours = useParcoursTours();

const homeTip = computed<TourStep[]>(() => {
  const steps: TourStep[] = [
    {
      key: "settings",
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

/**
 * The parcours has begun: the service whose time it is, the moon and the
 * 'Omer are cards of the stack, and their shortcuts on the home page fall
 * silent.
 */
const parcoursBegun = ref(false);

/** The order of the blocks under the deck, and the hidden ones (useHomeLayout). */
const home = useHomeLayout();
const homeLayout = home.layout;

/**
 * The home page in edit mode (P2-AccueilModifier), on the page itself: the
 * blocks wobble and are dragged where they belong (useHomeArrange), each
 * with its « Masquer » pill; the hidden ones stay in view, faded, at the
 * end, with « Afficher ». A block with nothing to show for now keeps its
 * place under its name. « Terminé » (or Escape) leaves it.
 */
const editing = ref(false);
const blocksRoot = ref<HTMLElement | null>(null);
const savedOrder = computed(() => homeLayout.value.order);

// A long press with a finger on a block opens edit mode. The deck has its
// own (the card's sheet), so does a volume of the shelf (its page), and the
// day bar is touched: they are left out.
const arrange = useHomeArrange({
  root: blocksRoot,
  editing,
  order: savedOrder,
  accept: (target) => !target.closest(".dk, .day-bar, .deck-more, .shelf-cell, input"),
  onEnter: () => (editing.value = true),
  onDrop: (block, to) => {
    home.move(block, to);
    analyticsService.capture("home_block_moved", { block, to });
  },
});

const hiddenBlocks = computed(() => HOME_BLOCKS.filter((b) => homeLayout.value.hidden.includes(b)));
/** The tiles on the page: in edit mode, the hidden ones follow, faded. */
const tiles = computed<HomeBlock[]>(() => {
  const order = arrange.preview.value ?? savedOrder.value;
  return editing.value ? [...order, ...hiddenBlocks.value] : order;
});
const isHidden = (block: HomeBlock): boolean => homeLayout.value.hidden.includes(block);
/**
 * The books pinned to the home page (useHomePinned), chosen in edit mode
 * under their block (HomePinnedEditor). Pinning a book shows the block if
 * it was hidden.
 */
function onBookPinned(book: PinnedBook | "prayers"): void {
  haptic("tick");
  if (isHidden("livres")) void arrange.animate(() => home.show("livres"));
  analyticsService.capture(
    "home_book_pinned",
    book === "prayers"
      ? { kind: "prayers", corpus: "sidour" }
      : { kind: book.ref.startsWith("book:") ? "section" : "text", corpus: book.corpus },
  );
}

function onBookUnpinned(book: PinnedBook): void {
  haptic("tick");
  analyticsService.capture("home_book_unpinned", {
    kind: book.ref.startsWith("book:") ? "section" : "text",
    corpus: book.corpus,
  });
}

/** The blocks that span both columns on a wide screen. */
const isWide = (block: HomeBlock): boolean =>
  block === "volumes" || block === "portes" || block === "ecoute";
const blockName = (block: HomeBlock): string => t(`home.edit.blocks.${block}.title`);

function toggleBlock(block: HomeBlock): void {
  haptic("tick");
  if (isHidden(block)) {
    void arrange.animate(() => home.show(block));
    analyticsService.capture("home_block_shown", { block });
  } else {
    void arrange.animate(() => home.hide(block));
    analyticsService.capture("home_block_hidden", { block });
  }
}

/** With the keyboard, an up or down arrow moves the focused block. */
function onTileKey(event: KeyboardEvent, block: HomeBlock): void {
  if (!editing.value || isHidden(block)) return;
  // The arrows of a book list choose a book, they do not move the block.
  if ((event.target as Element | null)?.closest(".tile-controls")) return;
  const index = savedOrder.value.indexOf(block);
  const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
  if (to < 0 || to >= savedOrder.value.length) return;
  event.preventDefault();
  void arrange.animate(() => home.move(block, to));
  analyticsService.capture("home_block_moved", { block, to });
}

function startEditing(): void {
  editing.value = true;
  void nextTick(() => blocksRoot.value?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function onEditKey(event: KeyboardEvent): void {
  if (event.key === "Escape" && editing.value) editing.value = false;
}

// The old address (/accueil/modifier) lands here with `?modifier`: edit
// mode opens, and the address goes back to the home page's own.
watch(
  () => route.query.modifier,
  (value) => {
    if (value === undefined) return;
    editing.value = true;
    void router.replace({ query: {} });
  },
  { immediate: true },
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
  window.addEventListener("keydown", onEditKey);
});

watch([locale, localeMessagesReady, () => route.path], applyHomeMeta);

onUnmounted(() => {
  unsubscribeAuth?.();
  window.removeEventListener("keydown", onEditKey);
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

      <!-- Edit mode: what is going on, and how to leave it. -->
      <div
        v-if="editing"
        class="edit-bar w-full max-w-6xl mx-auto mt-5 flex items-center justify-between gap-3"
      >
        <p class="text-sm leading-snug">
          <span class="font-extrabold">{{ t("home.edit.title") }}</span>
          <br />
          <span class="text-text-secondary">{{ t("home.edit.hint") }}</span>
        </p>
        <button type="button" class="btn btn-primary edit-done" @click="editing = false">
          {{ t("home.edit.done") }}
        </button>
      </div>

      <!-- The day's deck, always first; below it, the blocks in the order
           given to them (P2-AccueilModifier). A long press on a block, or
           « Modifier l'accueil » at the bottom, arranges them in place. A
           block with nothing to say disappears on its own. -->
      <div
        ref="blocksRoot"
        class="home-blocks relative w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 md:items-start gap-[26px] md:gap-6"
        :class="{ 'is-editing': editing, 'mt-4': editing }"
        v-bind="arrange.handlers"
      >
        <!-- Mon parcours : le paquet du jour, sa barre, le portefeuille. -->
        <ParcoursHub
          class="dash-card"
          :class="{ 'deck-resting': editing }"
          :inert="editing || undefined"
          @begun="(begun) => (parcoursBegun = begun)"
        />

        <!-- Each block in its tile. Outside edit mode the tile is
             transparent to the grid (`display: contents`); in edit mode it
             is the box that wobbles and moves, its content inert. -->
        <div
          v-for="block in tiles"
          :key="block"
          class="home-tile"
          :class="{
            'md:col-span-2': isWide(block),
            'is-hidden': editing && isHidden(block),
            'is-dragging': arrange.dragging.value === block,
          }"
          :data-block="block"
          :tabindex="editing && !isHidden(block) ? 0 : undefined"
          :role="editing ? 'group' : undefined"
          :aria-label="editing ? t('home.edit.tileLabel', { name: blockName(block) }) : undefined"
          @keydown="onTileKey($event, block)"
        >
          <button
            v-if="editing"
            type="button"
            class="tile-pill"
            :aria-label="
              t(isHidden(block) ? 'home.edit.showLabel' : 'home.edit.hideLabel', {
                name: blockName(block),
              })
            "
            @click="toggleBlock(block)"
          >
            {{ t(isHidden(block) ? "home.edit.show" : "home.edit.hide") }}
          </button>
          <div class="tile-body" :inert="editing || undefined">
            <div v-if="block === 'horaires'" class="flex flex-col gap-3">
              <!-- Horaires du jour : calculés sur l'appareil, rien à charger. -->
              <ZmanimCard
                class="dash-card"
                style="--enter-delay: 0.1s"
                place-first
                @click="trackCard('zmanim')"
              />

              <!-- Before the parcours begins: the sidour one gesture away
                 while a service's time lasts, and the blessing of the moon (a
                 few nights a month, missed for lack of a reminder) with the
                 'Omer. Once it has begun, these are cards of the stack, with
                 or without the « trois tefilot » habit. -->
              <template v-if="!parcoursBegun">
                <SidourNowCard />
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

            <!-- The books one has pinned, up to three on their shelf. -->
            <HomePinnedBooks
              v-else-if="block === 'livres'"
              @open="(corpus) => trackCard(`pinned_${corpus}`)"
            />

            <!-- The audio courses begun, to resume where they were left. -->
            <HomeListeningResume
              v-else-if="block === 'ecoute'"
              @click="trackCard('listening_resume')"
            />
          </div>
          <!-- In edit mode, a block with nothing to show for now keeps its
               place under its name (shown only when the body is empty). -->
          <div v-if="editing" class="tile-empty">
            <p class="text-[17px] font-bold">{{ blockName(block) }}</p>
            <p class="mt-[3px] text-[13px] text-text-secondary">
              {{ t(`home.edit.blocks.${block}.sub`) }} · {{ t("home.edit.empty") }}
            </p>
          </div>
          <!-- In edit mode, the pinned books are chosen under their block. -->
          <HomePinnedEditor
            v-if="editing && block === 'livres'"
            class="tile-controls"
            @pinned="onBookPinned"
            @unpinned="onBookUnpinned"
          />
        </div>
      </div>

      <p class="mt-[22px] mb-10 text-center">
        <button
          v-if="editing"
          type="button"
          class="btn btn-primary edit-done"
          @click="editing = false"
        >
          {{ t("home.edit.done") }}
        </button>
        <button
          v-else
          type="button"
          class="text-[13px] font-semibold text-text-secondary underline underline-offset-4"
          @click="startEditing"
        >
          {{ t("home.edit.link") }}
        </button>
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

      <!-- Le formulaire de support, tout en bas : discret (une ligne en
           petit, gris) mais visible, là où l'on arrive après avoir tout vu. -->
      <p
        class="mt-10 text-center text-sm text-text-secondary enter-rise"
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
    <!-- Mon parcours commencé : ses gestes, une fois (aussi sur le site). Il
         passe avant l'astuce des réglages, qui attend l'ouverture suivante. -->
    <FeatureTour
      v-if="dashboard && parcoursBegun"
      tip="parcours-home"
      :steps="parcoursTours.home.value"
      :delay="600"
      web
    />
  </main>

  <!-- App native : pas de footer de site (l'essentiel vit dans le profil). -->
  <SiteFooter v-if="!isNativeApp" />

  <!-- « Tout se passe bien ? » : la relance du formulaire de support, sur
       l'accueil seulement (jamais pendant une lecture), après quelques jours
       d'usage, et seulement quand rien d'autre ne réclame l'attention. -->
  <FeedbackNudge />
</template>

<style scoped>
/* The long press opens edit mode: not the link preview the system would offer. */
.home-blocks {
  -webkit-touch-callout: none;
}

/* Outside edit mode, a tile is transparent to the grid: its block is the item. */
.home-tile,
.tile-body {
  display: contents;
}
.tile-empty {
  display: none;
}

/* Edit mode: each block is a tile that wobbles a little, you can pick it up. */
.is-editing {
  user-select: none;
  -webkit-user-select: none;
}
.is-editing .home-tile {
  position: relative;
  display: block;
  cursor: grab;
  transition:
    transform 0.22s ease,
    opacity 0.2s ease;
  animation: wobble 0.5s ease-in-out infinite;
}
/* Neighbors wobble out of step, as things held in the hand do. */
.is-editing .home-tile:nth-child(even) {
  animation-direction: reverse;
}
.is-editing .tile-body {
  display: block;
}
.is-editing .home-tile:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: var(--radius-card);
}
/* The held block, above the others, lifted. */
.is-editing .home-tile.is-dragging {
  z-index: 5;
  cursor: grabbing;
  animation: none;
}
.is-editing .home-tile.is-dragging .tile-body {
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-pop);
}
/* A hidden block stays in view, faded and still: « Afficher » brings it back. */
.is-editing .home-tile.is-hidden {
  cursor: default;
  animation: none;
}
.is-editing .home-tile.is-hidden .tile-body,
.is-editing .home-tile.is-hidden .tile-empty {
  opacity: 0.4;
}
/* Nothing to show for now: the block keeps its place under its name. */
.is-editing .tile-body:empty {
  display: none;
}
.is-editing .tile-body:empty + .tile-empty {
  display: block;
  padding: 14px 16px;
  border: 1px dashed var(--color-line-strong);
  border-radius: var(--radius-card);
}
/* The deck is not arranged: it rests while the blocks move. */
.deck-resting {
  opacity: 0.6;
}
/* `rotate`, not `transform`: the wobble does not keep a block from moving aside. */
@keyframes wobble {
  0%,
  100% {
    rotate: -0.4deg;
  }
  50% {
    rotate: 0.4deg;
  }
}
.tile-pill {
  position: absolute;
  top: -10px;
  inset-inline-end: -6px;
  z-index: 6;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--radius-pill);
  background: var(--color-text-primary);
  color: var(--color-page);
  font-size: 12px;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.is-hidden .tile-pill {
  background: var(--color-primary);
  color: var(--color-on-primary, var(--color-page));
}
/* The choice of the pinned books: solid, and still while one types. */
.tile-controls {
  margin-top: 12px;
  cursor: default;
}
.is-editing .home-tile:focus-within {
  animation: none;
}
.edit-done {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}

/* Staggered entrance: cards, greeting/hero and memorial all rise into place. */
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
  .is-editing .home-tile {
    animation: none;
    transition: none;
  }
}
</style>
