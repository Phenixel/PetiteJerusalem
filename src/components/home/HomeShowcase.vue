<script setup lang="ts">
/**
 * The site's home page, under the hook, for a visitor without an account: the
 * presentation of what the site and the app hold, drawn with the app's own
 * objects (docs/design.md, « The site's home page shows the app with its own
 * objects »). No frame around a drawing: the objects stand on the page, on a
 * shelf when they are things one sets down.
 *
 *  - the Sidour, with the objects of its moments in a row: the sidour, the
 *    moon, the 'hanoukkia, the chofar, the loulav, the havdala, the candles,
 *    the sheaf of the 'Omer;
 *  - the library, its bound volumes on their two shelves (LibraryShelf);
 *  - Mon parcours, a piece of the stone wall; the lights of the series stay
 *    a mystery, the first one alone drawn, the others blurred (StreakLight
 *    `locked`), as in the app before they are earned;
 *  - the sharing of a reading, the six orders of the Michna to divide up;
 *  - the times, the sky of each service (ArtSky);
 *  - the chiourim, three covers of series fanned like a playlist;
 *  - the app, to download.
 *
 * Each section keeps a title and a sentence the search engines read, and a
 * link to go further. It replaces the three doors (HomeDoors) on this page;
 * the dashboard keeps them as one of its blocks. On a phone it comes under
 * the information of the moment (HomeView), which a visitor looks for first.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import LibraryShelf, { type ShelfBook } from "../LibraryShelf.vue";
import AppDownloadButton from "../AppDownloadButton.vue";
import ArtCandles from "../art/ArtCandles.vue";
import ArtHanoukia from "../art/ArtHanoukia.vue";
import ArtHavdala from "../art/ArtHavdala.vue";
import ArtLoulav from "../art/ArtLoulav.vue";
import ArtMoon from "../art/ArtMoon.vue";
import ArtOmer from "../art/ArtOmer.vue";
import ArtShofar from "../art/ArtShofar.vue";
import ArtSiddur from "../art/ArtSiddur.vue";
import ArtSky, { type SkyMoment } from "../art/ArtSky.vue";
import ArtVolume from "../art/ArtVolume.vue";
import ChiourCover from "../chiourim/ChiourCover.vue";
import StoneWall from "../parcours/StoneWall.vue";
import StreakLight from "../parcours/StreakLight.vue";
import { SEDER_BINDINGS } from "../../config/bindings";
import { localDayKey } from "../../services/dateService";
import { addDays, dayRange, weekStart } from "../../services/parcours/days";
import type { LightId } from "../../services/parcours/lights";
import type { DayStatus, WallWeek } from "../../services/parcours/schedule";

const emit = defineEmits<{ (e: "open", card: string): void }>();

const { t } = useI18n();
const router = useRouter();

/**
 * A drawing opens its section's page, as its link does. The drawing is
 * hidden from screen readers (the link says it), so it takes a click, not a
 * focus: the keyboard goes through the link.
 */
function go(to: string, card: string): void {
  emit("open", card);
  void router.push(to);
}

// --- The Sidour: the objects of its moments, on their shelf. ---
const OBJECTS = [
  { key: "siddur", art: ArtSiddur, label: () => t("home.showcase.sidour.objects.siddur") },
  { key: "moon", art: ArtMoon, label: () => t("home.showcase.sidour.objects.moon") },
  { key: "hanoukia", art: ArtHanoukia, label: () => t("home.showcase.sidour.objects.hanoukia") },
  { key: "shofar", art: ArtShofar, label: () => t("home.showcase.sidour.objects.shofar") },
  { key: "loulav", art: ArtLoulav, label: () => t("home.showcase.sidour.objects.loulav") },
  { key: "havdala", art: ArtHavdala, label: () => t("home.showcase.sidour.objects.havdala") },
  { key: "candles", art: ArtCandles, label: () => t("home.showcase.sidour.objects.candles") },
  { key: "omer", art: ArtOmer, label: () => t("home.showcase.sidour.objects.omer") },
] as const;

/** What an object needs to be drawn: the moon a little past its first quarter, the eight lights. */
function objectProps(key: string): Record<string, unknown> {
  if (key === "moon") return { age: 10 };
  if (key === "hanoukia") return { night: 8, lit: true };
  return {};
}

// --- The library: two shelves of three, as on the library page. ---
const CORPORA = [
  ["tehilim", "tehilim"],
  ["michna", "mishna"],
  ["talmud", "talmud"],
  ["tanakh", "tanakh"],
  ["moussar", "moussar"],
  ["halakha", "halakha"],
] as const;

