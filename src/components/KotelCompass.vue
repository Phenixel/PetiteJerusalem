<script setup lang="ts">
import { computed, onUnmounted, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import { analyticsService } from "../services/analyticsService";
import { haptic } from "../services/haptics";
import { numberFormat } from "../services/intlCache";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useCompassHeading } from "../composables/useCompassHeading";
import { closeKotelCompass, kotelCompassOpen } from "../composables/useKotelCompass";
import { prefersLessMotion, prefersReducedMotion } from "../composables/useMotion";
import {
  accuracySpread,
  arrowOffset,
  dialTilt,
  fillLevel,
  isAligned,
  isFlat,
  nextNotch,
} from "../services/compassReading";
import {
  arrowAngle,
  bearingToKotel,
  compassPoint,
  distanceToKotelKm,
} from "../services/kotelDirection";

/**
 * La direction du Kotel, sur un cadran : la 'Amida se dit face à Jérusalem, et
 * ce qui manque au lecteur n'est pas la règle mais le geste, savoir de quel
 * côté se tourner dans une chambre d'hôtel ou un aéroport.
 *
 * Le cap est calculé pour le lieu des horaires (Paris par défaut, la position
 * de l'appareil si elle est partagée) : le même lieu que les zmanim de la
 * page, rien de nouveau à régler. Quand l'appareil donne le nord, le cadran
 * tourne avec lui et il suffit de suivre la flèche ; sinon le nord reste en
 * haut, la flèche garde son sens et c'est au lecteur de placer le nord.
 *
 * The window opens straight on the dial, with no title (the button that
 * opened it said what it is). Under it, one status line and one line of
 * figures. Facing the Kotel is felt and seen: the phone clicks as the arrow
 * comes close and beats once when it is there, while the dial fills with the
 * theme color from the bottom up (see docs/design.md, « The compass fills
 * when you face the Kotel »).
 */
const { t, locale } = useI18n();
const { place, status: geoStatus, locateDevice } = useZmanimLocation();
const placeLabel = useZmanimPlaceLabel(place);
const {
  heading,
  status: compassStatus,
  accuracy,
  accuracyDegrees,
  tilt,
  start,
  stop,
} = useCompassHeading({ accuracy: true });

const live = computed(() => compassStatus.value === "live");

const bearing = computed(() => bearingToKotel(place.value.latitude, place.value.longitude));
const point = computed(() => t(`textReading.kotel.points.${compassPoint(bearing.value)}`));
const distance = computed(() =>
  numberFormat(locale.value, { maximumFractionDigits: 0 }).format(
    distanceToKotelKm(place.value.latitude, place.value.longitude),
  ),
);

/**
 * Les angles affichés, déroulés : passer de 359° à 1° doit tourner d'un
 * degré, pas faire un tour complet à l'envers, ce que ferait une transition
 * CSS entre deux valeurs brutes.
 */
function unwrap(previous: number, next: number): number {
  return previous + (((next - previous + 540) % 360) - 180);
}

const roseAngle = ref(0);
const needleAngle = ref(bearing.value);
watch(
  [heading, bearing],
  () => {
    roseAngle.value = unwrap(roseAngle.value, heading.value === null ? 0 : -heading.value);
    needleAngle.value = unwrap(needleAngle.value, arrowAngle(bearing.value, heading.value));
  },
  { immediate: true },
);

const spin = (angle: number) => ({ transform: `rotate(${angle}deg)` });

/**
 * Une lettre du cadran, posée sur le cercle mais laissée droite : on la fait
 * tourner autour du centre, on l'écarte de 64 unités, puis on la redresse
 * d'autant (les transformations s'enchaînent dans le repère de la
 * précédente : la dernière rotation tourne donc la lettre sur elle-même).
 */
const cardinalStyle = (angle: number) => {
  const turn = angle + roseAngle.value;
  return {
    transform: `rotate(${turn}deg) translate(0px, -64px) rotate(${-turn}deg)`,
  };
};

/** Les quatre aires cardinales du cadran, à leur place sur le cercle. */
const CARDINALS = [
  { key: "n", angle: 0 },
  { key: "e", angle: 90 },
  { key: "s", angle: 180 },
  { key: "o", angle: 270 },
] as const;

