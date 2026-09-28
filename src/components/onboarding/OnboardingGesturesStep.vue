<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MockPinch from "../mock/MockPinch.vue";
import MockReadingMenu from "../mock/MockReadingMenu.vue";
import MockAutoScroll from "../mock/MockAutoScroll.vue";

/**
 * La dernière page, la seule qu'on puisse passer : les gestes de la lecture.
 * Aucun ne se devine, d'où les captures qui les montrent se faire (chaque
 * capture est un morceau d'application dessiné, voir components/mock, donc
 * juste dans le thème et la langue choisis).
 *
 * Les textes sont ceux des astuces du lecteur (`tips.reading.*`) : ce sont
 * les mêmes gestes, ils doivent se dire de la même façon. Qui passe cette
 * page les retrouvera là, en lisant.
 */

const { t } = useI18n();

const gestures = [
  { component: MockReadingMenu, key: "menu" },
  { component: MockPinch, key: "pinch" },
  { component: MockAutoScroll, key: "autoScroll" },
] as const;
</script>

<template>
  <div>
    <h1 class="mb-3 text-3xl font-bold text-text-primary sm:text-4xl">
      {{ t("onboarding.gestures.title") }}
    </h1>
    <p class="mb-8 text-lg text-text-secondary">
      {{ t("onboarding.gestures.intro") }}
    </p>

    <figure v-for="gesture in gestures" :key="gesture.key" class="mb-8 last:mb-0">
      <component :is="gesture.component" />
      <figcaption class="mt-3">
        <span class="block font-semibold text-text-primary">
          {{ t(`tips.reading.${gesture.key}.title`) }}
        </span>
        <span class="mt-0.5 block text-sm text-text-secondary">
          {{ t(`tips.reading.${gesture.key}.text`) }}
        </span>
      </figcaption>
    </figure>
  </div>
</template>
