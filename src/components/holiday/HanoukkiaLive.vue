<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { HDate, months } from "@hebcal/hdate";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useNow } from "../../composables/useNow";
import { hebrewDateFor } from "../../services/zmanimService";
import { analyticsService } from "../../services/analyticsService";

/**
 * La 'hanoukkia de l'accueil, le temps de 'Hanouka : elle porte autant de
 * lumières que le soir en compte, et la toucher ouvre le texte de l'allumage
 * (les bénédictions de Nerot 'Hanouka, dans la bibliothèque).
 *
 * Le jour hébraïque bascule à la chkia, et c'est bien celui-là qu'il faut :
 * le soir venu, la lumière de plus est déjà allumée, et c'est celle-là que
 * la 'hanoukkia doit montrer. D'où hebrewDateFor, qui tient compte de
 * l'heure au lieu du jour civil, et l'horloge partagée qui la suit. Ce
 * composant tire donc le moteur d'horaires : il est chargé à la demande.
 *
 * Le dessin reprend l'ornement OrnamentHanoukkia, les flammes en plus ou en
 * moins : les lumières se remplissent de droite à gauche, comme on les
 * allume, le chamach toujours allumé.
 */
const { t } = useI18n();
const { place } = useZmanimLocation();
const now = useNow();

/** Le soir de 'Hanouka (1 à 8), ou 8 si la date échappe à la fête. */
const lights = computed(() => {
  const hd = hebrewDateFor(place.value, now.value, now.value);
  const first = new HDate(25, months.KISLEV, hd.getFullYear());
  const day = hd.abs() - first.abs() + 1;
  return Math.min(8, Math.max(1, day));
});

/** Les lumières, de gauche à droite : allumée ou non ce soir. */
const CANDLES = [12, 17, 22, 27, 37, 42, 47, 52];
const lit = computed(() => CANDLES.map((_, i) => CANDLES.length - i <= lights.value));
</script>

<template>
  <RouterLink
    to="/bibliotheque/moadim/nerot-hanouka"
    class="hanoukkia block"
    :aria-label="t('home.holiday.hanoukaLights', { n: lights })"
    :title="t('home.holiday.hanoukaLights', { n: lights })"
    @click="analyticsService.capture('holiday_text_opened', { theme: 'hanouka', day: lights })"
  >
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="illu"
    >
      <path d="M22 58h20" />
      <path d="M32 58V30" />
      <path d="M10 30h44" />
      <path v-for="x in CANDLES" :key="x" :d="`M${x} 30V20`" />
      <path d="M32 30V13" />
      <path class="accent" d="M32 10c-1.5-2-1-4.5 0-6 1 1.5 1.5 4 0 6z" />
      <path
        v-for="(x, i) in CANDLES"
        :key="`flame-${x}`"
        class="accent flame"
        :class="{ 'flame-off': !lit[i] }"
        :d="`M${x} 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z`"
      />
    </svg>
  </RouterLink>
</template>

<style scoped>
.hanoukkia {
  transition: transform 0.2s ease;
}
.hanoukkia:hover {
  transform: translateY(-2px);
}
.illu {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.accent {
  stroke: var(--color-secondary);
}
.flame {
  fill: var(--color-secondary);
  transition: opacity 0.4s ease;
}
.flame-off {
  opacity: 0;
}
</style>
