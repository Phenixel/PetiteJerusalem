<script setup lang="ts">
/**
 * Le lecteur plein écran : ce qu'ouvre un appui sur la barre du bas, comme
 * l'écran « en cours de lecture » d'une application d'écoute.
 *
 * Il prend la reliure de la série du cours, assombrie, en aplat (playerTone),
 * et y pose en crème : d'où vient l'écoute, la pochette, le titre et le rav,
 * la barre de lecture, les commandes (reculer de 15 s, précédent, lecture,
 * suivant, avancer de 30 s), la vitesse et le texte étudié. Plus bas, ce qui
 * suit dans la file, et ce que dit le cours de lui-même.
 *
 * Chargé à la demande (il lit le catalogue, donc Firestore) : la barre du bas,
 * montée sur toutes les pages, n'en porte rien.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Chiour } from "../../models/models";
import { useAudioPlayer } from "../../composables/useAudioPlayer";
import { useOverlay } from "../../composables/useOverlayStack";
import { useTexteLabels } from "../../composables/useTexteLabels";
import { chiourService } from "../../services/chiourService";
import { chiourTexte, texteRoute } from "../../services/chiourTexte";
import { analyticsService } from "../../services/analyticsService";
import { COVER_INK, playerTone } from "./cover";
import { formatMinutes } from "./duration";
import AppIcon from "../icons/AppIcon.vue";
import ChiourCover from "./ChiourCover.vue";
import NowPlayingBars from "./NowPlayingBars.vue";
import PlayerSeek from "./PlayerSeek.vue";
import PlayerSpeed from "./PlayerSpeed.vue";
import ShareModal from "../ShareModal.vue";
import { SITE_URL } from "../../config/site";

const { t, locale } = useI18n();
const router = useRouter();
const player = useAudioPlayer();
const { texteLabel } = useTexteLabels();

const track = computed(() => player.track.value);
const tone = computed(() => playerTone(track.value?.cover?.seed ?? track.value?.slug ?? ""));

useOverlay(player.sheetOpen, player.closeSheet);

// La page sous le lecteur ne défile pas avec lui.
let overflowBefore = "";
onMounted(() => {
  overflowBefore = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.documentElement.style.overflow = overflowBefore;
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") player.closeSheet();
}

// --- Le cours qui joue, tel que le catalogue le connaît ---
const chiour = ref<Chiour | null>(null);
watch(
  () => track.value?.slug,
  async (slug) => {
    chiour.value = null;
    if (!slug) return;
    try {
      const found = await chiourService.getChiourBySlug(slug);
      if (track.value?.slug === slug) chiour.value = found;
    } catch {
      // Hors ligne : le lecteur reste utilisable sans la fiche du cours.
    }
  },
  { immediate: true },
);

const texte = computed(() => (chiour.value ? chiourTexte(chiour.value) : null));

/** Ferme le lecteur avant de quitter vers une page (le texte, le cours). */
function goTo(to: Parameters<typeof router.push>[0]) {
  player.closeSheet();
  void router.push(to);
}

function openTexte() {
  if (!texte.value || !chiour.value) return;
  analyticsService.capture("chiour_text_opened", {
    source: "lecteur",
    chiour_slug: chiour.value.slug,
    texte_id: Number(texte.value.entry.id),
    chapitre: texte.value.chapitre,
  });
  goTo(texteRoute(texte.value.entry, texte.value.chapitre));
}

// --- La file ---
const upNext = computed(() =>
  player.queue.value.map((item, index) => ({ item, index })).slice(player.queueIndex.value),
);

const showShare = ref(false);
const shareUrl = computed(() =>
  track.value?.slug ? `${SITE_URL}/chiourim/${track.value.slug}` : "",
);
</script>

