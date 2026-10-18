<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";
import { analyticsService } from "../services/analyticsService";
import { authService } from "../services/authService";
import { setRevealOrigin } from "../composables/useRevealOrigin";
import { refreshSupportUnread, useSupportUnread } from "../composables/useSupportUnread";
import { useHolidayTheme } from "../composables/useHolidayTheme";
import HolidayFabShape from "./holiday/HolidayFabShape.vue";
import { useLocalePath } from "../composables/useLocalePath";
import { isSectionPath } from "../content/seoLocales";
import { SIDOUR_PATH, STUDY_PATH, isSidourPath, isStudyPath } from "../config/navSections";
import { stopTabBarChange, tabBarChange, tabBarChangeRun } from "../composables/useTabBarChange";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// Sans compte, l'onglet profil s'annonce « Réglages », icône engrenage :
// c'est ce que la page offre alors (langue, thème, polices), et personne
// n'irait chercher des réglages sous un onglet « Profil » déconnecté.
const isLoggedIn = ref(false);
let unsubscribeAuth: (() => void) | null = null;

// Nous écrire : une réponse de l'équipe pas encore lue se compte sur l'onglet
// du profil, là où mène la ligne « Nous écrire ». Relu à chaque compte qui
// arrive et au retour dans l'app (la réponse a pu arriver entre-temps), et
// seulement si l'appareil a déjà écrit ou qu'un compte est connecté.
const { unread: supportUnread } = useSupportUnread();
let checkedFor: string | null | undefined;
let removeResume: (() => void) | null = null;
onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    isLoggedIn.value = user != null;
    const id = user?.id ?? null;
    if (id !== checkedFor) {
      checkedFor = id;
      void refreshSupportUnread(user != null);
    }
  });
  void import("@capacitor/app")
    .then(({ App }) => App.addListener("resume", () => void refreshSupportUnread(isLoggedIn.value)))
    .then((handle) => (removeResume = () => void handle.remove()))
    .catch(() => {});
});
onUnmounted(() => {
  unsubscribeAuth?.();
  removeResume?.();
});

/**
 * Les chemins traduits (accueil, horaires) dans l'espace de langue où l'on
 * est : un chemin écrit en dur ferait sortir de l'espace anglais au premier
 * appui, sans même que l'onglet se reconnaisse actif.
 */
const { localePath } = useLocalePath();

// `anim` : personnalité de l'icône au toucher, en écho aux illustrations de
// l'accueil (maison qui gonfle, livre qui se redresse, lecteur qui se
// balance, personnage qui bondit).
//
// `isActive` : les adresses qui allument l'onglet. Le `active-class` de
// RouterLink ne suffit pas, il compare les routes déclarées et non les
// adresses : /bibliotheque/tehilim et /bibliotheque sont deux routes
// distinctes, l'onglet s'éteignait donc dès qu'on ouvrait un corpus. Et les
// textes de liturgie, s'ils vivent sous /bibliotheque, allument le Sidour,
// pas l'Étude (voir config/navSections).
type Tab = {
  to: string;
  icon: IconName;
  labelKey: string;
  anim: string;
  isActive: (path: string) => boolean;
};
const tabs = computed<Tab[]>(() => {
  // L'accueil est traduit (/, /en, /he) : l'onglet suit l'espace de langue,
  // comme le bouton des horaires plus bas.
  const home = localePath("home");
  return [
    { to: home, icon: "home", labelKey: "common.home", anim: "pop", isActive: (p) => p === home },
    // Le Sidour garde la place et le dessin de l'ancienne bibliothèque : c'est
    // par ce livre ouvert qu'on allait chercher l'office, le geste ne change
    // pas, il mène simplement plus vite.
    {
      to: SIDOUR_PATH,
      icon: "book-open",
      labelKey: "common.sidour",
      anim: "sway",
      isActive: isSidourPath,
    },
    // L'Étude réunit la bibliothèque, les chiourim et le partage, reliés par
    // les onglets en tête de leurs pages (PageTabs).
    {
      to: STUDY_PATH,
      icon: "book-reader",
      labelKey: "common.study",
      anim: "bow",
      isActive: isStudyPath,
    },
    // Les sous-pages du profil (/profile/appearance...) sont des routes à
    // part : l'onglet reste allumé tant qu'on y est.
    {
      to: "/profile",
      icon: isLoggedIn.value ? "user" : "settings",
      labelKey: isLoggedIn.value ? "common.profile" : "profile.guestTitle",
      anim: "hop",
      isActive: (p) => p === "/profile" || p.startsWith("/profile/"),
    },
  ];
});

