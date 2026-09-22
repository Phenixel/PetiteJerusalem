<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import ShareModal from "./ShareModal.vue";
import { useReadingSize } from "../composables/useReadingSize";
import { useScrollFrame } from "../composables/useScrollFrame";
import { useOverlay } from "../composables/useOverlayStack";
import { openFeedback } from "../composables/useFeedback";
import { clearPassage, readingPassage } from "../composables/useReadingSelection";
import { hasNiqqud, transliterate } from "../services/hebrewTransliteration";
import { analyticsService } from "../services/analyticsService";

/**
 * La bulle de commandes d'un passage choisi (voir useReadingSelection).
 *
 * Elle prend la place du menu du système, coupé sur les textes : au lieu de
 * copier, rechercher sur le web et traduire automatiquement un verset, elle
 * propose les trois gestes qui ont un sens devant un texte.
 *
 *  - **Partager** : le lien mène à ce passage précis (`?verset=…`), et non au
 *    haut du chapitre, si bien que celui qui le reçoit tombe dessus.
 *  - **Phonétique** : la translittération du seul passage choisi, en bulle,
 *    sans faire basculer toute la page (on bute sur un mot, on ne renonce pas
 *    à l'hébreu).
 *  - **Signaler** : le formulaire de support s'ouvre sur « une erreur », le
 *    champ des détails déjà rempli de ce qui permet de retrouver le passage
 *    (l'endroit, les premiers mots, le lien) ; la personne complète.
 *
 * Le marque-page s'y ajoute là où le texte en prend : c'était la seule
 * commande d'un verset choisi, elle rejoint les autres plutôt que de rester
 * seule sous le fil.
 *
 * Elle est posée une fois dans App.vue et suit le passage : la bulle glisse
 * avec lui au défilement, et s'efface quand il quitte l'écran, comme le fait
 * le menu qu'elle remplace.
 */

const { t } = useI18n();
const route = useRoute();
const scrollFrame = useScrollFrame();

/** Ce que la bulle montre : les commandes, ou la phonétique du passage. */
const view = ref<"actions" | "phonetic">("actions");
const showShare = ref(false);

/**
 * La place de la bulle : le haut de son bord, en pixels de fenêtre. Elle se
 * pose au-dessus du passage, comme le menu du système ; dessous quand le
 * passage touche le haut de l'écran, où elle passerait sous la zone système ou
 * sous le bandeau du site.
 */
const spot = shallowRef<{ top: number } | null>(null);

const bubble = ref<HTMLElement | null>(null);

/**
 * La bulle suit la taille de lecture, à moitié, comme le menu de lecture : qui
 * agrandit le texte le fait parce qu'il le lit mal, et lui laisser une rangée
 * de commandes en petits caractères la lui fermerait. À moitié, et plafonnée :
 * quatre colonnes doivent tenir sur la largeur d'un téléphone.
 */
const readingSize = useReadingSize();
const bubbleScale = computed(() => Math.min(1.2, 1 + (readingSize.scale.value - 1) * 0.5));
const iconSize = computed(() => Math.round(17 * bubbleScale.value));

/**
 * Ce qui tient le haut de l'écran et sous quoi la bulle ne passe pas : la zone
 * système (l'app native est bord à bord) et le bandeau du site. Mesuré par un
 * témoin : `--safe-top` est une expression `max()` que le style calculé ne rend
 * pas en pixels. Refait quand la fenêtre change de taille, pas à chaque image.
 */
const chromeTop = ref(0);
function measureChrome(): void {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;" +
    "height:calc(var(--safe-top) + var(--navbar-height) + 0.5rem)";
  document.body.appendChild(probe);
  chromeTop.value = probe.getBoundingClientRect().height;
  probe.remove();
}

/**
 * Hauteur supposée de la bulle tant qu'elle n'est pas rendue : sa rangée de
 * commandes est plus basse que cela, on la pose donc au-dessus sans hésiter.
 */
