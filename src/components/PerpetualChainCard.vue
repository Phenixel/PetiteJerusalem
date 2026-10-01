<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName, Session } from "../models/models";
import { sessionService } from "../services/sessionService";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";
import ProgressBar from "./ProgressBar.vue";

/**
 * La chaîne perpétuelle en tête du partage : une carte comme les autres
 * chaînes, cliquable tout entière, placée sous le bouton de création. La
 * couleur du thème ne marque que ce qui la distingue (« Toujours ouverte »,
 * le nombre de tours terminés, l'avancement), et la carte ne nomme personne :
 * elle dit pour combien de personnes on lit, les noms sont sur sa page.
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

/** « On y lit pour 5 personnes. », sans nommer personne. */
const namesLine = computed(() => {
  const count = props.names.length;
  return count === 0
    ? t("perpetual.noNamesYet")
    : t("perpetual.readingForCount", { n: count }, count);
});

const to = computed(() => `/share-reading/session/${props.session.slug || props.session.id}`);

const track = () => {
  analyticsService.capture("perpetual_chain_opened", { source: "share_home" });
};
</script>

<template>
  <RouterLink
    :to="to"
    class="card card-hover group p-5 md:p-6 flex flex-col gap-4"
    data-perpetual-card
    @click="track"
  >
    <div class="flex items-center gap-4">
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
          <AppIcon name="rotate" :size="13" />
          {{ t("perpetual.alwaysOpen") }}
        </span>
        <span
          class="text-xl font-bold leading-tight text-text-primary group-hover:text-primary transition-colors"
        >
          {{ session.name }}
        </span>
        <span class="text-sm leading-relaxed text-text-secondary">
          {{ t("perpetual.homeText") }}
        </span>
      </div>
      <!-- Le chiffre en avant, au bout de la ligne : les tours terminés. Au
           premier tour, il n'y a rien à compter encore. -->
      <div v-if="completed > 0" class="shrink-0 flex flex-col items-center">
        <span
          class="font-display text-4xl md:text-5xl font-bold leading-none text-primary tabular-nums"
        >
          {{ completed }}
        </span>
        <span class="mt-1 text-xs font-semibold text-text-secondary">
          {{ t("perpetual.timesCompleted") }}
        </span>
      </div>
    </div>

    <div v-if="progress.total > 0" class="flex flex-col gap-1.5">
      <div class="flex justify-between gap-3 text-xs font-semibold">
        <span class="text-text-primary">{{ t("perpetual.cycle", { n: cycle }) }}</span>
        <span class="text-text-secondary">
          {{ t("perpetual.roundProgress", { read: progress.read, total: progress.total }) }}
        </span>
      </div>
      <ProgressBar
        :value="progress.readPercentage"
        size="xs"
        :label="t('perpetual.roundProgress', { read: progress.read, total: progress.total })"
      />
    </div>

    <span class="text-sm leading-relaxed text-text-secondary">{{ namesLine }}</span>
  </RouterLink>
</template>
