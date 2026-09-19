import { computed, ref } from "vue";
import { devicePreference } from "../services/devicePreference";
import { isNativeApp } from "./useNativeApp";

/**
 * Les astuces : ce qu'une page montre la première fois qu'on y arrive.
 *
 * L'introduction de première ouverture (useOnboarding) dit ce que l'app
 * contient. Elle ne peut pas dire comment chaque écran se manie : une ligne
 * d'horaire qui se tire vers la gauche pour poser un rappel, le bouton rond
 * d'une page de lecture qui ouvre le sommaire et les réglages. Personne ne
 * devine un geste, et une commande qu'on ne connaît pas ne sert à personne.
 *
 * Une astuce se joue donc sur la page même, devant la commande qu'elle
 * explique : un voile assombrit le reste, un projecteur découpe la commande,
 * et une bulle en quelques mots dit ce qu'elle fait (voir FeatureTour.vue).
 * Une astuce peut compter plusieurs pas (suivant), et se passe d'un geste.
 *
 * App native seulement, comme l'introduction : le site se visite le plus
 * souvent par une page précise venue d'un moteur de recherche, et une bulle
 * en travers d'un texte qu'on est venu lire est une gêne, pas une aide. Un
 * paramètre d'adresse (`?tips`, ou `?tips=reading-menu` pour une seule) les
 * force partout, pour les montrer et les essayer sur les canaux de preview.
 *
 * Trois règles tiennent la mesure, pour qu'une aide ne devienne pas un
 * harcèlement :
 *
 *  - chaque astuce ne se montre qu'une fois : l'appareil retient celles
 *    qu'il a vues, dans les deux stockages (voir devicePreference), car une
 *    astuce qui reviendrait à chaque vidage de cache finirait par agacer.
 *    « Revoir les astuces » (onglet À propos) efface cette mémoire ;
 *  - une seule astuce par ouverture de l'app : quatre bulles à la suite en
 *    changeant de page, c'est un tutoriel qu'on n'a pas demandé. La suivante
 *    attend la prochaine ouverture (voir `launchSpent`) ;
 *  - « Me le rappeler à la prochaine ouverture » remet l'astuce à plus tard
 *    sans la marquer vue : on n'a pas toujours le temps de lire, et l'astuce
 *    revient, à la prochaine ouverture, sur la même page.
 *
 * Une astuce peut aussi en attendre une autre (`after`) : sur une page de
 * lecture, les gestes ne s'expliquent qu'après le menu, une ouverture plus
 * tard, pour que chaque astuce reste courte.
 */

/** Les astuces connues, par page. Ajouter une entrée suffit à en créer une. */
export type FeatureTipId =
  | "home-settings"
  | "zmanim-reminder"
  | "reading-menu"
  | "reading-gestures";

const STORAGE_KEY = "pj_tips_seen";

export const TIP_IDS: readonly FeatureTipId[] = [
  "home-settings",
  "zmanim-reminder",
  "reading-menu",
  "reading-gestures",
];

/**
 * Ce qui vaut une nouvelle ouverture sans relancer l'app : un retour au
 * premier plan après une demi-heure ailleurs. L'app native reste des jours
 * en arrière-plan sans être relancée ; « la prochaine ouverture » ne peut pas
 * attendre que le système la tue.
 */
export const NEW_OPENING_AFTER_MS = 30 * 60 * 1000;

function parseSeen(raw: string | null): FeatureTipId[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is FeatureTipId => TIP_IDS.includes(id as FeatureTipId));
  } catch {
    return null;
  }
}

const seenStore = devicePreference<FeatureTipId[]>(STORAGE_KEY, parseSeen, JSON.stringify);

const seen = ref<FeatureTipId[]>(seenStore.read() ?? []);

/** Paramètre d'adresse qui force les astuces, où qu'on soit. */
const URL_PARAM = "tips";