const ROOM_ABOVE = 132;
/**
 * L'écart entre la bulle et le passage : elle se pose contre lui, juste assez
 * détachée pour qu'on voie où finit l'une et où commence l'autre.
 */
const GAP = 6;

function measure(): void {
  const el = readingPassage.value?.el;
  if (!el || !el.isConnected) {
    spot.value = null;
    return;
  }
  const rect = el.getBoundingClientRect();
  // Passage sorti de l'écran : la bulle s'efface, le choix reste. Elle
  // revient telle quelle dès qu'on remonte dessus.
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    spot.value = null;
    return;
  }
  // Sa hauteur réelle dès qu'elle est rendue : la phonétique d'un long
  // paragraphe ne tient pas dans la place d'une rangée de commandes, et
  // sortirait par le haut de l'écran.
  const height = bubble.value?.offsetHeight || ROOM_ABOVE;
  const above = rect.top - GAP - height;
  const below = above < chromeTop.value;
  spot.value = { top: below ? rect.bottom + GAP : above };
}

// La bulle suit le passage sans poser d'écouteur de plus : la géométrie du
// défilement est déjà mesurée une fois par image pour toute l'app.
watch([readingPassage, scrollFrame], measure, { immediate: true });
watch(() => scrollFrame.value.viewport, measureChrome);
// La phonétique change sa hauteur : elle peut lui faire changer de côté.
watch(view, () => void nextTick(measure));
// Et la bulle se replace une fois rendue, sa hauteur enfin connue (voir aussi
// le montage, plus bas) : sur la hauteur supposée, elle se posait trop haut
// au-dessus du passage, ou passait dessous alors qu'elle tenait au-dessus.
watch(readingPassage, () => void nextTick(measure));

// Un nouveau passage repart des commandes : la phonétique du précédent n'a
// rien à faire au-dessus de celui-ci, ni sa fenêtre de partage devant.
watch(readingPassage, (passage) => {
  view.value = "actions";
  showShare.value = false;
  if (passage) {
    analyticsService.capture("passage_menu_opened", {
      bookmarkable: typeof passage.bookmarked === "boolean",
    });
  }
});

const isOpen = computed(() => readingPassage.value !== null);
// Le bouton retour d'Android relâche le passage avant de quitter la page.
useOverlay(isOpen, clearPassage);

// Une navigation (lien du menu de lecture, retour) laisse le passage derrière.
watch(() => route.fullPath, clearPassage);

/**
 * La phonétique du passage : calculée à la demande, elle parcourt chaque
 * lettre. Un texte sans voyelles ne se translittère pas, la commande ne se
 * montre alors pas du tout.
 */
const phonetic = computed(() =>
  view.value === "phonetic" && readingPassage.value
    ? transliterate(readingPassage.value.hebrew)
    : "",
);
const canTransliterate = computed(() => hasNiqqud(readingPassage.value?.hebrew ?? ""));

/** Le marque-page ne se propose que là où le texte en prend (voir ReadingPassage). */
const showBookmark = computed(() => typeof readingPassage.value?.bookmarked === "boolean");
/**
 * L'intitulé de la commande reste « Marque-page » : la bulle tient quatre
 * colonnes sur un téléphone, « Retirer le marque-page » les ferait éclater.
 * C'est la couleur de l'icône qui dit qu'il est posé, et le nom complet qui
 * l'annonce à qui ne voit pas l'écran.
 */
const bookmarkLabel = computed(() =>
  readingPassage.value?.bookmarked ? t("textReading.bookmarkRemove") : t("textReading.bookmarkAdd"),
);

/** Les premiers mots du passage : de quoi le reconnaître dans un signalement. */
const EXCERPT_MAX = 160;
function excerpt(hebrew: string): string {
  const clean = hebrew.trim().replace(/\s+/g, " ");
  return clean.length > EXCERPT_MAX ? `${clean.slice(0, EXCERPT_MAX).trimEnd()}…` : clean;
}

