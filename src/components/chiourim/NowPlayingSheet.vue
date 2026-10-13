<script setup lang="ts">
/**
 * Le lecteur plein écran : ce qu'ouvre un appui sur la barre du bas, comme
 * l'écran « en cours de lecture » d'une application d'écoute.
 *
 * Il prend la reliure de la série du cours, assombrie, en aplat (playerTone),
 * et y pose en crème : d'où vient l'écoute, la pochette, le titre et le rav,
 * la barre de lecture, les commandes (reculer de 15 s, précédent, lecture,
 * suivant, avancer de 30 s), la vitesse et le texte étudié. Plus bas, la
 * file (ce qui joue, ce qui suit, et repliés au-dessus les cours d'avant), et
 * ce que dit le cours de lui-même.
 *
 * Chargé à la demande (il lit le catalogue, donc Firestore) : la barre du bas,
 * montée sur toutes les pages, n'en porte rien.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { Chiour } from "../../models/models";
import { useAudioPlayer, type AudioTrack } from "../../composables/useAudioPlayer";
import { shortTitle } from "../../composables/useChiourPlayback";
import { useOverlay } from "../../composables/useOverlayStack";
import { useTexteLabels } from "../../composables/useTexteLabels";
import { chiourService } from "../../services/chiourService";
import { chiourTexte, hasChapitres, texteOf, texteRoute } from "../../services/chiourTexte";
import { analyticsService } from "../../services/analyticsService";
import { COVER_INK, playerTone } from "./cover";
import { formatMinutes } from "./duration";
import AppIcon from "../icons/AppIcon.vue";
import ChiourCover from "./ChiourCover.vue";
import NowPlayingBars from "./NowPlayingBars.vue";
import PlayerSeek from "./PlayerSeek.vue";
import PlayerSpeed from "./PlayerSpeed.vue";
import QueueRow from "./QueueRow.vue";
import ShareModal from "../ShareModal.vue";
import { SITE_URL } from "../../config/site";
import { FULL_CLIP, SHEET_EASING, barClip, motionAllowed } from "./sheetMotion";

/** Le plein écran a fini de se réduire en barre : GlobalAudioPlayer peut le démonter. */
const emit = defineEmits<{ closed: [] }>();

const { t, locale } = useI18n();
const router = useRouter();
const player = useAudioPlayer();
const { chapitreLabel, texteLabel } = useTexteLabels();

const track = computed(() => player.track.value);
const tone = computed(() => playerTone(track.value?.cover?.seed ?? track.value?.slug ?? ""));

useOverlay(player.sheetOpen, player.closeSheet);

// La page sous le lecteur ne défile pas avec lui, et le clavier y reste :
// le focus entre sur « Réduire », ne sort pas du lecteur avec Tab, et revient
// à la barre du bas quand on le referme.
const root = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const collapseButton = ref<HTMLButtonElement | null>(null);
let overflowBefore = "";
onMounted(() => {
  overflowBefore = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);
  root.value?.addEventListener("touchstart", onTouchStart, { passive: true });
  // Non passif : pendant le geste, la page ne défile pas sous le doigt.
  root.value?.addEventListener("touchmove", onTouchMove, { passive: false });
  root.value?.addEventListener("touchend", onTouchEnd);
  root.value?.addEventListener("touchcancel", onTouchEnd);
  collapseButton.value?.focus({ preventScroll: true });
  growFromBar();
});
onBeforeUnmount(() => {
  document.documentElement.style.overflow = overflowBefore;
  document.removeEventListener("keydown", onKeydown);
  // La barre du bas réapparaît une fois le lecteur fermé.
  void nextTick(() =>
    document.querySelector<HTMLElement>("[data-player-open]")?.focus({ preventScroll: true }),
  );
});

// --- La barre qui s'agrandit, le plein écran qui redevient la barre ---
const closing = ref(false);
/** De combien le doigt a tiré le plein écran vers le bas, à l'instant du lâcher. */
let dragOffset = 0;

