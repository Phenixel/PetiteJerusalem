<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import BottomSheet from "./BottomSheet.vue";
import { useOverlay } from "../composables/useOverlayStack";
import { COMMENTARY_LABELS, type CommentaryGroup } from "../composables/usePassageCommentaries";

/**
 * Le panneau d'étude : les commentaires du passage choisi (Rachi, Tossafot),
 * ouvert depuis le bouton « Commentaires » de la bulle d'un passage.
 *
 * Il suit la lecture : tant qu'il est ouvert, toucher un autre passage du
 * texte y montre les commentaires de celui-ci, sans rouvrir de bulle. On
 * étudie ainsi un daf passage après passage, d'un seul geste chaque fois.
 *
 * Sur un téléphone, c'est un bottom sheet (BottomSheet.vue) à mi-hauteur,
 * qu'on tire par sa poignée jusqu'en haut de l'écran pour lire un long
 * Tossafot, et qu'on pousse vers le bas pour le fermer (la page réserve sa
 * hauteur sous le texte pour qu'on puisse lire jusqu'au bout) ; sur un écran
 * large, une colonne à droite du texte, qui se décale pour lui faire place.
 * Il se ferme aussi d'une croix, d'Échap ou du bouton retour.
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

/** Écran large : la colonne de droite, sans poignée ni geste. */
const WIDE = "(min-width: 1024px)";
const wideQuery = typeof window !== "undefined" ? window.matchMedia?.(WIDE) : undefined;
const wide = ref(wideQuery?.matches ?? false);
const onWide = (event: MediaQueryListEvent): void => {
  wide.value = event.matches;
};

const isEmpty = computed(() => props.state === "ready" && props.groups.length === 0);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") emit("close");
}
onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  wideQuery?.addEventListener?.("change", onWide);
});
onBeforeUnmount(() => {
  open.value = false;
  window.removeEventListener("keydown", onKeydown);
  wideQuery?.removeEventListener?.("change", onWide);
});
</script>

<template>
  <BottomSheet
    class="commentary-panel"
    :label="t('textReading.commentaries.title')"
    :snaps="[0.55, 0.92]"
    :docked="wide"
    @close="emit('close')"
  >
    <template #header>
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
   toute la hauteur (la page se range à sa gauche, voir TextReadingPage). */
.commentary-panel.sheet-docked {
  inset: calc(var(--safe-top, 0px) + var(--navbar-height, 4rem)) 0 0 auto;
  z-index: 46;
  width: 24rem;
  max-height: none;
  border-radius: var(--radius-xl) 0 0 0;
  animation: none;
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