const shelves = computed<ShelfBook[][]>(() => {
  const books = CORPORA.map(([corpus, label]) => ({
    corpus,
    to: `/bibliotheque/${corpus}`,
    label: t(`study.types.${label}`),
  }));
  return [books.slice(0, 3), books.slice(3)];
});

// --- Mon parcours: a piece of the wall, built over seven weeks. ---
/**
 * An example of a wall, the same for every visitor: weeks mostly built, a
 * few stones half laid, a day missed, Chabbat white, today and the rest of
 * the week still to come. It shows what the wall is; it is no one's.
 */
const PATTERN: DayStatus[] = [
  "full",
  "full",
  "partial",
  "full",
  "full",
  "full",
  "rest",
  "full",
  "full",
  "full",
  "none",
  "full",
  "partial",
  "rest",
];

const wall = computed<WallWeek[]>(() => {
  const today = localDayKey();
  const lastWeek = weekStart(today);
  const first = addDays(lastWeek, -7 * 6);
  const weeks: WallWeek[] = [];
  let index = 0;
  for (let start = first; start <= lastWeek; start = addDays(start, 7)) {
    const days = dayRange(start, addDays(start, 6)).map((day, weekday) => {
      let status: DayStatus = PATTERN[index++ % PATTERN.length];
      if (weekday === 6) status = "rest";
      if (day === today) status = "today";
      else if (day > today) status = "future";
      return { day, status, planned: 3, done: status === "full" ? 3 : 1 };
    });
    weeks.push({ week: addDays(start, 6), days });
  }
  return weeks;
});

/** The first lights of the series: the old lamp, then the ones still to discover. */
const LIGHTS: LightId[] = ["lamp", "candle", "lantern", "menorah", "lighthouse", "moon"];

// --- Sharing: the six orders of the Michna, to divide between six people. ---
const SEDARIM = Object.entries(SEDER_BINDINGS);

// --- The times: the sky of each service. ---
const SKIES: { moment: SkyMoment; label: () => string }[] = [
  { moment: "chaharit", label: () => t("home.sidourNow.names.chaharit") },
  { moment: "minha", label: () => t("home.sidourNow.names.minha") },
  { moment: "arvit", label: () => t("home.sidourNow.names.arvit") },
];

// --- The chiourim: three covers, the subjects the classes cover. ---
const covers = computed(() =>
  (["talmud", "halakha", "moussar"] as const).map((key) => ({
    seed: key,
    label: t(`study.types.${key}`),
  })),
);
</script>