function growFromBar() {
  if (!root.value || !motionAllowed()) return;
  root.value.animate([{ clipPath: barClip() }, { clipPath: FULL_CLIP }], {
    duration: 420,
    easing: SHEET_EASING,
  });
  content.value?.animate(
    [
      { opacity: 0, transform: "translateY(24px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 320, delay: 90, easing: "ease-out", fill: "backwards" },
  );
}

/** Se réduit jusqu'à la barre, d'où qu'on le ferme (flèche, Échap, retour, geste), puis s'en va. */
async function shrinkToBar() {
  closing.value = true;
  const el = root.value;
  if (!el || !motionAllowed()) {
    emit("closed");
    return;
  }
  content.value?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 160,
    easing: "ease-in",
    fill: "forwards",
  });
  const from = `translateY(${dragOffset}px)`;
  el.style.transform = "";
  try {
    await el.animate(
      [
        { clipPath: FULL_CLIP, transform: from },
        { clipPath: barClip(), transform: "translateY(0px)" },
      ],
      { duration: 360, easing: SHEET_EASING, fill: "forwards" },
    ).finished;
  } catch {
    // Animation interrompue : on ferme quand même.
  }
  emit("closed");
}

watch(
  () => player.sheetOpen.value,
  (open) => {
    if (!open && !closing.value) void shrinkToBar();
  },
);

// --- Téléphone : tirer le plein écran vers le bas le referme ---
// Le geste ne part que du haut de la page (sinon, c'est la page qui défile),
// et pas d'un curseur (la barre de lecture se tire de côté). Le plein écran
// suit le doigt ; lâché assez bas, ou d'un coup sec, il se réduit en barre,
// sinon il remonte.
const DRAG_SLOP = 8;
const DRAG_CLOSE = 120;
const FLICK_SPEED = 0.6; // px/ms
let touchStart: { x: number; y: number; atTop: boolean } | null = null;
let dragging = false;
let lastMove = { y: 0, time: 0 };
let speed = 0;

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  const target = event.target as HTMLElement | null;
  if (closing.value || !touch || target?.closest("input, [role='slider']")) {
    touchStart = null;
    return;
  }
  touchStart = { x: touch.clientX, y: touch.clientY, atTop: (root.value?.scrollTop ?? 0) <= 0 };
  dragging = false;
  dragOffset = 0;
  speed = 0;
  lastMove = { y: touch.clientY, time: event.timeStamp };
}

function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (!touchStart || !touch || !root.value) return;
  const dy = touch.clientY - touchStart.y;
  if (!dragging) {
    const vertical = Math.abs(dy) > Math.abs(touch.clientX - touchStart.x);
    if (!touchStart.atTop || dy <= DRAG_SLOP || !vertical) return;
    dragging = true;
  }
  event.preventDefault();
  dragOffset = Math.max(0, dy - DRAG_SLOP);
  const elapsed = event.timeStamp - lastMove.time;
  if (elapsed > 0) speed = (touch.clientY - lastMove.y) / elapsed;
  lastMove = { y: touch.clientY, time: event.timeStamp };
  root.value.style.transform = `translateY(${dragOffset}px)`;
}

function onTouchEnd() {
  touchStart = null;
  if (!dragging || !root.value) return;
  dragging = false;
  if (dragOffset > DRAG_CLOSE || speed > FLICK_SPEED) {
    player.closeSheet();
    return;
  }
  const from = `translateY(${dragOffset}px)`;
  root.value.style.transform = "";
  dragOffset = 0;
  if (motionAllowed()) {
    root.value.animate([{ transform: from }, { transform: "translateY(0px)" }], {
      duration: 220,
      easing: SHEET_EASING,
    });
  }
}

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";