/** Les graduations du cadran, tous les trente degrés. */
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/**
 * The rose is drawn twice: once on the dial, once in the theme's "on" color,
 * cut to the shape of what has filled the dial. As the color rises, the
 * arrow and the letters it covers turn white with it, instead of sinking
 * into it.
 */
const LAYERS = ["dry", "wet"] as const;

/**
 * iOS ne donne l'orientation qu'après un geste. La permission se demande
 * dans celui qui ouvre la fenêtre (voir le `watch` plus bas) ; le bouton ne reste
 * que si ce geste n'a pas suffi. Il se pose alors sur le cadran éteint, et
 * non sous lui : un cadran qui a l'air de marcher ne fait chercher aucun
 * bouton, et la flèche, figée nord en haut, enverrait prier de travers
 * quiconque la suivrait sans avoir lu la suite.
 */
const locked = computed(() => compassStatus.value === "locked");

/**
 * Le cadran penche à l'opposé du téléphone, comme la rose d'une boussole de
 * marine qui reste à l'horizontale : il se présente de face quand le
 * téléphone est à plat, et l'envie de le redresser fait poser le téléphone.
 * Seulement quand la boussole parle : sans elle, la façon de tenir
 * l'appareil n'y change rien.
 */
const tiltStyle = computed(() => {
  if (!live.value || tilt.value === null) return "";
  const { x, y } = dialTilt(tilt.value);
  // Une chaîne et non un objet : à valeur égale (le cadran au plus fort de
  // son inclinaison, la main qui tremble d'un degré), le cadran ne se
  // redessine pas.
  return `transform: rotateX(${x}deg) rotateY(${y}deg)`;
});

const flat = computed(() => tilt.value !== null && isFlat(tilt.value));

/**
 * La précision, dessinée autour de la flèche : le secteur où le Kotel se
 * trouve, compte tenu de ce que l'appareil dit de son étalonnage. Étroit,
 * on peut suivre la flèche ; large, il faut calibrer.
 */
const spread = computed(() =>
  live.value ? accuracySpread(accuracy.value, accuracyDegrees.value) : null,
);

const WEDGE_RADIUS = 86;

/** Le secteur, dessiné vers le haut du cadran puis tourné avec la flèche. */
const wedgePath = computed(() => {
  if (spread.value === null) return null;
  const angle = (spread.value * Math.PI) / 180;
  const dx = WEDGE_RADIUS * Math.sin(angle);
  const y = (100 - WEDGE_RADIUS * Math.cos(angle)).toFixed(2);
  const left = (100 - dx).toFixed(2);
  const right = (100 + dx).toFixed(2);
  return `M100 100 L${left} ${y} A${WEDGE_RADIUS} ${WEDGE_RADIUS} 0 0 1 ${right} ${y} Z`;
});

/** Les barres de la précision, comme celles du réseau : trois, deux, une. */
const BARS = [1, 2, 3] as const;
const barsLit = computed(() =>
  accuracy.value === "high" ? 3 : accuracy.value === "medium" ? 2 : 1,
);

/** Le niveau de la précision, en un mot (« bonne », « moyenne », « faible »). */
const LEVEL_KEYS = {
  high: "textReading.kotel.accuracy.high",
  medium: "textReading.kotel.accuracy.medium",
  low: "textReading.kotel.accuracy.low",
} as const;

const accuracyLevel = computed(() =>
  accuracy.value === "unknown" ? "" : t(LEVEL_KEYS[accuracy.value]),
);

/** La ligne de la précision, sous le cadran. */
const accuracyText = computed(() => {
  if (accuracy.value === "unknown") return t("textReading.kotel.accuracy.unknown");
  if (accuracyDegrees.value === null || accuracy.value === "low") {
    return t("textReading.kotel.accuracy.line", { level: accuracyLevel.value });
  }
  return t("textReading.kotel.accuracy.lineDegrees", {
    level: accuracyLevel.value,
    deg: accuracyDegrees.value,
  });
});

/**
 * Le calibrage : un 8 décrit dans l'air, le seul geste qui étalonne le
 * magnétomètre d'un téléphone (aucune API ne le fait à sa place). La fenêtre
 * le montre, et suit la précision pendant qu'on le fait.
 */
