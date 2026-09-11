<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useChneiMikraOptions } from "../composables/useChneiMikraOptions";
import { analyticsService } from "../services/analyticsService";
import ToggleSwitch from "./ToggleSwitch.vue";

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
      <ToggleSwitch v-model="doubleVerses" @update:model-value="capture('double_verses', $event)" />
      {{ t("chneiMikra.doubleVerses") }}
    </label>

    <label class="inline-flex items-center gap-2.5 cursor-pointer text-sm text-text-primary">
      <ToggleSwitch v-model="withRashi" @update:model-value="capture('rashi', $event)" />
      {{ t("chneiMikra.withRashi") }}
    </label>
  </div>
</template>
