<script setup lang="ts">
/**
 * « Paracha de la semaine » : celle qu'on lit ce Chabbat, puis le calendrier
 * des Chabbats qui suivent, chacun lié au texte de sa paracha.
 *
 * Les 54 pages de parachiot de la bibliothèque existaient déjà, mais aucune
 * page ne répondait à « quelle est la paracha de cette semaine ». Tout est
 * calculé sur l'appareil (parashaCalendar, qui ne fait qu'appeler
 * dailyCycles) : la page tient hors connexion, comme les horaires.
 */
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { hubPath } from "../../content/etudeTexts";
import { PARASHA_PATH, parashaLabel, parashaWeeks } from "../../content/parashaCalendar";
import { SITE_URL } from "../../config/site";
import { analyticsService } from "../../services/analyticsService";
import { seoService } from "../../services/seoService";
import AppIcon from "../../components/icons/AppIcon.vue";

/** Un cycle complet et des poussières : chaque paracha y passe au moins une fois. */
const CYCLE_WEEKS = 56;

const { t, locale } = useI18n();

const weeks = computed(() => parashaWeeks(new Date(), CYCLE_WEEKS));
const current = computed(() => weeks.value[0] ?? null);
const rest = computed(() => weeks.value.slice(1));

/**
 * « 7 novembre 2026 », dans la langue affichée. Sans le jour de la semaine :
 * la date suit toujours le mot « Chabbat », qui le dit déjà.
 */
const dayYear = (date: Date): string =>
  new Intl.DateTimeFormat(locale.value, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/** « sam. 7 nov. », la date d'une ligne du calendrier. */
const dayShort = (date: Date): string =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

onMounted(() => {
  const url = `${SITE_URL}${PARASHA_PATH}`;
  seoService.setMeta({
    title: t("seo.parashaTitle"),
    description: t("seo.parashaDescription"),
    canonical: url,
    og: { url },
  });
  analyticsService.capture("parasha_viewed");
});
</script>

<template>
  <main class="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
    <RouterLink to="/bibliotheque/tanakh" class="back-link mb-6">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("study.types.tanakh") }}
    </RouterLink>

    <h1 class="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
      {{ t("paracha.title") }}
    </h1>
    <p class="mt-1.5 text-xs text-text-secondary leading-relaxed">
      {{ t("paracha.description") }}
    </p>

    <!-- Ce qu'on vient chercher : la paracha de ce Chabbat, et de quoi la lire. -->
    <section v-if="current" class="card mt-6 p-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-primary">
        {{ t("paracha.thisWeek") }}
      </p>
      <p class="mt-1 text-xl font-bold text-text-primary">{{ parashaLabel(current.parasha) }}</p>
      <p class="text-sm text-text-secondary">
        {{ t("paracha.readOn", { date: dayYear(current.shabbat) }) }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <RouterLink
          v-for="entry in current.parasha.entries"
          :key="entry.id"
          :to="hubPath(entry)"
          class="btn btn-primary"
        >
          {{ t("paracha.read", { name: entry.name }) }}
        </RouterLink>
        <RouterLink to="/bibliotheque/chnei-mikra" class="btn btn-soft">
          {{ t("paracha.chneiMikra") }}
        </RouterLink>
      </div>
    </section>

    <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-text-secondary">
      {{ t("paracha.cycle") }}
    </h2>
    <ul class="mt-3 flex flex-col divide-y divide-line">
      <li
        v-for="week in rest"
        :key="week.parasha.weekKey"
        class="flex items-center justify-between gap-4 py-2.5"
      >
        <span class="min-w-0">
          <RouterLink
            v-for="(entry, index) in week.parasha.entries"
            :key="entry.id"
            :to="hubPath(entry)"
            class="font-medium text-primary hover:underline"
            >{{ index > 0 ? " - " : "" }}{{ entry.name }}</RouterLink
          >
          <span class="block text-xs text-text-secondary">{{ week.parasha.entries[0].livre }}</span>
        </span>
        <span class="shrink-0 text-sm tabular-nums text-text-secondary">
          {{ dayShort(week.shabbat) }}
        </span>
      </li>
    </ul>

    <p class="mt-6 border-t border-line pt-3 text-xs text-text-secondary leading-relaxed">
      {{ t("paracha.shabbatNote") }}
      <RouterLink to="/horaires" class="text-primary hover:underline">
        {{ t("zmanim.navTitle") }}
      </RouterLink>
    </p>
  </main>
</template>
