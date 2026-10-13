<script setup lang="ts">
/**
 * Le livre de la bibliothèque qu'étudie un cours, et son chapitre : le même
 * champ dans la fiche d'un chiour du backoffice et dans le formulaire du
 * studio des auteurs.
 *
 * On cherche le livre comme dans la bibliothèque (nom hébreu, nom latin,
 * autres noms ; voir catalogSearch), puis on choisit, si on veut, la division
 * que le cours suit. Les chapitres se lisent dans le texte lui-même, avec les
 * titres que leur donne le lecteur (« Chapitre 3 · Daf 25a à 34b »,
 * « Introduction », « 11. אבירות לב ») : le numéro enregistré est celui
 * qu'attend chiourTexte (l'index de section, ou le rang du bloc).
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../models/models";
import { bookName, filterBySearch } from "../services/catalogSearch";
import { hasChapitres, linkableTextes, texteOf, texteTitle } from "../services/chiourTexte";
import { loadText } from "../services/textService";
import { useTextLabels } from "../composables/useTextLabels";
import { liveValue } from "../composables/liveInput";
import AppSelect, { type SelectOption } from "./AppSelect.vue";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{ id?: string; disabled?: boolean }>();

const texteId = defineModel<number | null>("texteId", { required: true });
const chapitre = defineModel<number | null>("chapitre", { required: true });

const { t, locale } = useI18n();
const { headingLabel } = useTextLabels();

const MAX_RESULTS = 8;
/** Le champ du chapitre, nommé par son libellé. */
const chapterId = `${props.id ?? "chiour-texte"}-chapitre`;
const all = linkableTextes();

const search = ref("");
const entry = computed(() => texteOf(texteId.value));
const results = computed<TextStudyJsonEntry[]>(() =>
  search.value.trim() ? filterBySearch(all, search.value).slice(0, MAX_RESULTS) : [],
);

function choose(next: TextStudyJsonEntry) {
  texteId.value = Number(next.id);
  chapitre.value = null;
  search.value = "";
}

function clear() {
  texteId.value = null;
  chapitre.value = null;
}

/** La ligne d'un résultat : le livre qui porte le texte, pour départager les homonymes. */
const contextOf = (e: TextStudyJsonEntry) =>
  `${t(`chiourim.texte.types.${typeKey(e)}`)} · ${bookName(e.livre)}`;

function typeKey(e: TextStudyJsonEntry): string {
  switch (String(e.type)) {
    case "Talmud Bavli":
      return "talmud";
    case "Mishna":
      return "michna";
    default:
      return String(e.type).toLowerCase();
  }
}

// --- Les chapitres, lus dans le texte ---
const chapterOptions = ref<SelectOption[]>([]);
const loadingChapters = ref(false);
const chaptersFailed = ref(false);

watch(
  entry,
  async (current) => {
    chapterOptions.value = [];
    chaptersFailed.value = false;
    if (!current || !hasChapitres(current)) return;
    loadingChapters.value = true;
    try {
      const content = await loadText(current);
      if (texteOf(texteId.value) !== current) return;
      if (content.sections.length > 1) {
        chapterOptions.value = content.sections.map((s) => ({
          value: String(s.index),
          label: headingLabel(s.heading, s.label),
        }));
      } else {
        const blocks = content.sections[0]?.blocks ?? [];
        chapterOptions.value = blocks
          .map((b, i) => ({ value: String(i + 1), label: headingLabel(b.heading, b.label) }))
          .filter((option) => option.label);
      }
    } catch {
      chaptersFailed.value = true;
    } finally {
      loadingChapters.value = false;
    }
  },
  { immediate: true },
);

const chapterModel = computed({
  get: () => (chapitre.value === null ? "" : String(chapitre.value)),
  set: (value: string) => {
    chapitre.value = value === "" ? null : Number(value);
  },
});

/** Repli quand le texte ne se charge pas (hors ligne) : le numéro, à la main. */
function onChapterNumber(event: Event) {
  const raw = liveValue(event).trim();
  const n = Number(raw);
  chapitre.value = raw === "" || !Number.isInteger(n) || n < 0 ? null : n;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Le livre choisi -->
    <div v-if="entry" class="flex items-center gap-3 rounded-control bg-surface-soft px-4 py-3">
      <AppIcon name="book-open" :size="18" class="shrink-0 text-primary" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold text-text-primary">{{ texteTitle(entry, locale) }}</p>
        <p class="truncate text-sm text-text-secondary">{{ contextOf(entry) }}</p>
      </div>
      <button
        type="button"
        class="btn btn-soft btn-sm shrink-0"
        :disabled="props.disabled"
        @click="clear"
      >
        <AppIcon name="x" :size="13" />
        {{ t("chiourim.texte.remove") }}
      </button>
    </div>

    <!-- La recherche d'un livre -->
    <div v-else>
      <!-- La loupe se centre sur le champ seul, pas sur les résultats en dessous -->
      <div class="relative">
        <AppIcon
          name="search"
          :size="16"
          class="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-text-secondary/70"
        />
        <input
          :id="props.id"
          :value="search"
          type="text"
          class="field !ps-11"
          :placeholder="t('chiourim.texte.searchPlaceholder')"
          :disabled="props.disabled"
          autocomplete="off"
          @input="search = liveValue($event)"
        />
      </div>
      <ul v-if="results.length" class="mt-2 overflow-hidden rounded-control bg-surface shadow-pop">
        <li v-for="result in results" :key="result.id">
          <button
            type="button"
            class="block w-full px-4 py-2.5 text-start transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            @click="choose(result)"
          >
            <span class="block font-medium text-text-primary">{{ result.name }}</span>
            <span class="block text-xs text-text-secondary">{{ contextOf(result) }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="search.trim()" class="mt-2 text-sm text-text-secondary">
        {{ t("chiourim.texte.noResult") }}
      </p>
    </div>

    <!-- Le chapitre -->
    <div v-if="entry && hasChapitres(entry)">
      <label :for="chapterId" class="mb-2 block text-sm font-semibold text-text-secondary">{{
        t("chiourim.texte.chapterLabel")
      }}</label>
      <p v-if="loadingChapters" class="text-sm text-text-secondary">
        <AppIcon name="spinner" :size="13" class="me-1 animate-spin" />{{
          t("chiourim.texte.loadingChapters")
        }}
      </p>
      <AppSelect
        v-else-if="chapterOptions.length"
        :id="chapterId"
        v-model="chapterModel"
        :options="chapterOptions"
        :placeholder="t('chiourim.texte.wholeText')"
        :disabled="props.disabled"
      />
      <input
        v-else-if="chaptersFailed"
        :id="chapterId"
        type="number"
        min="0"
        step="1"
        class="field"
        :value="chapitre ?? ''"
        :placeholder="t('chiourim.texte.chapterNumber')"
        :disabled="props.disabled"
        @input="onChapterNumber"
      />
    </div>
  </div>
</template>