function onKeydown(event: KeyboardEvent) {
  // La fenêtre de partage, ouverte par-dessus, se ferme seule d'abord.
  if (event.key === "Escape") {
    if (showShare.value) showShare.value = false;
    else player.closeSheet();
    return;
  }
  if (event.key !== "Tab" || showShare.value || !root.value) return;
  const items = [...root.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!root.value.contains(active) || (event.shiftKey && active === first)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
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
const placed = computed(() => player.queue.value.map((item, index) => ({ item, index })));
/** Ce qui suit le cours en cours, avec sa place dans la file. */
const following = computed(() => placed.value.slice(player.queueIndex.value + 1));
/**
 * Ce qui le précède. Replié d'abord : la file s'ouvre sur ce qui joue. Mais
 * un cours lancé au milieu d'une série ne doit pas en perdre le début.
 */
const earlier = computed(() => placed.value.slice(0, Math.max(0, player.queueIndex.value)));
const showEarlier = ref(false);
/** Les dix suivants d'abord : une série de quarante ne se lit pas d'un bloc. */
const QUEUE_FIRST = 10;
const showWholeQueue = ref(false);
const shownFollowing = computed(() =>
  showWholeQueue.value ? following.value : following.value.slice(0, QUEUE_FIRST),
);

/** Le chapitre qu'étudie un cours de la file, si son livre en a (voir chiourTexte). */
function chapterOf(item: AudioTrack): string {
  const entry = texteOf(item.texteId);
  return entry && hasChapitres(entry) && typeof item.texteChapitre === "number"
    ? chapitreLabel(entry, item.texteChapitre)
    : "";
}

/** La ligne sous un cours de la file : le chapitre qu'il étudie, sa durée. */
function itemLine(item: AudioTrack): string {
  const chapter = chapterOf(item);
  const duration = item.duration ? formatMinutes(item.duration, locale.value) : "";
  return [chapter, duration].filter(Boolean).join(" · ");
}

/** Sous le cours qui joue : son chapitre, ce qu'il en reste. */
const currentLine = computed(() => {
  if (!track.value) return "";
  const chapter = chapterOf(track.value);
  const total = player.duration.value || track.value.duration || 0;
  const left = total
    ? t("chiourim.player.left", {
        time: formatMinutes(total - player.currentTime.value, locale.value),
      })
    : "";
  return [chapter, left].filter(Boolean).join(" · ");
});

const showShare = ref(false);
const shareUrl = computed(() =>
  track.value?.slug ? `${SITE_URL}/chiourim/${track.value.slug}` : "",
);
</script>

<template>
  <div
    ref="root"
    class="player-sheet fixed inset-0 z-[58] overflow-y-auto overscroll-contain"
    :class="{ 'pointer-events-none': closing }"
    :style="{ backgroundColor: tone, color: COVER_INK }"
    role="dialog"
    aria-modal="true"
    :aria-label="t('audioPlayer.nowPlaying')"
  >
    <div
      v-if="track"
      ref="content"
      class="mx-auto w-full max-w-6xl px-6 pb-[calc(2rem+var(--safe-bottom,0px))] pt-[calc(0.75rem+var(--safe-top,0px))]"
    >
      <!-- En tête : réduire, d'où vient l'écoute, partager -->
      <header class="flex items-center gap-3">
        <button
          ref="collapseButton"
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
          <p dir="auto" class="truncate text-sm font-semibold">{{ track.context }}</p>
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

          <!-- Le titre et le rav ; la vitesse à leur droite, sous la main sans
               encombrer la rangée des commandes -->
          <div class="mt-8 flex items-start gap-4">
            <div class="min-w-0 flex-1">
              <h2 dir="auto" class="font-display text-2xl font-bold leading-tight line-clamp-3">
                {{ track.title }}
              </h2>
              <p v-if="track.subtitle" dir="auto" class="mt-1 truncate opacity-75">
                {{ track.subtitle }}
              </p>
            </div>
            <!-- Des classes globales : PlayerSpeed les pose sur son bouton, que le
                 style local de ce composant n'atteindrait pas -->
            <PlayerSpeed
              class="mt-1 shrink-0 bg-white/[0.14] transition-colors hover:bg-white/[0.22]"
            />
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
              <AppIcon :name="player.isPlaying.value ? 'pause-solid' : 'play-solid'" :size="30" />
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
              <!-- Masquée sur téléphone par son enveloppe : le display de
                   .sheet-pill, hors couche, l'emporterait sur « hidden » -->
              <span class="hidden shrink-0 sm:block">
                <span class="sheet-pill">{{ t("chiourim.texte.read") }}</span>
              </span>
            </button>
          </section>

          <!-- La file : les cours d'avant (repliés), ce qui joue, puis ce qui
               suit, une ligne par cours -->
          <section v-if="player.queue.value.length > 1" class="sheet-card overflow-hidden !p-0">
            <template v-if="earlier.length">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-5 pb-3 pt-4 text-start transition-colors hover:bg-white/5"
                :aria-expanded="showEarlier"
                aria-controls="sheet-earlier"
                @click="showEarlier = !showEarlier"
              >
                <span class="sheet-label">{{ t("chiourim.player.earlier") }}</span>
                <span class="flex items-center gap-1.5 text-xs opacity-60">
                  {{ t("chiourim.coursesCount", { count: earlier.length }) }}
                  <AppIcon
                    name="chevron-down"
                    :size="16"
                    class="transition-transform"
                    :class="{ 'rotate-180': showEarlier }"
                  />
                </span>
              </button>
              <ol v-show="showEarlier" id="sheet-earlier" class="sheet-queue">
                <li v-for="{ item, index } in earlier" :key="index">
                  <QueueRow
                    :number="item.episode ?? index + 1"
                    :title="shortTitle(item.title, track.context)"
                    :line="itemLine(item)"
                    @click="player.playAt(index)"
                  />
                </li>
              </ol>
            </template>
            <h3
              class="sheet-label px-5 pt-4"
              :class="{ 'border-t border-white/10': earlier.length }"
            >
              {{ t("chiourim.player.nowPlaying") }}
            </h3>
            <div class="flex items-center gap-3 px-5 pb-4 pt-3">
              <ChiourCover
                v-if="track.cover"
                :seed="track.cover.seed"
                :label="track.cover.label"
                size="sm"
              />
              <span class="min-w-0 flex-1">
                <span dir="auto" class="font-semibold leading-snug line-clamp-2">{{
                  shortTitle(track.title, track.context)
                }}</span>
                <span v-if="currentLine" class="mt-0.5 block text-sm opacity-70">{{
                  currentLine
                }}</span>
              </span>
              <NowPlayingBars :playing="player.isPlaying.value" class="shrink-0" />
            </div>

            <template v-if="following.length">
              <div class="flex items-baseline justify-between px-5 pt-2">
                <h3 class="sheet-label">{{ t("chiourim.player.upNext") }}</h3>
                <span class="text-xs opacity-60">{{
                  t("chiourim.coursesCount", { count: following.length })
                }}</span>
              </div>
              <ol class="sheet-queue mt-2">
                <li v-for="{ item, index } in shownFollowing" :key="index">
                  <QueueRow
                    :number="item.episode ?? index + 1"
                    :title="shortTitle(item.title, track.context)"
                    :line="itemLine(item)"
                    @click="player.playAt(index)"
                  />
                </li>
              </ol>
              <button
                v-if="following.length > shownFollowing.length"
                type="button"
                class="w-full border-t border-white/10 px-5 py-3 text-start text-sm font-semibold opacity-80 hover:opacity-100"
                @click="showWholeQueue = true"
              >
                {{ t("chiourim.player.wholeQueue", { count: following.length }) }}
              </button>
            </template>
          </section>

          <section v-if="chiour" class="sheet-card">
            <h3 class="mb-2 font-bold">{{ t("chiourim.player.about") }}</h3>
            <p
              v-if="chiour.description"
              dir="auto"
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
.sheet-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}
/* Une ligne par cours, séparées d'un filet : la file se lit d'un coup d'œil. */
.sheet-queue > li + li {
  border-top: 1px solid rgb(255 255 255 / 0.1);
}
.sheet-queue {
  border-top: 1px solid rgb(255 255 255 / 0.1);
}
.sheet-chip {
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgb(255 255 255 / 0.12);
}
</style>
