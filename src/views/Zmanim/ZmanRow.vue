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
 *    couleur du thème portant une cloche. Le geste franc, jusqu'au bout, pose
 *    ou retire le rappel sans rien demander ; le geste retenu laisse la ligne
 *    ouverte sur sa cloche, qu'on touche alors pour ouvrir les réglages ;
 *  - un rappel posé se voit à un petit triangle plein dans l'angle de la
 *    ligne, du côté de l'heure. Une cloche posée dans le texte aurait mangé
 *    la place du nom sur un téléphone, et une ligne sur deux marquée aurait
 *    fait une colonne d'icônes ; l'angle, lui, ne prend la place de rien et
 *    se repère d'un coup d'oeil en parcourant la liste.
 *
 * Rien ne se valide avant le relâcher : on peut tirer la ligne, voir ce
 * qu'elle propose, et la laisser revenir sans rien changer.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
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
/** En deçà, on ne sait pas encore si le doigt défile ou s'il tire la ligne. */
const AXIS_SLOP = 8;

const row = ref<HTMLElement | null>(null);
const shift = ref(props.expanded ? REVEAL : 0);
const sliding = ref(false);

let startX = 0;
let startY = 0;
let axis: "none" | "x" | "y" = "none";
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
}

function onTouchEnd(): void {
  if (!sliding.value) return;
  const travelled = shift.value;
  sliding.value = false;
  dragEndedAt = Date.now();
  if (travelled >= commitDistance()) {
    // Geste franc : la ligne se referme sur son résultat, sans rien demander.
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
         elle n'apparaît pas avant que la place ne soit faite. -->
    <button
      v-if="canRemind"
      type="button"
      class="absolute inset-y-0 end-0 flex items-center justify-center overflow-hidden bg-primary text-white"
      :style="{ width: `${shift}px`, transition: sliding ? 'none' : 'width 0.2s ease' }"
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
