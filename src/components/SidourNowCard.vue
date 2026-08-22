<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  currentTefilaWindow,
  tefilaPath,
  type TefilaKey,
} from "../services/sidourService";
import { formatZmanTime } from "../services/zmanimService";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";

/**
 * Le raccourci du sidour sur l'accueil : pendant la plage horaire d'un office
 * (Cha'harit, Min'ha, Arvit), une ligne mène directement au texte, avec
 * l'heure jusqu'à laquelle il se dit. Entre deux offices, rien : la carte
 * n'occupe pas l'accueil quand elle n'a rien à proposer.
 *
 * Chargée à la demande (voir HomeView) : elle tire le moteur des horaires.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// La plage change avec l'heure (elle s'ouvre et se referme sous la page).
const now = ref(new Date());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = new Date()), 60_000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const window_ = computed(() => currentTefilaWindow(place.value, now.value));

const ICONS: Record<TefilaKey, IconName> = {
  chaharit: "sunrise",
  minha: "sun",
  arvit: "moon",
};

const path = computed(() => (window_.value ? tefilaPath(window_.value.tefila) : null));
const tefilaName = computed(() =>
  window_.value ? t(`home.sidourNow.names.${window_.value.tefila}`) : "",
);
const untilTime = computed(() =>
  window_.value ? formatZmanTime(window_.value.end, place.value.tzid, locale.value) : "",
);

function trackOpen() {
  analyticsService.capture("home_card_clicked", {
    card: "sidour_now",
    tefila: window_.value?.tefila,
  });
}
</script>

<template>
  <RouterLink
    v-if="window_ && path"
    :to="path"
    class="card card-hover w-full px-6 py-4 flex items-center justify-between gap-3 group"
    @click="trackOpen()"
  >
    <span class="flex items-center gap-2.5 min-w-0">
      <AppIcon :name="ICONS[window_.tefila]" :size="17" class="text-primary flex-shrink-0" />
      <span
        class="font-medium text-text-primary truncate group-hover:text-primary transition-colors"
      >
        {{ t("home.sidourNow.title", { tefila: tefilaName }) }}
        <span class="text-text-secondary font-normal">
          · {{ t("home.sidourNow.until", { time: untilTime }) }}
        </span>
      </span>
    </span>
    <AppIcon
      name="chevron-right"
      :size="15"
      class="flex-shrink-0 text-text-secondary/50 group-hover:text-primary transition-colors rtl:rotate-180"
    />
  </RouterLink>
</template>
