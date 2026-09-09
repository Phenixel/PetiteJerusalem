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

<!-- Composition : le texte serré à gauche (la date hébraïque qui situe, le nom
     de l'horaire, le temps qui reste et le lieu), l'heure en grand à droite,
     centrée sur ce bloc. C'est elle qu'on vient lire, de loin et en vitesse ;
     le reste la sert et passe donc à côté, au corps du texte courant. Rien ne
     dit « aujourd'hui » : une carte d'horaires sur l'accueil ne parle pas d'un
     autre jour. -->
<template>
  <RouterLink
    :to="localePath('horaires')"
    class="card card-hover group flex flex-col justify-center p-5 md:p-6"
  >
    <template v-if="headline">
      <span class="flex items-center justify-between gap-4">
        <span class="min-w-0">
          <span class="block text-sm text-text-secondary">{{ hebrewDate }}</span>
          <span class="mt-1 flex items-start gap-2">
            <AppIcon :name="headline.icon" :size="18" class="mt-0.5 shrink-0 text-primary" />
            <!-- Ni troncature ni ellipse sur le nom : « Fin du Chéma (Maguen
                 Avraham) » réduit à « Fin du Chéma… » ferait passer une heure
                 pour l'autre, et les deux opinions sont séparées d'une bonne
                 demi-heure. Il passe à la ligne s'il le faut. -->
            <span
              class="font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary"
            >
              {{ headline.label }}
            </span>
          </span>
          <span class="mt-1 block text-sm text-text-secondary">
            <template v-if="headline.note">{{ headline.note }} · </template>{{ placeLabel }}
          </span>
        </span>
        <span
          class="shrink-0 text-4xl font-bold leading-none text-primary tabular-nums md:text-5xl"
        >
          {{ clock(headline.date) }}
        </span>
      </span>
    </template>

    <span v-else class="text-sm text-text-secondary">{{ t("zmanim.unavailable") }}</span>
  </RouterLink>
</template>
