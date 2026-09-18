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
 * paramètre d'adresse (`?tips`) les force partout, pour les montrer et les
 * essayer sur les canaux de preview.
 *
 * Chaque astuce ne se montre qu'une fois : l'appareil retient celles qu'il a
 * vues, dans les deux stockages (voir devicePreference), car une astuce qui
 * reviendrait à chaque vidage de cache finirait par agacer. « Revoir les
 * astuces » (onglet À propos) efface cette mémoire.
 */

/** Les astuces connues, par page. Ajouter une entrée suffit à en créer une. */
export type FeatureTipId = "zmanim-reminder" | "reading-menu";

const STORAGE_KEY = "pj_tips_seen";

const TIP_IDS: readonly FeatureTipId[] = ["zmanim-reminder", "reading-menu"];

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

function askedByUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(URL_PARAM);
}

const forcedByUrl = ref(askedByUrl());

/** Les astuces ont-elles lieu d'être sur cette plateforme ? */
export const tipsOffered = computed(() => isNativeApp || forcedByUrl.value);

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

/** Pour les tests : oublie la relecture native et relit le stockage. */
export function resetFeatureTipsForTests(): void {
  restored = null;
  seen.value = seenStore.read() ?? [];
  forcedByUrl.value = askedByUrl();
}

export function useFeatureTips() {
  /** L'astuce doit-elle se montrer ? Attend la relecture native si besoin. */
  async function shouldShowTip(id: FeatureTipId): Promise<boolean> {
    if (!tipsOffered.value) return false;
    // Forcée par l'adresse, l'astuce se montre même déjà vue : c'est le but.
    if (forcedByUrl.value) return true;
    await restoreFeatureTips();
    return !seen.value.includes(id);
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
  }

  return { shouldShowTip, markTipSeen, resetFeatureTips, tipsOffered };
}