<template>
  <div class="showcase">
    <!-- The Sidour: the objects of its moments, standing on their shelf. -->
    <section class="showcase-section text-center">
      <p class="showcase-kicker">{{ t("home.showcase.sidour.kicker") }}</p>
      <h2 class="showcase-title">{{ t("home.showcase.sidour.title") }}</h2>
      <p class="showcase-text mx-auto">{{ t("home.showcase.sidour.text") }}</p>
      <ul
        class="objects-shelf is-link mx-auto mt-10"
        role="list"
        @click="go('/sidour', 'visual_sidour')"
      >
        <li v-for="object in OBJECTS" :key="object.key" class="object">
          <span class="object-art" :class="`object-${object.key}`" aria-hidden="true">
            <component :is="object.art" v-bind="objectProps(object.key)" />
          </span>
          <span class="object-label">{{ object.label() }}</span>
        </li>
      </ul>
      <RouterLink to="/sidour" class="showcase-link mt-8" @click="emit('open', 'feature_sidour')">
        {{ t("home.showcase.sidour.link") }}
      </RouterLink>
    </section>

    <!-- The library: its volumes, bound, on their shelf. -->
    <section class="showcase-section text-center">
      <p class="showcase-kicker">{{ t("home.showcase.libraryKicker") }}</p>
      <h2 class="showcase-title">{{ t("home.showcase.libraryTitle") }}</h2>
      <p class="showcase-text mx-auto">{{ t("home.showcase.libraryText") }}</p>
      <div class="mx-auto mt-8 max-w-xl space-y-2">
        <LibraryShelf
          v-for="(books, index) in shelves"
          :key="index"
          :books="books"
          :start-index="index * 3"
          @open="(corpus: string) => emit('open', `shelf_${corpus}`)"
        />
      </div>
      <RouterLink to="/bibliotheque" class="showcase-link mt-6" @click="emit('open', 'library')">
        {{ t("home.showcase.libraryLink") }}
      </RouterLink>
    </section>

    <!-- Mon parcours: a piece of the wall, and the lights of the days held. -->
    <section class="showcase-section showcase-row">
      <div
        class="showcase-visual is-link"
        aria-hidden="true"
        @click="go('/parcours', 'visual_parcours')"
      >
        <StoneWall class="demo-wall" :weeks="wall" inert />
        <ul class="lights mt-6" role="list">
          <li v-for="(light, index) in LIGHTS" :key="light" class="light">
            <StreakLight :light="light" level="high" :width="56" :locked="index > 0" />
            <span class="light-label">
              {{ index === 0 ? t("parcours.lights.names.lamp") : t("parcours.lights.hidden") }}
            </span>
          </li>
        </ul>
      </div>
      <div class="showcase-copy">
        <p class="showcase-kicker">{{ t("home.showcase.parcours.kicker") }}</p>
        <h2 class="showcase-title">{{ t("home.showcase.parcours.title") }}</h2>
        <p class="showcase-text">{{ t("home.showcase.parcours.text") }}</p>
        <RouterLink
          to="/parcours"
          class="showcase-link mt-4"
          @click="emit('open', 'feature_parcours')"
        >
          {{ t("home.showcase.parcours.link") }}
        </RouterLink>
      </div>
    </section>

    <!-- Sharing: the six orders of the Michna, one per reader. -->
    <section class="showcase-section showcase-row is-flipped">
      <div
        class="showcase-visual is-link"
        aria-hidden="true"
        @click="go('/share-reading', 'visual_share')"
      >
        <div class="sedarim">
          <div v-for="[seder, color] in SEDARIM" :key="seder" class="seder">
            <ArtVolume :color="color" :label="t(`parcours.sedarim.${seder}`)" />
          </div>
        </div>
        <span class="plank" />
      </div>
      <div class="showcase-copy">
        <p class="showcase-kicker">{{ t("home.showcase.share.kicker") }}</p>
        <h2 class="showcase-title">{{ t("home.showcase.share.title") }}</h2>
        <p class="showcase-text">{{ t("home.showcase.share.text") }}</p>
        <RouterLink
          to="/share-reading"
          class="showcase-link mt-4"
          @click="emit('open', 'feature_share')"
        >
          {{ t("home.showcase.share.link") }}
        </RouterLink>
      </div>
    </section>

    <!-- The times: the sky of each service, from dawn to nightfall. -->
    <section class="showcase-section showcase-row">
      <div
        class="showcase-visual is-link"
        aria-hidden="true"
        @click="go('/horaires', 'visual_zmanim')"
      >
        <ul class="skies" role="list">
          <li v-for="sky in SKIES" :key="sky.moment" class="sky">
            <span class="sky-disc"><ArtSky :moment="sky.moment" /></span>
            <span class="light-label">{{ sky.label() }}</span>
          </li>
        </ul>
      </div>
      <div class="showcase-copy">
        <p class="showcase-kicker">{{ t("home.showcase.zmanim.kicker") }}</p>
        <h2 class="showcase-title">{{ t("home.showcase.zmanim.title") }}</h2>
        <p class="showcase-text">{{ t("home.showcase.zmanim.text") }}</p>
        <RouterLink
          to="/horaires"
          class="showcase-link mt-4"
          @click="emit('open', 'feature_zmanim')"
        >
          {{ t("home.showcase.zmanim.link") }}
        </RouterLink>
      </div>
    </section>

    <!-- The chiourim: three covers, fanned like a playlist. -->
    <section class="showcase-section showcase-row is-flipped">
      <div
        class="showcase-visual is-link"
        aria-hidden="true"
        @click="go('/chiourim', 'visual_chiourim')"
      >
        <div class="covers">
          <!-- The cover takes its parent's width: a box each, sized here. -->
          <div v-for="cover in covers" :key="cover.seed" class="cover">
            <ChiourCover :seed="cover.seed" :label="cover.label" />
          </div>
        </div>
      </div>
      <div class="showcase-copy">
        <p class="showcase-kicker">{{ t("home.showcase.chiourim.kicker") }}</p>
        <h2 class="showcase-title">{{ t("home.showcase.chiourim.title") }}</h2>
        <p class="showcase-text">{{ t("home.showcase.chiourim.text") }}</p>
        <RouterLink
          to="/chiourim"
          class="showcase-link mt-4"
          @click="emit('open', 'feature_chiourim')"
        >
          {{ t("home.showcase.chiourim.link") }}
        </RouterLink>
      </div>
    </section>

    <!-- The app: the same texts, the times and the parcours, in the pocket. -->
    <section class="showcase-section text-center">
      <h2 class="showcase-title">{{ t("home.showcase.appTitle") }}</h2>
      <p class="showcase-text mx-auto">{{ t("home.showcase.appText") }}</p>
      <AppDownloadButton class="mt-6" source="home_showcase" />
    </section>
  </div>
