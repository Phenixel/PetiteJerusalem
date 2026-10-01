<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Session } from "../../../models/models";
import { DateService } from "../../../services/dateService";
import { perpetualStats, type SpokenDuration } from "../../../services/perpetualChain";

/**
 * Le compteur de la chaîne perpétuelle : combien de fois elle a été terminée,
 * en grand au bout de la ligne (docs/design.md, « Le chiffre en avant tombe
 * toujours au même endroit »), et trois chiffres qui le servent en dessous.
 * Au premier tour, il n'y a rien à compter : la carte dit ce qui va venir.
 */
const props = defineProps<{
  session: Session;
  /** Places lues du tour en cours, comme la barre d'avancement. */
  read: number;
  total: number;
}>();

const { t, locale } = useI18n();

const stats = computed(() => perpetualStats(props.session, props.read));

const spoken = (duration: SpokenDuration): string =>
  duration.unit === "hours"
    ? t("perpetual.stats.hours", { n: duration.value })
    : t("perpetual.stats.days", { n: duration.value }, duration.value);

const lastRoundLine = computed(() => {
  const { lastCycle, lastCycleEndedAt, completedCycles } = stats.value;
  if (!lastCycle || !lastCycleEndedAt) return "";
  return t("perpetual.stats.lastRound", {
    n: completedCycles,
    date: DateService.formatDate(lastCycleEndedAt),
    duration: spoken(lastCycle),
  });
});

const totalReadLabel = computed(() =>
  new Intl.NumberFormat(locale.value).format(stats.value.totalRead),
);
</script>

<template>
  <section
    class="card p-5 md:p-6 max-w-3xl mx-auto w-full flex flex-col gap-4"
    :aria-label="t('perpetual.stats.label')"
  >
    <template v-if="stats.completedCycles > 0">
      <div class="flex items-center gap-4">
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <h2 class="text-base md:text-lg font-bold text-text-primary">
            {{ t("perpetual.stats.title") }}
          </h2>
          <p v-if="lastRoundLine" class="text-sm leading-relaxed text-text-secondary">
            {{ lastRoundLine }}
          </p>
        </div>
        <div class="shrink-0 flex flex-col items-center">
          <span
            class="font-display text-4xl md:text-5xl font-bold leading-none text-primary tabular-nums"
          >
            {{ stats.completedCycles }}
          </span>
          <span class="mt-1 text-xs font-semibold text-text-secondary">
            {{ t("perpetual.stats.times") }}
          </span>
        </div>
      </div>
      <dl class="grid grid-cols-3 gap-3 pt-3.5 border-t border-line">
        <div class="flex flex-col-reverse gap-0.5">
          <dt class="text-xs text-text-secondary">{{ t("perpetual.stats.totalRead") }}</dt>
          <dd class="text-lg font-bold text-text-primary tabular-nums">{{ totalReadLabel }}</dd>
        </div>
        <div v-if="stats.lastCycleParticipants !== null" class="flex flex-col-reverse gap-0.5">
          <dt class="text-xs text-text-secondary">{{ t("perpetual.stats.readers") }}</dt>
          <dd class="text-lg font-bold text-text-primary tabular-nums">
            {{ stats.lastCycleParticipants }}
          </dd>
        </div>
        <div v-if="stats.averageCycle" class="flex flex-col-reverse gap-0.5">
          <dt class="text-xs text-text-secondary">{{ t("perpetual.stats.average") }}</dt>
          <dd class="text-lg font-bold text-text-primary tabular-nums">
            {{ spoken(stats.averageCycle) }}
          </dd>
        </div>
      </dl>
    </template>
    <div v-else class="flex flex-col gap-1">
      <h2 class="text-base md:text-lg font-bold text-text-primary">
        {{ t("perpetual.stats.firstRoundTitle") }}
      </h2>
      <p class="text-sm leading-relaxed text-text-secondary">
        {{ t("perpetual.stats.firstRoundText", { total }) }}
      </p>
    </div>
  </section>
</template>
