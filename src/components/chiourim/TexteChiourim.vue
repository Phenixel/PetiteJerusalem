<script setup lang="ts">
/**
 * Les cours audio d'un texte de la bibliothèque, sous le chapitre qu'on vient
 * de lire ou en tête d'un livre : ce qui fait le pont entre lire et écouter.
 *
 * Ceux du chapitre ouvert d'abord ; trois à cinq lignes, la suite à un geste. Rien
 * ne s'affiche tant qu'aucun cours n'étudie ce texte, ni hors connexion :
 * l'encart ne promet pas ce qu'il ne peut pas jouer.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Chiour, TextStudyJsonEntry } from "../../models/models";
import { chiourService } from "../../services/chiourService";
import { serieService } from "../../services/serieService";
import { chiourimOfTexte, hasChapitres, texteTitle } from "../../services/chiourTexte";
import { useTexteLabels } from "../../composables/useTexteLabels";
import { analyticsService } from "../../services/analyticsService";
import ChiourTrackRow from "./ChiourTrackRow.vue";

const props = defineProps<{
  entry: TextStudyJsonEntry;
  /** Le chapitre ouvert (index de section), ou null sur le livre entier. */
  chapitre: number | null;
}>();

const { t, locale } = useI18n();
const { chapitreLabel } = useTexteLabels();

const FIRST = 3;
/** Ceux du chapitre ouvert passent avant, mais pas plus de cinq d'emblée. */
const CHAPTER_MAX = 5;
const all = ref<Chiour[]>([]);
const expanded = ref(false);
const texteId = computed(() => Number(props.entry.id));

const ordered = computed(() => chiourimOfTexte(all.value, texteId.value, props.chapitre));
const ofChapter = computed(() =>
  props.chapitre === null
    ? 0
    : ordered.value.filter((c) => c.texteChapitre === props.chapitre).length,
);
const visible = computed(() =>
  expanded.value
    ? ordered.value
    : ordered.value.slice(0, Math.max(FIRST, Math.min(ofChapter.value, CHAPTER_MAX))),
);

const title = computed(() =>
  ofChapter.value > 0 ? t("chiourim.texte.onChapter") : t("chiourim.texte.onText"),
);

/** La ligne sous un cours : son rav, et le chapitre qu'il étudie. */
function line(chiour: Chiour): string {
  const chapter =
    chiour.texteChapitre !== null && hasChapitres(props.entry)
      ? chapitreLabel(props.entry, chiour.texteChapitre)
      : "";
  return [chiour.auteur, chapter].filter(Boolean).join(" · ");
}

let shownFor = "";
watch(
  texteId,
  async (id) => {
    all.value = [];
    expanded.value = false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      // Les noms de séries, pour la pochette et le mini-lecteur.
      void serieService.getAllSeries().catch(() => {});
      const found = await chiourService.getChiourimOfTexte(id);
      if (id !== texteId.value) return;
      all.value = found;
    } catch {
      all.value = [];
    }
  },
  { immediate: true },
);

// Combien de lecteurs voient l'encart, sur quel texte : le dénominateur des
// écoutes lancées depuis un texte (`chiour_played`, source « texte »).
watch(
  () => [ordered.value.length, props.chapitre] as const,
  ([count, chapitre]) => {
    const key = `${texteId.value}:${chapitre}`;
    if (!count || shownFor === key) return;
    shownFor = key;
    analyticsService.capture("text_chiourim_shown", {
      texte_id: texteId.value,
      chapitre,
      chiourim_count: count,
      chapter_count: ofChapter.value,
    });
  },
);
</script>

<template>
  <section v-if="ordered.length" :aria-label="title">
    <h2 class="mb-2 flex items-center gap-2 text-lg font-bold text-text-primary">
      {{ title }}
    </h2>
    <div class="-mx-2">
      <ChiourTrackRow
        v-for="chiour in visible"
        :key="chiour.slug"
        :chiour="chiour"
        :list="ordered"
        source="texte"
        :context="texteTitle(entry, locale)"
        :subtitle="line(chiour)"
      />
    </div>
    <button
      v-if="!expanded && ordered.length > visible.length"
      type="button"
      class="mt-2 text-sm font-semibold text-primary hover:underline"
      @click="expanded = true"
    >
      {{ t("chiourim.texte.showAll", { count: ordered.length }) }}
    </button>
  </section>
</template>
