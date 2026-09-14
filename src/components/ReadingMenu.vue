<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import ReadingSizeControl from "./ReadingSizeControl.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import { useReadingSize } from "../composables/useReadingSize";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { isNativeApp } from "../composables/useNativeApp";
import { addReadingMenu, removeReadingMenu } from "../composables/useReadingNav";
import { useScrollFrame } from "../composables/useScrollFrame";
import { useOverlay } from "../composables/useOverlayStack";
import type { BookState } from "../composables/useBookDownload";
import { kotelCompassOffered, openKotelCompass } from "../composables/useKotelCompass";
import { openTefilinMirror, tefilinMirrorOffered } from "../composables/useTefilinMirror";
import {
  autoScrollEnabled,
  restoreAutoScrollFromDevice,
  setAutoScrollEnabled,
} from "../composables/useAutoScroll";
import { sansTahanoun, setSansTahanoun } from "../composables/useSansTahanoun";
import type { ReadingNavSection } from "../composables/useReadingNav";
import { analyticsService } from "../services/analyticsService";

/**
 * Le menu de lecture, le même sur tous les textes de la bibliothèque : à la
 * place du bouton « remonter en haut », un bouton rond d'où surgit un petit
 * panneau. Il porte toujours la taille du texte et le retour en haut de
 * page, sans faire remonter jusqu'à la barre d'outils ; les textes qui se
 * divisent y listent leurs repères (sections d'un office, montées d'une
 * paracha, dafim d'une guemara), qui mènent au passage cherché sans faire
 * défiler trois écrans.
 *
 * Le panneau s'ouvre AU-DESSUS du bouton rond, qui reste en place et devient
 * la croix qui le referme : ce qu'on a touché pour ouvrir est ce qu'on touche
 * pour fermer, au même endroit, sans chercher la croix dans le panneau. Un
 * second bouton rond paraît à sa droite, celui des réglages de lecture : il
 * fait passer le panneau du sommaire aux réglages (le défilement automatique,
 * « sans tahanoun » sur une tefila). Les deux boutons échangent alors leurs
 * rôles : celui de gauche ramène au sommaire, celui de droite, à la place des
 * réglages, devient la croix qui quitte. La croix est toujours sur le bouton
 * qu'on vient de toucher en dernier.
 *
 * Contrairement au bouton de remontée, le menu reste affiché tout au long de
 * la lecture : c'est un repère permanent, pas un raccourci de passage. Il ne
 * s'efface qu'une fois tout en bas de la page, où la fin du texte porte ses
 * propres boutons ; une page trop courte pour défiler ne le montre donc pas,
 * sa barre d'outils étant restée sous les yeux.
 *
 * La page peut aussi lui confier deux commandes de sa barre d'outils, pour
 * qu'elles restent à portée en pleine lecture : la bascule hébreu /
 * phonétique (`phonetic`, null quand le texte ne se translittère pas) et,
 * dans l'app native, le téléchargement du texte (`downloadState`, "none"
 * quand il n'y a rien à télécharger). Une tefila (`tefila`) y ajoute le
 * réglage « sans tahanoun », qui n'a de sens que devant un office.
 */
const props = withDefaults(
  defineProps<{
    sections?: ReadingNavSection[];
    phonetic?: boolean | null;
    downloadState?: BookState;
    tefila?: boolean;
  }>(),
  {
    sections: () => [],
    phonetic: null,
    downloadState: "none",
    tefila: false,
  },
);

const emit = defineEmits<{
  (e: "update:phonetic", value: boolean): void;
  (e: "download"): void;
}>();

const { t } = useI18n();

const open = ref(false);
/** Ce que le panneau montre : le sommaire, ou les réglages de lecture. */
const view = ref<"menu" | "settings">("menu");
const isMiniPlayerVisible = useMiniPlayerVisible();

/**
 * Le menu suit la taille de lecture, à moitié. Qui agrandit le texte le fait
 * parce qu'il le lit mal : lui laisser un sommaire en petits caractères, c'est
 * lui rendre illisible le seul endroit d'où l'on rejoint un passage. À moitié,
 * parce qu'un menu n'est pas un texte : le réglage le plus fort (×1,6) le
 * rendrait plus grand que ce qu'il sert à atteindre, et le panneau ne tiendrait
 * plus dans l'écran.
 */
