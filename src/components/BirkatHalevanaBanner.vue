<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useNow } from "../composables/useNow";
import {
  birkatHalevanaLastDay,
  formatHebrewDate,
  hebrewDateFor,
  moonAge,
  saysBirkatHalevana,
} from "../services/zmanimService";
import { analyticsService } from "../services/analyticsService";
import CardArt from "./CardArt.vue";

/**
 * La bénédiction de la lune, les nuits où elle se dit.
 *
 * Elle a une fenêtre courte, une fois par mois, et se rate facilement : rien
 * ne la rappelle et son texte dort au fond de la bibliothèque. Le bandeau ne
 * paraît que ces nuits-là, et disparaît le reste du mois.
 *
 * Il porte la lune elle-même, à sa phase du soir, dans son coin (voir
 * CardArt) : une carte mise en avant porte son objet, aux couleurs du vrai.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// Le jour hébraïque change à la chkia, et la bénédiction se dit la nuit :
// c'est donc toujours du bon côté de la bascule qu'il faut la poser. D'où
// hebrewDateFor, qui tient compte de l'heure, et le minuteur qui la suit.
// Le bandeau paraît ainsi à la chkia de la première nuit où elle se dit
// (sept jours pleins après le molad, voir saysBirkatHalevana), jamais la
// veille. La fenêtre se compte depuis le molad et non depuis Roch Hodech :
// elle dépend donc du LIEU, dont la sortie des étoiles ouvre la nuit.
// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const hebrewDay = computed(() => hebrewDateFor(place.value, now.value, now.value));
const visible = computed(() => saysBirkatHalevana(place.value, hebrewDay.value));

/** L'âge de la lune ce soir : son dessin en suit la phase. */
const age = computed(() => moonAge(hebrewDay.value, now.value));

/** La date limite : la moitié de la lunaison. */
const deadline = computed(() =>
  formatHebrewDate(birkatHalevanaLastDay(place.value, hebrewDay.value), locale.value),
);
</script>

<template>
  <RouterLink
    v-if="visible"
    to="/bibliotheque/brahot/birkat-halevana"
    class="card card-hover group relative mt-1 flex min-h-16 items-center p-4 pe-24"
    @click="analyticsService.capture('birkat_halevana_opened', { source: 'home' })"
  >
    <CardArt :art="{ kind: 'moon', age }" :rise="10" :size="68" surface="plain" />
    <span class="relative min-w-0">
      <span
        class="block font-medium leading-snug text-text-primary transition-colors group-hover:text-primary"
      >
        {{ t("home.birkatHalevana.title") }}
      </span>
      <span class="block text-xs text-text-secondary">
        {{ t("home.birkatHalevana.until", { date: deadline }) }}
      </span>
    </span>
  </RouterLink>
</template>