const zmanimPath = computed(() => localePath("horaires"));

/**
 * The bar replays its change (the "what's new" tour, useTabBarChange): the
 * tabs of the previous version are drawn over the real slots, the library
 * book jumps over the times circle to the Chiourim slot and merges
 * into Étude, then Sidour rises where the book was. The real tabs are hidden
 * meanwhile, and take over at the end, in the same place.
 *
 * The jump is measured between the two slots (the times circle sits between
 * them), so that it lands right whatever the width and the direction of
 * reading (Hebrew lays the bar out from the right).
 */
const tabRow = ref<HTMLElement | null>(null);
const hop = ref(0);

function measureHop(): void {
  const slots = tabRow.value?.querySelectorAll<HTMLElement>(".change-slot");
  if (!slots || slots.length < 3) return;
  const from = slots[1].getBoundingClientRect();
  const to = slots[2].getBoundingClientRect();
  hop.value = to.left + to.width / 2 - (from.left + from.width / 2);
}

// Measured when the scene appears and again when it starts: the bar may
// have been laid out anew in between (a rotation, the safe areas read late).
watch(
  [tabBarChangeRun, tabBarChange],
  async () => {
    await nextTick();
    measureHop();
  },
  { immediate: true },
);

/** The last movement of the scene (Sidour settling) ends it. */
function onChangeEnd(event: AnimationEvent): void {
  if (tabBarChange.value === "playing" && event.animationName.includes("sidour-arrive")) {
    stopTabBarChange();
  }
}

const isHomeActive = computed(() => route.path === localePath("home"));
const isProfileActive = computed(
  () => route.path === "/profile" || route.path.startsWith("/profile/"),
);

// Le temps d'une fête, le rond prend la forme d'un objet de la fête (la
// pomme de Roch Hachana, la soucca), l'horloge restant au milieu : c'est le
// seul bouton que tout le monde touche tous les jours, et c'est là que la
// fête se voit d'abord (voir useHolidayTheme, HolidayFabShape).
const { activeHolidayTheme } = useHolidayTheme();

// Onglet dont l'icône s'anime. Remis à null d'abord pour que l'animation
// reparte même en retouchant l'onglet déjà actif.
const poppedTab = ref<string | null>(null);
function popIcon(to: string) {
  if (to === "/profile") {
    analyticsService.capture("profile_opened", { source: "bottom_bar" });
  }
  poppedTab.value = null;
  requestAnimationFrame(() => {
    poppedTab.value = to;
  });
}

/**
 * Toucher l'onglet de la page où l'on est déjà la remonte en haut, comme sur
 * iOS et Android. Il ne faisait rien : 129 appuis sur « Accueil » depuis
 * l'accueil en septembre 2026 (docs/audit-usage-posthog-2026-10.md, 2.7).
 * Depuis une sous-page (un corpus de la bibliothèque), le lien ramène à la
 * page de l'onglet, comme avant.
 */
function onTabClick(tab: Tab) {
  popIcon(tab.to);
  if (route.path !== tab.to) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

// La page des horaires se comporte en surcouche (voir App.vue) : le bouton
// rond l'ouvre en cercle depuis lui-même, et la referme si elle est déjà là.
const onZmanim = computed(() => isSectionPath(route.path, "horaires"));

function toggleZmanim(event: MouseEvent) {
  popIcon(zmanimPath.value);
  if (onZmanim.value) {
    analyticsService.capture("zmanim_closed", { source: "bottom_bar" });
    // Refermer, c'est revenir sur la page que la surcouche recouvrait.
    // Ouverte par lien direct (widget) : rien derrière, on rend l'accueil.
    if (router.options.history.state.back != null) router.back();
    else void router.replace("/");
    return;
  }
  analyticsService.capture("zmanim_opened", { source: "bottom_bar" });
  setRevealOrigin(event.currentTarget as HTMLElement);
  void router.push(zmanimPath.value);
}
</script>

<!-- Barre de navigation basse de l'app native (remplace le menu hamburger du
     site). Fixée au-dessus de la barre de gestes Android (safe-area).
     Au centre, un bouton rond en accès rapide aux horaires du jour : c'est ce
     qu'on vient vérifier le plus souvent, et toujours en vitesse. -->
