<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { analyticsService } from "../../services/analyticsService";
import { serieService, type Serie } from "../../services/serieService";
import { useViewedChiourim } from "../../composables/useViewedChiourim";
import { chiourCover, useChiourPlayback } from "../../composables/useChiourPlayback";
import { formatMinutes } from "../../components/chiourim/duration";
import { listeningOf, progressOf, resumePosition } from "../../services/listeningProgress";
import { useTexteLabels } from "../../composables/useTexteLabels";
import { chiourTexte, texteRoute } from "../../services/chiourTexte";
import type { Chiour } from "../../models/models";
import BigPlayButton from "../../components/chiourim/BigPlayButton.vue";
import ChiourCover from "../../components/chiourim/ChiourCover.vue";
import ChiourTrackRow from "../../components/chiourim/ChiourTrackRow.vue";
import ShareModal from "../../components/ShareModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../config/site";
import { APP_SITE_URL } from "../../config/environment";

/**
 * La page d'un cours, comme celle d'une playlist d'un seul titre : sa
 * pochette, son titre et son rav, le bouton qui le lance (le lecteur, lui, est
 * en bas de l'écran, et s'ouvre en plein écran), le texte qu'il étudie, sa
 * description, puis la série où il s'inscrit et d'autres cours à écouter.
 * C'est la page qu'on partage, et celle où mène une recherche.
 */

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { player, isCurrent, playFrom } = useChiourPlayback();
const { texteLabel } = useTexteLabels();

function auteurPath(auteur: string) {
  return `/chiourim/auteur/${chiourService.generateAuteurSlug(auteur)}`;
}

const { isViewed, markViewed, isLoaded: viewedLoaded } = useViewedChiourim();

const chiour = ref<Chiour | null>(null);
const allChiourim = ref<Chiour[]>([]);
const serie = ref<Serie | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
// Vrai si l'utilisateur connecté avait DÉJÀ vu ce chiour avant cette visite.
// Capturé à l'arrivée sur la page, une fois la liste des vus chargée (elle
// arrive après le premier rendu au chargement complet de la page).
const wasAlreadyViewed = ref(false);
const viewMarkedFor = ref<string | null>(null);

// Partage (même modal que les sessions de lecture : WhatsApp, SMS, QR, copie)
const showShareModal = ref(false);
// Toujours le site de l'environnement (config/environment), jamais
// window.location : elle vaut "localhost" (ou capacitor://localhost) en dev
// et dans l'app native, ce qui produirait un lien de partage inutilisable.
const shareUrl = computed(() =>
  chiour.value ? `${APP_SITE_URL}/chiourim/${chiour.value.slug}` : "",
);

// Un watch sur ses deux sources, et non un watchEffect : celui-ci lisait et
// écrivait `viewMarkedFor`, et se réveillait donc de sa propre écriture.
watch(
  [chiour, viewedLoaded],
  ([current, loaded]) => {
    if (!current || !loaded || viewMarkedFor.value === current.slug) return;
    viewMarkedFor.value = current.slug;
    wasAlreadyViewed.value = isViewed(current.slug);
    // Un chiour avec audio n'est marqué vu qu'au démarrage de l'écoute (voir
    // useAudioPlayer) : arriver sur la page ne prouve pas qu'on l'a écouté.
    // Sans audio, il n'y a rien à écouter : la visite reste le seul signal.
    if (!current.mediaUrl) markViewed(current.slug);
  },
  { immediate: true },
);

const cover = computed(() => (chiour.value ? chiourCover(chiour.value) : null));

const current = computed(() => !!chiour.value && isCurrent(chiour.value.slug));
const playing = computed(() => current.value && player.isPlaying.value);

/** Où on en est, dit sous le titre : la durée, ou ce qu'il en reste. */
const progress = computed(() => (chiour.value ? progressOf(chiour.value.slug) : 0));
const timeLine = computed(() => {
  if (!chiour.value) return "";
  const duration = chiour.value.duration ?? listeningOf(chiour.value.slug)?.d ?? 0;
  if (!duration) return "";
  const resume = resumePosition(chiour.value.slug);
  if (resume !== null)
    return t("chiourim.player.left", { time: formatMinutes(duration - resume, locale.value) });
  return formatMinutes(duration, locale.value);
});

const playLabel = computed(() => {
  if (playing.value) return t("audioPlayer.pause");
  if (current.value || (chiour.value && resumePosition(chiour.value.slug) !== null))
    return t("chiourim.resumeShort");
  return t("chiourim.listen");
});