const readingSize = useReadingSize();
const menuScale = computed(() => 1 + (readingSize.scale.value - 1) * 0.5);

// Mêmes règles de placement que ScrollToTop, qu'il remplace : au-dessus du
// mini-lecteur et, dans l'app, de la bottom bar. La distance au bas de
// l'écran est aussi ce que le panneau retranche de sa hauteur (voir style).
const bottomRem = computed(() => {
  if (isNativeApp) return isMiniPlayerVisible.value ? 11 : 7;
  return isMiniPlayerVisible.value ? 9 : 5;
});

// Tout en bas de l'office : le menu s'efface (panneau ouvert excepté). La
// mesure vient de l'image partagée (useScrollFrame) : plus de lecture de
// scrollHeight à chaque événement de défilement.
const scrollFrame = useScrollFrame();
const atBottom = computed(() => scrollFrame.value.atBottom);

function close() {
  open.value = false;
  view.value = "menu";
}

// Le bouton retour d'Android ferme le panneau avant de quitter la page.
useOverlay(open, close);

/** Dénominateur des sauts : ouvertures du panneau, saut ou non derrière. */
function trackNavOpened() {
  analyticsService.capture("tefila_nav_opened", { sections_count: props.sections.length });
}

function openMenu() {
  open.value = true;
  view.value = "menu";
  trackNavOpened();
}

function showSettings() {
  view.value = "settings";
  // L'interrupteur du défilement peut n'exister que dans les préférences
  // natives : on le relit avant de le montrer, comme l'écran des réglages.
  void restoreAutoScrollFromDevice();
  analyticsService.capture("reading_settings_opened", { tefila: props.tefila });
}

/**
 * Le bouton de gauche, celui du menu : il ouvre le panneau, le referme depuis
 * le sommaire, et ramène au sommaire depuis les réglages.
 */
function onMenuButton() {
  if (!open.value) openMenu();
  else if (view.value === "settings") view.value = "menu";
  else close();
}

/** Le bouton de droite : les réglages depuis le sommaire, la croix depuis eux. */
function onSettingsButton() {
  if (view.value === "menu") showSettings();
  else close();
}

const menuButtonIcon = computed(() => {
  if (!open.value) return "list";
  return view.value === "settings" ? "list" : "x";
});
const menuButtonLabel = computed(() => {
  if (!open.value) return t("textReading.navMenu");
  return view.value === "settings" ? t("textReading.settings.backToMenu") : t("common.close");
});
const settingsButtonIcon = computed(() => (view.value === "settings" ? "x" : "settings"));
const settingsButtonLabel = computed(() =>
  view.value === "settings" ? t("common.close") : t("textReading.settings.open"),
);

function goTop() {
  close();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Les repères d'un texte (sections d'un office, montées d'une paracha, dafim
 * d'une guemara) n'avaient aucun suivi : on ne savait pas si le menu est
 * trouvé, ni s'il sert vraiment à sauter les trois écrans qu'il est censé
 * épargner. `rank` dit vers quoi on saute : le début du texte, ou un passage
 * que l'on ne trouvait pas en défilant. Les évènements gardent leur nom
 * d'origine (tefila_*), pour ne pas couper la série déjà mesurée.
 */
function trackJump(anchor: string) {
  const rank = props.sections.findIndex((section) => section.anchor === anchor);
  analyticsService.capture("tefila_section_jumped", {
    sections_count: props.sections.length,
    rank: rank >= 0 ? rank + 1 : null,
  });
}

/**
 * La boussole du Kotel, quand le texte lu se dit face à Jérusalem : le titre
 * de la 'Amida la porte déjà, mais il est loin dès qu'on a commencé à lire,
 * et c'est en priant qu'on se demande de quel côté se tourner.
 */
function openKotel() {
  close();
  openKotelCompass("menu");
}

/**
 * Le miroir, quand le texte lu contient la pose des téfilines : le bayit de la
 * tête se place à l'endroit du corps qu'on ne voit pas, et on a rarement une
 * main libre pour remonter chercher le titre du passage.
 */
function openMirror() {
  close();
  openTefilinMirror("menu");
}

function goTo(anchor: string) {
  trackJump(anchor);
  close();
  const el = document.querySelector(`[data-block-anchor="${anchor}"]`);
  if (!(el instanceof HTMLElement)) return;
  // Le titre de la section vient se poser sous l'en-tête, la lecture dessous.
  window.scrollTo({
    top: window.scrollY + el.getBoundingClientRect().top - 84,
    behavior: "smooth",
  });
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && open.value) close();
};

