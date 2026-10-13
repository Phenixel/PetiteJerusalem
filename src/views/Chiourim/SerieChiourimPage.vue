<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { chiourService } from "../../services/chiourService";
import { serieService, type Serie } from "../../services/serieService";
import type { Chiour } from "../../models/models";
import AppIcon from "../../components/icons/AppIcon.vue";
import ChiourCover from "../../components/chiourim/ChiourCover.vue";
import ChiourTrackRow from "../../components/chiourim/ChiourTrackRow.vue";
import TexteLinkButton from "../../components/chiourim/TexteLinkButton.vue";
import BigPlayButton from "../../components/chiourim/BigPlayButton.vue";
import { formatMinutes, totalDuration } from "../../components/chiourim/duration";
import { useChiourPlayback } from "../../composables/useChiourPlayback";
import { isFinished, resumePosition } from "../../services/listeningProgress";
import { chiourTexte, serieTexte } from "../../services/chiourTexte";
import { useTexteLabels } from "../../composables/useTexteLabels";
import { seoService } from "../../services/seoService";
import { analyticsService } from "../../services/analyticsService";
import { SITE_URL } from "../../config/site";

/**
 * Une série, comme un album : sa pochette, son rav, sa durée, le bouton qui
 * lance (ou reprend) l'écoute, le livre qu'elle étudie, puis ses épisodes dans
 * l'ordre, qui s'enchaînent.
 */

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { player, playFrom } = useChiourPlayback();
const { chapitreLabel, chiourTexteLabel } = useTexteLabels();

const serie = ref<Serie | null>(null);
const episodes = ref<Chiour[]>([]);
const auteurName = ref<string | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const totalLabel = computed(() => formatMinutes(totalDuration(episodes.value), locale.value));
const texte = computed(() => serieTexte(episodes.value));

/** Le cours qui joue appartient-il à cette série ? */
const playingHere = computed(() => episodes.value.some((e) => e.slug === player.track.value?.slug));

/**
 * Où reprendre : le premier épisode entamé et pas fini, sinon le premier
 * qu'on n'a pas fini, sinon le premier.
 */
const nextToPlay = computed<Chiour | null>(() => {
  const playable = episodes.value.filter((e) => e.mediaUrl);
  return (
    playable.find((e) => resumePosition(e.slug) !== null) ??
    playable.find((e) => !isFinished(e.slug)) ??
    playable[0] ??
    null
  );
});

const mainLabel = computed(() => {
  if (playingHere.value)
    return player.isPlaying.value ? t("audioPlayer.pause") : t("chiourim.resumeShort");
  const target = nextToPlay.value;
  if (!target) return t("chiourim.listen");
  return target.slug === episodes.value[0]?.slug && resumePosition(target.slug) === null
    ? t("chiourim.listen")
    : t("chiourim.resumeEpisode", { n: target.episode ?? episodes.value.indexOf(target) + 1 });
});

function playMain() {
  if (playingHere.value) {
    player.toggle();
    return;
  }
  if (nextToPlay.value)
    playFrom(episodes.value, nextToPlay.value, "serie", serie.value?.name ?? null);
}

/**
 * La ligne sous un épisode : le chapitre qu'il étudie. Le livre de la série
 * est déjà dit en tête ; il n'est répété que pour un épisode qui en sort.
 */
function episodeLine(chiour: Chiour): string {
  const link = chiourTexte(chiour);
  if (!link) return "";
  if (link.entry === texte.value && link.chapitre !== null)
    return chapitreLabel(link.entry, link.chapitre);
  return link.entry === texte.value ? "" : chiourTexteLabel(chiour);
}

const loadSerie = async () => {
  const serieId = String(route.params.serieId ?? "");
  error.value = null;
  isLoading.value = true;
  try {
    const [found, all] = await Promise.all([
      serieService.getSerie(serieId),
      chiourService.getAllChiourim(),
    ]);
    if (!found) {
      error.value = t("serie.notFound");
      return;
    }
    serie.value = found;
    episodes.value = serieService.episodesOf(serieId, all);
    auteurName.value = episodes.value.find((c) => c.auteur)?.auteur ?? null;
    // Les deux portes d'entrée du catalogue (une série, un auteur) n'étaient
    // pas mesurées : on ne savait pas si les visiteurs suivent un cours de
    // bout en bout ou picorent depuis la liste générale.
    analyticsService.capture("chiour_serie_opened", {
      serie_id: serieId,
      serie_name: found.name,
      auteur: auteurName.value,
      episodes_count: episodes.value.length,
    });
    seoService.setMeta({
      title: `${found.name} | ${t("chiourim.title")} | Petite Jerusalem`,
      description: found.description || t("serie.seoDescription", { serie: found.name }),
      canonical: SITE_URL + `/chiourim/serie/${serieId}`,
    });
  } catch (err) {
    console.error("Erreur lors du chargement de la série:", err);
    error.value = err instanceof Error ? err.message : t("chiourim.loadError");
  } finally {
    isLoading.value = false;
  }
};