/** Le lance avec sa série pour file, ou le met en pause s'il joue. */
function playThis() {
  if (!chiour.value) return;
  const queue = episodes.value.length ? episodes.value : [chiour.value];
  playFrom(queue, chiour.value, "chiour", serie.value?.name ?? null);
}

/** La série du cours, dans l'ordre : la file du lecteur et la liste « Dans cette série ». */
const episodes = computed(() =>
  chiour.value?.serieId ? serieService.episodesOf(chiour.value.serieId, allChiourim.value) : [],
);

/**
 * La série affichée sous le cours : entière jusqu'à douze épisodes, sinon une
 * fenêtre autour de celui-ci, la série complète restant à un lien.
 */
const SERIE_WINDOW = 12;
const episodeWindow = computed(() => {
  const list = episodes.value;
  if (list.length <= SERIE_WINDOW) return list;
  const index = Math.max(
    0,
    list.findIndex((c) => c.slug === chiour.value?.slug),
  );
  const start = Math.min(Math.max(0, index - 3), list.length - SERIE_WINDOW);
  return list.slice(start, start + SERIE_WINDOW);
});

const texte = computed(() => (chiour.value ? chiourTexte(chiour.value) : null));
const texteTo = computed(() =>
  texte.value ? texteRoute(texte.value.entry, texte.value.chapitre) : null,
);

function trackTexteOpened() {
  if (!chiour.value || !texte.value) return;
  analyticsService.capture("chiour_text_opened", {
    source: "chiour",
    chiour_slug: chiour.value.slug,
    texte_id: Number(texte.value.entry.id),
    chapitre: texte.value.chapitre,
  });
}

// Les épisodes voisins ont leur propre liste : les recommandations proposent
// autre chose (mêmes catégories, même auteur), sans les dupliquer.
const recommendations = computed(() => {
  if (!chiour.value || !allChiourim.value.length) return [];
  return chiourService
    .getRecommendations(chiour.value, allChiourim.value, 12)
    .filter((r) => !r.serieId || r.serieId !== chiour.value?.serieId)
    .slice(0, 4);
});

/**
 * Quand la série enchaîne (fin d'un épisode, bouton suivant), la page suit le
 * cours qui joue, comme l'écran « en cours de lecture » d'un lecteur : on
 * reste sur ce qu'on écoute.
 */
watch(
  () => player.track.value?.slug,
  (now, before) => {
    if (!now || !before || before !== route.params.slug) return;
    if (episodes.value.some((e) => e.slug === now)) {
      void router.replace(`/chiourim/${now}`);
    }
  },
);

function applyChiour(all: Chiour[], slug: string): boolean {
  allChiourim.value = all;
  const found = all.find((c) => c.slug === slug) ?? null;
  if (!found) return false;
  applyFound(found);
  return true;
}

/**
 * Ouverture d'une page de chiour. `chiour_played` ne compte que les écoutes
 * lancées : sans dénominateur, impossible de dire si un chiour est peu écouté
 * parce qu'il est peu ouvert, ou parce que sa page ne donne pas envie.
 * Mêmes clés que le lecteur audio (`chiour_slug`, `chiour_title`) pour que les
 * deux événements se recollent.
 */
function trackChiourOpened(found: Chiour): void {
  if (trackedSlug === found.slug) return;
  trackedSlug = found.slug;
  analyticsService.capture("chiour_opened", {
    chiour_slug: found.slug,
    chiour_title: found.name,
    auteur: found.auteur ?? null,
    serie_id: found.serieId ?? null,
    // Réécoute ou découverte : `useViewedChiourim` garde la trace des chiourim
    // déjà lancés sur cet appareil.
    already_viewed: isViewed(found.slug),
    // Le cours étudie-t-il un livre de la bibliothèque ?
    texte_id: found.texteId ?? null,
  });
}

// La page se réutilise d'un chiour à l'autre (épisode suivant, recommandation)
// et `applyFound` passe deux fois sur le même chiour (cache puis catalogue
// frais) : un seul événement par chiour réellement ouvert.
let trackedSlug: string | null = null;