</template>

<style scoped>
.showcase-section {
  padding-block: 44px;
}
.showcase-section + .showcase-section {
  border-top: 1px solid var(--color-line);
}
.showcase-kicker {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-primary);
}
.showcase-title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
}
.showcase-text {
  max-width: 36rem;
  margin-top: 10px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.showcase-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* A section with a drawing: on a phone the drawing comes first; from a
   medium screen up, side by side, alternating. */
.showcase-row {
  display: grid;
  gap: 28px;
  align-items: center;
}
.showcase-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* A drawing that opens its page: the hand, and a slight lift on hover. */
.is-link {
  cursor: pointer;
  transition: transform 0.2s ease;
}
@media (hover: hover) {
  .is-link:hover {
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-link {
    transition: none;
  }
}

/* --- The objects of the Sidour, standing on their shelf --- */
.objects-shelf {
  display: grid;
  max-width: 56rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  row-gap: 28px;
}
.object {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.object-art {
  display: flex;
  height: 96px;
  width: 100%;
  align-items: flex-end;
  justify-content: center;
  /* The shelf they stand on: a plank under each, joined from one to the next. */
  border-bottom: 7px solid var(--plank);
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.16));
}
.object-art :deep(svg) {
  height: 100%;
  width: auto;
  overflow: visible;
}
/* The moon takes its grays from the card that usually carries it (CardArt,
   on a light surface): the same tones here, on the page. */
.object-moon {
  --moon-highland: #d9d4c8;
  --moon-mare: #a29d90;
  --moon-mare-deep: #928e83;
  --moon-bright: #f7f5ef;
  --moon-pit: #cbc6ba;
  --moon-dark: rgb(15 20 40 / 0.07);
}
:root.dark .object-moon {
  --moon-dark: rgb(255 255 255 / 0.08);
}
.object-moon :deep(svg) {
  height: 72%;
  margin-bottom: 10px;
}
.object-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* --- Mon parcours: the wall and the lights --- */
.demo-wall {
  width: 100%;
  max-width: 26rem;
}
.lights,
.skies {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px 18px;
}
.light,
.sky {
  display: flex;
  width: 72px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.light-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-secondary);
}

/* --- Sharing: six volumes side by side, on a plank --- */
.sedarim {
  display: flex;
  justify-content: center;
}
.seder {
  width: 76px;
  margin-inline: -10px;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.18));
}
.seder:nth-child(even) {
  transform: translateY(-4px);
}
.plank {
  display: block;
  width: min(100%, 26rem);
  height: 9px;
  margin-top: -6px;
  border-radius: 3px;
  background: var(--plank);
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}

/* --- The times: the sky of each service, in its round window --- */
.skies {
  gap: 20px 28px;
}
.sky {
  width: 104px;
}
.sky-disc {
  display: block;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card-hover);
}
.sky-disc :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

/* --- The chiourim: three covers fanned, the middle one in front --- */
.covers {
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover {
  flex: none;
  width: 112px;
  box-shadow: var(--shadow-card-hover);
}
.cover:nth-child(1) {
  transform: rotate(-8deg) translateX(18px);
}
.cover:nth-child(2) {
  z-index: 1;
  transform: translateY(-6px);
}
.cover:nth-child(3) {
  transform: rotate(8deg) translateX(-18px);
}

/* The wood of the shelves: the library's plank, flat. */
.showcase {
  --plank: #b49870;
}
:root.dark .showcase {
  --plank: #7c6649;
}

@media (min-width: 768px) {
  .showcase-section {
    padding-block: 64px;
  }
  .showcase-title {
    font-size: 36px;
  }
  .objects-shelf {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
  .object-art {
    height: 120px;
  }
  .showcase-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 56px;
  }
  .showcase-row.is-flipped .showcase-visual {
    order: 2;
  }
  .seder {
    width: 92px;
  }
  .cover {
    width: 136px;
  }
}
</style>
