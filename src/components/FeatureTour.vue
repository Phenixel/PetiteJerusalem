<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";
import { useFeatureTips, type FeatureTipId } from "../composables/useFeatureTips";
import { isOnboardingOpen } from "../composables/useOnboarding";
import { hasOpenOverlay, pushOverlay } from "../composables/useOverlayStack";
import { analyticsService } from "../services/analyticsService";

/**
 * Une astuce jouée sur la page, devant la commande qu'elle explique.
 *
 * Trois couches, toutes posées dans le <body> (la page des horaires vit sous
 * une transition qui la rogne en cercle, un `fixed` posé dedans serait rogné
 * avec elle) :
 *
 *  - un voile qui assombrit la page, percé d'un projecteur sur la commande.
 *    Le voile est un dessin SVG dont le trou n'est pas peint : ce qu'on y
 *    touche atteint la commande elle-même, qui répond comme d'habitude. La
 *    toucher vaut « j'ai compris », l'astuce passe au pas suivant ou s'en va ;
 *  - un liseré de la couleur du thème autour du projecteur, qui respire ;
 *  - une bulle, au-dessus ou au-dessous selon la place, avec sa flèche vers
 *    la commande : un titre, deux phrases, « Suivant » ou « Compris », et
 *    « Passer ». Toucher le voile passe aussi. « Me le rappeler à la
 *    prochaine ouverture » la remet à plus tard sans la compter vue.
 *
 * Un pas peut n'avoir aucune commande à éclairer (un geste à deux doigts sur
 * le texte) : la bulle se pose alors au milieu de l'écran, sans projecteur,
 * et montre le geste dans une capture dessinée (`component`, voir
 * src/components/mock), plutôt que de le décrire.
 *
 * Le composant décide seul de se montrer : jamais deux fois la même astuce,
 * une seule par ouverture de l'app (useFeatureTips), jamais sous
 * l'introduction ni sous une fenêtre ouverte, jamais devant une commande qui
 * n'est pas à l'écran, et pas avant que la page ne se soit posée (`delay`).
 * Une astuce est notée vue quand elle se ferme, ou quand on quitte la page
 * en plein milieu : seule « à la prochaine ouverture » la fait revenir.
 *
 * La page qui l'accueille décrit ses pas (`steps`) et se prépare à chacun
 * par l'évènement `step` (ouvrir un panneau pour montrer ce qu'il contient),
 * puis range à la fin par `finish`, qui dit comment l'astuce s'est close.
 */

export interface TourStep {
  /** Nom du pas, pour la mesure et la clé de rendu. */
  key: string;
  title: string;
  text: string;
  /** Dessin posé devant le titre. */
  icon?: IconName;
  /**
   * La commande à éclairer, résolue au moment où le pas commence. Sans
   * cible, la bulle se pose au milieu de l'écran (un geste sur le texte).
   */
  target?: () => HTMLElement | null;
  /** Une capture dessinée du geste, montrée dans la bulle. */
  component?: Component;
  /** Rayon du projecteur (pixels) : 9999 pour un bouton rond. */
  radius?: number;
  /** Marge entre la commande et le bord du projecteur (pixels). */
  padding?: number;
  /**
   * La commande répond à un geste qui ne produit aucun clic (une ligne
   * qu'on tire) : le relâcher du doigt vaut alors aussi « j'ai compris ».
   */
  gesture?: boolean;
}

/**
 * Comment l'astuce s'est close ; `lost` : la commande éclairée a disparu ;
 * `later` : remise à la prochaine ouverture, elle n'est pas comptée vue.
 */
export type TourExit =
  | "next"
  | "skip"
  | "target"
  | "backdrop"
  | "escape"
  | "back"
  | "lost"
  | "later";

const props = withDefaults(
  defineProps<{
    tip: FeatureTipId;
    steps: TourStep[];
    /** Les astuces à avoir vues avant celle-ci (une ouverture plus tôt). */
    after?: FeatureTipId[];
    /** Le temps que la page se pose (transition d'arrivée comprise). */
    delay?: number;
  }>(),
  { after: () => [], delay: 800 },
);

const emit = defineEmits<{
  /** Un pas commence : la page se met en place (ouvre ce qu'il faut voir). */
  (e: "step", index: number, key: string): void;
  /** L'astuce est close ; la page range ce qu'elle avait ouvert. */
  (e: "finish", via: TourExit, index: number): void;
}>();

const { t } = useI18n();
const { shouldShowTip, claimTip, releaseTip, markTipSeen } = useFeatureTips();

