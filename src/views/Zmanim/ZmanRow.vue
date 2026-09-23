<script setup lang="ts">
/**
 * Une ligne d'horaire, et le rappel qu'on peut y poser.
 *
 * Sur le site, c'est une ligne de texte : un nom, ce qu'il désigne, une heure.
 * Dans l'app native, la même ligne devient une commande, parce que c'est là
 * qu'on se dit « celui-là, il faudrait qu'on me le rappelle » :
 *
 *  - la toucher ouvre le réglage du rappel (combien de minutes avant) ;
 *  - la tirer vers la gauche découvre, du côté de l'heure, un fond de la
 *    couleur du thème portant une cloche. Le geste franc, jusqu'au bout ou
 *    d'un coup sec, pose ou retire le rappel sans rien demander (avec le
 *    dernier délai réglé) ; le geste retenu laisse la ligne ouverte sur sa
 *    cloche, qu'on touche alors pour ouvrir les réglages ;
 *  - un rappel posé se voit à un petit triangle plein dans l'angle de la
 *    ligne, du côté de l'heure. Une cloche posée dans le texte aurait mangé
 *    la place du nom sur un téléphone, et une ligne sur deux marquée aurait
 *    fait une colonne d'icônes ; l'angle, lui, ne prend la place de rien et
 *    se repère d'un coup d'oeil en parcourant la liste.
 *
 * Rien ne se valide avant le relâcher : on peut tirer la ligne, voir ce
 * qu'elle propose, et la laisser revenir sans rien changer.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import MockTouch from "../../components/mock/MockTouch.vue";
import type { ZmanTime } from "../../services/zmanimService";

const props = defineProps<{
  zman: ZmanTime;
  /** L'heure, déjà mise en forme dans le fuseau du lieu. */
  time: string;
  /** Le prochain horaire à venir : mis en couleur. */
  isNext: boolean;
  /** Minutes d'avance du rappel posé, null quand il n'y en a pas. */
  minutesBefore: number | null;
  /** Les rappels n'existent que dans l'app native. */
  canRemind: boolean;
  /** La ligne est ouverte sur sa cloche (une seule à la fois dans la liste). */
  expanded: boolean;
  /**
   * La démonstration de l'astuce (voir ZmanimPage) : un doigt se pose sur
   * la ligne, la tire vers la gauche jusqu'à sa cloche, la lâche, et
   * recommence. Le doigt est celui des captures dessinées (MockTouch), posé
   * dans la ligne pour la suivre dans son mouvement. Elle ne fait que
   * montrer : pour tout le reste la ligne est fermée, un toucher ouvre les
   * réglages, un geste la tire comme d'habitude.
   */
  demo?: boolean;
}>();

const emit = defineEmits<{
  /** Ouvrir le réglage du rappel. */
  (e: "open"): void;
  /** Le geste est allé au bout : poser ou retirer le rappel. */
  (e: "toggle"): void;
  /** La ligne s'ouvre sur sa cloche, ou se referme. */
  (e: "update:expanded", value: boolean): void;
}>();

const { t } = useI18n();

const hasReminder = computed(() => props.minutesBefore !== null);

const reminderLabel = computed(() => {
  if (props.minutesBefore === null) return t("zmanim.reminder.none");
  return props.minutesBefore === 0
    ? t("zmanim.reminder.atTime")
    : t("zmanim.reminder.before", { minutes: props.minutesBefore });
});

/**
 * Ce que fait la cloche découverte : elle ouvre les réglages. C'est son
 * dessin, cloche ou cloche barrée, qui annonce ce que le geste franc ferait ;
 * l'étiquette, elle, décrit le toucher, seul geste que le clavier et les
 * lecteurs d'écran atteignent.
 */
const actionLabel = computed(() =>
  t("zmanim.reminder.openAria", { name: t(`zmanim.names.${props.zman.key}`) }),
);

