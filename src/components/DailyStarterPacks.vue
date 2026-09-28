<script setup lang="ts">
// Les trois parcours de départ, quand la liste est vide : « Lire »,
// « Faire », « Progresser ». Un clic compose une première liste, qu'on
// retouche ensuite dans « Gérer ma liste ».
import { useI18n } from "vue-i18n";
import { STARTER_PACKS, type StarterPack } from "../services/dailyActions";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";

defineProps<{ busy?: boolean }>();
const emit = defineEmits<{ (e: "choose", pack: StarterPack): void }>();

const { t } = useI18n();

const ICONS: Record<StarterPack["id"], IconName> = {
  lire: "book-open",
  faire: "circle-check",
  progresser: "flame",
};
</script>

<template>
  <div>
    <p class="text-sm text-text-secondary mb-3">{{ t("dailyReading.packs.intro") }}</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button
        v-for="pack in STARTER_PACKS"
        :key="pack.id"
        type="button"
        class="card card-hover p-4 text-left flex flex-col gap-2"
        :disabled="busy"
        @click="emit('choose', pack)"
      >
        <AppIcon :name="ICONS[pack.id]" :size="20" class="text-primary" />
        <span class="font-semibold text-text-primary">{{ t(pack.titleKey) }}</span>
        <span class="text-xs text-text-secondary leading-relaxed">{{
          t(pack.descriptionKey)
        }}</span>
      </button>
    </div>
  </div>
</template>
