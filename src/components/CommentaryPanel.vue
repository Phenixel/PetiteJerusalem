<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import BottomSheet from "./BottomSheet.vue";
import { sideBySide } from "../composables/useSideBySide";
import { useOverlay } from "../composables/useOverlayStack";
import { STUDY_MIN, TEXT_ROOM, useStudyWidth } from "../composables/useStudyWidth";
import { analyticsService } from "../services/analyticsService";
import { COMMENTARY_LABELS, type CommentaryGroup } from "../composables/usePassageCommentaries";

/**
 * Le panneau d'étude : les commentaires du passage choisi (Rachi, Tossafot),
 * ouvert depuis le bouton « Commentaires » de la bulle d'un passage.
 *
 * Il suit la lecture : tant qu'il est ouvert, toucher un autre passage du
 * texte y montre les commentaires de celui-ci, sans rouvrir de bulle. On
 * étudie ainsi un daf passage après passage, d'un seul geste chaque fois.
 *
 * Sur un téléphone (app ou site), c'est un bottom sheet (BottomSheet.vue) à
 * mi-hauteur, qu'on tire par sa poignée jusqu'en haut de l'écran pour lire
 * un long Tossafot, et qu'on pousse vers le bas pour le fermer (la page
 * réserve sa hauteur sous le texte pour qu'on puisse lire jusqu'au bout).
 * Dès que l'écran a la place de deux colonnes (tablette, pliant ouvert,
 * téléphone en paysage, ordinateur : voir useSideBySide), c'est une colonne
 * à droite du texte, qui se range à sa gauche.
 * Il se ferme aussi d'une croix, d'Échap ou du bouton retour.
 *
 * La colonne se tire par son bord gauche pour lui donner plus ou moins de
 * place (useStudyWidth) ; le texte à sa gauche suit. Au clavier, les flèches
 * gauche et droite la font grandir et rétrécir ; un double appui sur le bord
 * lui rend sa largeur d'origine.
 */
const props = defineProps<{
  /** Où se trouve le passage, en clair : « Daf 2a · passage 3 ». */
  place: string;
  /** Ses commentaires ; vide : le passage n'en a pas. */
  groups: CommentaryGroup[];
  state: "idle" | "loading" | "ready" | "error";
}>();

const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();

const open = ref(true);
useOverlay(open, () => emit("close"));

/** Chaque passage repart du haut de ses commentaires (le corps du volet défile). */
const body = ref<HTMLElement | null>(null);
watch(
  () => props.place,
  () => body.value?.closest(".sheet-body")?.scrollTo({ top: 0 }),
);

const isEmpty = computed(() => props.state === "ready" && props.groups.length === 0);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") emit("close");
}

// ---- La largeur de la colonne, tirée par son bord gauche -------------------

const studyWidth = useStudyWidth();
const panelWidth = ref(0);
const maxWidth = ref(STUDY_MIN);
let drag: { pointer: number; moved: boolean } | null = null;

function panelEl(): HTMLElement | null {
  return body.value?.closest(".commentary-panel") ?? null;
}

function measureWidth(): void {
  panelWidth.value = Math.round(panelEl()?.getBoundingClientRect().width ?? 0);
  maxWidth.value = Math.max(STUDY_MIN, window.innerWidth - TEXT_ROOM);
}

/** Pendant le geste, rien ne glisse en douceur et rien ne se sélectionne. */
function setResizing(on: boolean): void {
  document.documentElement.classList.toggle("study-resizing", on);
}

function onResizeStart(event: PointerEvent): void {
  if (event.button > 0) return;
  event.preventDefault();
  drag = { pointer: event.pointerId, moved: false };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  setResizing(true);
}

function onResizeMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointer) return;
  drag.moved = true;
  // La colonne tient le bord droit de l'écran : sa largeur est ce qui reste
  // à droite du doigt.
  studyWidth.preview(document.documentElement.clientWidth - event.clientX);
  measureWidth();
}

function onResizeEnd(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointer) return;
  const moved = drag.moved;
  drag = null;
  setResizing(false);
  if (!moved) return;
  studyWidth.commit();
  captureResize();
}

function onResizeKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 64 : 24;
  const current = panelWidth.value || STUDY_MIN;
  const next =
    event.key === "ArrowLeft"
      ? current + step
      : event.key === "ArrowRight"
        ? current - step
        : event.key === "Home"
          ? STUDY_MIN
          : event.key === "End"
            ? maxWidth.value
            : null;
  if (next === null) return;
  event.preventDefault();
  studyWidth.preview(next);
  studyWidth.commit();
  void nextTick(measureWidth);
  captureResize();
}

function resetWidth(): void {
  studyWidth.reset();
  void nextTick(measureWidth);
  analyticsService.capture("commentaries_resized", {
    width: null,
    viewport_width: window.innerWidth,
  });
}

function captureResize(): void {
  analyticsService.capture("commentaries_resized", {
    width: studyWidth.chosen.value,
    viewport_width: window.innerWidth,
  });
}

watch(sideBySide, () => void nextTick(measureWidth));
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", measureWidth);
  measureWidth();
});
onBeforeUnmount(() => {
  open.value = false;
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", measureWidth);
  setResizing(false);
});
</script>

