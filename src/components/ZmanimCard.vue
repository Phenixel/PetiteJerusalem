<script setup lang="ts">
// Carte « horaires » du tableau de bord : une seule heure, celle qu'on vient
// vérifier. Le détail (les quatorze horaires du jour, le Chabbat, les autres
// jours) vit sur la page dédiée, à un clic.
//
// Du vendredi à la sortie du Chabbat, c'est lui qui prend la place du
// prochain horaire : son entrée d'abord, puis sa sortie une fois les bougies
// allumées.
//
// Tout est calculé sur l'appareil (voir zmanimService) : la carte n'attend
// rien du réseau et reste juste même connexion coupée.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useZmanCountdown } from "../composables/useZmanCountdown";
import {
  computeZmanim,
  formatZmanTime,
  featuredShabbat,
  nextZman,
} from "../services/zmanimService";
import AppIcon from "./icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const countdown = useZmanCountdown();

// L'horaire mis en avant change au fil de la journée : on suit l'heure à la
// minute plutôt que de figer l'état au montage.
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 30_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

/** Le prochain horaire du jour, ou le premier du lendemain une fois la nuit passée. */
const upcoming = computed(() => {
  const today = nextZman(computeZmanim(place.value, now.value), now.value);
  if (today) return today;
  const tomorrow = new Date(now.value);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return computeZmanim(place.value, tomorrow)[0] ?? null;
});

const shabbat = computed(() => featuredShabbat(place.value, now.value));

/** Ce que la carte annonce : une heure, son nom, et une ligne de contexte. */
const headline = computed(() => {
  const week = shabbat.value;
  if (week) {
    const lit = now.value.getTime() >= week.candleLighting.getTime();
    return {
      icon: "candle" as const,
      label: t(lit ? "zmanim.shabbat.havdalah" : "zmanim.shabbat.candleLighting"),
      date: lit ? week.havdalah : week.candleLighting,
      // Avant l'allumage, la sortie donne l'autre bout du Chabbat ; après,
      // elle est déjà l'heure annoncée et n'a pas à être répétée.
      note: lit ? "" : `${t("zmanim.shabbat.havdalah")} ${clock(week.havdalah)}`,
    };
  }
  const zman = upcoming.value;
  if (!zman) return null;
  return {
    icon: "clock" as const,
    label: t(`zmanim.names.${zman.key}`),
    date: zman.date,
    note: countdown(zman.date, now.value),
  };
});

const placeLabel = useZmanimPlaceLabel(place);
</script>

<template>
  <RouterLink
    to="/horaires"
    class="card card-hover p-5 flex items-center justify-between gap-3 group"
  >
    <template v-if="headline">
      <span class="flex items-center gap-3 min-w-0">
        <AppIcon :name="headline.icon" :size="20" class="text-primary shrink-0" />
        <span class="min-w-0">
          <!-- Pas de troncature sur le nom : « Fin du Chéma (Maguen Avraham) »
               réduit à « Fin du Chéma… » ferait passer une heure pour l'autre,
               et les deux opinions sont séparées d'une bonne demi-heure. -->
          <span
            class="block font-medium text-text-primary leading-snug group-hover:text-primary transition-colors"
          >
            {{ headline.label }}
          </span>
          <span class="block text-xs text-text-secondary truncate">
            <template v-if="headline.note">{{ headline.note }} · </template>{{ placeLabel }}
          </span>
        </span>
      </span>
      <span class="shrink-0 text-2xl font-semibold text-primary tabular-nums">
        {{ clock(headline.date) }}
      </span>
    </template>

    <span v-else class="text-sm text-text-secondary">{{ t("zmanim.unavailable") }}</span>
  </RouterLink>
</template>
