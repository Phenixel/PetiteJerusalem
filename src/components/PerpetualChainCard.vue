<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName, Session } from "../models/models";
import { sessionService } from "../services/sessionService";
import { analyticsService } from "../services/analyticsService";
import { formatPrayerName } from "../services/perpetualChain";
import AppIcon from "./icons/AppIcon.vue";

/**
 * La chaîne perpétuelle en tête du partage. C'est la seule carte colorée de la
 * page (docs/design.md, « Ce qu'on vient chercher prend la couleur, pleine ») :
 * la seule chaîne qu'on peut toujours rejoindre, et celle où l'on vient
 * quand la sienne ne trouve pas assez de lecteurs.
 *
 * Le blanc y descend en trois tons, comme sur la carte de la prochaine fête :
 * le nom et le compteur à plein, ce qui les explique en dessous, les noms
 * plus bas encore.
 */
const props = defineProps<{
  session: Session;
  /** Les noms lus aujourd'hui, ceux du lecteur en tête. */
  names: PrayerName[];
}>();

const { t } = useI18n();

const progress = computed(() => sessionService.getSessionReservationStats(props.session));
const completed = computed(() => props.session.completedCycles ?? 0);
const cycle = computed(() => props.session.cycle ?? completed.value + 1);

/** « On y lit pour David ben Sarah, Rivka bat Léa et 21 autres. » */
const namesLine = computed(() => {
  const shown = props.names.slice(0, 2).map(formatPrayerName);
  if (shown.length === 0) return t("perpetual.noNamesYet");
  const names = shown.join(", ");
  const others = props.names.length - shown.length;
  return others > 0
    ? t("perpetual.readingForMore", { names, count: others }, others)
    : t("perpetual.readingFor", { names });
});

const to = computed(() => `/share-reading/session/${props.session.slug || props.session.id}`);

const track = () => {
  analyticsService.capture("perpetual_chain_opened", { source: "share_home" });
};
</script>

<template>
  <RouterLink
    :to="to"
    class="card bg-primary text-white p-5 md:p-6 flex flex-col gap-4"
    data-perpetual-card
    @click="track"
  >
    <div class="flex items-center gap-4">
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85">
          <AppIcon name="rotate" :size="13" />
          {{ t("perpetual.alwaysOpen") }}
        </span>
        <span class="text-xl font-bold leading-tight">{{ session.name }}</span>
        <span class="text-sm leading-relaxed text-white/85">{{ t("perpetual.homeText") }}</span>
      </div>
      <!-- Le chiffre en avant, au bout de la ligne : les tours terminés. Au
           premier tour, il n'y a rien à compter encore. -->
      <div v-if="completed > 0" class="shrink-0 flex flex-col items-center">
        <span class="font-display text-4xl md:text-5xl font-bold leading-none tabular-nums">
          {{ completed }}
        </span>
        <span class="mt-1 text-xs font-semibold text-white/85">
          {{ t("perpetual.timesCompleted") }}
        </span>
      </div>
    </div>

    <div v-if="progress.total > 0" class="flex flex-col gap-1.5">
      <div class="flex justify-between gap-3 text-xs font-semibold">
        <span>{{ t("perpetual.cycle", { n: cycle }) }}</span>
        <span class="text-white/85">
          {{ t("perpetual.roundProgress", { read: progress.read, total: progress.total }) }}
        </span>
      </div>
      <div class="h-1.5 rounded-full bg-white/25 overflow-hidden">
        <div
          class="h-full w-full rounded-full bg-white origin-left rtl:origin-right transition-transform"
          :style="{ transform: `scaleX(${progress.readPercentage / 100})` }"
        ></div>
      </div>
    </div>

    <span class="text-sm leading-relaxed text-white/70">{{ namesLine }}</span>
  </RouterLink>
</template>