onMounted(() => {
  addReadingMenu();
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  removeReadingMenu();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <!-- Un clic hors du panneau le referme, sans voile qui assombrit la page. -->
  <div v-if="open" class="fixed inset-0 z-40" @click="close" aria-hidden="true"></div>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-10 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-10 opacity-0"
  >
    <div
      v-show="!atBottom || open"
      class="fixed right-6 z-50"
      :style="{ '--menu-bottom': `${bottomRem}rem`, bottom: `${bottomRem}rem` }"
    >
      <!-- Le panneau surgit au-dessus des boutons ronds, ancré sur eux : il
           grandit sur place plutôt que d'ouvrir un modal ailleurs. -->
      <transition name="nav-panel">
        <div
          v-if="open"
          class="nav-panel absolute bottom-full right-0 mb-2 flex flex-col overflow-hidden rounded-xl bg-surface shadow-pop"
          :style="{ '--menu-scale': menuScale }"
        >
          <transition name="nav-view" mode="out-in">
            <!-- Le sommaire : la taille du texte, la bascule hébreu /
                 phonétique, le téléchargement, puis les repères. -->
            <div v-if="view === 'menu'" key="menu" class="flex min-h-0 flex-col">
              <div
                class="flex items-center justify-between gap-2 ps-3 pe-3 pt-2.5 pb-1 flex-shrink-0"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <ReadingSizeControl />
                  <!-- Hébreu / phonétique, en abrégé : la place manque pour les mots. -->
                  <div
                    v-if="phonetic !== null"
                    class="inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
                    role="group"
                    :aria-label="`${t('textReading.hebrew')} / ${t('textReading.phonetic')}`"
                  >
                    <button
                      @click="emit('update:phonetic', false)"
                      class="px-2.5 py-1 rounded-control text-sm font-medium transition-colors"
                      :class="
                        !phonetic ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'
                      "
                      :aria-pressed="!phonetic"
                      :aria-label="t('textReading.hebrew')"
                      :title="t('textReading.hebrew')"
                    >
                      א
                    </button>
                    <button
                      @click="emit('update:phonetic', true)"
                      class="px-2.5 py-1 rounded-control text-sm font-medium transition-colors"
                      :class="
                        phonetic ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'
                      "
                      :aria-pressed="phonetic"
                      :aria-label="t('textReading.phonetic')"
                      :title="t('textReading.phonetic')"
                    >
                      Aa
                    </button>
                  </div>
                </div>
                <!-- App native : le texte se télécharge sans quitter la lecture. -->
                <button
                  v-if="downloadState !== 'none'"
                  @click="emit('download')"
                  class="icon-btn flex-shrink-0"
                  :class="downloadState === 'downloaded' ? 'text-primary' : ''"
                  :aria-label="
                    downloadState === 'downloaded' ? t('downloads.delete') : t('downloads.download')
                  "
                  :title="
                    downloadState === 'downloaded' ? t('downloads.delete') : t('downloads.download')
                  "
                >
                  <AppIcon
                    v-if="downloadState === 'downloading'"
                    name="spinner"
                    :size="16"
                    class="animate-spin text-primary"
                  />
                  <AppIcon
                    v-else-if="downloadState === 'downloaded'"
                    name="circle-check"
                    :size="16"
                  />
                  <AppIcon v-else name="download" :size="16" />
                </button>
              </div>
              <nav class="overflow-y-auto px-2 pb-2 min-h-0">
                <button @click="goTop" class="section-item">
                  <AppIcon name="arrow-up" :size="13" class="flex-shrink-0 text-text-secondary" />
                  {{ t("textReading.navTop") }}
                </button>
                <button v-if="kotelCompassOffered" @click="openKotel" class="section-item">
                  <AppIcon name="compass" :size="13" class="flex-shrink-0 text-text-secondary" />
                  {{ t("textReading.kotel.title") }}
                </button>
                <button v-if="tefilinMirrorOffered" @click="openMirror" class="section-item">
                  <AppIcon name="mirror" :size="13" class="flex-shrink-0 text-text-secondary" />
                  {{ t("textReading.mirror.title") }}
                </button>
                <p v-if="props.sections.length" class="section-heading">
                  {{ t("textReading.navSections") }}
                </p>
                <button
                  v-for="section in props.sections"
                  :key="section.anchor"
                  @click="goTo(section.anchor)"
                  class="section-item"
                >
                  <span class="section-name">{{ section.label }}</span>
                  <!-- Le nom hébreu, celui du sidour de papier : c'est souvent lui
                       que l'œil cherche. -->
                  <span v-if="section.hebrew" class="section-he" dir="rtl">{{
                    section.hebrew
                  }}</span>
                </button>
              </nav>
            </div>

            <!-- Les réglages de lecture : des lignes séparées d'un filet, comme
                 l'écran des réglages, chacune avec son interrupteur. -->
            <div v-else key="settings" class="settings-view overflow-y-auto px-3 pt-2.5 pb-2">
              <p class="section-heading !px-0">{{ t("textReading.settings.title") }}</p>
              <ul class="flex flex-col divide-y divide-line">
                <li>
                  <label class="setting-row">
                    <span class="min-w-0">
                      <span class="setting-name">{{ t("textReading.settings.autoScroll") }}</span>
                      <span class="setting-hint">
                        {{ t("textReading.settings.autoScrollHint") }}
                      </span>
                    </span>
                    <ToggleSwitch
                      :model-value="autoScrollEnabled"
                      @update:model-value="setAutoScrollEnabled"
                    />
                  </label>
                </li>
                <!-- Une tefila seulement : le tahanoun n'a pas sa place devant
                     une guemara. -->
                <li v-if="tefila">
                  <label class="setting-row">
                    <span class="min-w-0">
                      <span class="setting-name">{{ t("textReading.settings.sansTahanoun") }}</span>
                      <span class="setting-hint">
                        {{ t("textReading.settings.sansTahanounHint") }}
                      </span>
                    </span>
                    <ToggleSwitch
                      :model-value="sansTahanoun"
                      @update:model-value="setSansTahanoun"
                    />
                  </label>
                </li>
              </ul>
            </div>
          </transition>
        </div>
      </transition>

      <!-- Les boutons ronds : celui du menu, toujours là, et celui des réglages
           qui paraît à sa droite quand le panneau est ouvert. -->
      <div class="flex items-center justify-end">
        <button
          @click="onMenuButton"
          class="fab"
          :aria-label="menuButtonLabel"
          aria-haspopup="menu"
          :aria-expanded="open"
        >
          <transition name="fab-icon" mode="out-in">
            <AppIcon :key="menuButtonIcon" :name="menuButtonIcon" :size="18" />
          </transition>
        </button>
        <transition name="fab-second">
          <div v-if="open" class="fab-second">
            <button
              @click="onSettingsButton"
              class="fab"
              :class="{ 'text-primary': view === 'settings' }"
              :aria-label="settingsButtonLabel"
            >
              <transition name="fab-icon" mode="out-in">
                <AppIcon :key="settingsButtonIcon" :name="settingsButtonIcon" :size="18" />
              </transition>
            </button>
          </div>
        </transition>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Les boutons ronds : la surface qui porte l'ombre, comme le bouton de
   remontée qu'ils remplacent. */
.fab {
  display: flex;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  color: var(--color-text-primary);
  transition: color 0.3s ease;
}

.fab:hover {
  color: var(--color-primary);
}

.fab:focus {
  outline: none;
}

.fab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Le second bouton pousse le premier vers la gauche en prenant sa place :
   sa largeur grandit, le bouton du menu glisse, et l'icône des réglages
   paraît dans l'espace ouvert. */
.fab-second {
  width: 3.25rem;
  padding-inline-start: 0.5rem;
  overflow: visible;
}

.fab-second-enter-active {
  transition:
    width 0.25s cubic-bezier(0.3, 1.1, 0.55, 1),
    padding 0.25s cubic-bezier(0.3, 1.1, 0.55, 1),
    opacity 0.15s ease-out 0.08s,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s;
}

.fab-second-leave-active {
  transition:
    width 0.15s ease-in,
    padding 0.15s ease-in,
    opacity 0.1s ease-in,
    transform 0.1s ease-in;
}

.fab-second-enter-from,
.fab-second-leave-to {
  width: 0;
  padding-inline-start: 0;
  opacity: 0;
  transform: scale(0.5);
}

/* L'icône du bouton change de rôle (menu, croix, réglages) : elle tourne en
   s'effaçant, la nouvelle arrive dans le même mouvement. */
.fab-icon-enter-active,
.fab-icon-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.fab-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}

.fab-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}

