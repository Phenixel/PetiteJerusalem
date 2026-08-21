<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useChneiMikraOptions } from "../composables/useChneiMikraOptions";
import { analyticsService } from "../services/analyticsService";

/**
 * Les deux options du chnei mikra : le verset écrit deux fois (chnayim mikra)
 * et le commentaire de Rachi. Le réglage est partagé (useChneiMikraOptions) :
 * activer Rachi ici l'active aussi dans la lecture quotidienne, et
 * inversement.
 */

const props = defineProps<{
  /** D'où l'option est basculée, pour la mesure d'audience. */
  source: string;
}>();

const { t } = useI18n();
const { doubleVerses, withRashi } = useChneiMikraOptions();

function capture(option: string, enabled: boolean) {
  analyticsService.capture("chnei_mikra_option_toggled", {
    option,
    enabled,
    source: props.source,
  });
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
    <label class="inline-flex items-center gap-2.5 cursor-pointer text-sm text-text-primary">
      <span class="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          class="sr-only peer"
          v-model="doubleVerses"
          @change="capture('double_verses', doubleVerses)"
        />
        <span
          class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
        ></span>
      </span>
      {{ t("chneiMikra.doubleVerses") }}
    </label>

    <label class="inline-flex items-center gap-2.5 cursor-pointer text-sm text-text-primary">
      <span class="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          class="sr-only peer"
          v-model="withRashi"
          @change="capture('rashi', withRashi)"
        />
        <span
          class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
        ></span>
      </span>
      {{ t("chneiMikra.withRashi") }}
    </label>
  </div>
</template>
