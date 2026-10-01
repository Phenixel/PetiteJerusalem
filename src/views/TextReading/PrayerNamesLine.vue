<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName, PrayerNameKind } from "../../models/models";
import { formatPrayerName } from "../../services/perpetualChain";
import AppIcon from "../../components/icons/AppIcon.vue";
import type { IconName } from "../../components/icons/registry";

/**
 * « Vous lisez pour » : dans le lecteur, sous la réservation d'un Téhilim de
 * la chaîne perpétuelle, les noms pour lesquels on le lit. Deux groupes,
 * comme sur la page de la chaîne (PrayerNamesCard) : on ne dit pas de la même
 * façon une refoua chelema et un leilouy nichmat. Les premiers noms de chaque
 * groupe suffisent, le reste se déplie.
 */
const props = defineProps<{ names: PrayerName[] }>();

const { t } = useI18n();

/** Noms montrés par groupe avant de déplier. */
const FOLDED_COUNT = 3;
const open = ref(false);

const GROUPS: { kind: PrayerNameKind; icon: IconName; labelKey: string }[] = [
  { kind: "refoua", icon: "heart", labelKey: "perpetual.names.refoua" },
  { kind: "leilouy", icon: "candle", labelKey: "perpetual.names.leilouy" },
];

const groups = computed(() =>
  GROUPS.map((group) => {
    const names = props.names.filter((name) => name.kind === group.kind);
    return {
      ...group,
      shown: open.value ? names : names.slice(0, FOLDED_COUNT),
      hidden: open.value ? 0 : Math.max(0, names.length - FOLDED_COUNT),
    };
  }).filter((group) => group.shown.length > 0),
);

const hidden = computed(() => groups.value.reduce((sum, group) => sum + group.hidden, 0));
</script>

<template>
  <div class="flex flex-col gap-2 pt-3 mt-3 border-t border-line" data-prayer-names-line>
    <span class="text-xs font-semibold text-text-secondary">
      {{ t("perpetual.reading.readingFor") }}
    </span>
    <div v-for="group in groups" :key="group.kind" class="flex flex-col gap-0.5">
      <span class="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
        <AppIcon :name="group.icon" :size="13" class="text-primary" />
        {{ t(group.labelKey) }}
      </span>
      <ul class="text-sm font-medium leading-relaxed text-text-primary">
        <li v-for="(name, i) in group.shown" :key="name.id" class="inline">
          <span class="whitespace-nowrap">{{ formatPrayerName(name) }}</span>
          <span v-if="i < group.shown.length - 1" class="text-text-secondary/50" aria-hidden="true">
            ·
          </span>
        </li>
      </ul>
    </div>
    <button
      v-if="hidden > 0"
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
