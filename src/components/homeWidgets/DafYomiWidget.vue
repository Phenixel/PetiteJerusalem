<script setup lang="ts">
/**
 * Widget « Daf hayomi » : le traité et le daf du jour, en grand à la fin de la
 * ligne comme le pourcentage de la lecture du jour, et la barre de ce qui est
 * fait du traité. Le daf change à minuit (jour civil, voir useDafYomi).
 *
 * Il mène au traité dans la bibliothèque ; un traité absent du catalogue
 * renvoie à la lecture du jour, où le Daf hayomi se coche.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDafYomi } from "../../composables/useTehilimDay";
import { dafProgress } from "../../services/dafYomi";
import { hubPath } from "../../content/etudeTexts";
import AppIcon from "../icons/AppIcon.vue";
import ProgressBar from "../ProgressBar.vue";

const { t } = useI18n();

const daf = useDafYomi();

const progress = computed(() => (daf.value ? dafProgress(daf.value) : null));
const pct = computed(() =>
  progress.value ? Math.round((progress.value.dafIndex / progress.value.dafCount) * 100) : 0,
);
const to = computed(() =>
  daf.value?.entry ? hubPath(daf.value.entry) : "/bibliotheque/lecture-du-jour",
);
</script>

<template>
  <RouterLink v-if="daf && progress" :to="to" class="card card-hover p-5 md:p-6 block group">
    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <h3
          class="font-semibold text-text-primary flex items-center gap-2.5 group-hover:text-primary transition-colors"
        >
          <AppIcon name="graduation-cap" :size="17" class="shrink-0 text-primary" />
          {{ t("home.widgets.catalog.daf_yomi.name") }}
        </h3>
        <p class="mt-1 text-lg font-medium leading-snug text-text-primary">
          {{ daf.entry?.name ?? daf.tractate }}
        </p>
        <p class="mt-0.5 text-sm text-text-secondary">
          {{
            t("home.widgets.daf.progress", { index: progress.dafIndex, count: progress.dafCount })
          }}
        </p>
      </div>
      <span class="shrink-0 text-4xl md:text-5xl font-bold leading-none tabular-nums text-primary">
        {{ daf.blatt }}
      </span>
    </div>
    <ProgressBar class="mt-4" :value="pct" :label="t('home.widgets.catalog.daf_yomi.name')" />
  </RouterLink>
</template>
