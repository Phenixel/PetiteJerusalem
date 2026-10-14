<script setup lang="ts">
/**
 * Nouvel objectif, 2 : quelle partie. Les sedarim debout sur une planche :
 * un toucher en prend un, un autre le repose, et l'on peut en prendre
 * plusieurs. Un traité seul se trouve par son nom : il sort de son séder
 * comme un livre mince, posé devant lui. « Tout le Chass » prend tout.
 *
 * Le Tanakh n'a pas de sedarim : ses livres se prennent un à un.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useParcoursViews } from "../../../composables/useParcoursViews";
import type { TextStudyJsonEntry } from "../../../models/models";
import { filterBySearch } from "../../../services/catalogSearch";
import type {
  ProgramCorpus,
  ProgramObjective,
  ProgramPart,
} from "../../../services/parcours/model";
import {
  SEDARIM,
  programTexts,
  resolveParts,
  sederOf,
  sederTexts,
  textName,
  textTotal,
  totalOf,
  unitOf,
  type SederId,
} from "../../../services/parcours/texts";
import CatalogSearchField from "../../CatalogSearchField.vue";
import ChoicePill from "../pickers/ChoicePill.vue";

const props = defineProps<{ corpus: ProgramCorpus }>();
const model = defineModel<ProgramPart[]>({ required: true });

const { t, locale } = useI18n();
const views = useParcoursViews();

/** Les reliures des six ordres : une famille de tons chauds, comme l'étagère. */
const SEDER_COLORS: Record<SederId, string> = {
  zeraim: "#7a5a45",
  moed: "#7d6a4c",
  nachim: "#84483f",
  nezikin: "#6d5743",
  kodachim: "#86622f",
  toharot: "#96604a",
};

const bySeder = computed(() => props.corpus === "michna" || props.corpus === "talmud");
const all = computed(() => model.value.includes("all"));
const has = (part: ProgramPart) => all.value || model.value.includes(part);

function setParts(parts: ProgramPart[]): void {
  model.value = parts;
}

function toggleSeder(seder: SederId): void {
  const key = `seder:${seder}`;
  if (all.value) return setParts(SEDARIM.filter((s) => s !== seder).map((s) => `seder:${s}`));
  if (model.value.includes(key)) return setParts(model.value.filter((part) => part !== key));
  // Le séder pris englobe les traités déjà choisis dedans.
  const inside = new Set(
    sederTexts(props.corpus as "michna" | "talmud", seder).map((e) => `text:${e.id}`),
  );
  setParts([...model.value.filter((part) => !inside.has(part)), key]);
}

function toggleText(entry: TextStudyJsonEntry): void {
  const key = `text:${entry.id}`;
  if (all.value) return;
  setParts(
    model.value.includes(key) ? model.value.filter((part) => part !== key) : [...model.value, key],
  );
}

function toggleAll(): void {
  setParts(all.value ? [] : ["all"]);
}

interface Spine {
  key: string;
  label: string;
  color: string;
  height: number;
  on: boolean;
  /** Un traité sorti de son séder : un livre mince. */
  thin: boolean;
  toggle: () => void;
}

/** L'étagère : chaque séder, et devant lui les traités qu'on en a sortis. */
const spines = computed(() => {
  if (!bySeder.value) return [];
  const corpus = props.corpus as "michna" | "talmud";
  const sizes = SEDARIM.map((seder) => totalOf(sederTexts(corpus, seder).map((e) => Number(e.id))));
  const most = Math.max(1, ...sizes);
  return SEDARIM.flatMap((seder, i) => {
    if (sizes[i] === 0) return [];
    const height = Math.round(150 + (60 * sizes[i]) / most);
    const on = has(`seder:${seder}`);
    const label = t(`parcours.sedarim.${seder}`);
    const items: Spine[] = [
      {
        key: seder,
        label,
        color: SEDER_COLORS[seder],
        height,
        on,
        thin: false,
        toggle: () => toggleSeder(seder),
      },
    ];
    if (!on) {
      for (const entry of sederTexts(corpus, seder)) {
        if (!model.value.includes(`text:${entry.id}`)) continue;
        items.push({
          key: `text:${entry.id}`,
          label: textName(Number(entry.id), locale.value),
          color: SEDER_COLORS[seder],
          height: height - 44,
          on: true,
          thin: true,
          toggle: () => toggleText(entry),
        });
      }
    }
    return items;
  });
});

// La recherche d'un traité (ou d'un livre) par son nom : dès deux lettres.
const term = ref("");
const results = computed(() => {
  if (term.value.trim().length < 2) return [];
  return filterBySearch(programTexts(props.corpus), term.value)
    .slice(0, 5)
    .map((entry) => {
      const seder = sederOf(entry);
      const inSeder = all.value || (seder !== null && model.value.includes(`seder:${seder}`));
      return {
        entry,
        name: textName(Number(entry.id), locale.value),
        on: inSeder || model.value.includes(`text:${entry.id}`),
        disabled: inSeder,
        meta: inSeder
          ? t("parcours.create.inSeder", { seder: seder ? t(`parcours.sedarim.${seder}`) : "" })
          : views.unitsLabel(unitOf(props.corpus), textTotal(Number(entry.id))),
      };
    });
});