/** Toutes les astuces (`?tips`), ou une seule (`?tips=reading-menu`), ou rien. */
function askedByUrl(): "all" | FeatureTipId | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (value === null) return null;
  return TIP_IDS.includes(value as FeatureTipId) ? (value as FeatureTipId) : "all";
}

const forcedByUrl = ref(askedByUrl());

const isForced = (id: FeatureTipId) => forcedByUrl.value === "all" || forcedByUrl.value === id;

/** Les astuces ont-elles lieu d'être sur cette plateforme ? */
export const tipsOffered = computed(() => isNativeApp || forcedByUrl.value !== null);

/** Une astuce s'est déjà montrée depuis cette ouverture de l'app. */
let launchSpent = false;

/** L'astuce à l'écran en ce moment : jamais deux bulles l'une sur l'autre. */
let activeTip: FeatureTipId | null = null;

/** Quand l'app est passée en arrière-plan, pour compter une nouvelle ouverture. */
let hiddenAt: number | null = null;

function onVisibilityChange(): void {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt !== null && Date.now() - hiddenAt >= NEW_OPENING_AFTER_MS) launchSpent = false;
  hiddenAt = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibilityChange);
}

/**
 * Au premier lancement de l'app native, le localStorage peut avoir été vidé :
 * les préférences natives rendent la liste des astuces vues. Une seule fois
 * par lancement, et tous les appelants attendent la même promesse.
 */
let restored: Promise<void> | null = null;

export function restoreFeatureTips(): Promise<void> {
  if (!restored) {
    restored = seenStore.restore().then((saved) => {
      // Ce que le natif rend s'ajoute à ce que la session a déjà noté : une
      // astuce vue pendant que le plugin répondait ne doit pas revenir.
      if (saved) seen.value = Array.from(new Set([...seen.value, ...saved]));
    });
  }
  return restored;
}

/** Pour les tests : oublie la relecture native, l'ouverture, et relit le stockage. */
export function resetFeatureTipsForTests(): void {
  restored = null;
  launchSpent = false;
  activeTip = null;
  hiddenAt = null;
  seen.value = seenStore.read() ?? [];
  forcedByUrl.value = askedByUrl();
}

export function useFeatureTips() {
  /**
   * L'astuce doit-elle se montrer ? Attend la relecture native si besoin.
   * `after` : les astuces qui doivent avoir été vues avant celle-ci.
   */
  async function shouldShowTip(id: FeatureTipId, after: FeatureTipId[] = []): Promise<boolean> {
    if (!tipsOffered.value) return false;
    // Forcée par l'adresse, l'astuce se montre même déjà vue : c'est le but.
    if (isForced(id)) return true;
    await restoreFeatureTips();
    if (seen.value.includes(id)) return false;
    if (after.some((other) => !seen.value.includes(other))) return false;
    return !launchSpent;
  }

  /**
   * L'astuce paraît : elle prend l'ouverture, et l'écran. Faux si une autre
   * est déjà à l'écran, ou si l'ouverture vient d'être prise entre-temps.
   */
  function claimTip(id: FeatureTipId): boolean {
    if (activeTip !== null && activeTip !== id) return false;
    if (launchSpent && !isForced(id)) return false;
    activeTip = id;
    launchSpent = true;
    return true;
  }

  /** L'astuce a quitté l'écran, vue ou remise à plus tard. */
  function releaseTip(id: FeatureTipId): void {
    if (activeTip === id) activeTip = null;
  }

  function markTipSeen(id: FeatureTipId): void {
    if (seen.value.includes(id)) return;
    seen.value = [...seen.value, id];
    seenStore.write(seen.value);
  }

  /** « Revoir les astuces » : elles se montreront à nouveau, page par page. */
  function resetFeatureTips(): void {
    seen.value = [];
    seenStore.write([]);
    launchSpent = false;
  }

  return { shouldShowTip, claimTip, releaseTip, markTipSeen, resetFeatureTips, tipsOffered };
}
