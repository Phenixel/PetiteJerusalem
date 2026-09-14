<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import { KETORET_KLAF, KLAF_PHOTOS, MENORA_KLAF, MENORA_STEM } from "../content/klaf";
import { closeKlaf, klafOpen, KLAF_LABELS } from "../composables/useKlaf";

/**
 * Le parchemin, ouvert depuis le fil du sidour ou le menu de lecture : la
 * photo du klaf d'abord, telle qu'un sofer l'a écrit, puis, sur un second
 * onglet, sa retranscription dans la police hébraïque du lecteur.
 *
 * La photo se lit de près : un toucher l'agrandit au double, et l'on fait
 * défiler ; un second toucher la ramène à la largeur de la fenêtre. La
 * retranscription est écrite dans l'écriture du sofer (police Stam Sefarad
 * CLM, ktav Sefaradi avec taguim) : le même rendu que le klaf, mais du texte,
 * qui suit la taille de lecture. Celle du pitoum haketoret suit les blancs du
 * parchemin ; celle du Lamnatséa'h reprend sa forme, sept branches et un
 * pied, en traits pleins : c'est une écriture, pas une illustration.
 */
const { t } = useI18n();

type View = "photo" | "text";

/** Les deux onglets, avec leurs clés en clair pour le test des clés. */
const VIEWS: { id: View; labelKey: string }[] = [
  { id: "photo", labelKey: "textReading.klaf.photo" },
  { id: "text", labelKey: "textReading.klaf.text" },
];

const view = ref<View>("photo");
const zoomed = ref(false);
const photosEl = ref<HTMLElement | null>(null);

/**
 * Agrandie, la photo déborde à droite et à gauche : on la fait commencer par
 * son bord droit, là où les lignes d'hébreu commencent, plutôt qu'au milieu
 * d'une ligne.
 */
async function toggleZoom(): Promise<void> {
  zoomed.value = !zoomed.value;
  await nextTick();
  if (zoomed.value && photosEl.value) photosEl.value.scrollLeft = photosEl.value.scrollWidth;
}

// Chaque ouverture repart de la photo, à la largeur de la fenêtre : c'est
// elle qu'on vient voir, et ce qu'on avait agrandi la dernière fois ne dit
// rien de ce qu'on cherche aujourd'hui.
watch(klafOpen, (kind) => {
  if (kind) {
    view.value = "photo";
    zoomed.value = false;
  }
});

const kind = computed(() => klafOpen.value);
const photos = computed(() => (kind.value ? KLAF_PHOTOS[kind.value] : []));
const title = computed(() => (kind.value ? t(KLAF_LABELS[kind.value].title) : ""));
</script>

<template>
  <AppModal
    :open="kind !== null"
    :label="title"
    panel-class="klaf-panel animate-[scaleIn_0.3s_ease]"
    @close="closeKlaf"
  >
    <div class="klaf-head">
      <h3 class="text-lg font-bold text-text-primary">{{ title }}</h3>
      <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="closeKlaf">
        <AppIcon name="x" :size="18" />
      </button>
    </div>

    <!-- Photo ou texte : un groupe segmenté, comme les onglets des pages. -->
    <div class="klaf-tabs">
      <div
        class="inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
        role="group"
        :aria-label="t('textReading.klaf.views')"
      >
        <button
          v-for="tab in VIEWS"
          :key="tab.id"
          type="button"
          class="rounded-control px-5 py-1.5 text-sm font-semibold transition-colors"
          :class="view === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'"
          :aria-pressed="view === tab.id"
          @click="view = tab.id"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>
    </div>

    <div class="klaf-body">
      <!-- Le parchemin lui-même, page après page. -->
      <div
        v-if="view === 'photo'"
        ref="photosEl"
        class="klaf-photos"
        :class="{ 'klaf-zoomed': zoomed }"
      >
        <img
          v-for="(src, i) in photos"
          :key="src"
          :src="src"
          :alt="t('textReading.klaf.photoAlt', { title, n: i + 1 })"
          decoding="async"
          @click="toggleZoom"
        />
        <p class="klaf-hint">
          {{ t(zoomed ? "textReading.klaf.zoomOut" : "textReading.klaf.zoomIn") }}
        </p>
      </div>

      <!-- La retranscription : les blancs du parchemin, sans ses voyelles. -->
      <div v-else-if="kind === 'ketoret'" class="klaf-text" dir="rtl">
        <p v-for="(paragraph, i) in KETORET_KLAF" :key="i">{{ paragraph }}</p>
        <p class="klaf-hint" dir="auto">{{ t("textReading.klaf.transcribed") }}</p>
      </div>

      <!-- Le psaume en menora : le titre en tête, sept branches lues de haut
           en bas, de droite à gauche, la fin du verset du milieu au pied. -->
      <div v-else class="klaf-menora" dir="rtl">
        <p class="menora-title">{{ MENORA_KLAF.title }}</p>
        <div class="menora-branches">
          <div
            v-for="(verse, i) in MENORA_KLAF.branches"
            :key="i"
            class="menora-branch"
            :class="{ 'menora-stem': i === MENORA_STEM }"
          >
            <span class="menora-verse">{{ verse }}</span>
            <span class="menora-arm" aria-hidden="true"></span>
          </div>
        </div>
        <span class="menora-bar" aria-hidden="true"></span>
        <span class="menora-foot" aria-hidden="true"></span>
        <p class="menora-base">{{ MENORA_KLAF.base }}</p>
        <p class="klaf-hint" dir="auto">{{ t("textReading.klaf.transcribed") }}</p>
      </div>
    </div>
  </AppModal>