const visible = ref(false);
const index = ref(0);
const step = computed(() => props.steps[index.value]);
const isLast = computed(() => index.value === props.steps.length - 1);

/** Marge par défaut entre la commande et le projecteur. */
const PADDING = 6;
/** Distance entre le projecteur et la flèche de la bulle. */
const BUBBLE_GAP = 14;
/** Largeur de la bulle, et la gouttière qu'elle laisse aux bords de l'écran. */
const BUBBLE_WIDTH = 352;
const GUTTER = 16;
/** Ce que la flèche laisse entre elle et le coin arrondi de la bulle. */
const CARET_INSET = 24;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const hole = ref<Box | null>(null);
const viewport = ref({ width: 0, height: 0 });

let target: HTMLElement | null = null;
let timers: number[] = [];
let resizeObserver: ResizeObserver | null = null;
let removeOverlay: (() => void) | null = null;

/** Le projecteur suit la commande : mesurée à nouveau à chaque mouvement. */
function measure(): void {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const padding = step.value?.padding ?? PADDING;
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  hole.value = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function clearTimers(): void {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
}

/**
 * Plusieurs mesures échelonnées : ce que la page ouvre pour un pas (le
 * second bouton rond du menu de lecture) arrive en transition, et une seule
 * mesure au départ éclairerait une place encore vide.
 */
function measureSoon(): void {
  clearTimers();
  measure();
  [120, 350, 700].forEach((delay) => timers.push(window.setTimeout(measure, delay)));
}

function watchTarget(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!target || typeof ResizeObserver === "undefined") return;
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(target);
}

const isVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

/** Un pas commence : la commande est trouvée, amenée à l'écran, éclairée. */
async function startStep(next: number): Promise<void> {
  index.value = next;
  emit("step", next, props.steps[next].key);
  await nextTick();
  const find = props.steps[next].target;
  if (!find) {
    // Un geste sans commande : pas de projecteur, la bulle au milieu.
    clearTimers();
    resizeObserver?.disconnect();
    resizeObserver = null;
    target = null;
    hole.value = null;
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
    return;
  }
  target = find();
  if (!target || !isVisible(target)) {
    // Rien à éclairer pour ce pas : on passe au suivant, ou on s'en va.
    if (next + 1 < props.steps.length) return startStep(next + 1);
    finish("next");
    return;
  }
  const rect = target.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    target.scrollIntoView?.({ block: "center" });
  }
  watchTarget();
  measureSoon();
}

async function show(): Promise<void> {
  if (!claimTip(props.tip)) return;
  visible.value = true;
  analyticsService.capture("feature_tip_shown", { tip: props.tip, steps: props.steps.length });
  // La page derrière ne bouge pas pendant l'astuce : le projecteur est posé
  // sur une commande, il ne doit pas la perdre au premier défilement.
  document.documentElement.style.overflow = "hidden";
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", measure, { passive: true });
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("touchend", onDocumentTouch);
  // Retour Android : l'astuce se retire avant la page.
  removeOverlay = pushOverlay(() => finish("back"));
  await startStep(0);
  await nextTick();
  bubble.value?.focus();
}

function teardown(): void {
  clearTimers();
  resizeObserver?.disconnect();
  resizeObserver = null;
  target = null;
  window.removeEventListener("resize", measure);
  window.removeEventListener("scroll", measure);
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("touchend", onDocumentTouch);
  removeOverlay?.();
  removeOverlay = null;
  if (visible.value) document.documentElement.style.overflow = "";
}

function finish(via: TourExit): void {
  if (!visible.value) return;
  const at = index.value;
  teardown();
  visible.value = false;
  // Remise à la prochaine ouverture : l'astuce reviendra ; sinon, c'est vu.
  if (via !== "later") markTipSeen(props.tip);
  releaseTip(props.tip);
  analyticsService.capture("feature_tip_finished", { tip: props.tip, via, step: at });
  emit("finish", via, at);
}

/** « Suivant », ou la commande touchée : le pas d'après, ou la fin. */
function advance(via: TourExit): void {
  if (isLast.value) finish(via);
  else void startStep(index.value + 1);
}

const onTarget = (event: Event) =>
  target !== null && event.target instanceof Node && target.contains(event.target);

/**
 * La commande touchée à travers le projecteur : elle fait ce qu'elle fait
 * d'habitude, et l'astuce passe au pas suivant, on a compris. Écouté après
 * la commande (pas en capture) : la page qui prépare le pas suivant voit
 * alors ce que la commande vient d'ouvrir, et ne l'ouvre pas deux fois.
 */