function track(action: string): void {
  analyticsService.capture("passage_action", { action });
}

function share(): void {
  track("share");
  showShare.value = true;
}

function showPhonetic(): void {
  track("phonetic");
  view.value = "phonetic";
}

/**
 * Le signalement : le formulaire s'ouvre sur « une erreur », et le champ des
 * détails porte déjà l'endroit, les premiers mots et le lien. C'est ce qui
 * manquait le plus aux signalements reçus : « il y a une faute dans les
 * Tehilim » ne se retrouve pas, « Tehilim 23 · verset 4 » se corrige.
 */
function report(): void {
  const passage = readingPassage.value;
  if (!passage) return;
  track("report");
  const details = [
    t("textReading.selection.reportPlace", { place: passage.place }),
    t("textReading.selection.reportText", { text: excerpt(passage.hebrew) }),
    t("textReading.selection.reportLink", { url: passage.url }),
  ].join("\n");
  clearPassage();
  analyticsService.capture("feedback_opened", { from: "passage" });
  openFeedback({ kind: "error", details: `${details}\n\n` });
}

function bookmark(): void {
  const passage = readingPassage.value;
  if (!passage?.toggleBookmark) return;
  track(passage.bookmarked ? "bookmark_removed" : "bookmark_added");
  passage.toggleBookmark();
  clearPassage();
}

/**
 * Un appui hors du passage et hors de la bulle relâche le choix. Les passages
 * sont exclus pour que le second appui les relâche eux-mêmes : sans cela, cet
 * écouteur aurait relâché le choix juste avant que l'appui ne le repose.
 */
function onPointerDown(event: PointerEvent): void {
  // La fenêtre de partage porte le passage : le relâcher la ferait disparaître
  // sous les doigts de celui qui vient de l'ouvrir.
  if (showShare.value || !readingPassage.value) return;
  const target = event.target;
  if (target instanceof Element && target.closest(".reading-pick, .reading-bubble")) return;
  clearPassage();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") clearPassage();
}

