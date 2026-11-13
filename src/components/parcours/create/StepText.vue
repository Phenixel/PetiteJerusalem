<script setup lang="ts">
/**
 * Un texte chaque jour : un psaume, une page qu'on aime, relus en entier.
 * C'est la lecture du jour d'avant ; on le cherche dans le catalogue comme
 * dans la bibliothèque.
 *
 * On en prend plusieurs d'affilée, comme dans la lecture du jour d'avant
 * (plusieurs psaumes le même jour) : un toucher coche un texte, un autre le
 * décoche, la recherche se refait autant qu'on veut, et ce qu'on a coché
 * attend dessus. « Ajouter 3 textes » les prend tous.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../../models/models";
import { corpusOf } from "../../../content/etudeTexts";
import { texteTitle } from "../../../services/chiourTexte";
import { filterBySearch } from "../../../services/catalogSearch";
import { useBottomChromeHeight } from "../../../composables/useBottomChrome";
import CatalogSearchField from "../../CatalogSearchField.vue";
import AppIcon from "../../icons/AppIcon.vue";

const props = defineProps<{ taken: number[] }>();
const emit = defineEmits<{ (e: "pick", entries: TextStudyJsonEntry[]): void }>();

const { t, locale } = useI18n();
/** Le bouton reste en vue en bas de l'écran, au-dessus des barres du bas. */
const ctaBottom = useBottomChromeHeight("12px");

/** Ce qu'on étudie : la liturgie a sa page, le Sidour. */
const READABLE = new Set(["tehilim", "michna", "talmud", "tanakh", "moussar", "halakha"]);
const texts = (textStudiesJson as TextStudiesJson).textStudies.filter((e) =>
  READABLE.has(corpusOf(e)),
);

const term = ref("");
const results = computed(() =>
  term.value.trim().length < 2 ? [] : filterBySearch(texts, term.value).slice(0, 20),
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
    <CatalogSearchField v-model:term="term" :placeholder="t('parcours.create.searchAny')" />

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