function onDocumentClick(event: Event): void {
  if (onTarget(event)) advance("target");
}

/**
 * Le geste aussi, quand le pas le dit : une ligne d'horaire tirée vers la
 * gauche ne produit aucun clic, et c'est pourtant ce que l'astuce demandait.
 */
function onDocumentTouch(event: Event): void {
  if (step.value?.gesture && onTarget(event)) advance("target");
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") finish("escape");
}

/** Le délai de pose, puis l'astuce si rien d'autre ne réclame l'attention. */
function schedule(): void {
  timers.push(
    window.setTimeout(() => {
      timers = [];
      // L'introduction occupe l'écran (première ouverture, l'accueil monté
      // dessous) : l'astuce attend qu'elle se ferme, puis reprend son délai.
      if (isOnboardingOpen.value) {
        const stop = watch(isOnboardingOpen, (open) => {
          if (open) return;
          stop();
          schedule();
        });
        return;
      }
      if (document.hidden || hasOpenOverlay()) return;
      const find = props.steps[0].target;
      if (find) {
        const first = find();
        if (!first || !isVisible(first)) return;
      }
      void show();
    }, props.delay),
  );
}

onMounted(async () => {
  if (!props.steps.length || !(await shouldShowTip(props.tip, props.after))) return;
  schedule();
});

onBeforeUnmount(() => {
  teardown();
  // Partie en plein milieu : l'astuce a été vue, elle ne revient pas.
  if (visible.value) {
    markTipSeen(props.tip);
    releaseTip(props.tip);
  }
  visible.value = false;
});

// La page qui accueille l'astuce peut la clore elle-même : quand ce qu'elle
// avait ouvert pour un pas se referme sous le projecteur (retour Android).
defineExpose({ finish });

