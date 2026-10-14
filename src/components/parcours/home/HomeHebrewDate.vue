<script setup lang="ts">
/**
 * La date hébraïque, sous la salutation de l'accueil (P2-Accueil). Elle
 * bascule à la chkia, comme les horaires : le soir, c'est déjà le jour qui
 * vient.
 *
 * Chargée à la demande (voir HomeView) : elle tire le calendrier hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "../../../composables/useNow";
import { useZmanimLocation } from "../../../composables/useZmanimLocation";
import { formatHebrewDate, hebrewDateFor } from "../../../services/zmanimService";

const { locale } = useI18n();
const { place } = useZmanimLocation();
const now = useNow();

const date = computed(() =>
  formatHebrewDate(hebrewDateFor(place.value, now.value, now.value), locale.value),
);
</script>

<template>
  <p>{{ date }}</p>
</template>
