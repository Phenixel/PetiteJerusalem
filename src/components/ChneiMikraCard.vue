<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  adjacentParasha,
  getWeeklyParasha,
  shabbatOfWeek,
  type WeeklyParasha,
} from "../services/dailyCycles";
import { appendHebrewNumeral } from "../services/hebrewNumerals";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";
import CollapseTransition from "./CollapseTransition.vue";
import DailyReadingItem from "../views/Library/DailyReadingItem.vue";

/**
 * Le chnei mikra en tête du Tanakh de la bibliothèque.
 *
 * La paracha de la semaine avec son Targoum Onkelos ne se lisait que depuis la
 * lecture quotidienne, qui demande un compte et qu'il faut avoir pensé à
 * activer. Le Tanakh est pourtant l'endroit où on la cherche : elle s'y affiche
 * donc en permanence, et les flèches feuillettent les parachiot d'un Chabbat à
 * l'autre.
 *
 * Le texte reste replié à l'ouverture : cette page est un catalogue, une
 * paracha entière dépliée d'office enterrerait les livres sous elle.
 */

const { t, locale } = useI18n();

/** La paracha de la semaine en cours : le point de départ, et le retour. */
const current = getWeeklyParasha();
/** La paracha affichée : celle de la semaine, jusqu'à ce qu'on feuillette. */
const shown = ref<WeeklyParasha | null>(current);
const expanded = ref(false);

/** Feuilleter revient à la semaine en cours, d'où ce repère. */
const isCurrentWeek = computed(() => shown.value?.weekKey === current?.weekKey);

const title = computed(() =>
  (shown.value?.entries ?? []).map((e) => appendHebrewNumeral(e.name)).join(" · "),
);

/** « Chabbat 8 août » — le Chabbat où la paracha affichée est lue. */
const shabbatLabel = computed(() => {
  if (!shown.value) return "";
  const date = new Intl.DateTimeFormat(locale.value, {
    day: "numeric",
    month: "long",
  }).format(shabbatOfWeek(shown.value.weekKey));
  return t("chneiMikra.shabbatOn", { date });
});

function go(direction: 1 | -1) {
  if (!shown.value) return;
  const next = adjacentParasha(shown.value.weekKey, direction);
  if (!next) return;
  shown.value = next;
  analyticsService.capture("chnei_mikra_week_changed", {
    direction: direction === 1 ? "next" : "previous",
    parasha: next.names.join("-"),
  });
}

function backToCurrentWeek() {
  shown.value = current;
}

function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    analyticsService.capture("chnei_mikra_opened", {
      source: "library_tanakh",
      parasha: shown.value?.names.join("-") ?? null,
      current_week: isCurrentWeek.value,
    });
  }
}
</script>

<template>
  <section v-if="shown" class="card p-5 mb-10 animate-[fadeIn_0.4s_ease]">
    <div class="flex items-start justify-between gap-3">
      <button type="button" @click="toggle" class="group flex min-w-0 items-start gap-3 text-left">
        <AppIcon
          name="chevron-down"
          :size="13"
          class="mt-1.5 shrink-0 text-text-secondary/60 transition-transform duration-200"
          :class="expanded ? '' : '-rotate-90 rtl:rotate-90'"
        />
        <span class="min-w-0">
          <span class="block text-xs font-semibold text-primary">
            {{ t("chneiMikra.title") }}
          </span>
          <span
            class="block text-lg font-bold text-text-primary transition-colors group-hover:text-primary"
          >
            {{ title }}
          </span>
          <span class="block text-sm text-text-secondary">{{ shabbatLabel }}</span>
        </span>
      </button>

      <!-- Feuilleter les parachiot : les Chabbats de fête sont enjambés. -->
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          @click="go(-1)"
          class="icon-btn"
          :aria-label="t('chneiMikra.previous')"
          :title="t('chneiMikra.previous')"
        >
          <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
        </button>
        <button
          type="button"
          @click="go(1)"
          class="icon-btn"
          :aria-label="t('chneiMikra.next')"
          :title="t('chneiMikra.next')"
        >
          <AppIcon name="chevron-right" :size="18" class="rtl:rotate-180" />
        </button>
      </div>
    </div>

    <!-- Parti feuilleter : de quoi revenir à la paracha qu'on lit cette semaine. -->
    <button
      v-if="!isCurrentWeek"
      type="button"
      @click="backToCurrentWeek"
      class="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <AppIcon name="history" :size="13" />
      {{ t("chneiMikra.backToThisWeek") }}
    </button>

    <CollapseTransition>
      <div v-show="expanded" class="mt-5">
        <p class="mb-4 text-xs text-text-secondary/70">{{ t("chneiMikra.hint") }}</p>
        <div class="space-y-8">
          <DailyReadingItem
            v-for="entry in shown.entries"
            :key="entry.id"
            :entry="entry"
            :with-targoum="true"
            source="library_chnei_mikra"
          />
        </div>
      </div>
    </CollapseTransition>
  </section>
</template>