<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-black/5 dark:border-white/10 pb-[var(--safe-bottom)]"
    :class="{ 'tabs-staged': tabBarChange !== 'off' }"
    :aria-label="t('navbar.mainMenu')"
    data-tour="tab-bar"
  >
    <div ref="tabRow" class="tab-row relative flex items-stretch h-14">
      <template v-for="(tab, index) in tabs" :key="tab.to">
        <!-- Place réservée au bouton rond, à mi-parcours des onglets -->
        <span v-if="index === tabs.length / 2" class="w-16 shrink-0" aria-hidden="true"></span>
        <RouterLink
          :to="tab.to"
          class="tab-item"
          :class="tab.isActive(route.path) ? 'tab-item-active' : ''"
          :aria-current="tab.isActive(route.path) ? 'page' : undefined"
          exact-active-class="tab-item-noop"
          active-class="tab-item-noop"
          @click="onTabClick(tab)"
        >
          <span
            class="tab-icon"
            :class="poppedTab === tab.to ? `tab-icon-${tab.anim}` : ''"
            @animationend="poppedTab = null"
          >
            <AppIcon :name="tab.icon" :size="21" />
            <span
              v-if="tab.to === '/profile' && supportUnread > 0"
              class="tab-badge"
              :aria-label="t('support.unreadCount', { n: supportUnread }, supportUnread)"
            >
              {{ supportUnread > 9 ? "9+" : supportUnread }}
            </span>
          </span>
          <span class="text-[11px] font-medium leading-none">{{ t(tab.labelKey) }}</span>
        </RouterLink>
      </template>

      <!-- The change replayed (what's new): the old tabs over the real
           slots, under the times circle, which the book slips behind. -->
      <div
        v-if="tabBarChange !== 'off'"
        :key="tabBarChangeRun"
        class="tab-change"
        :class="{ 'tab-change-held': tabBarChange === 'held' }"
        :style="{ '--hop': `${hop}px` }"
        aria-hidden="true"
        @animationend="onChangeEnd"
      >
        <span class="tab-item change-slot" :class="{ 'tab-item-active': isHomeActive }">
          <span class="tab-icon"><AppIcon name="home" :size="21" /></span>
          <span class="text-[11px] font-medium leading-none">{{ t("common.home") }}</span>
        </span>
        <span class="change-slot change-stack">
          <span class="tab-item change-library">
            <span class="tab-icon change-library-icon"
              ><AppIcon name="book-open" :size="21"
            /></span>
            <span class="text-[11px] font-medium leading-none change-library-label">
              {{ t("study.title") }}
            </span>
          </span>
          <span
            class="tab-item change-sidour"
            :class="{ 'tab-item-active': isSidourPath(route.path) }"
          >
            <span class="tab-icon"><AppIcon name="book-open" :size="21" /></span>
            <span class="text-[11px] font-medium leading-none">{{ t("common.sidour") }}</span>
          </span>
        </span>
        <span class="w-16 shrink-0"></span>
        <span class="change-slot change-stack">
          <span
            class="tab-item change-chiourim"
            :class="{ 'tab-item-active': route.path.startsWith('/chiourim') }"
          >
            <span class="tab-icon"><AppIcon name="headphones" :size="21" /></span>
            <span class="text-[11px] font-medium leading-none">{{ t("common.chiourim") }}</span>
          </span>
          <span
            class="tab-item change-study"
            :class="{ 'tab-item-active': isStudyPath(route.path) }"
          >
            <span class="change-burst"></span>
            <span class="tab-icon change-study-icon"
              ><AppIcon name="book-reader" :size="21"
            /></span>
            <span class="text-[11px] font-medium leading-none change-study-label">
              {{ t("common.study") }}
            </span>
          </span>
        </span>
        <span class="tab-item change-slot" :class="{ 'tab-item-active': isProfileActive }">
          <span class="tab-icon"
            ><AppIcon :name="isLoggedIn ? 'user' : 'settings'" :size="21"
          /></span>
          <span class="text-[11px] font-medium leading-none">
            {{ t(isLoggedIn ? "common.profile" : "profile.guestTitle") }}
          </span>
        </span>
      </div>

      <button
        type="button"
        class="zmanim-fab"
        :class="{ 'zmanim-fab-active': onZmanim, 'zmanim-fab-shaped': activeHolidayTheme }"
        :aria-label="t('zmanim.title')"
        :title="t('zmanim.title')"
        :aria-pressed="onZmanim"
        @click="toggleZmanim"
      >
        <HolidayFabShape v-if="activeHolidayTheme" :theme="activeHolidayTheme.id" />
        <span
          class="tab-icon relative"
          :class="poppedTab === zmanimPath ? 'tab-icon-pop' : ''"
          @animationend="poppedTab = null"
        >
          <AppIcon name="clock" :size="24" />
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
}
.tab-item-active {
  color: var(--color-primary);
}
.tab-icon {
  position: relative;
  display: inline-flex;
  transform-origin: center;
}

