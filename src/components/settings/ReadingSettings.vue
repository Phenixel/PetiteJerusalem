<script setup lang="ts">
/**
 * La lecture, vue depuis les réglages.
 *
 * Pour l'instant, un seul interrupteur : le défilement automatique se lance
 * d'un double appui sur le texte, et deux appuis rapprochés arrivent sans
 * qu'on l'ait voulu. Coupé ici, le geste ne répond plus du tout, et le texte
 * ne se met plus à descendre sans qu'on sache pourquoi. L'allure, elle, reste
 * dans la pastille du bas : elle se règle pendant qu'on lit, pas avant.
 */
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  autoScrollEnabled,
  restoreAutoScrollFromDevice,
  setAutoScrollEnabled,
} from "../../composables/useAutoScroll";

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
    <p class="mb-6 text-text-secondary">{{ t("textReading.autoScroll.settingsDescription") }}</p>

    <div class="rounded-card bg-surface p-5 shadow-card">
      <label class="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span class="block font-semibold text-text-primary">
            {{ t("textReading.autoScroll.option") }}
          </span>
          <span class="block text-sm text-text-secondary leading-relaxed">
            {{ t("textReading.autoScroll.optionHint") }}
          </span>
        </span>
        <span class="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            class="sr-only peer"
            :checked="autoScrollEnabled"
            @change="setAutoScrollEnabled(($event.target as HTMLInputElement).checked)"
          />
          <span
            class="w-10 h-5 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-primary dark:bg-white/20"
          ></span>
        </span>
      </label>
    </div>
  </section>
</template>