/** Où la ligne s'ancre quand le geste s'arrête en chemin. */
const REVEAL = 84;
/** Au-delà, le relâcher ouvre la ligne au lieu de la laisser revenir. */
const OPEN_THRESHOLD = 28;
/** Part de la largeur de la ligne au-delà de laquelle le geste bascule seul. */
const COMMIT_RATIO = 0.5;
/**
 * Vitesse (pixels par milliseconde) à partir de laquelle un geste court mais
 * sec bascule aussi le rappel : on n'a pas à traverser la moitié de l'écran
 * quand le coup de pouce dit déjà tout. Un demi-pixel par milliseconde, c'est
 * un vrai coup, pas un doigt qui traîne.
 */
const FLICK_VELOCITY = 0.5;
/** Un arrêt plus long que cela avant de relâcher, et le geste n'est plus un coup. */
const FLICK_MAX_PAUSE_MS = 100;
/** En deçà, on ne sait pas encore si le doigt défile ou s'il tire la ligne. */
const AXIS_SLOP = 8;
/**
 * Le blanc laissé entre l'heure et le tiroir : la ligne s'écarte un peu plus
 * que le fond ne s'ouvre, sinon l'heure arrivait au contact de l'orange.
 */
const GAP = 12;

/** Largeur du tiroir : la course du geste, moins ce blanc. */
const drawer = computed(() => Math.max(0, shift.value - GAP));

const row = ref<HTMLElement | null>(null);
const shift = ref(props.expanded ? REVEAL : 0);
const sliding = ref(false);

let startX = 0;
let startY = 0;
let axis: "none" | "x" | "y" = "none";
/** Le dernier mouvement, pour mesurer la vitesse du geste au relâcher. */
let lastMoveAt = 0;
let lastShift = 0;
let velocity = 0;
/**
 * Sens de lecture : le geste va vers la gauche, et le tiroir se découvre à
 * droite, du côté de l'heure. En hébreu, tout est en miroir, le geste part
 * donc vers la droite (voir les propriétés logiques du gabarit).
 */
let direction = 1;
/**
 * Fin du dernier geste. Le relâchement produit aussi un clic, qui ne doit
 * rien ouvrir ; un simple drapeau ne suffisait pas, il restait levé et
 * avalait le VRAI appui suivant, celui de la cloche qu'on vient de découvrir.
 */
let dragEndedAt = 0;
const CLICK_AFTER_DRAG_MS = 400;

const fromDrag = () => Date.now() - dragEndedAt < CLICK_AFTER_DRAG_MS;

// La liste n'ouvre qu'une ligne : celle qu'on vient d'ouvrir referme l'autre.
watch(
  () => props.expanded,
  (open) => {
    if (!sliding.value) shift.value = open ? REVEAL : 0;
  },
);

/** Un tour de la démonstration : ouverte à 0,7 s, refermée à 2 s. */
const DEMO_PERIOD_MS = 3200;
const DEMO_OPEN_AT_MS = 700;
const DEMO_CLOSE_AT_MS = 2000;
let demoTimers: number[] = [];

/** Pose la ligne où la démonstration la veut, sauf si un doigt la tient. */
function demoShift(value: number): void {
  if (!sliding.value) shift.value = value;
}

function stopDemo(): void {
  demoTimers.forEach((timer) => window.clearTimeout(timer));
  demoTimers = [];
  demoShift(props.expanded ? REVEAL : 0);
}

function playDemo(): void {
  stopDemo();
  const cycle = () => {
    demoTimers = [
      window.setTimeout(() => demoShift(REVEAL), DEMO_OPEN_AT_MS),
      window.setTimeout(() => demoShift(0), DEMO_CLOSE_AT_MS),
      window.setTimeout(cycle, DEMO_PERIOD_MS),
    ];
  };
  cycle();
}

watch(
  () => props.demo,
  (on) => (on ? playDemo() : stopDemo()),
  { immediate: true },
);