/** Le Tanakh : ses livres, à prendre un à un. */
const books = computed(() =>
  bySeder.value
    ? []
    : programTexts(props.corpus).map((entry) => ({
        entry,
        name: textName(Number(entry.id), locale.value),
        on: has(`text:${entry.id}`),
      })),
);

const summary = computed(() => {
  const texts = resolveParts(props.corpus, model.value);
  if (texts.length === 0)
    return { title: t("parcours.create.nothing"), detail: t("parcours.create.nothingHint") };
  const draft = { kind: "program", corpus: props.corpus, parts: model.value } as ProgramObjective;
  return {
    title: views.objectiveTitle(draft),
    detail: views.unitsLabel(unitOf(props.corpus), totalOf(texts)),
  };
});
</script>

<template>
  <div>
    <!-- Les sedarim, debout sur la planche. -->
    <template v-if="bySeder">
      <div class="spines" role="group" :aria-label="t('parcours.create.sedarim')">
        <button
          v-for="spine in spines"
          :key="spine.key"
          type="button"
          class="spine"
          :class="{ 'is-on': spine.on, 'is-thin': spine.thin }"
          :style="{ height: `${spine.height}px`, backgroundColor: spine.color }"
          :aria-pressed="spine.on"
          @click="spine.toggle"
        >
          {{ spine.label }}
        </button>
      </div>
      <div class="plank" aria-hidden="true" />
      <p class="mt-2 text-[13px] text-text-secondary">{{ t("parcours.create.partsHint") }}</p>
    </template>

    <!-- Les livres du Tanakh. -->
    <div v-else class="flex flex-wrap gap-2" role="group" :aria-label="t('parcours.create.books')">
      <ChoicePill
        v-for="book in books"
        :key="book.entry.id"
        :on="book.on"
        @click="toggleText(book.entry)"
      >
        {{ book.name }}
      </ChoicePill>
    </div>

    <div class="mt-4 flex min-h-11 items-center justify-between gap-3">
      <p class="min-w-0 text-base leading-snug">
        <span class="font-extrabold">{{ summary.title }}</span
        ><br />
        <span class="text-sm text-text-secondary">{{ summary.detail }}</span>
      </p>
      <ChoicePill class="flex-none" :on="all" @click="toggleAll">
        {{ t(`parcours.volume.all.${corpus}`) }}
      </ChoicePill>
    </div>

    <template v-if="bySeder">
      <CatalogSearchField
        v-model:term="term"
        class="mt-5"
        :placeholder="t('parcours.create.searchText')"
      />
      <div v-if="results.length" class="mt-3 space-y-2">
        <button
          v-for="result in results"
          :key="result.entry.id"
          type="button"
          class="hit"
          :class="{ 'is-on': result.on && !result.disabled }"
          :disabled="result.disabled"
          :aria-pressed="result.on"
          @click="toggleText(result.entry)"
        >
          <span class="block text-[15px] font-extrabold">{{ result.name }}</span>
          <span class="hit-meta block text-[13px]">{{ result.meta }}</span>
        </button>
      </div>
      <p v-else-if="term.trim().length >= 2" class="mt-3 text-sm text-text-secondary">
        {{ t("parcours.create.noText") }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.spines {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding-top: 20px;
  height: 240px;
}
.spine {
  position: relative;
  flex: 0 1 46px;
  min-width: 30px;
  border-radius: 3px;
  color: #f3ead6;
  font:
    600 15px/1 var(--font-serif),
    serif;
  writing-mode: vertical-rl;
  box-shadow: inset 6px 0 0 rgb(0 0 0 / 0.14);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}
.spine::before,
.spine::after {
  content: "";
  position: absolute;
  inset-inline: 6px;
  height: 2px;
  background: #ecdfc4;
  opacity: 0.45;
}
.spine::before {
  top: 16px;
}
.spine::after {
  bottom: 16px;
}
/* Pris : sorti de la planche, ses filets dorés. */
.spine.is-on {
  transform: translateY(-16px);
  box-shadow:
    inset 6px 0 0 rgb(0 0 0 / 0.14),
    0 10px 16px rgb(58 46 30 / 0.25);
}
.spine.is-on::before,
.spine.is-on::after {
  height: 3px;
  background: #e2c06a;
  opacity: 1;
}
.spine.is-thin {
  flex: 0 0 22px;
  min-width: 22px;
  font-size: 12px;
}
.spine.is-thin::before,
.spine.is-thin::after {
  inset-inline: 4px;
}
.plank {
  height: 9px;
  border-radius: 3px;
  background: #b59a70;
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}
:root.dark .plank {
  background: #7c654a;
}
@media (prefers-reduced-motion: reduce) {
  .spine {
    transition: none;
  }
}
/* Un résultat de la recherche : pris, il prend la couleur du thème. */
.hit {
  display: block;
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  text-align: start;
}
.hit .hit-meta {
  color: var(--color-text-secondary);
}
.hit.is-on {
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: none;
}
.hit.is-on .hit-meta {
  color: color-mix(in srgb, var(--color-on-brand) 85%, transparent);
}
.hit:disabled {
  box-shadow: none;
  background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
}
</style>