onMounted(() => {
  measureChrome();
  // Le tout premier passage de la page : la bulle a été placée pendant que le
  // composant se montait, c'est-à-dire sur sa hauteur supposée, et le suivi
  // ci-dessus ne rejoue pas pour un passage déjà choisi. Elle se replace donc
  // ici, la bulle rendue et sa hauteur connue. Sans ce passage, le premier
  // passage choisi de chaque page laissait un blanc sous la bulle.
  measure();
  document.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <!-- L'enveloppe tient toute la largeur et ne prend aucun appui : seule la
       bulle qu'elle centre en reçoit. La bulle se pose ainsi au milieu de la
       colonne de lecture, quelle que soit la longueur du passage. -->
  <Transition name="bubble">
    <div
      v-if="readingPassage && spot && !showShare"
      class="bubble-anchor"
      :style="{ top: `${spot.top}px`, '--bubble-scale': bubbleScale }"
    >
      <div
        ref="bubble"
        class="reading-bubble"
        role="group"
        :aria-label="t('textReading.selection.title')"
      >
        <!-- Les commandes du passage : une rangée, comme le menu qu'elles
             remplacent, chacune sous son icône. -->
        <div v-if="view === 'actions'" class="flex items-stretch">
          <button type="button" class="bubble-action" @click="share">
            <AppIcon name="share" :size="iconSize" />
            {{ t("textReading.selection.share") }}
          </button>
          <button v-if="canTransliterate" type="button" class="bubble-action" @click="showPhonetic">
            <AppIcon name="languages" :size="iconSize" />
            {{ t("textReading.phonetic") }}
          </button>
          <button type="button" class="bubble-action" @click="report">
            <AppIcon name="flag" :size="iconSize" />
            {{ t("textReading.selection.report") }}
          </button>
          <!-- Le marque-page, là où le texte en prend : on ne revient pas à un
               verset d'une brakha ou d'un daf. -->
          <button
            v-if="showBookmark"
            type="button"
            class="bubble-action"
            :class="readingPassage.bookmarked ? 'text-primary' : ''"
            :aria-label="bookmarkLabel"
            :title="bookmarkLabel"
            @click="bookmark"
          >
            <AppIcon name="bookmark" :size="iconSize" />
            {{ t("textReading.selection.bookmark") }}
          </button>
        </div>

        <!-- La phonétique du seul passage choisi : l'hébreu reste à l'écran
             dessous, on ne bascule pas toute la page pour un mot. -->
        <div v-else class="bubble-phonetic">
          <div class="flex items-start justify-between gap-2">
            <p class="bubble-place">{{ readingPassage.place }}</p>
            <button
              type="button"
              class="icon-btn !w-7 !h-7 shrink-0"
              :aria-label="t('common.close')"
              @click="clearPassage()"
            >
              <AppIcon name="x" :size="14" />
            </button>
          </div>
          <p dir="ltr" class="bubble-tl">{{ phonetic }}</p>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Le partage du passage : la même fenêtre que partout ailleurs, avec le
       lien qui ramène ici. Dans le <body>, comme les autres fenêtres : la
       bulle s'efface pendant qu'elle est ouverte, et l'emporterait avec elle. -->
  <Teleport to="body">
    <ShareModal
      v-if="readingPassage"
      v-model:show="showShare"
      :session-name="readingPassage.place"
      :share-url="readingPassage.url"
      title-key="shareModal.titlePassage"
      message-key="shareModal.invitePassage"
      content-type="text"
      :content-id="readingPassage.key"
    />
  </Teleport>
</template>

<style scoped>
/* L'enveloppe : posée sur la fenêtre, à la hauteur du passage, transparente
   aux appuis. Le retrait de côté garantit que la bulle ne touche jamais le
   bord d'un écran étroit. */
.bubble-anchor {
  position: fixed;
  inset-inline: 0;
  z-index: 45;
  display: flex;
  justify-content: center;
  padding-inline: 0.75rem;
  pointer-events: none;
}

.reading-bubble {
  pointer-events: auto;
  max-width: min(26rem, 100%);
  overflow: hidden;
  border-radius: var(--radius-xl);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
}

/* Une commande : l'icône, puis son nom en petit, dans une colonne étroite.
   Quatre tiennent sur la largeur d'un téléphone. */
.bubble-action {
  display: flex;
  min-width: calc(4.5rem * var(--bubble-scale, 1));
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.3rem;
  padding: 0.6rem 0.5rem;
  font-size: calc(0.72rem * var(--bubble-scale, 1));
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  color: var(--color-text-primary);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.bubble-action:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-primary);
}

.bubble-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* La phonétique : un texte, pas une commande. Elle défile si le passage est
   long, la bulle ne mange jamais l'écran. */
.bubble-phonetic {
  max-height: 40vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.75rem 0.85rem;
}

.bubble-place {
  font-size: calc(0.75rem * var(--bubble-scale, 1));
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-secondary);
}

.bubble-tl {
  margin-top: 0.35rem;
  font-family: var(--font-reading);
  font-size: calc(1rem * var(--bubble-scale, 1));
  font-style: italic;
  line-height: 1.6;
  color: var(--color-text-primary);
}

/* Elle surgit du passage, brièvement : elle accompagne l'appui, elle ne
   s'annonce pas. */
.bubble-enter-active {
  transition:
    opacity 0.12s ease-out,
    scale 0.18s cubic-bezier(0.3, 1.3, 0.55, 1);
}

.bubble-leave-active {
  transition:
    opacity 0.1s ease-in,
    scale 0.1s ease-in;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  scale: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .bubble-enter-active,
  .bubble-leave-active {
    transition: opacity 0.12s ease;
  }

  .bubble-enter-from,
  .bubble-leave-to {
    scale: 1;
  }
}
</style>
