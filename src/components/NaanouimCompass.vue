<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import { compassNeedsPermission, useCompassHeading } from "../composables/useCompassHeading";
import { closeNaanouimCompass, naanouimCompassOpen } from "../composables/useNaanouimCompass";

/**
 * Les six côtés du na'anou'a, sur un cadran numéroté.
 *
 * Le loulav s'agite trois fois de chaque côté, dans un ordre que le sidour
 * donne en liste : sud, nord, est, haut, bas, ouest. Les quatre premiers
 * côtés de cette liste qui sont des points cardinaux prennent leur place sur
 * le cadran, chacun avec son rang ; le haut et le bas, qui n'en sont pas,
 * restent au centre. Quand l'appareil donne le nord, le cadran tourne avec
 * lui et les nombres montrent où se tourner ; sinon le nord reste en haut.
 *
 * Le cadran est celui de la boussole du Kotel (KotelCompass), au dessin près :
 * même cercle, mêmes graduations, même façon de poser une lettre droite sur
 * un cercle qui tourne.
 */
const { t } = useI18n();
const { heading, status: compassStatus, start, stop } = useCompassHeading();

/**
 * Les angles affichés, déroulés : passer de 359° à 1° doit tourner d'un
 * degré, pas faire un tour complet à l'envers.
 */
function unwrap(previous: number, next: number): number {
  return previous + (((next - previous + 540) % 360) - 180);
}

const roseAngle = ref(0);
watch(
  heading,
  () => {
    roseAngle.value = unwrap(roseAngle.value, heading.value === null ? 0 : -heading.value);
  },
  { immediate: true },
);

const spin = (angle: number) => ({ transform: `rotate(${angle}deg)` });

/**
 * Un repère du cadran, posé sur le cercle mais laissé droit : on le fait
 * tourner autour du centre, on l'écarte, puis on le redresse d'autant.
 */
const cardinalStyle = (angle: number, distance: number) => {
  const turn = angle + roseAngle.value;
  return {
    transform: `rotate(${turn}deg) translate(0px, ${-distance}px) rotate(${-turn}deg)`,
  };
};

/**
 * Les quatre côtés qui sont des points cardinaux, avec leur rang dans
 * l'ordre des na'anou'im : le sud d'abord, le nord ensuite, l'est en
 * troisième, et l'ouest en dernier, le haut et le bas passant entre les deux.
 */
const CARDINAUX = [
  { key: "s", angle: 180, rang: 1 },
  { key: "n", angle: 0, rang: 2 },
  { key: "e", angle: 90, rang: 3 },
  { key: "o", angle: 270, rang: 6 },
] as const;

/** Les graduations du cadran, tous les trente degrés. */
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

/**
 * iOS ne donne l'orientation qu'après un geste : le bouton est pour lui. Il
 * s'efface dès que la boussole parle, qu'on la refuse, ou qu'elle s'avère
 * muette.
 */
const askable = computed(
  () =>
    compassNeedsPermission() &&
    (compassStatus.value === "idle" || compassStatus.value === "asking"),
);

/** Ce que la fenêtre dit du cadran, sous les nombres. */
const hint = computed(() => {
  if (compassStatus.value === "live") return t("textReading.naanouim.live");
  if (compassStatus.value === "denied") return t("textReading.kotel.compassDenied");
  return t("textReading.kotel.fixed");
});

const showFlat = computed(() => compassStatus.value === "live" || askable.value);

const close = closeNaanouimCompass;

// Quitter la page emporte la fenêtre, comme pour la boussole du Kotel : sans
// cela, l'état partagé resterait « ouvert » (le retour arrière d'Android
// navigue sans rien fermer) et le cadran surgirait de lui-même, figé, au
// prochain texte qui le porte.
onUnmounted(closeNaanouimCompass);

// La boussole n'écoute que la fenêtre ouverte : les événements d'orientation
// arrivent plusieurs fois par seconde.
watch(naanouimCompassOpen, (open) => {
  if (!open) {
    stop();
    return;
  }
  if (!compassNeedsPermission()) void start();
});
</script>