/* Le panneau grandit avec le réglage de lecture, sans jamais déborder de
   l'écran : c'est la largeur disponible qui a le dernier mot. En hauteur, il
   laisse la place des boutons sous lui et ce qui, sous eux, tient le bas de
   l'écran (mini-lecteur, barre de l'app). */
.nav-panel {
  width: min(calc(20rem * var(--menu-scale, 1)), calc(100vw - 3rem));
  max-height: min(
    calc(30rem * var(--menu-scale, 1)),
    calc(100vh - var(--menu-bottom, 5rem) - 5rem),
    calc(100dvh - var(--menu-bottom, 5rem) - 5rem)
  );
}

.settings-view {
  font-size: calc(0.9rem * var(--menu-scale, 1));
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: calc(0.6rem * var(--menu-scale, 1)) 0;
  cursor: pointer;
}

.setting-name {
  display: block;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-primary);
}

.setting-hint {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.85em;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.section-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: start;
  padding: calc(0.5rem * var(--menu-scale, 1)) 0.55rem;
  border-radius: var(--radius-sm, 0.5rem);
  font-size: calc(0.9rem * var(--menu-scale, 1));
  line-height: 1.35;
  color: var(--color-text-primary);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

/* Le titre traduit prend la place qu'il faut ; l'hébreu garde la sienne au
   bout de la ligne, sans jamais se couper. */
.section-name {
  flex: 1 1 auto;
  min-width: 0;
}

.section-he {
  flex: 0 0 auto;
  font-family: var(--font-hebrew);
  font-size: 0.95em;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.section-item:hover .section-he {
  color: inherit;
}

.section-heading {
  padding: 0.5rem 0.55rem 0.15rem;
  font-size: calc(0.78rem * var(--menu-scale, 1));
  font-weight: 600;
  color: var(--color-text-secondary);
}

.section-item:hover {
  background-color: color-mix(in srgb, currentColor 8%, transparent);
  color: var(--color-primary);
}

/* Le panneau surgit du coin des boutons : un léger ressort à l'ouverture, une
   sortie brève et discrète. */
.nav-panel {
  transform-origin: bottom right;
}

.nav-panel-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.3s cubic-bezier(0.3, 1.3, 0.55, 1);
}

.nav-panel-leave-active {
  transition:
    opacity 0.12s ease-in,
    transform 0.12s ease-in;
}

.nav-panel-enter-from,
.nav-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.85);
}

/* Le contenu suit d'un souffle : le panneau arrive, la liste se révèle. */
.nav-panel-enter-active nav {
  transition: opacity 0.18s ease-out 0.08s;
}

.nav-panel-enter-from nav {
  opacity: 0;
}

/* Du sommaire aux réglages et retour : un fondu bref, le panneau ne bouge pas. */
.nav-view-enter-active,
.nav-view-leave-active {
  transition: opacity 0.12s ease;
}

.nav-view-enter-from,
.nav-view-leave-to {
  opacity: 0;
}

/* Mouvement réduit : les fondus suffisent. */
@media (prefers-reduced-motion: reduce) {
  .nav-panel-enter-active,
  .nav-panel-leave-active,
  .fab-second-enter-active,
  .fab-second-leave-active,
  .fab-icon-enter-active,
  .fab-icon-leave-active {
    transition: opacity 0.15s ease;
  }

  .nav-panel-enter-from,
  .nav-panel-leave-to,
  .fab-icon-enter-from,
  .fab-icon-leave-to {
    transform: none;
  }

  .fab-second-enter-from,
  .fab-second-leave-to {
    width: 3.25rem;
    padding-inline-start: 0.5rem;
    transform: none;
  }
}
</style>
