<script setup lang="ts">
/**
 * A text every day: a psalm, a page one loves, read again in full. It is the
 * daily reading of before; it is searched in the catalog as in the library.
 *
 * Several are taken in a row, as in the daily reading of before (several
 * psalms the same day): a tap ticks a text, another unticks it, the search is
 * redone as often as wanted, and what is ticked waits above it. « Ajouter 3
 * textes » takes them all.
 *
 * Above the search, the psalms already divided up: the Tehilim of the day of
 * the month, or of the week. They change every day, so they are not texts to
 * pick but a cycle of Mon parcours: a tap asks for it (`cycle`), and the page
 * decides how it is added. One already taken shows as such.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../../models/models";
import type { CycleId } from "../../../services/parcours/model";
import { corpusOf } from "../../../content/etudeTexts";
import { texteTitle } from "../../../services/chiourTexte";
import { filterBySearch } from "../../../services/catalogSearch";
import { useBottomChromeHeight } from "../../../composables/useBottomChrome";
import { useDebouncedValue } from "../../../composables/useDebouncedValue";
import CatalogSearchField from "../../CatalogSearchField.vue";
import AppIcon from "../../icons/AppIcon.vue";

const props = withDefaults(defineProps<{ taken: number[]; takenCycles?: readonly string[] }>(), {
  takenCycles: () => [],
});
const emit = defineEmits<{
  (e: "pick", entries: TextStudyJsonEntry[]): void;
  (e: "cycle", cycle: CycleId): void;
}>();

/** The psalms already divided up, offered above the search. */
const TEHILIM_CYCLES = ["tehilim-month", "tehilim-week"] as const satisfies readonly CycleId[];

const { t, locale } = useI18n();
/** Le bouton reste en vue en bas de l'écran, au-dessus des barres du bas. */
const ctaBottom = useBottomChromeHeight("12px");

/** Ce qu'on étudie : la liturgie a sa page, le Sidour. */
const READABLE = new Set(["tehilim", "michna", "talmud", "tanakh", "moussar", "halakha"]);
const texts = (textStudiesJson as TextStudiesJson).textStudies.filter((e) =>
  READABLE.has(corpusOf(e)),
);

const term = ref("");
// The catalog is searched once typing pauses; an emptied field empties the
// results at once.
const searched = useDebouncedValue(term);
const results = computed(() =>
  term.value.trim().length < 2 || searched.value.trim().length < 2
    ? []
    : filterBySearch(texts, searched.value).slice(0, 20),
);

/** Ce qu'on a coché, dans l'ordre où on l'a coché. */
const picked = ref<TextStudyJsonEntry[]>([]);
const isPicked = (entry: TextStudyJsonEntry): boolean =>
  picked.value.some((one) => one.id === entry.id);
const isTaken = (entry: TextStudyJsonEntry): boolean => props.taken.includes(Number(entry.id));

function toggle(entry: TextStudyJsonEntry): void {
  if (isTaken(entry)) return;
  picked.value = isPicked(entry)
    ? picked.value.filter((one) => one.id !== entry.id)
    : [...picked.value, entry];
}
</script>

<template>
  <div>
    <!-- The psalms already divided up: a cycle, a tap away. -->
    <p class="text-[13px] font-bold text-text-secondary">{{ t("parcours.create.readyMade") }}</p>
    <div class="mt-2 grid gap-2 sm:grid-cols-2">
      <button
        v-for="cycle in TEHILIM_CYCLES"
        :key="cycle"
        type="button"
        class="ready-made"
        :disabled="props.takenCycles.includes(cycle)"
        @click="emit('cycle', cycle)"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-bold">{{ t(`parcours.cycles.${cycle}.title`) }}</span>
          <span class="block text-[13px] text-text-secondary">
            {{
              props.takenCycles.includes(cycle)
                ? t("parcours.create.taken")
                : t(`parcours.cycles.${cycle}.hint`)
            }}
          </span>
        </span>
        <AppIcon
          :name="props.takenCycles.includes(cycle) ? 'check' : 'plus'"
          :size="16"
          class="flex-none text-primary"
        />
      </button>
    </div>

    <CatalogSearchField
      v-model:term="term"
      class="mt-5"
      :placeholder="t('parcours.create.searchAny')"
    />

    <!-- Ce qu'on a coché : il attend ici, d'une recherche à l'autre. -->
    <div v-if="picked.length" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="entry in picked"
        :key="entry.id"
        type="button"
        class="picked-chip"
        :aria-label="t('parcours.create.unpick', { name: texteTitle(entry, locale) })"
        @click="toggle(entry)"
      >
        {{ texteTitle(entry, locale) }}
        <AppIcon name="x" :size="12" />
      </button>
    </div>

    <div v-if="results.length" class="card mt-4 divide-y divide-line overflow-hidden">
      <button
        v-for="entry in results"
        :key="entry.id"
        type="button"
        class="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-soft disabled:opacity-60"
        :disabled="isTaken(entry)"
        :aria-pressed="isPicked(entry)"
        @click="toggle(entry)"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-bold">{{ texteTitle(entry, locale) }}</span>
          <span v-if="isTaken(entry)" class="block text-[13px] text-text-secondary">
            {{ t("parcours.create.taken") }}
          </span>
        </span>
        <span v-if="!isTaken(entry)" class="pick-box" :class="{ 'is-on': isPicked(entry) }">
          <AppIcon v-if="isPicked(entry)" name="check" :size="14" />
        </span>
      </button>
    </div>
    <p v-else-if="term.trim().length >= 2" class="mt-4 text-sm text-text-secondary">
      {{ t("parcours.create.noText") }}
    </p>
    <p v-else class="mt-4 text-sm text-text-secondary">{{ t("parcours.create.dailyTextHint") }}</p>

    <button
      v-if="picked.length"
      type="button"
      class="btn btn-primary create-cta"
      :style="{ bottom: ctaBottom }"
      @click="emit('pick', picked)"
    >
      {{ t("parcours.create.addTexts", { n: picked.length }, picked.length) }}
    </button>
  </div>
</template>

<style scoped>
/* Collé en bas de l'écran pendant qu'on coche : la liste peut être longue. */
.create-cta {
  position: sticky;
  z-index: 2;
  width: 100%;
  min-height: 48px;
  margin-top: 22px;
  box-shadow: 0 6px 18px rgb(58 46 30 / 0.18);
  font-size: 15px;
  font-weight: 700;
}
/* A ready-made division: a row like the search results, the plus at its end. */
.ready-made {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  text-align: start;
}
.ready-made:hover:not(:disabled) {
  background: var(--color-surface-soft);
}
.ready-made:disabled {
  opacity: 0.6;
}
.picked-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  color: var(--color-on-brand);
  font-size: 14px;
  font-weight: 700;
}
.pick-box {
  display: grid;
  flex: none;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.pick-box.is-on {
  background: var(--color-brand);
  box-shadow: none;
  color: var(--color-on-brand);
}
</style>