</template>

<!-- Le cadre est un élément d'AppModal, hors de la portée des styles scopés :
     sa règle est globale, sous un nom qui n'appartient qu'au parchemin. -->
<style>
/* Une fenêtre haute : la photo se lit page après page, le corps défile
   dans le cadre, la tête et les onglets restent en place. */
.klaf-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 36rem;
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  background-color: var(--color-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-pop);
}
</style>

<style scoped>
.klaf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.25rem 1.25rem 0.75rem;
}

.klaf-tabs {
  display: flex;
  justify-content: center;
  padding: 0 1.25rem 0.75rem;
}

.klaf-body {
  min-height: 0;
  overflow-y: auto;
  padding: 0.25rem 1.25rem 1.25rem;
  overscroll-behavior: contain;
}

/* La photo à la largeur de la fenêtre ; agrandie, elle en déborde et l'on
   fait défiler, la fenêtre ne s'élargit pas. */
.klaf-photos {
  overflow-x: auto;
}

.klaf-photos img {
  display: block;
  width: 100%;
  max-width: none;
  height: auto;
  border-radius: var(--radius-sm);
  cursor: zoom-in;
}

.klaf-photos img + img {
  margin-top: 0.75rem;
}

.klaf-zoomed img {
  width: 200%;
  cursor: zoom-out;
}

.klaf-hint {
  margin-top: 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: center;
  color: var(--color-text-secondary);
}

/* La retranscription, dans l'écriture du sofer (voir @font-face dans
   main.css), à la taille de lecture du lecteur (A− / A+), justifiée comme le
   parchemin. La police de lecture ne vient qu'en repli, le temps du
   chargement. */
.klaf-text {
  font-family: "Stam Sefarad CLM", var(--font-hebrew);
  font-size: calc(1.5rem * var(--reading-scale, 1));
  line-height: 1.7;
  text-align: justify;
  color: var(--color-text-primary);
}

.klaf-text p + p {
  margin-top: 1rem;
}

/* La menora : des traits pleins à la couleur du texte, ni ombre ni dégradé. */
.klaf-menora {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: "Stam Sefarad CLM", var(--font-hebrew);
  color: var(--color-text-primary);
  padding-top: 0.25rem;
}

.menora-title,
.menora-base {
  font-size: calc(1.2rem * var(--reading-scale, 1));
  line-height: 1.4;
  text-align: center;
}

.menora-title {
  margin-bottom: 0.75rem;
}

/* Sept branches côte à côte, la première à droite (le sens du texte), de
   même hauteur : le verset le plus long donne la sienne, les autres se
   prolongent d'un trait jusqu'à la barre qui les réunit. */
.menora-branches {
  display: flex;
  align-items: stretch;
  gap: 0.3rem;
}

.menora-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 2.3rem;
}

/* Un verset lu de haut en bas : écrit verticalement, l'hébreu part du bas ;
   retourné d'un demi-tour, il part du haut, comme sur le parchemin. */
.menora-verse {
  writing-mode: vertical-rl;
  direction: rtl;
  transform: rotate(180deg);
  font-size: calc(1.05rem * var(--reading-scale, 1));
  line-height: 1;
  white-space: nowrap;
  padding: 0.35rem 0;
}

.menora-arm {
  flex: 1;
  width: 2px;
  min-height: 0.75rem;
  background-color: currentColor;
}

/* La tige porte le verset du milieu et descend seule jusqu'au pied. */
.menora-stem .menora-arm {
  min-height: 1.25rem;
}

/* La barre réunit les sept branches, d'un centre de branche à l'autre. */
.menora-bar {
  width: calc(7 * 2.3rem + 6 * 0.3rem - 2.3rem);
  height: 2px;
  background-color: currentColor;
}

.menora-foot {
  width: 2px;
  height: 2rem;
  background-color: currentColor;
}

.menora-base {
  margin-top: 0.25rem;
}
</style>