const auteurSeed = computed(
  () => episodes.value.find((c) => c.auteurId)?.auteurId ?? auteurName.value ?? "",
);

const auteurPath = computed(() =>
  auteurName.value
    ? `/chiourim/auteur/${chiourService.generateAuteurSlug(auteurName.value)}`
    : null,
);

onMounted(loadSerie);
watch(() => route.params.serieId, loadSerie);
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-8 md:py-12">
    <button @click="router.push('/chiourim')" class="back-link mb-6">
      <AppIcon name="chevron-left" :size="14" class="rtl:rotate-180" />
      {{ t("detailChiour.backToList") }}
    </button>

    <!-- Chargement -->
    <div v-if="isLoading" class="animate-pulse" aria-hidden="true">
      <div class="flex flex-col gap-6 md:flex-row md:items-end">
        <div
          class="mx-auto h-56 w-56 rounded-card bg-black/10 md:mx-0 md:h-56 md:w-56 dark:bg-white/10"
        ></div>
        <div class="flex-1 space-y-3">
          <div class="h-9 w-2/3 rounded-lg bg-black/10 dark:bg-white/10"></div>
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

    <div v-else-if="serie" class="animate-[fadeIn_0.3s_ease]">
      <!-- En-tête, comme une playlist : la pochette, le titre, le rav, la durée -->
      <header class="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
        <div class="mx-auto w-[min(64vw,15rem)] shrink-0 md:mx-0 md:w-56">
          <ChiourCover
            :seed="serie.id"
            :label="serie.name"
            :sub="auteurName"
            size="md"
            class="shadow-pop"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="hidden text-sm font-semibold text-text-secondary md:block">
            {{ t("serie.label") }}
          </p>
          <h1
            dir="auto"
            class="font-display text-3xl font-bold leading-tight tracking-tight text-text-primary md:mt-1 md:text-5xl"
          >
            {{ serie.name }}
          </h1>
          <router-link
            v-if="auteurPath && auteurName"
            :to="auteurPath"
            class="mt-3 inline-flex items-center gap-2 font-semibold text-text-primary hover:text-primary"
          >
            <ChiourCover :seed="auteurSeed" :label="auteurName" size="avatar" round />
            {{ auteurName }}
          </router-link>
          <p class="mt-1 text-sm text-text-secondary">
            {{ t("serie.episodesCount", { count: episodes.length }) }}
            <template v-if="totalLabel"> · {{ totalLabel }}</template>
          </p>
        </div>
      </header>

      <!-- Les actions : le texte étudié à gauche, l'écoute au bout -->
      <div class="mt-5 flex items-center gap-3">
        <TexteLinkButton v-if="texte" :entry="texte" :chapitre="null" source="serie" />
        <BigPlayButton
          v-if="nextToPlay"
          class="ms-auto"
          :playing="playingHere && player.isPlaying.value"
          :label="mainLabel"
          @click="playMain"
        />
      </div>

      <p
        v-if="serie.description"
        dir="auto"
        class="mt-5 max-w-3xl leading-relaxed text-text-secondary"
      >
        {{ serie.description }}
      </p>

      <!-- Les épisodes : toucher un épisode le joue, la série suit -->
      <section class="-mx-2 mt-6" :aria-label="t('serie.episodes')">
        <ChiourTrackRow
          v-for="(chiour, i) in episodes"
          :key="chiour.slug"
          :chiour="chiour"
          :list="episodes"
          source="serie"
          :context="serie.name"
          :strip-prefix="serie.name"
          :number="chiour.episode ?? i + 1"
          :subtitle="episodeLine(chiour)"
        />
      </section>
    </div>
  </main>
</template>
