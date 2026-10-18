<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
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
import { HUMP_HEIGHT, HUMP_WIDTH, humpPoints } from "../composables/tabBarHump";

const { t } = useI18n();

/** The bump of the bar over the round button: its fill, and its edge. */
const hump = (() => {
  // The flat edge lies on the bar's top border, which the bump continues;
  // the fill goes on under it, hiding the border where the bump rises.
  const points = humpPoints(HUMP_HEIGHT + 0.5);
  const line = points.map(([x, y]) => `${x},${y.toFixed(2)}`).join(" L");
  return {
    edge: `M${line}`,
    fill: `M${line} L${HUMP_WIDTH},${HUMP_HEIGHT + 3} L0,${HUMP_HEIGHT + 3} Z`,
  };
})();
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
    :aria-label="t('navbar.mainMenu')"
  >
    <!-- The white of the bar rises over the round button rather than the
         button sticking out of it; the reading progress line rides over the
         same bump (tabBarHump). -->
    <svg
      class="tab-hump"
      :width="HUMP_WIDTH"
      :height="HUMP_HEIGHT + 3"
      :viewBox="`0 0 ${HUMP_WIDTH} ${HUMP_HEIGHT + 3}`"
      aria-hidden="true"
    >
      <path :d="hump.fill" class="fill-surface" />
      <path :d="hump.edge" class="tab-hump-edge stroke-black/5 dark:stroke-white/10" />
    </svg>
    <div class="relative flex items-stretch h-14">
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

/* The bump over the round button: centered on it, its foot over the bar's
   top border. */
.tab-hump {
  position: absolute;
  bottom: calc(100% - 2px);
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}
.tab-hump-edge {
  fill: none;
  stroke-width: 1px;
}

/* The round button in the middle of the bar: it rises a little above the
   tabs to stand apart, the white of the bar's bump around it. */
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

@media (prefers-reduced-motion: reduce) {
  .tab-icon-pop,
  .tab-icon-sway,
  .tab-icon-bow,
  .tab-icon-hop {
    animation: none;
  }
}
</style>
