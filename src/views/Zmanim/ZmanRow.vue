<script setup lang="ts">
/**
 * Une ligne d'horaire, et le rappel qu'on peut y poser.
 *
 * Sur le site, c'est une ligne de texte : un nom, ce qu'il désigne, une heure.
 * Dans l'app native, la même ligne devient une commande, parce que c'est là
 * qu'on se dit « celui-là, il faudrait qu'on me le rappelle » :
 *
 *  - la toucher ouvre le réglage du rappel (combien de minutes avant) ;
 *  - la faire glisser vers la droite pose ou retire le rappel d'un geste,
 *    avec le délai de la dernière fois : le raccourci de qui sait déjà ;
 *  - un rappel posé se voit à un petit triangle plein dans l'angle de la
 *    ligne, du côté de l'heure. Une cloche posée dans le texte aurait mangé
 *    la place du nom sur un téléphone, et une ligne sur deux marquée aurait
 *    fait une colonne d'icônes ; l'angle, lui, ne prend la place de rien et
 *    se repère d'un coup d'oeil en parcourant la liste.
 *
 * Le glissement ne valide qu'au relâcher, passé la moitié de la course : on
 * peut donc l'essayer, voir ce qu'il propose, et revenir en arrière sans rien
 * changer.
 */
import { computed, ref } from "vue";
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
}>();

const emit = defineEmits<{
  /** La ligne est touchée : ouvrir le réglage du rappel. */
  (e: "open"): void;
  /** Le glissement est allé au bout : poser ou retirer le rappel. */
  (e: "toggle"): void;
}>();

const { t } = useI18n();

const hasReminder = computed(() => props.minutesBefore !== null);

const reminderLabel = computed(() => {
  if (props.minutesBefore === null) return t("zmanim.reminder.none");
  return props.minutesBefore === 0
    ? t("zmanim.reminder.atTime")
    : t("zmanim.reminder.before", { minutes: props.minutesBefore });
});

/** Ce que le glissement révèle, et ce qu'il fera s'il va au bout. */
const actionLabel = computed(() =>
  hasReminder.value ? t("zmanim.reminder.quickOff") : t("zmanim.reminder.quickOn"),
);

/**
 * Largeur de la zone révélée, et course au-delà de laquelle le geste vaut.
 * La zone est un peu plus large que ce qu'elle porte : le libellé est entier
 * bien avant le seuil, on sait donc ce qu'on déclenche avant de relâcher.
 */
const REVEAL = 104;
const THRESHOLD = 56;
/** En deçà, on ne sait pas encore si le doigt défile ou s'il glisse. */
const AXIS_SLOP = 8;

const shift = ref(0);
const sliding = ref(false);

let startX = 0;
let startY = 0;
let axis: "none" | "x" | "y" = "none";
/** Direction du glissement « vers l'avant » : à gauche quand la page est en hébreu. */
let direction = 1;
/** Un glissement vient d'avoir lieu : le clic qui le suit n'ouvre rien. */
let dragged = false;

function onTouchStart(event: TouchEvent): void {
  if (!props.canRemind || event.touches.length !== 1) return;
  const touch = event.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  axis = "none";
  dragged = false;
  direction = document.documentElement.dir === "rtl" ? -1 : 1;
}

function onTouchMove(event: TouchEvent): void {
  if (!props.canRemind || event.touches.length !== 1) return;
  const touch = event.touches[0];
  const dx = (touch.clientX - startX) * direction;
  const dy = touch.clientY - startY;
  if (axis === "none") {
    if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
    // Le premier mouvement franc décide : la page défile, ou la ligne glisse.
    // Sans cet arbitrage, un défilement du pouce ouvrait les lignes au passage.
    axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  }
  if (axis !== "x") return;
  // La page ne doit pas défiler pendant que la ligne suit le doigt.
  event.preventDefault();
  sliding.value = true;
  dragged = true;
  shift.value = Math.max(0, Math.min(REVEAL, dx));
}

function onTouchEnd(): void {
  const commit = shift.value >= THRESHOLD;
  shift.value = 0;
  sliding.value = false;
  axis = "none";
  if (commit) emit("toggle");
}

function onClick(): void {
  if (!props.canRemind) return;
  // Le relâchement d'un glissement produit aussi un clic : il ne doit pas
  // ouvrir la fenêtre par-dessus le rappel qu'on vient de poser.
  if (dragged) {
    dragged = false;
    return;
  }
  emit("open");
}

const transform = computed(() => `translateX(${shift.value * direction}px)`);
</script>

<template>
  <li class="relative overflow-hidden">
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
      <!-- L'action révélée par le glissement, posée juste avant le bord de la
           ligne : elle n'entre dans le cadre que si l'on tire dessus. -->
      <span
        v-if="canRemind"
        aria-hidden="true"
        class="absolute inset-y-0 end-full flex items-center justify-end gap-1.5 pe-3 text-sm font-semibold text-primary"
        :style="{ width: `${REVEAL}px` }"
      >
        <AppIcon name="bell" :size="16" class="shrink-0" />
        {{ actionLabel }}
      </span>

      <!-- Le repère du rappel : un triangle plein dans l'angle de la ligne. -->
      <span
        v-if="hasReminder"
        aria-hidden="true"
        class="absolute top-0 end-0 h-0 w-0 border-t-[9px] border-s-[9px] border-t-primary border-s-transparent"
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
