<script setup lang="ts">
/**
 * The card of the moment on the site's home page, for a visitor without an
 * account: the one card in solid color, as on the app's home stack and at the
 * top of the Sidour page (docs/design.md, « What you come looking for takes
 * the color, solid »). Its object, the sidour, comes out through the top.
 *
 * While a service's time lasts, it opens that service, with the time until
 * which it is said. Between two services, it opens the Sidour itself: the
 * site's showcase always has something to show at this place.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "../../composables/useNow";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { analyticsService } from "../../services/analyticsService";
import { currentTefilaWindow, tefilaPath } from "../../services/sidourService";
import { formatZmanTime } from "../../services/zmanimService";
import CardArt from "../CardArt.vue";

const { t, locale } = useI18n();
const { place } = useZmanimLocation();
const now = useNow();

const tefila = computed(() => currentTefilaWindow(place.value, now.value));

const card = computed(() => {
  const window = tefila.value;
  const path = window ? tefilaPath(window.tefila) : null;
  if (window && path) {
    return {
      to: path,
      // « Le Sidour », not « En ce moment »: the block of what is going on
      // now (HomeOngoing) comes right under it with that title.
      kicker: t("home.showcase.momentKicker"),
      title: t(`home.sidourNow.names.${window.tefila}`),
      meta: t("sidour.until", {
        time: formatZmanTime(window.end, place.value.tzid, locale.value),
      }),
    };
  }
  return {
    to: "/sidour",
    kicker: t("home.showcase.momentKicker"),
    title: t("home.showcase.momentTitle"),
    meta: t("home.showcase.momentMeta"),
  };
});

function trackOpen(): void {
  analyticsService.capture("home_card_clicked", {
    card: "moment",
    tefila: tefila.value?.tefila ?? null,
  });
}
</script>

<template>
  <RouterLink
    :to="card.to"
    class="moment-card press-feedback relative block rounded-card bg-brand px-5 pt-4 pb-5 text-on-brand"
    @click="trackOpen"
  >
    <CardArt :art="{ kind: 'siddur' }" />
    <span class="relative block text-sm font-semibold text-on-brand/80">{{ card.kicker }}</span>
    <span class="relative mt-1 block font-display text-3xl font-bold leading-tight">
      {{ card.title }}
    </span>
    <span class="relative mt-1 block text-[15px] font-medium text-on-brand/90">
      {{ card.meta }}
    </span>
  </RouterLink>
</template>

<style scoped>
/* Lifted like the Sidour's card of the moment; the object rises above it. */
.moment-card {
  margin-top: 28px;
  box-shadow: var(--shadow-card-hover);
}
</style>