/** Le projecteur en chemin SVG : le cadre de l'écran, moins la commande. */
const maskPath = computed(() => {
  const box = hole.value;
  const { width, height } = viewport.value;
  if (!box) return `M0 0H${width}V${height}H0Z`;
  const r = Math.min(step.value?.radius ?? 12, box.width / 2, box.height / 2);
  const x = box.left;
  const y = box.top;
  const right = x + box.width;
  const bottom = y + box.height;
  return [
    `M0 0H${width}V${height}H0Z`,
    `M${x + r} ${y}H${right - r}A${r} ${r} 0 0 1 ${right} ${y + r}V${bottom - r}`,
    `A${r} ${r} 0 0 1 ${right - r} ${bottom}H${x + r}A${r} ${r} 0 0 1 ${x} ${bottom - r}`,
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`,
  ].join("");
});

const ringStyle = computed(() => {
  const box = hole.value;
  if (!box) return { display: "none" };
  return {
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    borderRadius: `${step.value?.radius ?? 12}px`,
  };
});

/**
 * La bulle se pose du côté où il y a le plus de place, sa flèche vers le
 * milieu de la commande, sans jamais sortir de l'écran.
 */
const placement = computed(() => {
  const box = hole.value;
  const { width: vw, height: vh } = viewport.value;
  if (!box) return null;
  const above = box.top > vh - (box.top + box.height);
  const width = Math.min(BUBBLE_WIDTH, vw - GUTTER * 2);
  const centerX = box.left + box.width / 2;
  const left = Math.min(Math.max(GUTTER, centerX - width / 2), vw - GUTTER - width);
  const caret = Math.min(Math.max(CARET_INSET, centerX - left), width - CARET_INSET);
  return { above, width, left, caret, box };
});

const bubbleStyle = computed(() => {
  const p = placement.value;
  const { width: vw, height: vh } = viewport.value;
  // Sans commande à éclairer : au milieu de l'écran.
  if (!p) {
    const width = Math.min(BUBBLE_WIDTH, vw - GUTTER * 2);
    return {
      width: `${width}px`,
      left: `${Math.max(GUTTER, (vw - width) / 2)}px`,
      top: "50%",
      transform: "translateY(-50%)",
    };
  }
  return {
    width: `${p.width}px`,
    left: `${p.left}px`,
    ...(p.above
      ? { bottom: `${vh - p.box.top + BUBBLE_GAP}px` }
      : { top: `${p.box.top + p.box.height + BUBBLE_GAP}px` }),
  };
});

const caretStyle = computed(() => {
  const p = placement.value;
  if (!p) return {};
  return { left: `${p.caret}px` };
});

const bubble = ref<HTMLElement | null>(null);

// Un nouveau pas : la bulle reprend le focus, pour le clavier et les lecteurs
// d'écran, qui lisent alors son titre.
watch(index, async () => {
  await nextTick();
  bubble.value?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && step" class="tour" :aria-label="t('tips.ariaLabel')">
      <!-- Le voile percé : seul ce qui est peint reçoit les touchers, le
           projecteur laisse passer vers la commande. -->
      <svg class="veil" :width="viewport.width" :height="viewport.height" aria-hidden="true">
        <path :d="maskPath" fill-rule="evenodd" class="veil-path" @click="finish('backdrop')" />
      </svg>

      <div class="ring" :style="ringStyle" aria-hidden="true"></div>

      <div
        ref="bubble"
        class="bubble"
        :class="placement?.above ? 'bubble-above' : 'bubble-below'"
        :style="bubbleStyle"
        role="dialog"
        :aria-labelledby="`tour-title-${step.key}`"
        tabindex="-1"
      >
        <span v-if="placement" class="caret" :style="caretStyle" aria-hidden="true"></span>

        <div class="flex items-center justify-between gap-3">
          <div
            v-if="steps.length > 1"
            class="flex items-center gap-1.5"
            :aria-label="t('tips.stepOf', { n: index + 1, total: steps.length })"
          >
            <span
              v-for="(s, i) in steps"
              :key="s.key"
              class="h-1.5 rounded-full transition-all duration-300"
              :class="
                i === index ? 'w-5 bg-primary' : i < index ? 'w-2 bg-primary/50' : 'w-2 bg-line'
              "
            ></span>
          </div>
          <span v-else></span>
          <button
            type="button"
            class="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            @click="finish('skip')"
          >
            {{ t("tips.skip") }}
          </button>
        </div>

        <h2
          :id="`tour-title-${step.key}`"
          class="mt-2 flex items-center gap-2 text-lg font-bold text-text-primary"
        >
          <span
            v-if="step.icon"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white"
          >
            <AppIcon :name="step.icon" :size="15" />
          </span>
          {{ step.title }}
        </h2>
        <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
          {{ step.text }}
        </p>

        <!-- Le geste montré plutôt que décrit : une capture dessinée. -->
        <component :is="step.component" v-if="step.component" class="mt-3" />

        <!-- Le bouton qui avance, puis, dessous, « à la prochaine
             ouverture » : on n'a pas toujours le temps de lire, et l'astuce
             reviendra, ici même. Sous le bouton et non à côté : la phrase est
             longue, elle renvoyait le bouton à la ligne. -->
        <div class="mt-4 flex flex-col items-end gap-2.5">
          <button type="button" class="btn btn-primary btn-sm" @click="advance('next')">
            {{ isLast ? t("tips.done") : t("tips.next") }}
          </button>
          <button
            type="button"
            class="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            @click="finish('later')"
          >
            {{ t("tips.later") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Au-dessus des menus, panneaux et barres du bas (z 50), sous l'introduction
   (z 90) et les toasts (z 100) : un rappel posé d'un geste s'annonce par-
   dessus l'astuce qui l'a demandé. */
.tour {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
}

.veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.veil-path {
  fill: rgb(0 0 0 / 0.55);
  pointer-events: visiblePainted;
  animation: veil-in 0.25s ease-out;
}

/* Le liseré autour du projecteur : la couleur du thème, et une respiration
   qui attire l'oeil sans clignoter. */
.ring {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 45%, transparent);
  animation: ring-breathe 2s ease-in-out infinite;
  transition:
    top 0.2s ease,
    left 0.2s ease,
    width 0.2s ease,
    height 0.2s ease;
}

/* La bulle : une surface, son ombre, et sa flèche vers la commande. */
.bubble {
  position: absolute;
  pointer-events: auto;
  padding: 1rem 1.125rem 1.125rem;
  border-radius: var(--radius-card);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  outline: none;
  animation: bubble-in 0.3s cubic-bezier(0.3, 1.2, 0.55, 1);
}

.caret {
  position: absolute;
  width: 1rem;
  height: 1rem;
  margin-left: -0.5rem;
  background-color: var(--color-surface);
  transform: rotate(45deg);
}

.bubble-above .caret {
  bottom: -0.5rem;
  box-shadow: 3px 3px 4px rgb(0 0 0 / 0.06);
}

.bubble-below .caret {
  top: -0.5rem;
  box-shadow: -3px -3px 4px rgb(0 0 0 / 0.06);
}

@keyframes veil-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes ring-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 45%, transparent);
  }
  50% {
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--color-primary) 0%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .veil-path,
  .bubble,
  .ring {
    animation: none;
  }
  .ring {
    transition: none;
  }
}
</style>
