<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { localeMessagesReady } from "../../i18n";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { pageTitle, seoService } from "../../services/seoService";
import { psalmsLabel, useTehilimDay } from "../../composables/useTehilimDay";
import { analyticsService } from "../../services/analyticsService";
import { useReadingPinch } from "../../composables/useReadingPinch";
import { useAutoScroll } from "../../composables/useAutoScroll";
import AppIcon from "../../components/icons/AppIcon.vue";
import BookEncadrement from "../../components/BookEncadrement.vue";
import ReadingMenu from "../../components/ReadingMenu.vue";
import ReadingProgressBar from "../../components/ReadingProgressBar.vue";
import ReadingSizeControl from "../../components/ReadingSizeControl.vue";
import DailyReadingItem from "./DailyReadingItem.vue";
import { SITE_URL } from "../../config/site";

/**
 * Les Tehilim du jour : les psaumes du cycle mensuel, les uns sous les autres.
 *
 * La bibliothèque les annonçait par une rangée de numéros, chacun menant à sa
 * page : lire les quinze psaumes d'un 5 du mois demandait quinze allers-retours.
 * Ils se lisent d'une traite, comme le chnei mikra, et cette page les donne
 * d'une traite. La bibliothèque, elle, garde son catalogue.
 *
 * Le jour est celui du mois hébraïque, calculé sur l'appareil : la page n'a
 * rien à charger pour savoir quoi montrer.
 */

const { t, locale } = useI18n();
// App native : pincer dans la page agrandit le texte lu, pas la page.
useReadingPinch();

/**
 * Le jour hébraïque (il bascule à la chkia du lieu des horaires), relu quand
 * la page revient à l'écran : une app qu'on laisse ouverte et qu'on rouvre le
 * lendemain proposerait sinon les psaumes de la veille. Pendant la lecture,
 * en revanche, rien ne change sous les yeux (`live: false`) : le jour ne
 * bascule qu'entre deux passages.
 */
const { cycle } = useTehilimDay({ live: false });

// Double appui sur le texte : la page descend toute seule, à l'allure choisie
// dans la pastille du bas (AutoScrollPill).
useAutoScroll(() => cycle.value.entries.length > 0);

const rangeLabel = computed(() => psalmsLabel(cycle.value.psalms, t));

function applySeoMeta() {
  seoService.setMeta({
    title: pageTitle(`${t("tehilimDay.title")} · ${rangeLabel.value}`),
    description: t("tehilimDay.pageDescription"),
    canonical: SITE_URL + "/bibliotheque/tehilim-du-jour",
  });
}

// Rejoué au changement de langue : les messages en et he arrivent par import
// dynamique, parfois après le montage.
watch([rangeLabel, locale, localeMessagesReady], applySeoMeta, { immediate: true });

onMounted(() => {
  analyticsService.capture("tehilim_day_page_viewed", {
    day: cycle.value.day,
    psalms_count: cycle.value.psalms.length,
  });
});
</script>

<template>
  <main class="mx-auto px-6 py-12">
    <div class="max-w-3xl mx-auto">
      <RouterLink to="/bibliotheque/tehilim" class="back-link mb-4">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("study.types.tehilim") }}
      </RouterLink>

      <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight pb-1">
        {{ t("tehilimDay.title") }}
      </h1>
      <p class="mt-2 text-text-secondary">{{ t("tehilimDay.hint") }}</p>

      <template v-if="cycle.entries.length">
        <div class="mt-8 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-xl font-bold text-text-primary">{{ rangeLabel }}</p>
            <p class="text-sm text-text-secondary">
              {{ t("tehilimDay.dayOfMonth", { day: cycle.day }) }}
            </p>
          </div>

          <!-- Taille du texte (même réglage que le lecteur de la bibliothèque) -->
          <ReadingSizeControl />
        </div>

        <!-- Ce qu'on dit avant de lire des Tehilim : une fois, en tête des
             psaumes du jour (voir EncadrementPlace). Ce qui se dit après les
             attend en bas de page, là où la lecture se termine. -->
        <BookEncadrement corpus="tehilim" part="before" class="mt-6" />

        <!-- Le jour a basculé pendant que la page était de côté : on remonte
             des composants neufs plutôt que de recycler ceux de la veille,
             marque-pages compris. -->
        <div :key="cycle.day" class="mt-8 space-y-10">
          <section v-for="entry in cycle.entries" :key="entry.id">
            <h2 class="mb-4 text-lg font-bold text-text-primary">
              {{ appendHebrewNumeral(entry.name) }}
            </h2>
            <DailyReadingItem :entry="entry" source="library_tehilim_day" />
          </section>
        </div>

        <!-- Le dernier psaume dit, ce qui se dit après la lecture. -->
        <BookEncadrement corpus="tehilim" part="after" class="mt-10" />
      </template>

      <p v-else class="mt-10 text-text-secondary">{{ t("tehilimDay.unavailable") }}</p>
    </div>

    <!-- Comme les autres textes de la bibliothèque : le menu de lecture et la
         progression au bas de l'écran. -->
    <ReadingMenu />
    <ReadingProgressBar />
  </main>
</template>