onBeforeUnmount(stopDemo);

/** La course au-delà de laquelle le relâcher bascule le rappel. */
function commitDistance(): number {
  return (row.value?.offsetWidth ?? 320) * COMMIT_RATIO;
}

function onTouchStart(event: TouchEvent): void {
  if (!props.canRemind || event.touches.length !== 1) return;
  const touch = event.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  axis = "none";
  direction = document.documentElement.dir === "rtl" ? -1 : 1;
  lastMoveAt = event.timeStamp;
  lastShift = props.expanded ? REVEAL : 0;
  velocity = 0;
}

function onTouchMove(event: TouchEvent): void {
  if (!props.canRemind || event.touches.length !== 1) return;
  const touch = event.touches[0];
  const from = props.expanded ? REVEAL : 0;
  // Course du geste, comptée positive quand la ligne s'ouvre.
  const dx = (startX - touch.clientX) * direction + from;
  const dy = touch.clientY - startY;
  if (axis === "none") {
    if (Math.abs(dx - from) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
    // Le premier mouvement franc décide : la page défile, ou la ligne suit.
    // Sans cet arbitrage, un défilement du pouce ouvrait les lignes au passage.
    axis = Math.abs(dx - from) > Math.abs(dy) ? "x" : "y";
  }
  if (axis !== "x") return;
  // La page ne doit pas défiler pendant que la ligne suit le doigt.
  event.preventDefault();
  sliding.value = true;
  // La ligne ne va pas plus loin que sa propre largeur : au-delà, elle
  // quitterait l'écran sans que le geste dise rien de plus.
  shift.value = Math.max(0, Math.min(row.value?.offsetWidth ?? Infinity, dx));
  // La vitesse du dernier mouvement, dans le sens de l'ouverture : c'est elle
  // qui dit, au relâcher, si le geste était un coup sec.
  const elapsed = event.timeStamp - lastMoveAt;
  if (elapsed > 0) velocity = (shift.value - lastShift) / elapsed;
  lastMoveAt = event.timeStamp;
  lastShift = shift.value;
}

/** Le geste était-il un coup sec, encore en mouvement au relâcher ? */
function flicked(timeStamp: number): boolean {
  return velocity >= FLICK_VELOCITY && timeStamp - lastMoveAt <= FLICK_MAX_PAUSE_MS;
}

function onTouchEnd(event: TouchEvent): void {
  if (!sliding.value) return;
  const travelled = shift.value;
  sliding.value = false;
  dragEndedAt = Date.now();
  // Geste franc, jusqu'au bout ou d'un coup sec : la ligne se referme sur son
  // résultat, sans rien demander. Un coup sec doit tout de même avoir ouvert
  // la ligne : un frémissement rapide ne bascule rien.
  if (travelled >= commitDistance() || (travelled >= OPEN_THRESHOLD && flicked(event.timeStamp))) {
    settle(false);
    emit("toggle");
    return;
  }
  settle(travelled >= OPEN_THRESHOLD);
}

/** Range la ligne : ouverte sur sa cloche, ou refermée. */
function settle(open: boolean): void {
  axis = "none";
  shift.value = open ? REVEAL : 0;
  if (open !== props.expanded) emit("update:expanded", open);
}

function onClick(): void {
  if (!props.canRemind || fromDrag()) return;
  // Ligne ouverte : la toucher la referme, comme on repousse un tiroir.
  if (props.expanded) {
    settle(false);
    return;
  }
  emit("open");
}

/** La cloche découverte par le geste : elle ouvre les réglages. */
function onAction(): void {
  // Le clic né du relâchement peut atterrir ici quand le doigt a fini
  // au-dessus du fond découvert : il n'ouvre rien.
  if (fromDrag()) return;
  settle(false);
  emit("open");
}

const transform = computed(() => `translateX(${-shift.value * direction}px)`);
</script>

<template>
  <li ref="row" class="relative overflow-hidden">
    <!-- Le tiroir de l'action, du côté de l'heure : c'est la place que la
         ligne libère en partant, et sa largeur EST la course du geste, ce qui
         garde la cloche au milieu de ce qu'on a découvert. Rognée aux bords,
         elle n'apparaît pas avant que la place ne soit faite, et un blanc la
         sépare de l'heure. -->
    <button
      v-if="canRemind"
      type="button"
      class="absolute inset-y-0 end-0 flex items-center justify-center overflow-hidden bg-primary text-white"
      :style="{ width: `${drawer}px`, transition: sliding ? 'none' : 'width 0.2s ease' }"
      :tabindex="expanded ? 0 : -1"
      :aria-hidden="!expanded"
      :aria-label="actionLabel"
      @click="onAction"
    >
      <AppIcon :name="hasReminder ? 'bell-off' : 'bell'" :size="20" />
    </button>

    <!-- `touch-pan-y` : le défilement vertical reste au navigateur, l'axe
         horizontal revient à la ligne, sans quoi le geste part en défilement
         de la page avant que le premier mouvement ne soit arbitré. -->
    <div
      class="relative"
      :class="canRemind ? 'touch-pan-y' : ''"
      :style="{ transform, transition: sliding ? 'none' : 'transform 0.2s ease' }"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- Le repère du rappel : un triangle plein dans l'angle de la ligne.
           Il s'efface le temps du geste : posé contre le tiroir de la même
           couleur, il n'aurait plus été un repère mais une bavure. -->
      <span
        v-if="hasReminder"
        aria-hidden="true"
        class="absolute top-0 end-0 h-0 w-0 border-t-[9px] border-s-[9px] border-t-primary border-s-transparent transition-opacity duration-200"
        :class="shift > 0 ? 'opacity-0' : ''"
      ></span>

      <!-- Le doigt de la démonstration : il se pose, la ligne part avec lui,
           il s'efface quand elle revient (voir `demo`). -->
      <span v-if="demo" class="demo-finger" aria-hidden="true">
        <MockTouch duration="3.2s" delay="0.4s" :taps="1" />
      </span>

      <component
        :is="canRemind ? 'button' : 'div'"
        :type="canRemind ? 'button' : undefined"
        class="flex w-full items-center justify-between gap-4 py-2.5 text-start"
        :aria-label="
          canRemind
            ? t('zmanim.reminder.rowAria', {
                name: t(`zmanim.names.${zman.key}`),
                time,
                reminder: reminderLabel,
              })
            : undefined
        "
        @click="onClick"
      >
        <span class="min-w-0">
          <span
            class="block font-semibold leading-snug"
            :class="isNext ? 'text-primary' : 'text-text-primary'"
          >
            {{ t(`zmanim.names.${zman.key}`) }}
          </span>
          <span class="block text-sm text-text-secondary">
            {{ t(`zmanim.hints.${zman.key}`) }}
          </span>
        </span>
        <span
          class="shrink-0 text-lg font-semibold tabular-nums"
          :class="isNext ? 'text-primary' : 'text-text-primary'"
        >
          {{ time }}
        </span>
      </component>
    </div>
  </li>
</template>

<style scoped>
/* Le doigt de la démonstration : posé aux deux tiers de la ligne, du côté
   de l'heure, là où l'on tire. Il paraît, appuie (MockTouch), suit la ligne
   qui s'ouvre, et s'efface le temps qu'elle revienne : le même tour de 3,2 s
   que les minuteurs de `playDemo`. */
.demo-finger {
  position: absolute;
  top: 50%;
  inset-inline-start: 68%;
  z-index: 1;
  pointer-events: none;
  animation: demo-finger 3.2s ease-in-out infinite;
}

@keyframes demo-finger {
  0% {
    opacity: 0;
  }
  10%,
  62% {
    opacity: 1;
  }
  74%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-finger {
    animation: none;
  }
}
</style>