<template>
  <AppModal :open="naanouimCompassOpen" :label="t('textReading.naanouim.title')" @close="close">
    <template v-if="naanouimCompassOpen">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h3 class="text-lg font-bold text-text-primary flex items-center gap-2">
          <AppIcon name="compass" :size="20" class="text-primary" />
          {{ t("textReading.naanouim.title") }}
        </h3>
        <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="close">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <p class="text-sm text-text-secondary leading-relaxed">
        {{ t("textReading.naanouim.intro") }}
      </p>

      <div class="my-5 flex justify-center">
        <svg
          viewBox="0 0 200 200"
          class="w-56 h-56 max-w-full"
          role="img"
          :aria-label="t('textReading.naanouim.order')"
        >
          <circle cx="100" cy="100" r="94" class="naanoua-dial" />
          <!-- Le cadran tourne avec l'appareil ; sans boussole, il garde le
               nord en haut. -->
          <g class="naanoua-rose" :style="spin(roseAngle)">
            <line
              v-for="tick in TICKS"
              :key="tick"
              x1="100"
              y1="10"
              x2="100"
              y2="20"
              class="naanoua-tick"
              :style="spin(tick)"
            />
          </g>
          <!-- Chaque côté cardinal porte son rang dans une pastille, et sa
               lettre en dehors : c'est le rang qu'on vient chercher, la
               lettre ne fait que dire de quel côté il tombe. -->
          <g
            v-for="cardinal in CARDINAUX"
            :key="cardinal.key"
            class="naanoua-rose"
            :style="cardinalStyle(cardinal.angle, 58)"
          >
            <circle cx="100" cy="100" r="16" class="naanoua-badge" />
            <text
              x="100"
              y="100"
              text-anchor="middle"
              dominant-baseline="central"
              class="naanoua-rang"
            >
              {{ cardinal.rang }}
            </text>
          </g>
          <text
            v-for="cardinal in CARDINAUX"
            :key="`${cardinal.key}-lettre`"
            x="100"
            y="100"
            text-anchor="middle"
            dominant-baseline="central"
            class="naanoua-cardinal naanoua-rose"
            :class="cardinal.key === 'n' ? 'naanoua-north' : ''"
            :style="cardinalStyle(cardinal.angle, 82)"
          >
            {{ t(`textReading.kotel.rose.${cardinal.key}`) }}
          </text>
          <!-- Le haut et le bas ne sont pas des points cardinaux : ils ne
               tournent pas avec le cadran, et restent au milieu, chacun avec
               la flèche qui dit de quel côté il va. -->
          <path d="M86 76 L95 90 L77 90 Z" class="naanoua-vertical" />
          <text x="112" y="84" text-anchor="middle" dominant-baseline="central" class="naanoua-mid">
            4
          </text>
          <path d="M86 124 L95 110 L77 110 Z" class="naanoua-vertical" />
          <text
            x="112"
            y="117"
            text-anchor="middle"
            dominant-baseline="central"
            class="naanoua-mid"
          >
            5
          </text>
        </svg>
      </div>

      <p class="text-center text-sm font-semibold text-text-primary">
        {{ t("textReading.naanouim.order") }}
      </p>
      <p class="mt-1 text-center text-sm text-text-secondary">
        {{ t("textReading.naanouim.middle") }}
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
    </template>
  </AppModal>
</template>

<style scoped>
/* Le cadran tourne autour de son centre ; la rotation vient du gabarit, en
   degrés, et la transition la rend lisible plutôt que sautante. */
.naanoua-rose,
.naanoua-tick,
.naanoua-cardinal {
  transform-box: view-box;
  transform-origin: 100px 100px;
}
.naanoua-rose {
  transition: transform 0.2s linear;
}
@media (prefers-reduced-motion: reduce) {
  .naanoua-rose {
    transition: none;
  }
}
.naanoua-dial {
  fill: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
  stroke: var(--color-line);
  stroke-width: 2;
}
.naanoua-tick {
  stroke: var(--color-line);
  stroke-width: 2;
  stroke-linecap: round;
}
.naanoua-cardinal {
  fill: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.naanoua-north {
  fill: var(--color-text-primary);
}
/* La pastille d'un rang : pleine, pour qu'on lise les nombres avant tout le
   reste du cadran. */
.naanoua-badge {
  fill: var(--color-primary);
}
.naanoua-rang {
  fill: var(--color-surface);
  font-size: 17px;
  font-weight: 700;
}
/* Le haut et le bas, au centre : le même trait que les graduations, en plus
   marqué, pour qu'ils se lisent comme deux côtés de plus et non comme une
   décoration. */
.naanoua-vertical {
  fill: var(--color-primary);
}
.naanoua-mid {
  fill: var(--color-text-primary);
  font-size: 15px;
  font-weight: 700;
}
</style>
