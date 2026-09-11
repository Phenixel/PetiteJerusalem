<script setup lang="ts">
/**
 * La lecture, vue depuis les réglages.
 *
 * Pour l'instant, une seule ligne : le défilement automatique se lance d'un
 * double appui sur le texte, et deux appuis rapprochés arrivent sans qu'on
 * l'ait voulu. Coupé ici, le geste ne répond plus du tout, et le texte ne se
 * met plus à descendre sans qu'on sache pourquoi. L'allure, elle, reste dans
 * la pastille du bas : elle se règle pendant qu'on lit, pas avant.
 *
 * Des lignes séparées d'un filet, sans cadre : d'autres réglages viendront
 * s'ajouter à celle-ci, et la liste doit pouvoir s'allonger sans devenir un
 * empilement de boîtes (voir docs/design.md).
 */
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  autoScrollEnabled,
  restoreAutoScrollFromDevice,
  setAutoScrollEnabled,
} from "../../composables/useAutoScroll";
import ToggleSwitch from "../ToggleSwitch.vue";

const { t } = useI18n();

// Le réglage peut n'exister que dans les préférences natives (localStorage
// vidé par le système) : on le relit à l'ouverture de l'écran, sans quoi
// l'interrupteur s'afficherait allumé alors qu'il est coupé.
onMounted(() => void restoreAutoScrollFromDevice());
</script>

<template>
  <section>
    <h2 class="mb-2 text-2xl font-bold text-text-primary">
      {{ t("textReading.autoScroll.settingsTitle") }}
    </h2>
    <p class="mb-3 text-text-secondary">{{ t("textReading.autoScroll.settingsDescription") }}</p>

    <ul class="flex flex-col divide-y divide-line">
      <li>
        <label class="flex cursor-pointer items-center justify-between gap-3 py-3">
          <span class="min-w-0">
            <span class="block font-semibold text-text-primary">
              {{ t("textReading.autoScroll.option") }}
            </span>
            <span class="block text-sm text-text-secondary leading-relaxed">
              {{ t("textReading.autoScroll.optionHint") }}
            </span>
          </span>
          <ToggleSwitch
            :model-value="autoScrollEnabled"
            @update:model-value="setAutoScrollEnabled"
          />
        </label>
      </li>
    </ul>
  </section>
</template>
