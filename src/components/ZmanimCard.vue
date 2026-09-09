<script setup lang="ts">
// Carte « horaires » du tableau de bord : une seule heure, celle qu'on vient
// vérifier. Le détail (les quatorze horaires du jour, le Chabbat, les autres
// jours) vit sur la page dédiée, à un clic.
//
// Du jour d'entrée à la sortie du repos (Chabbat, fête, ou les deux quand
// ils se suivent), c'est lui qui prend la place du prochain horaire : son
// entrée d'abord, puis sa sortie une fois les bougies allumées.
//
// Tout est calculé sur l'appareil (voir zmanimService) : la carte n'attend
// rien du réseau et reste juste même connexion coupée.
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useNow } from "../composables/useNow";
import { useZmanimPlaceLabel } from "../composables/useZmanimPlaceLabel";
import { useZmanCountdown } from "../composables/useZmanCountdown";
import {
  computeZmanim,
  formatHebrewDate,
  formatZmanTime,
  hebrewDateFor,
  nextZman,
  restPeriodsNear,
  sameCivilDay,
} from "../services/zmanimService";
import AppIcon from "./icons/AppIcon.vue";
import { useLocalePath } from "../composables/useLocalePath";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const countdown = useZmanCountdown();

// L'horaire mis en avant change au fil de la journée : on suit l'heure à la
// minute plutôt que de figer l'état au montage.
// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const clock = (date: Date) => formatZmanTime(date, place.value.tzid, locale.value);

/** Le prochain horaire du jour, ou le premier du lendemain une fois la nuit passée. */
const upcoming = computed(() => {
  const today = nextZman(computeZmanim(place.value, now.value), now.value);
  if (today) return today;
  const tomorrow = new Date(now.value);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // nextZman plutôt que le premier de la liste : le milieu de la nuit qui
  // l'ouvre peut être déjà passé (avant minuit, à l'est du fuseau).
  return nextZman(computeZmanim(place.value, tomorrow), now.value);
});

/** Le repos en cours, ou celui qui entre aujourd'hui, sinon rien à annoncer. */
const rest = computed(() => {
  const period = restPeriodsNear(place.value, now.value, locale.value)[0];
  if (!period) return null;
  const entering = sameCivilDay(place.value, period.start, now.value);
  return period.start.getTime() <= now.value.getTime() || entering ? period : null;
});

/** Ce que la carte annonce : une heure, son nom, et une ligne de contexte. */
const headline = computed(() => {
  const period = rest.value;
  if (period) {
    const lit = now.value.getTime() >= period.start.getTime();
    // « Sortie de Chabbat » ne convient plus quand une fête s'y ajoute.
    const endLabel = t(period.festivals.length > 0 ? "zmanim.rest.end" : "zmanim.shabbat.havdalah");
    return {
      icon: "candle" as const,
      label: lit ? endLabel : t("zmanim.shabbat.candleLighting"),
      date: lit ? period.end : period.start,
      // Avant l'allumage, la sortie donne l'autre bout du repos ; après, elle
      // est déjà l'heure annoncée et n'a pas à être répétée.
      note: lit ? "" : `${endLabel} ${clock(period.end)}`,
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

/**
 * La date hébraïque du jour, en tête de carte. Elle situe l'heure annoncée,
 * et c'est une des choses qu'on vient chercher ici : la savoir demandait
 * jusqu'ici d'ouvrir la page des horaires.
 *
 * Sensible à la chkia (hebrewDateFor), comme l'horaire mis en avant juste en
 * dessous : les deux parlent du même jour hébraïque, y compris le soir.
 */
const hebrewDate = computed(() =>
  formatHebrewDate(hebrewDateFor(place.value, now.value, now.value), locale.value),
);
</script>

<!-- Composition : une ligne de situation (le jour), puis l'heure en grand,
     seule chose de la carte à ce corps-là. C'est elle qu'on vient lire, de
     loin et en vitesse ; le nom de l'horaire et le compte à rebours la
     servent, ils passent donc après elle. -->
<template>
  <RouterLink
    :to="localePath('horaires')"
    class="card card-hover p-5 md:p-6 flex flex-col justify-center gap-3 group"
  >
    <template v-if="headline">
      <span class="flex items-baseline justify-between gap-3">
        <span class="text-sm font-semibold text-text-secondary">{{ t("zmanim.cardToday") }}</span>
        <span class="text-sm text-text-secondary truncate">{{ hebrewDate }}</span>
      </span>

      <span class="flex items-end justify-between gap-4">
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <AppIcon :name="headline.icon" :size="18" class="text-primary shrink-0" />
            <!-- Pas de troncature sur le nom : « Fin du Chéma (Maguen Avraham) »
                 réduit à « Fin du Chéma… » ferait passer une heure pour l'autre,
                 et les deux opinions sont séparées d'une bonne demi-heure. -->
            <span
              class="font-semibold text-text-primary leading-snug group-hover:text-primary transition-colors"
            >
              {{ headline.label }}
            </span>
          </span>
          <span class="mt-1 block text-sm text-text-secondary truncate">
            <template v-if="headline.note">{{ headline.note }} · </template>{{ placeLabel }}
          </span>
        </span>
        <span
          class="shrink-0 text-4xl md:text-5xl font-bold leading-none text-primary tabular-nums"
        >
          {{ clock(headline.date) }}
        </span>
      </span>
    </template>

    <span v-else class="text-sm text-text-secondary">{{ t("zmanim.unavailable") }}</span>
  </RouterLink>
</template>