/* Une réponse de l'équipe pas encore lue (Nous écrire) : le compte, sur la
   teinte du thème, à cheval sur le coin de l'icône du profil, détaché d'un
   liseré de la couleur de la barre. */
.tab-badge {
  position: absolute;
  top: -5px;
  inset-inline-end: -9px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9999px;
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: 0 0 0 2px var(--color-surface);
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Bouton rond central : posé au milieu de la barre, il déborde légèrement
   au-dessus pour se détacher des onglets sans masquer la page. */
.zmanim-fab {
  position: absolute;
  left: 50%;
  bottom: 0.6rem;
  transform: translateX(-50%);
  width: 3.25rem;
  height: 3.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-brand) 55%, transparent);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.zmanim-fab:active {
  transform: translateX(-50%) scale(0.92);
}
.zmanim-fab-active {
  box-shadow:
    0 6px 18px color-mix(in srgb, var(--color-primary) 45%, transparent),
    0 0 0 3px color-mix(in srgb, var(--color-primary) 28%, transparent);
}
/* Le temps d'une fête, le rond s'efface derrière la forme de l'objet
   (HolidayFabShape), qui porte l'ombre à sa place ; l'état ouvert se lit
   alors par un halo autour de la forme, l'anneau du rond n'ayant plus de
   rond à entourer. */
.zmanim-fab-shaped {
  background-color: transparent;
  box-shadow: none;
}
.zmanim-fab-shaped.zmanim-fab-active :deep(.fab-shape) {
  filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--color-primary) 45%, transparent))
    drop-shadow(0 0 3px color-mix(in srgb, var(--color-primary) 55%, transparent));
}

/* Accueil : la maison gonfle d'aise, on arrive chez soi. */
.tab-icon-pop {
  animation: tab-icon-pop 0.35s ease;
}
@keyframes tab-icon-pop {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(0.75);
  }
  70% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}

/* Sidour : le livre penche puis se redresse (cf. tome-straighten). */
.tab-icon-sway {
  transform-origin: bottom center;
  animation: tab-icon-sway 0.45s ease-out;
}
@keyframes tab-icon-sway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  35% {
    transform: translateY(-1px) rotate(-12deg);
  }
  70% {
    transform: rotate(5deg);
  }
}

/* Étude : le lecteur se balance au-dessus de son livre, deux fois, comme on
   le fait en étudiant. */
.tab-icon-bow {
  transform-origin: bottom center;
  animation: tab-icon-bow 0.6s ease-in-out;
}
@keyframes tab-icon-bow {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(1.5px) rotate(7deg);
  }
  50% {
    transform: translateY(0) rotate(0deg);
  }
  75% {
    transform: translateY(1px) rotate(5deg);
  }
}