<template>
  <BottomSheet
    class="commentary-panel"
    :label="t('textReading.commentaries.title')"
    :snaps="[0.55, 0.92]"
    :docked="sideBySide"
    @close="emit('close')"
  >
    <template #header>
      <div
        v-if="sideBySide"
        class="study-resizer"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        :aria-label="t('textReading.commentaries.resize')"
        :title="t('textReading.commentaries.resizeHint')"
        :aria-valuemin="STUDY_MIN"
        :aria-valuemax="maxWidth"
        :aria-valuenow="panelWidth"
        @pointerdown="onResizeStart"
        @pointermove="onResizeMove"
        @pointerup="onResizeEnd"
        @pointercancel="onResizeEnd"
        @dblclick="resetWidth"
        @keydown="onResizeKey"
      >
        <span class="study-resizer-grip" aria-hidden="true"></span>
      </div>
      <header class="commentary-head">
        <div class="min-w-0">
          <p class="commentary-title">{{ t("textReading.commentaries.title") }}</p>
          <p class="commentary-place">{{ place }}</p>
        </div>
        <button
          type="button"
          class="icon-btn shrink-0"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </header>
    </template>

    <div ref="body" class="commentary-body">
      <p v-if="state === 'loading' || state === 'idle'" class="commentary-note">
        {{ t("textReading.commentaries.loading") }}
      </p>
      <p v-else-if="state === 'error'" class="commentary-note">
        {{ t("textReading.commentaries.error") }}
      </p>
      <p v-else-if="isEmpty" class="commentary-note">
        {{ t("textReading.commentaries.none") }}
      </p>
      <section v-for="group in groups" v-else :key="group.source" class="commentary-group">
        <h3 class="commentary-source">{{ t(COMMENTARY_LABELS[group.source]) }}</h3>
        <p
          v-for="(comment, i) in group.comments"
          :key="i"
          dir="rtl"
          class="commentary-text font-hebrew"
        >
          <b v-if="comment.lead" class="commentary-lead">{{ comment.lead }}</b>
          {{ comment.text }}
        </p>
      </section>
      <p class="commentary-hint">{{ t("textReading.commentaries.hint") }}</p>
    </div>
  </BottomSheet>
</template>

<style scoped>
/* Écran large : le volet devient une colonne à droite, sous le bandeau, sur
   toute la hauteur (la page se range à sa gauche, voir TextReadingPage), de
   la largeur `--study-width` (main.css). */
.commentary-panel.sheet-docked {
  inset: calc(var(--safe-top, 0px) + var(--navbar-height, 4rem)) 0 0 auto;
  z-index: 46;
  width: var(--study-width);
  max-height: none;
  border-radius: var(--radius-xl) 0 0 0;
  animation: none;
}

/* Dans l'app, sur une tablette : la colonne s'arrête au-dessus de la barre
   d'onglets (3,5 rem, plus la zone des gestes). */
:global(.native-app .commentary-panel.sheet-docked) {
  bottom: calc(3.5rem + var(--safe-bottom, 0px));
  border-radius: var(--radius-xl) 0 0 var(--radius-xl);
}

/* Le bord gauche de la colonne, qu'on tire pour la régler : une bande de
   14 px à cheval sur le bord, et, au milieu de sa hauteur, un trait vertical
   comme la poignée d'un volet. Survolée ou au clavier, elle prend la couleur
   du thème sur toute sa hauteur. */
.study-resizer {
  position: absolute;
  inset: 0 auto 0 -7px;
  z-index: 1;
  display: flex;
  width: 14px;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
}

.study-resizer::before {
  position: absolute;
  inset: var(--radius-xl) auto var(--radius-xl) 6px;
  width: 2px;
  border-radius: 999px;
  background-color: var(--color-primary);
  content: "";
  opacity: 0;
  transition: opacity 0.15s ease;
}

.study-resizer:hover::before,
.study-resizer:focus-visible::before,
:global(.study-resizing .study-resizer::before) {
  opacity: 1;
}

.study-resizer:focus-visible {
  outline: none;
}

.study-resizer-grip {
  position: relative;
  width: 0.3rem;
  height: 2.25rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 18%, transparent);
}

.commentary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 1rem 0.6rem 1.25rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}

.sheet-docked .commentary-head {
  padding-top: 0.9rem;
}

.commentary-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.commentary-place {
  margin-top: 0.15rem;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}

/* Le corps du volet défile (BottomSheet) : ici, la marge du texte seulement. */
.commentary-body {
  padding: 0.75rem 1.25rem 1.25rem;
}

.commentary-group + .commentary-group {
  margin-top: 1.25rem;
}

.commentary-source {
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

/* Le commentaire suit la taille de lecture : c'est un texte qu'on étudie,
   pas une étiquette. */
.commentary-text {
  font-size: calc(1.05rem * var(--reading-scale, 1));
  line-height: 1.7;
  color: var(--color-text-primary);
}

.commentary-text + .commentary-text {
  margin-top: 0.6rem;
}

.commentary-lead {
  font-weight: 700;
}

.commentary-note,
.commentary-hint {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.commentary-hint {
  margin-top: 1.25rem;
}
</style>