function applyFound(found: Chiour): void {
  chiour.value = found;
  trackChiourOpened(found);
  if (serie.value?.id !== found.serieId) serie.value = null;
  if (found.serieId) {
    serieService
      .getSerie(found.serieId)
      .then((s) => {
        // Le visiteur a pu naviguer vers un autre chiour entre-temps.
        if (chiour.value?.serieId === s?.id) serie.value = s;
      })
      .catch(() => {});
  }
  seoService.setMeta({
    title: `${found.name} | Petite Jerusalem`,
    description: found.description || t("seo.chiourimDescription"),
    canonical: SITE_URL + `/chiourim/${found.slug}`,
  });
}

const loadChiour = async () => {
  const slug = route.params.slug as string;
  if (!slug) return;
  error.value = null;

  // Affichage immédiat depuis le cache
  const cached = chiourService.getCachedChiourim();
  if (cached && applyChiour(cached, slug)) {
    chiourService.registerView(slug);
    isLoading.value = false;
    if (chiourService.isCacheStale()) {
      chiourService
        .getAllChiourim()
        .then((fresh) => {
          // On a pu changer de chiour entre-temps (épisode suivant) : le
          // rafraîchissement ne doit pas reposer l'ancien.
          if (route.params.slug === slug) applyChiour(fresh, slug);
        })
        .catch(() => {});
    }
    return;
  }

  // Pas de cache (arrivée à froid sur un lien partagé) : on n'attend que le
  // document du chiour lui-même, un seul doc au lieu du catalogue entier.
  // Le catalogue se charge ensuite en arrière-plan pour la série et les
  // recommandations (leurs computed restent vides d'ici là).
  try {
    isLoading.value = true;
    const single = await chiourService.getChiourBySlug(slug);
    if (!single) {
      error.value = t("detailChiour.notFound");
    } else {
      applyFound(single);
      chiourService.registerView(slug);
      chiourService
        .getAllChiourim()
        .then((all) => {
          if (route.params.slug === slug) applyChiour(all, slug);
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error("Erreur lors du chargement du chiour:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadChiour);

watch(() => route.params.slug, loadChiour);
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-8 md:py-12">
    <button @click="router.push('/chiourim')" class="back-link mb-6">
      <AppIcon name="chevron-left" :size="14" class="rtl:rotate-180" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Chargement -->
    <div v-if="isLoading" class="animate-pulse" aria-hidden="true">
      <div class="flex flex-col gap-6 md:flex-row md:items-end">
        <div class="mx-auto h-56 w-56 rounded-card bg-black/10 md:mx-0 dark:bg-white/10"></div>
        <div class="w-full flex-1 space-y-3">
          <div class="h-4 w-32 rounded bg-black/10 dark:bg-white/10"></div>
          <div class="h-8 w-2/3 rounded-lg bg-black/10 dark:bg-white/10"></div>
          <div class="h-4 w-40 rounded bg-black/10 dark:bg-white/10"></div>
        </div>
      </div>
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ error }}</p>
      <button @click="router.push('/chiourim')" class="btn btn-soft">
        {{ t("detailChiour.backToList") }}
      </button>
    </div>

    <div v-else-if="chiour" class="animate-[fadeIn_0.3s_ease]">
      <!-- En-tête : la pochette, la série, le titre, le rav -->
      <header class="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
        <div v-if="cover" class="mx-auto w-[min(64vw,15rem)] shrink-0 md:mx-0 md:w-56">
          <ChiourCover
            :seed="cover.seed"
            :label="cover.label"
            :sub="serie ? chiour.auteur : null"
            size="md"
            class="shadow-pop"
          />
        </div>
        <div class="min-w-0 flex-1">
          <router-link
            v-if="serie"
            :to="`/chiourim/serie/${serie.id}`"
            class="text-sm font-semibold text-text-secondary hover:text-primary"
          >
            <template v-if="chiour.episode != null"
              >{{ t("serie.episodeBadge", { n: chiour.episode }) }} · </template
            >{{ serie.name }}
          </router-link>
          <h1
            dir="auto"
            class="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-4xl"
          >
            {{ chiour.name }}
          </h1>
          <router-link
            v-if="chiour.auteur"
            :to="auteurPath(chiour.auteur)"
            class="mt-3 inline-flex items-center gap-2 font-semibold text-text-primary hover:text-primary"
          >
            <ChiourCover
              :seed="chiour.auteurId ?? chiour.auteur"
              :label="chiour.auteur"
              size="avatar"
              round
            />
            {{ chiour.auteur }}
          </router-link>
          <p class="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
            <span v-if="timeLine">{{ timeLine }}</span>
            <span v-if="timeLine && chiour.niveau" aria-hidden="true">·</span>
            <span v-if="chiour.niveau">{{ chiour.niveau }}</span>
            <span
              v-if="wasAlreadyViewed"
              class="chip inline-flex items-center gap-1 bg-green-600/10 text-green-700 dark:text-green-300"
            >
              <AppIcon name="circle-check" :size="12" />
              {{ t("common.viewed") }}
            </span>
          </p>
          <span
            v-if="progress > 0 && progress < 1"
            class="mt-2 block h-1 w-40 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
            aria-hidden="true"
          >
            <span class="block h-full bg-primary" :style="{ width: `${progress * 100}%` }" />
          </span>
        </div>
      </header>

      <!-- Les actions : partager à gauche, l'écoute au bout -->
      <div class="mt-5 flex items-center gap-2">
        <button
          class="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-text-primary transition-colors hover:bg-black/10 dark:bg-white/10"
          :aria-label="t('common.share')"
          :title="t('common.share')"
          @click="showShareModal = true"
        >
          <AppIcon name="share" :size="17" />
        </button>
        <!-- Les catégories passent à la ligne entre les deux boutons, sans les pousser -->
        <span v-if="chiour.categories.length" class="hidden min-w-0 flex-1 flex-wrap gap-2 sm:flex">
          <span v-for="cat in chiour.categories" :key="cat" class="chip bg-primary/10 text-primary">
            {{ cat }}
          </span>
        </span>
        <BigPlayButton
          v-if="chiour.mediaUrl"
          class="ms-auto"
          :playing="playing"
          :label="playLabel"
          @click="playThis"
        />
      </div>

      <!-- Le texte étudié : la carte mène au livre, au chapitre près -->
      <router-link
        v-if="texte && texteTo"
        :to="texteTo"
        class="card card-hover mt-6 flex items-center gap-4 p-4 md:p-5"
        @click="trackTexteOpened"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-text-secondary">{{ t("chiourim.texte.studied") }}</span>
          <span class="block font-semibold leading-snug text-text-primary">{{
            texteLabel(texte.entry, texte.chapitre)
          }}</span>
        </span>
        <span class="btn btn-soft btn-sm hidden shrink-0 !rounded-pill sm:inline-flex">
          {{ t("chiourim.texte.read") }}
        </span>
      </router-link>

      <!-- La description -->
      <section v-if="chiour.description" class="mt-8">
        <h2 class="mb-2 text-lg font-bold text-text-primary">
          {{ t("common.description") }}
        </h2>
        <p dir="auto" class="text-text-secondary leading-relaxed whitespace-pre-line">
          {{ chiour.description }}
        </p>
      </section>

      <!-- La série -->
      <section v-if="serie && episodes.length > 1" class="mt-12">
        <div class="mb-3 flex items-baseline justify-between gap-4">
          <h2 class="font-display text-2xl font-bold tracking-tight text-text-primary">
            {{ t("detailChiour.inSerie") }}
          </h2>
          <router-link
            :to="`/chiourim/serie/${serie.id}`"
            class="shrink-0 text-sm font-semibold text-text-secondary hover:text-primary"
          >
            {{ t("serie.seeAll") }}
          </router-link>
        </div>
        <div class="-mx-2">
          <ChiourTrackRow
            v-for="episode in episodeWindow"
            :key="episode.slug"
            :chiour="episode"
            :list="episodes"
            source="chiour"
            :context="serie.name"
            :strip-prefix="serie.name"
            :number="episode.episode ?? episodes.indexOf(episode) + 1"
            :subtitle="''"
          />
        </div>
      </section>

      <!-- À écouter ensuite -->
      <section v-if="recommendations.length > 0" class="mt-12">
        <h2 class="mb-3 font-display text-2xl font-bold tracking-tight text-text-primary">
          {{ t("detailChiour.recommendations") }}
        </h2>
        <div class="-mx-2">
          <ChiourTrackRow
            v-for="rec in recommendations"
            :key="rec.slug"
            :chiour="rec"
            :list="recommendations"
            source="chiour"
          />
        </div>
      </section>
    </div>

    <ShareModal
      v-if="chiour"
      v-model:show="showShareModal"
      :session-name="chiour.name"
      :share-url="shareUrl"
      title-key="shareModal.titleChiour"
      message-key="shareModal.inviteChiour"
      content-type="chiour"
      :content-id="chiour.slug"
    />
  </main>
</template>