/* Profil : petit bond amical avec réception en douceur (cf. person-hop). */
.tab-icon-hop {
  animation: tab-icon-hop 0.4s ease;
}
@keyframes tab-icon-hop {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  20% {
    transform: translateY(0) scale(1.1, 0.85);
  }
  55% {
    transform: translateY(-4px) scale(0.95, 1.05);
  }
  85% {
    transform: translateY(0) scale(1.05, 0.92);
  }
}

/* --- The change replayed (what's new, useTabBarChange) ---
   One timeline of 3.6 s, every piece on its own delay:
   0.6 s   the library book crouches, then jumps (its label fades);
   0.85 s  it flies over the times circle to the Chiourim slot;
   1.7 s   it lands: the headphones and the book shrink into each other,
           a ring opens, the Étude reader pops out;
   2.5 s   Sidour rises in the empty slot, and the scene ends. */
.tabs-staged .tab-row > .tab-item {
  opacity: 0;
}
.tab-change {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  pointer-events: none;
}
/* Held: every movement waits at its first frame, the old bar. */
.tab-change-held,
.tab-change-held * {
  animation-play-state: paused !important;
}
.change-slot {
  flex: 1;
  min-width: 0;
}
.change-stack {
  position: relative;
  display: flex;
}
.change-stack > .tab-item {
  position: absolute;
  inset: 0;
}
.change-library {
  animation: library-leap 1.25s cubic-bezier(0.45, 0, 0.3, 1) 0.6s both;
}
.change-library-icon {
  animation: library-tumble 1.25s ease-in-out 0.6s both;
}
.change-library-label {
  animation: label-out 0.3s ease-in 0.7s both;
}
.change-chiourim {
  animation: chiourim-merge 0.4s ease-in 1.7s both;
}
.change-study-icon {
  animation: study-pop 0.55s cubic-bezier(0.3, 1.5, 0.55, 1) 1.95s both;
}
.change-study-label {
  animation: label-in 0.35s ease-out 2s both;
}
.change-burst {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.4rem;
  height: 2.4rem;
  margin: calc(-1.2rem - 7px) 0 0 -1.2rem;
  border-radius: 9999px;
  border: 2px solid var(--color-primary);
  opacity: 0;
  animation: burst 0.7s ease-out 1.85s both;
}
.change-sidour {
  animation: sidour-arrive 0.65s cubic-bezier(0.3, 1.4, 0.55, 1) 2.5s both;
}

/* The book crouches, jumps over the times circle in an arc, and lands on
   the other slot, shrinking into it. */
@keyframes library-leap {
  0% {
    transform: translate(0, 0) scale(1);
  }
  12% {
    transform: translate(0, 2px) scale(1.1, 0.85);
  }
  28% {
    transform: translate(calc(var(--hop) * 0.2), -30px) scale(1.05);
  }
  50% {
    transform: translate(calc(var(--hop) * 0.5), -46px) scale(1.1);
  }
  72% {
    transform: translate(calc(var(--hop) * 0.8), -26px) scale(0.95);
  }
  88% {
    transform: translate(var(--hop), 0) scale(0.75);
    opacity: 1;
  }
  100% {
    transform: translate(var(--hop), 0) scale(0.2);
    opacity: 0;
  }
}
@keyframes library-tumble {
  0%,
  14% {
    transform: rotate(0deg);
  }
  45% {
    transform: rotate(-14deg);
  }
  80%,
  100% {
    transform: rotate(8deg);
  }
}
@keyframes label-out {
  to {
    opacity: 0;
    transform: translateY(3px);
  }
}
@keyframes label-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes chiourim-merge {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  40% {
    transform: scale(1.12);
    opacity: 1;
  }
  100% {
    transform: scale(0.2);
    opacity: 0;
  }
}
@keyframes study-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
@keyframes burst {
  0% {
    opacity: 0.8;
    transform: scale(0.3);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}
@keyframes sidour-arrive {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.5);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab-icon-pop,
  .tab-icon-sway,
  .tab-icon-bow,
  .tab-icon-hop {
    animation: none;
  }
}
</style>
