<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { compassNeedsPermission, useCompassHeading } from "../composables/useCompassHeading";
import { closeKotelCompass, kotelCompassOpen } from "../composables/useKotelCompass";
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
const { heading, status: compassStatus, start, stop } = useCompassHeading();

const bearing = computed(() => bearingToKotel(place.value.latitude, place.value.longitude));
const point = computed(() => t(`textReading.kotel.points.${compassPoint(bearing.value)}`));
const distance = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(
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
 * iOS ne donne l'orientation qu'après un geste : le bouton est pour lui. Il
 * s'efface dès que la boussole parle, qu'on la refuse, ou qu'elle s'avère
 * muette : un bouton qui ne peut plus rien donner ne se propose pas.
 */
const askable = computed(
  () =>
    compassNeedsPermission() &&
    (compassStatus.value === "idle" || compassStatus.value === "asking"),
);

/** Ce que la fenêtre dit du cadran, sous les chiffres. */
const hint = computed(() => {
  if (compassStatus.value === "live") return t("textReading.kotel.live");
  if (compassStatus.value === "denied") return t("textReading.kotel.compassDenied");
  return t("textReading.kotel.fixed");
});

/**
 * La consigne de tenir l'appareil à plat, tant que la boussole a une chance
 * de servir : le magnétomètre donne son cap dans le plan de l'écran, un
 * téléphone tenu debout fait tourner la flèche avec l'inclinaison de la main.
 * Elle n'a plus lieu d'être quand il n'y a pas de boussole du tout.
 */
const showFlat = computed(() => compassStatus.value === "live" || askable.value);

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
    return;
  }
  // Là où la permission se demande (iOS), l'appel doit partir d'un geste :
  // c'est le bouton qui l'ouvrira.
  if (!compassNeedsPermission()) void start();
});
</script>

<template>
  <div v-if="kotelCompassOpen" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div
      class="modal-panel animate-[scaleIn_0.3s_ease]"
      role="dialog"
      aria-modal="true"
      :aria-label="t('textReading.kotel.title')"
      @click.stop
    >
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

      <div class="my-5 flex justify-center">
        <svg
          viewBox="0 0 200 200"
          class="w-56 h-56 max-w-full"
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
          <!-- La flèche du Kotel : le seul élément qui compte, tout le reste
               du cadran n'est là que pour la situer. -->
          <g class="kotel-rose" :style="spin(needleAngle)">
            <path
              d="M100 40 L124 78 L107 78 L107 148 L93 148 L93 78 L76 78 Z"
              class="kotel-needle"
            />
          </g>
        </svg>
      </div>

      <p class="text-center text-sm font-semibold text-text-primary">
        {{ t("textReading.kotel.bearing", { deg: Math.round(bearing), point }) }}
      </p>
      <p class="mt-1 text-center text-sm text-text-secondary">
        {{ t("textReading.kotel.distance", { km: distance }) }}
      </p>
      <p class="mt-3 text-center text-xs text-text-secondary leading-relaxed">{{ hint }}</p>
      <p v-if="showFlat" class="mt-1 text-center text-xs text-text-secondary leading-relaxed">
        {{ t("textReading.kotel.flat") }}
      </p>

      <button
        v-if="askable"
        type="button"
        class="btn btn-soft w-full mt-4"
        :disabled="compassStatus === 'asking'"
        @click="start"
      >
        <AppIcon name="compass" :size="16" />
        {{ t("textReading.kotel.enable") }}
      </button>

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
    </div>
  </div>
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
@media (prefers-reduced-motion: reduce) {
  .kotel-rose {
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
