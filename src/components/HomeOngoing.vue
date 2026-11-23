<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { sidourText } from "../content/sidourGroups";
import { useNow } from "../composables/useNow";
import { useOccasionsDone } from "../composables/useOfficesDone";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { analyticsService } from "../services/analyticsService";
import { haptic } from "../services/haptics";
import { ongoingOccasions, type OngoingOccasion } from "../services/ongoingOccasions";
import { MOMENT_TEXTS } from "../services/sidourMoment";
import { formatHebrewDate, formatZmanTime } from "../services/zmanimService";
import type { CardArtSpec } from "./CardArt.vue";
import CardArt from "./CardArt.vue";

/**
 * « En ce moment » on the home page, above the times of the day: what the
 * calendar opens for a few days (the blessing of the moon, the 'Hanouka
 * lighting, the counting of the 'Omer; services/ongoingOccasions.ts).
 *
 * Set apart from the deck on purpose: in the stack, the moon waited under
 * the service of the hour, and by day it did not show at all, so its few
 * nights went by unseen. Here each occasion stays in view for as long as it
 * lasts, says when it is said, opens its text, and is marked done with its
 * round « Fait » button (a word, not an icon: the object in the corner
 * already says what the card is, see cardArt.test.ts): the device remembers it (as the Sidour page does) and it
 * leaves the home page until its next time. Nothing the rest of the time.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();
// The clock shared by the home page cards (a single setInterval).
const now = useNow();
const done = useOccasionsDone();

interface OngoingCard {
  occasion: OngoingOccasion;
  kicker: string;
  title: string;
  meta: string;
  route: string;
  art: CardArtSpec;
}

const textRoute = (key: string): string => sidourText(key)?.path ?? "/sidour";
const textTitle = (key: string): string => {
  const text = sidourText(key);
  return text ? (locale.value === "he" ? text.hebrew : text.latin) : "";
};

function cardOf(occasion: OngoingOccasion): OngoingCard {
  switch (occasion.kind) {
    case "halevana": {
      const date = formatHebrewDate(occasion.until, locale.value);
      return {
        occasion,
        kicker: occasion.now ? t("sidour.thisNight") : t("sidour.tonight"),
        title: t("home.birkatHalevana.title"),
        meta: occasion.now
          ? t("home.birkatHalevana.until", { date })
          : t("home.birkatHalevana.fromNight", { date }),
        route: textRoute(MOMENT_TEXTS.halevana),
        art: { kind: "moon", age: occasion.moonAge },
      };
    }
    case "hanouka": {
      const n = occasion.candle;
      const time = occasion.beforeShabbat
        ? formatZmanTime(occasion.beforeShabbat, place.value.tzid, locale.value)
        : null;
      const meta = time
        ? n === 1
          ? t("sidour.hanouka.beforeShabbatOne", { time })
          : t("sidour.hanouka.beforeShabbat", { n, time })
        : n === 1
          ? t("sidour.hanouka.nightOne")
          : t("sidour.hanouka.night", { n });
      return {
        occasion,
        kicker: t("sidour.days.hanouka"),
        title: textTitle(MOMENT_TEXTS.hanouka),
        meta,
        route: textRoute(MOMENT_TEXTS.hanouka),
        art: { kind: "hanoukia", night: n, lit: occasion.lit },
      };
    }
    case "omer": {
      const n = occasion.day;
      const left = 49 - n;
      return {
        occasion,
        kicker: t("home.ongoing.omerKicker"),
        // The first day has an ordinal of its own in French.
        title: n === 1 && locale.value === "fr" ? t("home.omer.dayOne") : t("home.omer.day", { n }),
        meta: left > 0 ? t("home.omer.remaining", { n: left }) : t("home.omer.last"),
        route: textRoute(MOMENT_TEXTS.arvit),
        art: { kind: "omer" },
      };
    }
  }
}

const cards = computed<OngoingCard[]>(() =>
  ongoingOccasions(place.value, now.value, done.keys.value).map(cardOf),
);

/** The occasion opened: the moon and the 'Omer keep the events of their old banners. */
function opened(occasion: OngoingOccasion): void {
  analyticsService.capture("home_card_clicked", { card: `ongoing_${occasion.kind}` });
  if (occasion.kind === "halevana") {
    analyticsService.capture("birkat_halevana_opened", { source: "home" });
  } else if (occasion.kind === "omer") {
    analyticsService.capture("omer_opened", { source: "home", day: occasion.day });
  }
}

function markDone(occasion: OngoingOccasion): void {
  haptic("done");
  done.mark(occasion.key, true);
  analyticsService.capture("parcours_occasion_marked", {
    occasion: occasion.kind,
    done: true,
    source: "home_ongoing",
  });
}
</script>

<template>
  <section v-if="cards.length" :aria-label="t('home.ongoing.title')" class="flex flex-col gap-2">
    <p class="ongoing-label">{{ t("home.ongoing.title") }}</p>
    <div
      v-for="card in cards"
      :key="card.occasion.key"
      class="card card-hover group relative flex min-h-[76px] items-center p-4 pe-24"
    >
      <CardArt :art="card.art" :scale="0.46" surface="plain" />
      <div class="relative flex min-w-0 flex-1 items-center gap-3">
        <!-- The whole card opens the text (the link stretches over it). -->
        <RouterLink
          :to="card.route"
          class="ongoing-link min-w-0 flex-1"
          @click="opened(card.occasion)"
        >
          <span class="block text-xs font-bold text-primary">{{ card.kicker }}</span>
          <span
            class="block font-medium leading-snug text-text-primary transition-colors group-hover:text-primary"
          >
            {{ card.title }}
          </span>
          <span class="block text-xs text-text-secondary">{{ card.meta }}</span>
        </RouterLink>
        <button
          type="button"
          class="ongoing-done"
          :aria-label="t('home.ongoing.markDone', { name: card.title })"
          @click="markDone(card.occasion)"
        >
          {{ t("home.ongoing.done") }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ongoing-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.ongoing-link::after {
  content: "";
  position: absolute;
  inset: -16px;
  inset-inline-end: -96px;
}
/* Round, as every control (docs/design.md), above the stretched link. */
.ongoing-done {
  position: relative;
  z-index: 1;
  flex: none;
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
  color: var(--color-text-secondary);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.ongoing-done:hover {
  background: var(--color-surface-soft);
  color: var(--color-primary);
}
</style>
