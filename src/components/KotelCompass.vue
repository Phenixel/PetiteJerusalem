<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import { analyticsService } from "../services/analyticsService";
import { numberFormat } from "../services/intlCache";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useCompassHeading } from "../composables/useCompassHeading";
import { closeKotelCompass, kotelCompassOpen } from "../composables/useKotelCompass";
import { prefersLessMotion } from "../composables/useMotion";
import { accuracySpread, dialTilt, isFlat } from "../services/compassReading";
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
} = useCompassHeading();

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
 * iOS ne donne l'orientation qu'après un geste. La permission se demande
 * dans celui qui ouvre la fenêtre (openKotelCompass) ; le bouton ne reste
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
  if (!live.value || tilt.value === null) return {};
  const { x, y } = dialTilt(tilt.value);
  return { transform: `rotateX(${x}deg) rotateY(${y}deg)` };
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
  if (accuracy.value === "low") return t("textReading.kotel.accuracy.lowLine");
  if (accuracyDegrees.value === null) {
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

function openCalibration(): void {
  calibrating.value = true;
  analyticsService.capture("kotel_compass_calibration_opened", { accuracy: accuracy.value });
}

/**
 * Le téléphone qui décrit son 8 : une démonstration qu'on vient de demander
 * en touchant « Calibrer », coupée quand le système demande moins
 * d'animations (le dessin du 8 reste, le téléphone posé à sa croisée).
 */
const animateCalibration = computed(() => calibrating.value && !prefersLessMotion());

/** Le chemin du 8, couché : deux boucles qui se croisent au centre. */
const EIGHT =
  "M100 60 C125 25 175 25 175 60 C175 95 125 95 100 60 C75 25 25 25 25 60 C25 95 75 95 100 60 Z";

/** Ce que la fenêtre dit du cadran, sous les chiffres. */
const hint = computed(() => {
  if (compassStatus.value === "live") return t("textReading.kotel.live");
  if (compassStatus.value === "denied") return t("textReading.kotel.compassDenied");
  if (compassStatus.value === "locked") return t("textReading.kotel.locked");
  if (compassStatus.value === "unavailable") return t("textReading.kotel.fixed");
  return t("textReading.kotel.searching");
});

/**
 * La consigne de tenir l'appareil à plat, tant que la boussole parle : le
 * magnétomètre donne son cap dans le plan de l'écran, un téléphone tenu
 * debout fait tourner la flèche avec l'inclinaison de la main. Une fois le
 * téléphone à plat, elle le confirme.
 */
const flatText = computed(() => {
  if (!live.value) return null;
  return flat.value ? t("textReading.kotel.flatOk") : t("textReading.kotel.flat");
});

const close = closeKotelCompass;

// Quitter la page emporte la fenêtre : sans cela, l'état partagé resterait
// « ouverte » (le retour arrière d'Android navigue sans rien fermer) et la
// boussole surgirait d'elle-même à l'office suivant.
onUnmounted(closeKotelCompass);

// La boussole n'écoute que la fenêtre ouverte : les événements d'orientation
// arrivent plusieurs fois par seconde, ils n'ont rien à faire derrière une
// page de texte fermée.
watch(kotelCompassOpen, (open) => {
  if (!open) {
    stop();
    calibrating.value = false;
    return;
  }
  // La permission, là où elle se demande, est déjà partie avec le geste
  // d'ouverture : start en attend la réponse.
  void start();
});
</script>

<template>
  <AppModal :open="kotelCompassOpen" :label="t('textReading.kotel.title')" @close="close">
    <template v-if="kotelCompassOpen">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h3 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <AppIcon name="compass" :size="20" class="text-primary" />
          {{ t("textReading.kotel.title") }}
        </h3>
        <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="close">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <p class="text-sm text-text-secondary leading-relaxed">{{ t("textReading.kotel.intro") }}</p>

      <!-- Le calibrage prend la place du cadran : c'est lui qu'on regarde,
           et l'on y revient d'un geste. -->
      <div v-if="calibrating" class="my-5">
        <svg viewBox="0 0 200 120" class="w-56 max-w-full mx-auto block" aria-hidden="true">
          <path :d="EIGHT" class="kotel-eight" />
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
        <h4 class="mt-4 text-sm font-semibold text-text-primary">
          {{ t("textReading.kotel.calibration.title") }}
        </h4>
        <ol class="mt-2 list-decimal ps-5 space-y-1.5 text-sm text-text-secondary leading-relaxed">
          <li>{{ t("textReading.kotel.calibration.away") }}</li>
          <li>{{ t("textReading.kotel.calibration.eight") }}</li>
          <li>{{ t("textReading.kotel.calibration.flat") }}</li>
        </ol>
        <p
          class="mt-4 flex items-center justify-center gap-2 text-sm font-medium"
          :class="accuracy === 'high' ? 'text-primary' : 'text-text-secondary'"
          aria-live="polite"
        >
          <AppIcon v-if="accuracy === 'high'" name="circle-check" :size="16" />
          {{
            accuracy === "high"
              ? t("textReading.kotel.calibration.done")
              : accuracy === "unknown"
                ? t("textReading.kotel.calibration.unknown")
                : t("textReading.kotel.calibration.current", { level: accuracyLevel })
          }}
        </p>
        <button type="button" class="btn btn-primary w-full mt-4" @click="calibrating = false">
          <AppIcon name="compass" :size="16" />
          {{ t("textReading.kotel.calibration.back") }}
        </button>
      </div>

      <template v-else>
        <!-- La scène donne la profondeur où le cadran penche ; le bouton
             d'activation se pose par-dessus le cadran éteint. -->
        <div class="kotel-stage relative my-5 flex justify-center">
          <div class="kotel-tilt" :class="{ 'kotel-off': locked }" :style="tiltStyle">
            <svg
              viewBox="0 0 200 200"
              class="w-56 h-56 max-w-full block"
              role="img"
              :aria-label="t('textReading.kotel.bearing', { deg: Math.round(bearing), point })"
            >
              <circle cx="100" cy="100" r="94" class="kotel-dial" />
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
              <g v-if="wedgePath" class="kotel-rose" :style="spin(needleAngle)">
                <path :d="wedgePath" class="kotel-spread" :class="`kotel-spread-${accuracy}`" />
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
            </svg>
          </div>
          <div v-if="locked" class="absolute inset-0 flex items-center justify-center">
            <button type="button" class="btn btn-primary shadow-lg" @click="start">
              <AppIcon name="compass" :size="16" />
              {{ t("textReading.kotel.enable") }}
            </button>
          </div>
        </div>

        <p class="text-center text-sm font-semibold text-text-primary">
          {{ t("textReading.kotel.bearing", { deg: Math.round(bearing), point }) }}
        </p>
        <p class="mt-1 text-center text-sm text-text-secondary">
          {{ t("textReading.kotel.distance", { km: distance }) }}
        </p>
        <p class="mt-3 text-center text-xs text-text-secondary leading-relaxed">{{ hint }}</p>
        <p v-if="flatText" class="mt-1 text-center text-xs text-text-secondary leading-relaxed">
          {{ flatText }}
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
        class="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <span class="flex items-center gap-1.5 min-w-0">
          <AppIcon name="map-pin" :size="14" class="text-primary shrink-0" />
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
    </template>
  </AppModal>
</template>

<style scoped>
/* Le cadran tourne autour de son centre ; la rotation vient du gabarit, en
   degrés, et la transition la rend lisible plutôt que sautante. */
.kotel-rose,
.kotel-tick,
.kotel-cardinal {
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
@media (prefers-reduced-motion: reduce) {
  .kotel-rose,
  .kotel-tilt {
    transition: none;
  }
}
.kotel-dial {
  fill: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
  stroke: var(--color-line);
  stroke-width: 2;
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
</style>