<template>
  <div
    class="player-sheet fixed inset-0 z-[58] overflow-y-auto overscroll-contain"
    :style="{ backgroundColor: tone, color: COVER_INK }"
    role="dialog"
    aria-modal="true"
    :aria-label="t('audioPlayer.nowPlaying')"
    @keydown="onKeydown"
  >
    <div
      v-if="track"
      class="mx-auto w-full max-w-6xl px-6 pb-[calc(2rem+var(--safe-bottom,0px))] pt-[calc(0.75rem+var(--safe-top,0px))]"
    >
      <!-- En tête : réduire, d'où vient l'écoute, partager -->
      <header class="flex items-center gap-3">
        <button
          type="button"
          class="sheet-icon"
          :aria-label="t('chiourim.player.collapse')"
          :title="t('chiourim.player.collapse')"
          @click="player.closeSheet()"
        >
          <AppIcon name="chevron-down" :size="24" />
        </button>
        <div class="min-w-0 flex-1 text-center">
          <p v-if="track.context" class="text-xs uppercase tracking-wider opacity-70">
            {{ t("chiourim.player.from") }}
          </p>
          <p class="truncate text-sm font-semibold">{{ track.context }}</p>
        </div>
        <button
          type="button"
          class="sheet-icon"
          :aria-label="t('common.share')"
          :title="t('common.share')"
          :disabled="!track.slug"
          @click="showShare = true"
        >
          <AppIcon name="share" :size="20" />
        </button>
      </header>

      <div
        class="mt-6 grid grid-cols-1 gap-10 lg:mt-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16"
      >
        <!-- Le cours qui joue et ses commandes -->
        <section class="mx-auto w-full min-w-0 max-w-md lg:mx-0">
          <div class="mx-auto w-[min(76vw,22rem)] lg:w-full">
            <ChiourCover
              v-if="track.cover"
              :seed="track.cover.seed"
              :label="track.cover.label"
              size="md"
              class="shadow-pop"
            />
          </div>

          <div class="mt-8">
            <h2 class="font-display text-2xl font-bold leading-tight line-clamp-3">
              {{ track.title }}
            </h2>
            <p v-if="track.subtitle" class="mt-1 truncate opacity-75">{{ track.subtitle }}</p>
          </div>

          <PlayerSeek class="mt-6" />

          <div class="mt-4 flex items-center justify-between">
            <button
              type="button"
              class="sheet-icon"
              :aria-label="t('audioPlayer.rewind')"
              :title="t('audioPlayer.rewind')"
              @click="player.skip(-15)"
            >
              <AppIcon name="rotate-ccw" :size="26" />
              <span class="skip-n">15</span>
            </button>
            <button
              type="button"
              class="sheet-icon"
              :aria-label="t('audioPlayer.previous')"
              :title="t('audioPlayer.previous')"
              @click="player.previous()"
            >
              <AppIcon name="skip-back" :size="28" class="rtl:rotate-180" />
            </button>
            <button
              type="button"
              class="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition-transform active:scale-95"
              :style="{ backgroundColor: COVER_INK, color: tone }"
              :aria-label="player.isPlaying.value ? t('audioPlayer.pause') : t('audioPlayer.play')"
              :title="player.isPlaying.value ? t('audioPlayer.pause') : t('audioPlayer.play')"
              @click="player.toggle()"
            >
              <AppIcon
                :name="player.isPlaying.value ? 'pause-solid' : 'play-solid'"
                :size="30"
                :class="{ 'ml-1': !player.isPlaying.value }"
              />
            </button>
            <button
              type="button"
              class="sheet-icon"
              :disabled="!player.hasNext.value"
              :aria-label="t('audioPlayer.next')"
              :title="t('audioPlayer.next')"
              @click="player.next()"
            >
              <AppIcon name="skip-forward" :size="28" class="rtl:rotate-180" />
            </button>
            <button
              type="button"
              class="sheet-icon"
              :aria-label="t('audioPlayer.forward')"
              :title="t('audioPlayer.forward')"
              @click="player.skip(30)"
            >
              <AppIcon name="rotate-cw" :size="26" />
              <span class="skip-n">30</span>
            </button>
          </div>

          <!-- La vitesse ; le texte étudié a sa carte, juste en dessous -->
          <div class="mt-6 flex items-center">
            <PlayerSpeed class="sheet-pill" />
          </div>
        </section>

        <!-- La suite, et le cours lui-même -->
        <div class="min-w-0 space-y-6">
          <section v-if="texte" class="sheet-card">
            <button
              type="button"
              class="flex w-full items-center gap-4 text-start"
              @click="openTexte"
            >
              <AppIcon name="book-open" :size="22" class="shrink-0 opacity-80" />
              <span class="min-w-0 flex-1">
                <span class="block text-xs uppercase tracking-wider opacity-70">{{
                  t("chiourim.texte.studied")
                }}</span>
                <span class="block font-semibold leading-snug">{{
                  texteLabel(texte.entry, texte.chapitre)
                }}</span>
              </span>
              <span class="sheet-pill hidden shrink-0 sm:inline-flex">{{
                t("chiourim.texte.read")
              }}</span>
            </button>
          </section>

          <section v-if="upNext.length > 1" class="sheet-card">
            <h3 class="mb-2 font-bold">{{ t("chiourim.player.upNext") }}</h3>
            <ol class="-mx-2">
              <li v-for="{ item, index } in upNext" :key="item.src">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-control px-2 py-2 text-start transition-colors hover:bg-white/10"
                  :aria-current="index === player.queueIndex.value ? 'true' : undefined"
                  @click="player.playAt(index)"
                >
                  <span class="flex w-6 shrink-0 justify-center text-sm tabular-nums opacity-75">
                    <NowPlayingBars
                      v-if="index === player.queueIndex.value"
                      :playing="player.isPlaying.value"
                    />
                    <template v-else>{{ index + 1 }}</template>
                  </span>
                  <span
                    class="min-w-0 flex-1 truncate"
                    :class="index === player.queueIndex.value ? 'font-bold' : ''"
                    >{{ item.title }}</span
                  >
                  <span v-if="item.duration" class="shrink-0 text-xs tabular-nums opacity-70">{{
                    formatMinutes(item.duration, locale)
                  }}</span>
                </button>
              </li>
            </ol>
          </section>

          <section v-if="chiour" class="sheet-card">
            <h3 class="mb-2 font-bold">{{ t("chiourim.player.about") }}</h3>
            <p
              v-if="chiour.description"
              class="whitespace-pre-line leading-relaxed opacity-85 line-clamp-6"
            >
              {{ chiour.description }}
            </p>
            <div v-if="chiour.categories.length" class="mt-3 flex flex-wrap gap-2">
              <span v-for="cat in chiour.categories" :key="cat" class="sheet-chip">{{ cat }}</span>
            </div>
            <button type="button" class="sheet-pill mt-4" @click="goTo(`/chiourim/${chiour.slug}`)">
              {{ t("chiourim.player.openPage") }}
            </button>
          </section>
        </div>
      </div>
    </div>

    <ShareModal
      v-if="track?.slug"
      v-model:show="showShare"
      :session-name="track.title"
      :share-url="shareUrl"
      title-key="shareModal.titleChiour"
      message-key="shareModal.inviteChiour"
      content-type="chiour"
      :content-id="track.slug"
    />
  </div>
</template>

<style scoped>
.sheet-icon {
  position: relative;
  display: flex;
  height: 3rem;
  width: 3rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition:
    background-color 0.15s,
    opacity 0.15s;
}
.sheet-icon:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.1);
}
.sheet-icon:disabled {
  opacity: 0.35;
}
.skip-n {
  position: absolute;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}
.sheet-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: rgb(255 255 255 / 0.14);
  transition: background-color 0.15s;
}
.sheet-pill:hover {
  background: rgb(255 255 255 / 0.22);
}
/* Les cartes du lecteur : une surface un ton plus sombre que son fond. */
.sheet-card {
  border-radius: var(--radius-card);
  padding: 1rem 1.25rem;
  background: rgb(0 0 0 / 0.22);
}
.sheet-chip {
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgb(255 255 255 / 0.12);
}
</style>
