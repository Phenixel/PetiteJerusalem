<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  adjacentParasha,
  getParashaForShabbat,
  getWeeklyParasha,
  shabbatOfWeek,
  type WeeklyParasha,
} from "../../services/dailyCycles";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { seoService } from "../../services/seoService";
import { analyticsService } from "../../services/analyticsService";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useChneiMikraOptions } from "../../composables/useChneiMikraOptions";
import AppIcon from "../../components/icons/AppIcon.vue";
import ChneiMikraOptions from "../../components/ChneiMikraOptions.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import DailyReadingItem from "./DailyReadingItem.vue";

/**
 * Le chnei mikra : la paracha de la semaine, chaque verset suivi de son
 * Targoum Onkelos.
 *
 * Il ne se lisait que depuis la lecture quotidienne, qui demande un compte et
 * qu'il faut avoir pensé à activer. Cette page l'ouvre à tout le monde, et la
 * bibliothèque y renvoie depuis le Tanakh.
 *
 * La semaine affichée vit dans l'URL (`?semaine=2026-08-15`, le Chabbat où la
 * paracha est lue) : le bouton « précédent » du navigateur défait un
 * feuilletage, et un lien envoyé à quelqu'un ouvre bien la même paracha.
 */

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();
// Verset écrit deux fois, Rachi : réglage partagé avec la lecture quotidienne.
const { doubleVerses, withRashi } = useChneiMikraOptions();

const WEEK_PARAM = "semaine";

/** La paracha de la semaine en cours : le défaut, et le retour. */
const currentWeek = computed(() => getWeeklyParasha());

/**
 * La paracha demandée par l'URL. Une semaine inconnue (lien trafiqué, Chabbat
 * de fête sans paracha ordinaire) retombe sur celle de la semaine : mieux vaut
 * une page utile qu'une erreur.
 */
const parasha = computed<WeeklyParasha | null>(() => {
  const asked = route.query[WEEK_PARAM];
  if (typeof asked !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asked)) return currentWeek.value;
  return getParashaForShabbat(shabbatOfWeek(asked)) ?? currentWeek.value;
});

const isCurrentWeek = computed(() => parasha.value?.weekKey === currentWeek.value?.weekKey);

const title = computed(() =>
  (parasha.value?.entries ?? []).map((e) => appendHebrewNumeral(e.name)).join(" · "),
);

/** « Chabbat 8 août », le Chabbat où la paracha affichée est lue. */
const shabbatLabel = computed(() => {
  if (!parasha.value) return "";
  const date = new Intl.DateTimeFormat(locale.value, {
    day: "numeric",
    month: "long",
  }).format(shabbatOfWeek(parasha.value.weekKey));
  return t("chneiMikra.shabbatOn", { date });
});

/** Les parachiot voisines : une flèche sans destination est désactivée. */
const previous = computed(() =>
  parasha.value ? adjacentParasha(parasha.value.weekKey, -1) : null,
);
const next = computed(() => (parasha.value ? adjacentParasha(parasha.value.weekKey, 1) : null));

function goTo(target: WeeklyParasha | null, direction: "previous" | "next" | "current") {
  if (!target) return;
  analyticsService.capture("chnei_mikra_week_changed", {
    direction,
    parasha: target.names.join("-"),
  });
  // La semaine en cours est le défaut : elle n'a pas à encombrer l'URL.
  // Seule la query change, le chemin reste celui où l'on est.
  const query =
    target.weekKey === currentWeek.value?.weekKey ? {} : { [WEEK_PARAM]: target.weekKey };
  void router.push({ query });
}

function applySeoMeta() {
  seoService.setMeta({
    title: `${t("chneiMikra.title")} · ${title.value} | Petite Jérusalem`,
    description: t("chneiMikra.pageDescription"),
    canonical: window.location.origin + "/bibliotheque/chnei-mikra",
  });
}

watch(title, applySeoMeta, { immediate: true });
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="max-w-3xl mx-auto">
      <RouterLink to="/bibliotheque/tanakh" class="back-link mb-4">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("study.types.tanakh") }}
      </RouterLink>

      <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
        {{ t("chneiMikra.title") }}
      </h1>
      <p class="mt-2 text-text-secondary">{{ t("chneiMikra.hint") }}</p>

      <template v-if="parasha">
        <!-- Feuilleter les parachiot : les Chabbats de fête sont enjambés. -->
        <div class="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            @click="goTo(previous, 'previous')"
            :disabled="!previous"
            class="icon-btn disabled:opacity-30"
            :aria-label="t('chneiMikra.previous')"
            :title="t('chneiMikra.previous')"
          >
            <AppIcon name="chevron-left" :size="20" class="rtl:rotate-180" />
          </button>

          <div class="min-w-0 text-center">
            <p class="truncate text-xl font-bold text-text-primary">{{ title }}</p>
            <p class="text-sm text-text-secondary">{{ shabbatLabel }}</p>
          </div>

          <button
            type="button"
            @click="goTo(next, 'next')"
            :disabled="!next"
            class="icon-btn disabled:opacity-30"
            :aria-label="t('chneiMikra.next')"
            :title="t('chneiMikra.next')"
          >
            <AppIcon name="chevron-right" :size="20" class="rtl:rotate-180" />
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <!-- Parti feuilleter : de quoi revenir à la paracha qu'on lit cette semaine. -->
          <button
            v-if="!isCurrentWeek"
            type="button"
            @click="goTo(currentWeek, 'current')"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <AppIcon name="history" :size="13" />
            {{ t("chneiMikra.backToThisWeek") }}
          </button>
          <span v-else></span>

          <!-- Taille du texte (même réglage que le lecteur de la bibliothèque) -->
          <ReadingSizeControl />
        </div>

        <!-- Options de lecture : verset écrit deux fois, commentaire de Rachi -->
        <ChneiMikraOptions class="mt-4" source="library_chnei_mikra" />

        <!-- La paracha change : on remonte des composants neufs plutôt que de
             recycler ceux du texte précédent, marque-pages compris. -->
        <div :key="parasha.weekKey" class="mt-8 space-y-10">
          <DailyReadingItem
            v-for="entry in parasha.entries"
            :key="entry.id"
            :entry="entry"
            :with-targoum="true"
            :double-verses="doubleVerses"
            :with-rashi="withRashi"
            source="library_chnei_mikra"
          />
        </div>
      </template>

      <p v-else class="mt-10 text-text-secondary">{{ t("chneiMikra.unavailable") }}</p>
    </div>

    <!-- Comme les autres textes de la bibliothèque : le menu de lecture et la
         progression au bas de l'écran. -->
    <ReadingMenu />
    <ReadingProgressBar />
  </main>
</template>
