<script setup lang="ts">
/**
 * Widget « Aujourd'hui » : la date hébraïque, ce que le jour a de particulier
 * (Roch Hodech, une fête, un jeûne) et ses hiloulot, qui sinon ne se lisent
 * qu'au bas de la page des horaires. Il y mène.
 *
 * Le jour hébraïque bascule à la chkia (hebrewDateFor), comme sur la carte
 * des horaires : le soir, c'est déjà demain. La liste des hiloulot (2 600
 * noms) arrive par import dynamique, comme sur la page des horaires.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { useNow } from "../../composables/useNow";
import { useLocalePath } from "../../composables/useLocalePath";
import { formatHebrewDate, hebrewDateFor, holidayNamesOn } from "../../services/zmanimService";
import { hiloulotOn, loadHiloulot, type HiloulotIndex } from "../../services/hiloulot";
import AppIcon from "../icons/AppIcon.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const { localePath } = useLocalePath();
// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const day = computed(() => hebrewDateFor(place.value, now.value, now.value));
const date = computed(() => formatHebrewDate(day.value, locale.value));
const highlights = computed(() => holidayNamesOn(place.value, day.value, locale.value));

const index = ref<HiloulotIndex | null>(null);
watch(
  locale,
  (value) => {
    void loadHiloulot(value).then((loaded) => {
      if (locale.value === value) index.value = loaded;
    });
  },
  { immediate: true },
);

/** Trois noms au plus : au-delà, c'est la page des horaires qui les donne. */
const VISIBLE = 3;
const hiloulot = computed(() => (index.value ? hiloulotOn(index.value, day.value) : []));
const more = computed(() => Math.max(0, hiloulot.value.length - VISIBLE));
</script>

<template>
  <RouterLink :to="localePath('horaires')" class="card card-hover p-5 md:p-6 block group">
    <h3
      class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
    >
      <AppIcon name="sunrise" :size="17" class="shrink-0 text-primary" />
      {{ t("home.widgets.catalog.today.name") }}
    </h3>
    <p class="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary">
      {{ date }}
    </p>
    <p v-if="highlights.length" class="mt-1 text-sm font-medium text-primary">
      {{ highlights.join(" · ") }}
    </p>
    <div v-if="hiloulot.length" class="mt-4">
      <p class="text-xs font-semibold text-text-secondary">
        {{ t("home.widgets.today.hiloulot") }}
      </p>
      <p class="mt-1 text-sm leading-relaxed text-text-primary">
        {{ hiloulot.slice(0, VISIBLE).join(", ") }}
        <span v-if="more" class="text-text-secondary">
          {{ t("home.widgets.today.more", { n: more }, more) }}
        </span>
      </p>
    </div>
  </RouterLink>
</template>