const calibrating = ref(false);
let calibrationOpenedAt = 0;

function openCalibration(): void {
  calibrating.value = true;
  calibrationOpenedAt = Date.now();
  analyticsService.capture("kotel_compass_calibration_opened", { accuracy: accuracy.value });
}

/**
 * Le téléphone qui décrit son 8 : une démonstration qu'on vient de demander
 * en touchant « Calibrer », coupée quand le système demande moins
 * d'animations (le dessin du 8 reste, le téléphone posé à sa croisée).
 */
const animateCalibration = computed(() => !prefersLessMotion());

/** Le calibrage a pris : la précision est redevenue bonne. */
const calibrated = computed(() => accuracy.value === "high");

/** Ce que le calibrage dit de la précision, pendant qu'on fait le geste. */
const calibrationText = computed(() => {
  if (calibrated.value) return t("textReading.kotel.calibration.done");
  if (accuracy.value === "unknown") return t("textReading.kotel.calibration.unknown");
  return t("textReading.kotel.calibration.current", { level: accuracyLevel.value });
});

/** The three gestures, in order (written out whole: i18nUsage.test.ts reads them). */
const CALIBRATION_STEPS = [
  "textReading.kotel.calibration.away",
  "textReading.kotel.calibration.eight",
  "textReading.kotel.calibration.flat",
] as const;

/** Le chemin du 8, couché : deux boucles qui se croisent au centre. */
const EIGHT =
  "M100 60 C125 25 175 25 175 60 C175 95 125 95 100 60 C75 25 25 25 25 60 C25 95 75 95 100 60 Z";

/**
 * Calibration that takes brings you back to the dial by itself: whoever is
 * tracing the 8 is not reading the screen, and kept tracing it after « La
 * boussole est calibrée » had appeared. The phone beats once when accuracy
 * turns good; the check stays a moment, then the dial returns, saying for a
 * few seconds that the compass is calibrated. Only a change counts: opened
 * with the accuracy already good, the screen waits for its button.
 */
const CALIBRATED_RETURN_MS = 1100;
const CALIBRATED_NOTICE_MS = 3000;
const justCalibrated = ref(false);
let returnTimer: ReturnType<typeof setTimeout> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function clearCalibrationTimers(): void {
  if (returnTimer) clearTimeout(returnTimer);
  if (noticeTimer) clearTimeout(noticeTimer);
  returnTimer = null;
  noticeTimer = null;
}

watch(accuracy, (level, before) => {
  if (!calibrating.value || level !== "high" || before === "high" || returnTimer) return;
  haptic("done");
  analyticsService.capture("kotel_compass_calibrated", {
    seconds: Math.round((Date.now() - calibrationOpenedAt) / 1000),
  });
  returnTimer = setTimeout(() => {
    returnTimer = null;
    calibrating.value = false;
    justCalibrated.value = true;
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      justCalibrated.value = false;
    }, CALIBRATED_NOTICE_MS);
  }, CALIBRATED_RETURN_MS);
});

function backFromCalibration(): void {
  clearCalibrationTimers();
  calibrating.value = false;
}

/**
 * Facing the Kotel. The arrow's offset from the top of the phone, only while
 * the compass speaks: without it, the arrow is drawn for north up, and
 * nothing says which way the phone points.
 */
const offset = computed(() =>
  live.value && heading.value !== null && !calibrating.value
    ? arrowOffset(arrowAngle(bearing.value, heading.value))
    : null,
);

const aligned = ref(false);
/** Bumped at each lock: replays the ripple around the dial. */
const lockCount = ref(0);
let notch: number | null = null;
let openedAt = 0;
let alignedOnce = false;

watch(offset, (value) => {
  if (value === null) {
    aligned.value = false;
    notch = null;
    return;
  }
  const now = isAligned(value, aligned.value);
  if (now && !aligned.value) {
    haptic("done");
    lockCount.value += 1;
    if (!alignedOnce) {
      alignedOnce = true;
      analyticsService.capture("kotel_compass_aligned", {
        seconds: Math.round((Date.now() - openedAt) / 1000),
      });
    }
  }
  aligned.value = now;
  // The notches: one click every ten degrees as the arrow comes close, so
  // that the way can be found by touch alone.
  const next = nextNotch(value, notch);
  if (!now && next !== null && next !== notch) haptic("tick");
  notch = next;
});

