<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { computeZmanim, formatZmanTime, type ZmanKey } from "../../services/zmanimService";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import AppIcon from "../../components/icons/AppIcon.vue";
import type { IconName } from "../../components/icons/registry";

/**
 * L'horaire d'un moment du sidour, posé juste avant ce qui se lit : la fin du
 * Chéma avant le Chéma, la plage de Min'ha en tête de Min'ha… L'heure est
 * calculée sur l'appareil pour le lieu des horaires, et le « i » explique la
 * règle (les deux avis quand la pratique les distingue) au lieu de laisser
 * deviner à quoi correspond l'heure affichée.
 *
 * Les fichiers de tefila posent le marqueur (`TextBlock.zman`) ; chaque clé de
 * ZMAN_CARDS décrit une carte : son icône, les heures dont sa ligne principale
 * a besoin, et le nombre de lignes de son explication (textReading.zman.*).
 */
const props = defineProps<{ zman: string }>();

const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// L'heure du jour change à minuit (et le lecteur peut rester ouvert) : les
// heures sont une donnée du calcul, pas une valeur figée à l'ouverture.
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 60_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

interface ZmanCard {
  icon: IconName;
  /** Heures sans lesquelles la ligne principale n'a pas de sens. */
  requires: (keyof ZmanParams)[];
  /** Nombre de lignes d'explication (textReading.zman.<clé>.d1..dN). */
  details: number;
}

const ZMAN_CARDS: Record<string, ZmanCard> = {
  chaharit: { icon: "sunrise", requires: ["misheyakir", "hatsot"], details: 4 },
  shema: { icon: "clock", requires: ["shema"], details: 3 },
  amida: { icon: "clock", requires: ["tefila"], details: 2 },
  minha: { icon: "sun", requires: ["minhaGuedola", "chkia"], details: 4 },
  arvit: { icon: "moon", requires: ["tset"], details: 3 },
};

interface ZmanParams {
  misheyakir: string;
  netz: string;
  shemaMGA: string;
  shema: string;
  tefilaMGA: string;
  tefila: string;
  hatsot: string;
  minhaGuedola: string;
  minhaKetana: string;
  plag: string;
  chkia: string;
  tset: string;
  hatsotLayla: string;
}

const KEY_MAP: Record<keyof ZmanParams, ZmanKey> = {
  misheyakir: "misheyakir",
  netz: "sunrise",
  shemaMGA: "sofZmanShmaMGA",
  shema: "sofZmanShma",
  tefilaMGA: "sofZmanTfillaMGA",
  tefila: "sofZmanTfilla",
  hatsot: "chatzot",
  minhaGuedola: "minchaGedola",
  minhaKetana: "minchaKetana",
  plag: "plagHaMincha",
  chkia: "sunset",
  tset: "tzeit",
  hatsotLayla: "chatzotNight",
};

const times = computed<ZmanParams>(() => {
  const byKey = new Map(computeZmanim(place.value, now.value).map((z) => [z.key, z.date]));
  const clock = (key: ZmanKey): string => {
    const date = byKey.get(key);
    return date ? formatZmanTime(date, place.value.tzid, locale.value) : "";
  };
  const params = {} as ZmanParams;
  for (const [param, key] of Object.entries(KEY_MAP) as [keyof ZmanParams, ZmanKey][]) {
    params[param] = clock(key);
  }
  return params;
});

const card = computed(() => ZMAN_CARDS[props.zman] ?? null);

// vue-i18n attend un objet indexable : le type nominal des heures ne l'est pas.
const params = computed<Record<string, unknown>>(() => ({ ...times.value }));

// Nuit ou jour polaire : sans les heures de sa ligne principale, la carte
// n'affiche rien plutôt qu'une heure vide.
const usable = computed(
  () => card.value !== null && card.value.requires.every((param) => times.value[param] !== ""),
);

const details = computed(() => {
  if (!card.value) return [];
  const lines: string[] = [];
  for (let i = 1; i <= card.value.details; i++) {
    lines.push(t(`textReading.zman.${props.zman}.d${i}`, params.value));
  }
  return lines;
});

const showInfo = ref(false);
</script>

<template>
  <div v-if="card && usable" class="my-6 card p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <AppIcon :name="card.icon" :size="18" class="text-primary flex-shrink-0" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-text-primary">
            {{ t(`textReading.zman.${zman}.title`) }}
          </p>
          <p class="text-sm text-text-secondary">
            {{ t(`textReading.zman.${zman}.main`, params) }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="icon-btn flex-shrink-0"
        :aria-expanded="showInfo"
        :aria-label="t('textReading.zman.info')"
        :title="t('textReading.zman.info')"
        @click="showInfo = !showInfo"
      >
        <AppIcon name="info" :size="16" />
      </button>
    </div>
    <div v-if="showInfo" class="mt-3 text-sm text-text-secondary leading-relaxed">
      <ul class="space-y-1.5 list-disc ps-5">
        <li v-for="(line, i) in details" :key="i">{{ line }}</li>
      </ul>
      <p v-if="place.city" class="mt-2 text-text-secondary/70">
        {{ t("textReading.zman.place", { city: place.city }) }}
      </p>
    </div>
  </div>
</template>
