<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName } from "../../models/models";
import { formatPrayerName } from "../../services/perpetualChain";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * « Vous lisez pour » : dans le lecteur, sous la réservation d'un Téhilim de
 * la chaîne perpétuelle, les noms pour lesquels on le lit. On les dit avant
 * de commencer ; les premiers suffisent, le reste se déplie.
 */
const props = defineProps<{ names: PrayerName[] }>();

const { t } = useI18n();

const FOLDED_COUNT = 6;
const open = ref(false);

const shown = computed(() => (open.value ? props.names : props.names.slice(0, FOLDED_COUNT)));
const hidden = computed(() => Math.max(0, props.names.length - FOLDED_COUNT));
</script>

<template>
  <div class="flex flex-col gap-1.5 pt-3 mt-3 border-t border-line" data-prayer-names-line>
    <span class="text-xs font-semibold text-text-secondary">
      {{ t("perpetual.reading.readingFor") }}
    </span>
    <ul class="text-sm font-medium leading-relaxed text-text-primary">
      <li v-for="(name, i) in shown" :key="name.id" class="inline">
        <span class="whitespace-nowrap">{{ formatPrayerName(name) }}</span>
        <span v-if="i < shown.length - 1" class="text-text-secondary/50" aria-hidden="true">
          ·
        </span>
      </li>
    </ul>
    <button
      v-if="hidden > 0 && !open"
      type="button"
      class="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
      :aria-expanded="open"
      @click="open = true"
    >
      {{ t("perpetual.reading.more", { n: hidden }, hidden) }}
      <AppIcon name="chevron-down" :size="13" />
    </button>
  </div>
</template>