/**
 * The color that fills the dial: a level that rises as the arrow comes near,
 * then fills it at once on the lock. Its surface is a slow wave, driven by a
 * spring so that the fill overshoots a little and settles, like a liquid that
 * has been moved; the faster it moves, the more the surface stirs. The frame
 * loop only runs while the surface can be seen (neither empty nor full). Cut
 * only at the system's request, not on a small machine: like the home page
 * stack, the fill says that something has just happened (see docs/design.md,
 * « Motion answers a gesture »). Then the level is set without its path, and
 * the surface is flat.
 */
const targetLevel = computed(() =>
  offset.value === null ? 0 : fillLevel(offset.value, aligned.value),
);

const backWave = ref<SVGPathElement | null>(null);
const frontWave = ref<SVGPathElement | null>(null);
/** The same surface, cutting out the white copy of the rose. */
const clipWave = ref<SVGPathElement | null>(null);

const SPRING = 90;
const DAMPING = 11;
const WAVE_SPEED = 2.2;

let level = 0;
let velocity = 0;
let phase = 0;
let frame = 0;
let lastFrame = 0;

/** The liquid's outline: its surface at `surface`, a wave on top, the dial's bottom below. */
function liquidPath(surface: number, amplitude: number, shift: number): string {
  let path = "";
  for (let x = 0; x <= 200; x += 5) {
    const y = surface + amplitude * Math.sin((x / 200) * Math.PI * 3 + shift);
    path += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)} `;
  }
  return `${path}L200 210 L0 210 Z`;
}

function paint(): void {
  // Empty, the surface sits under the dial; full, above it, waves included.
  const surface = 208 - level * 224;
  const stir = prefersReducedMotion() ? 0 : 4 + Math.min(6, Math.abs(velocity) * 10);
  const front = liquidPath(surface, stir, phase);
  frontWave.value?.setAttribute("d", front);
  clipWave.value?.setAttribute("d", front);
  backWave.value?.setAttribute("d", liquidPath(surface - 4, stir * 0.9, -phase * 1.2 + 2));
}

function step(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const target = targetLevel.value;
  velocity += (SPRING * (target - level) - DAMPING * velocity) * dt;
  level += velocity * dt;
  phase += dt * WAVE_SPEED;
  const settled = Math.abs(target - level) < 0.002 && Math.abs(velocity) < 0.002;
  if (settled && (target === 0 || target === 1)) {
    level = target;
    velocity = 0;
    paint();
    frame = 0;
    return;
  }
  paint();
  frame = requestAnimationFrame(step);
}

function stopLiquid(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

watch(targetLevel, (target) => {
  if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined") {
    level = target;
    velocity = 0;
    paint();
    return;
  }
  if (frame) return;
  lastFrame = performance.now();
  frame = requestAnimationFrame(step);
});

// The dial comes back after the calibration screen: its liquid is redrawn
// where it stood.
watch([backWave, frontWave, clipWave], paint, { flush: "post" });

const clipId = `kotel-liquid-${useId()}`;

/**
 * The one line under the dial: what to do now. Facing the Kotel, it says so;
 * a low accuracy comes first, since the arrow cannot be trusted then.
 */
const statusText = computed(() => {
  if (live.value) {
    if (justCalibrated.value) return t("textReading.kotel.status.calibrated");
    if (accuracy.value === "low") return t("textReading.kotel.status.lowAccuracy");
    if (aligned.value) return t("textReading.kotel.status.aligned");
    if (tilt.value !== null && !flat.value) return t("textReading.kotel.status.flat");
    return t("textReading.kotel.status.turn");
  }
  if (compassStatus.value === "denied") return t("textReading.kotel.compassDenied");
  if (locked.value) return t("textReading.kotel.status.locked");
  if (compassStatus.value === "unavailable") return t("textReading.kotel.fixed");
  return t("textReading.kotel.status.searching");
});

/** The status is a sentence that explains (no compass), not a short order. */
const statusIsNote = computed(
  () => compassStatus.value === "denied" || compassStatus.value === "unavailable",
);

const close = closeKotelCompass;

function reset(): void {
  stop();
  stopLiquid();
  clearCalibrationTimers();
  calibrating.value = false;
  justCalibrated.value = false;
  aligned.value = false;
  notch = null;
  level = 0;
  velocity = 0;
}

// Quitter la page emporte la fenêtre : sans cela, l'état partagé resterait
// « ouverte » (le retour arrière d'Android navigue sans rien fermer) et la
// boussole surgirait d'elle-même à l'office suivant.
onUnmounted(() => {
  closeKotelCompass();
  stopLiquid();
  clearCalibrationTimers();
});

// La boussole n'écoute que la fenêtre ouverte : les événements d'orientation
// arrivent plusieurs fois par seconde, ils n'ont rien à faire derrière une
// page de texte fermée. `flush: "sync"` : elle démarre dans le geste qui
// ouvre la fenêtre, le seul où iOS accepte de demander la permission (voir
// useCompassHeading).
watch(
  kotelCompassOpen,
  (open) => {
    if (!open) {
      reset();
      return;
    }
    openedAt = Date.now();
    alignedOnce = false;
    void start();
  },
  { flush: "sync" },
);
</script>

<template>
  <AppModal :open="kotelCompassOpen" :label="t('textReading.kotel.title')" @close="close">
    <div v-if="kotelCompassOpen" class="relative">
      <!-- No title: the button that opened the window named it already, and
           the dial is what is looked at. Only the close command remains. -->
      <button
        type="button"
        class="icon-btn absolute -top-2 -end-2 z-10"
        :aria-label="t('common.close')"
        @click="close"
      >
        <AppIcon name="x" :size="18" />
      </button>

      <!-- Le calibrage prend la place du cadran : c'est lui qu'on regarde,
           et l'on y revient d'un geste, ou de lui-même quand il a pris. -->
      <div v-if="calibrating" class="pt-4">
        <svg viewBox="0 0 200 120" class="w-56 max-w-full mx-auto block" aria-hidden="true">
          <path :d="EIGHT" class="kotel-eight" :class="{ 'kotel-eight-done': calibrated }" />
          <g :transform="animateCalibration ? undefined : 'translate(100 60)'">
            <rect x="-9" y="-15" width="18" height="30" rx="4" class="kotel-phone" />
            <line x1="-3" y1="-11" x2="3" y2="-11" class="kotel-phone-ear" />
            <animateMotion
              v-if="animateCalibration"
              dur="4s"
              repeatCount="indefinite"
              rotate="auto"
              :path="EIGHT"
            />
          </g>
        </svg>
        <ol class="mt-5 space-y-2 text-sm text-text-secondary">
          <li
            v-for="(key, index) in CALIBRATION_STEPS"
            :key="key"
            class="flex items-baseline gap-3"
          >
            <span class="kotel-step shrink-0">{{ index + 1 }}</span>
            <span>{{ t(key) }}</span>
          </li>
        </ol>
        <p
          class="mt-5 flex items-center justify-center gap-2 text-sm font-medium"
          :class="calibrated ? 'text-primary' : 'text-text-secondary'"
          aria-live="polite"
        >
          <AppIcon v-if="calibrated" name="circle-check" :size="16" class="kotel-done-check" />
          <svg
            v-else-if="accuracy !== 'unknown'"
            viewBox="0 0 14 12"
            class="w-3.5 h-3 shrink-0"
            aria-hidden="true"
          >
            <rect
              v-for="bar in BARS"
              :key="bar"
              :x="(bar - 1) * 5"
              :y="12 - bar * 4"
              width="3.5"
              :height="bar * 4"
              rx="1"
              :class="bar <= barsLit ? 'kotel-bar-lit' : 'kotel-bar'"
            />
          </svg>
          {{ calibrationText }}
        </p>
        <button type="button" class="btn btn-soft w-full mt-4" @click="backFromCalibration">
          <AppIcon name="compass" :size="16" />
          {{ t("textReading.kotel.calibration.back") }}
        </button>
      </div>

      <template v-else>
        <!-- La scène donne la profondeur où le cadran penche ; le bouton
             d'activation se pose par-dessus le cadran éteint. -->
        <div class="kotel-stage relative mt-3 mb-5 flex justify-center">
          <div
            class="kotel-tilt"
            :class="{ 'kotel-off': locked, 'kotel-aligned': aligned }"
            :style="tiltStyle"
          >
            <svg
              viewBox="0 0 200 200"
              class="w-60 h-60 max-w-full block overflow-visible"
              role="img"
              :aria-label="t('textReading.kotel.bearing', { deg: Math.round(bearing), point })"
            >
              <defs>
                <clipPath :id="`${clipId}-dial`">
                  <circle cx="100" cy="100" r="94" />
                </clipPath>
                <clipPath :id="clipId">
                  <path ref="clipWave" d="M0 210 L200 210 Z" />
                </clipPath>
              </defs>
              <circle cx="100" cy="100" r="94" class="kotel-dial" />
              <!-- The color that rises in the dial as you turn toward the
                   Kotel: a lighter swell behind, the surface in front. -->
              <g v-if="live" :clip-path="`url(#${clipId}-dial)`">
                <path ref="backWave" d="M0 210 L200 210 Z" class="kotel-liquid-back" />
                <path ref="frontWave" d="M0 210 L200 210 Z" class="kotel-liquid" />
              </g>
              <circle cx="100" cy="100" r="94" class="kotel-ring" />
              <!-- The ripple of the lock, replayed at each one (and only then: the
                   dial that comes back from calibration does not replay it). -->
              <g v-if="aligned" :key="lockCount" class="kotel-ripples">
                <circle cx="100" cy="100" r="94" class="kotel-ripple" />
                <circle cx="100" cy="100" r="94" class="kotel-ripple kotel-ripple-late" />
              </g>
              <!-- The mark of "straight ahead", fixed to the phone: the arrow
                   is to point there. -->
              <path v-if="live" d="M100 4 L94 -5 L106 -5 Z" class="kotel-lubber" />
              <g
                v-for="layer in LAYERS"
                :key="layer"
                :class="layer === 'wet' ? 'kotel-wet' : ''"
                :clip-path="layer === 'wet' ? `url(#${clipId})` : undefined"
              >
                <template v-if="layer === 'dry' || live">
                  <!-- Le cadran (graduations et aires cardinales) tourne avec
                       l'appareil ; sans boussole, il garde le nord en haut. -->
                  <g class="kotel-rose" :style="spin(roseAngle)">
                    <line
                      v-for="tick in TICKS"
                      :key="tick"
                      x1="100"
                      y1="10"
                      x2="100"
                      y2="20"
                      class="kotel-tick"
                      :style="spin(tick)"
                    />
                  </g>
                  <!-- Les lettres se posent sur le cercle avec lui, mais restent
                       droites : tourner avec le cadran mettrait le S à l'envers. -->
                  <text
                    v-for="cardinal in CARDINALS"
                    :key="cardinal.key"
                    x="100"
                    y="100"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    class="kotel-cardinal kotel-rose"
                    :class="cardinal.key === 'n' ? 'kotel-north' : ''"
                    :style="cardinalStyle(cardinal.angle)"
                  >
                    {{ t(`textReading.kotel.rose.${cardinal.key}`) }}
                  </text>
                  <!-- La précision : le secteur où se trouve le Kotel, de part
                       et d'autre de la flèche. -->
                  <g
                    v-if="wedgePath && layer === 'dry'"
                    class="kotel-rose"
                    :style="spin(needleAngle)"
                  >
                    <path
                      :d="wedgePath"
                      class="kotel-spread"
                      :class="{ 'kotel-spread-low': accuracy === 'low' }"
                    />
                  </g>
                  <!-- La flèche du Kotel : le seul élément qui compte, tout le
                       reste du cadran n'est là que pour la situer. Éteinte tant
                       que la boussole attend d'être activée. -->
                  <g v-if="!locked" class="kotel-rose" :style="spin(needleAngle)">
                    <path
                      d="M100 40 L124 78 L107 78 L107 148 L93 148 L93 78 L76 78 Z"
                      class="kotel-needle"
                    />
                  </g>
                </template>
              </g>
            </svg>
          </div>
          <div v-if="locked" class="absolute inset-0 flex items-center justify-center">
            <button type="button" class="btn btn-primary shadow-lg" @click="start(true)">
              <AppIcon name="compass" :size="16" />
              {{ t("textReading.kotel.enable") }}
            </button>
          </div>
        </div>

        <!-- What to do now, then the figures: two lines, no more. -->
        <p
          class="text-center leading-snug"
          :class="
            statusIsNote
              ? 'text-sm text-text-secondary'
              : [
                  'text-base font-semibold transition-colors',
                  aligned || justCalibrated ? 'text-primary' : 'text-text-primary',
                ]
          "
          aria-live="polite"
        >
          {{ statusText }}
        </p>
        <p class="mt-1 text-center text-sm text-text-secondary tabular-nums">
          {{ t("textReading.kotel.facts", { point, deg: Math.round(bearing), km: distance }) }}
        </p>

        <!-- La précision et de quoi la rétablir : sans elles, une boussole
             mal étalonnée envoie prier de travers sans qu'on le sache. -->
        <div
          v-if="live"
          class="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm"
        >
          <span
            class="flex items-center gap-2"
            :class="
              accuracy === 'low'
                ? 'text-amber-700 dark:text-amber-300 font-medium'
                : 'text-text-secondary'
            "
          >
            <svg
              v-if="accuracy !== 'unknown'"
              viewBox="0 0 14 12"
              class="w-3.5 h-3 shrink-0"
              aria-hidden="true"
            >
              <rect
                v-for="bar in BARS"
                :key="bar"
                :x="(bar - 1) * 5"
                :y="12 - bar * 4"
                width="3.5"
                :height="bar * 4"
                rx="1"
                :class="bar <= barsLit ? 'kotel-bar-lit' : 'kotel-bar'"
              />
            </svg>
            {{ accuracyText }}
          </span>
          <button
            type="button"
            class="btn btn-sm"
            :class="accuracy === 'low' ? 'btn-primary' : 'btn-soft'"
            @click="openCalibration"
          >
            <AppIcon name="rotate" :size="14" />
            {{ t("textReading.kotel.calibrate") }}
          </button>
        </div>
      </template>

      <!-- Le lieu du calcul : le cap change d'un continent à l'autre, il doit
           être clair qu'il vaut pour l'endroit affiché, et rectifiable. -->
      <div
        class="mt-5 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <span class="flex items-center gap-1.5 min-w-0">
          <span class="truncate text-text-secondary">{{ placeLabel }}</span>
        </span>
        <button
          type="button"
          class="flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60"
          :disabled="geoStatus === 'loading'"
          @click="locateDevice()"
        >
          <AppIcon
            :name="geoStatus === 'loading' ? 'spinner' : 'locate'"
            :size="14"
            :class="geoStatus === 'loading' ? 'animate-spin' : ''"
          />
          {{ geoStatus === "loading" ? t("zmanim.place.locating") : t("zmanim.place.useMine") }}
        </button>
      </div>
      <p
        v-if="geoStatus === 'denied' || geoStatus === 'unavailable'"
        class="mt-2 text-xs text-text-secondary"
      >
        {{ geoStatus === "denied" ? t("zmanim.place.denied") : t("zmanim.place.unavailable") }}
      </p>
    </div>
  </AppModal>
</template>

<style scoped>
/* Le cadran tourne autour de son centre ; la rotation vient du gabarit, en
   degrés, et la transition la rend lisible plutôt que sautante. */
.kotel-rose,
.kotel-tick,
.kotel-cardinal,
.kotel-ripple,
.kotel-needle {
  /* Les rotations se comptent dans le repère du cadran (le viewBox), pas
     dans la boîte de chaque forme : le centre est le même pour toutes. */
  transform-box: view-box;
  transform-origin: 100px 100px;
}
.kotel-rose {
  transition: transform 0.2s linear;
}
/* Le cadran penche dans une scène en perspective : sans profondeur, la
   rotation 3D ne ferait que l'aplatir. */
.kotel-stage {
  perspective: 600px;
}
.kotel-tilt {
  transition:
    transform 0.15s linear,
    opacity 0.2s ease,
    filter 0.2s ease;
  transform-style: preserve-3d;
}
/* Éteint : le cadran attend qu'on active la boussole, et le bouton posé
   dessus doit se lire avant lui. */
.kotel-off {
  opacity: 0.35;
  filter: grayscale(1) blur(1px);
}
.kotel-dial {
  fill: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
}
.kotel-ring {
  fill: none;
  stroke: var(--color-line);
  stroke-width: 2;
  transition: stroke 0.3s ease;
}
.kotel-aligned .kotel-ring {
  stroke: var(--color-brand);
}
/* The rising color: the theme's solid fill, and a lighter swell of the same
   color behind it (two flat layers, not a gradient). */
.kotel-liquid {
  fill: var(--color-brand);
}
.kotel-liquid-back {
  fill: color-mix(in srgb, var(--color-brand) 45%, transparent);
}
.kotel-tick {
  stroke: var(--color-line);
  stroke-width: 2;
  stroke-linecap: round;
}
.kotel-cardinal {
  fill: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.kotel-north {
  fill: var(--color-text-primary);
}
/* What the color has covered is written on it. */
.kotel-wet .kotel-tick {
  stroke: color-mix(in srgb, var(--color-on-brand) 55%, transparent);
}
.kotel-wet .kotel-cardinal {
  fill: var(--color-on-brand);
}
.kotel-wet .kotel-needle {
  fill: var(--color-on-brand);
  stroke: var(--color-on-brand);
  filter: none;
}
/* "Straight ahead", fixed to the top of the phone; it takes the color when
   the arrow points at it. */
.kotel-lubber {
  fill: var(--color-text-secondary);
  stroke: var(--color-text-secondary);
  stroke-width: 2;
  stroke-linejoin: round;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease;
}
.kotel-aligned .kotel-lubber {
  fill: var(--color-brand);
  stroke: var(--color-brand);
}
/* Le secteur de la précision : la couleur de la flèche, très diluée, pour
   qu'il se lise comme son halo et non comme une seconde aiguille. */
.kotel-spread {
  fill: color-mix(in srgb, var(--color-primary) 14%, transparent);
}
.kotel-spread-low {
  fill: color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.kotel-bar {
  fill: var(--color-line);
}
.kotel-bar-lit {
  fill: currentColor;
}
/* Le 8 du calibrage et le téléphone qui le parcourt. */
.kotel-eight {
  fill: none;
  stroke: var(--color-line);
  stroke-width: 3;
  stroke-dasharray: 6 6;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}
.kotel-eight-done {
  stroke: var(--color-primary);
}
.kotel-phone {
  fill: var(--color-surface);
  stroke: var(--color-primary);
  stroke-width: 2.5;
}
.kotel-phone-ear {
  stroke: var(--color-primary);
  stroke-width: 2;
  stroke-linecap: round;
}
/* The number of a calibration step, in a small round of the theme color. */
.kotel-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
}
/* La flèche est dessinée anguleuse, puis arrondie par un trait épais aux
   jointures rondes : des angles vifs feraient un instrument de mesure, là où
   l'on veut un objet qu'on a envie de prendre en main. */
.kotel-needle {
  fill: var(--color-primary);
  stroke: var(--color-primary);
  stroke-width: 8;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--color-primary) 30%, transparent));
}
/* The lock: the arrow swells for a beat, and two rings leave the dial. */
.kotel-aligned .kotel-needle {
  animation: kotel-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.kotel-ripple {
  fill: none;
  stroke: var(--color-brand);
  stroke-width: 3;
  opacity: 0;
  animation: kotel-ripple 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}
.kotel-ripple-late {
  animation-delay: 0.18s;
}
.kotel-done-check {
  animation: kotel-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes kotel-pop {
  40% {
    transform: scale(1.12);
  }
}
@keyframes kotel-ripple {
  from {
    opacity: 0.7;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.22);
  }
}
@media (prefers-reduced-motion: reduce) {
  .kotel-rose,
  .kotel-tilt {
    transition: none;
  }
  .kotel-aligned .kotel-needle,
  .kotel-ripple,
  .kotel-done-check {
    animation: none;
  }
}
</style>
