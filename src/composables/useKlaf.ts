import { computed, ref } from "vue";
import { analyticsService } from "../services/analyticsService";
import type { KlafKind } from "../services/textService";

/**
 * Le parchemin (klaf) qu'on ouvre depuis le fil du sidour : le pitoum
 * haketoret tel qu'un sofer l'écrit, le psaume 67 écrit en forme de menora.
 *
 * Beaucoup lisent ces deux passages sur un parchemin plutôt que dans le
 * sidour : la ketoret dans la graphie du sofer, le Lamnatséa'h en regardant
 * la menora dans laquelle il est écrit. Le paragraphe du fil porte une
 * commande qui ouvre le parchemin (voir KlafViewer.vue), et le menu de lecture
 * l'offre aussi, une fois qu'on a commencé à lire et que le paragraphe est
 * loin.
 *
 * Même forme que la boussole du Kotel et le miroir des téfilines : un état
 * partagé à l'échelle de l'app, parce que le paragraphe qui ouvre la fenêtre,
 * le menu et la fenêtre elle-même vivent dans des arbres de composants
 * séparés.
 */

const current = ref<KlafKind | null>(null);

/** Le parchemin ouvert, ou null quand la fenêtre est fermée. */
export const klafOpen = computed(() => current.value);

/** D'où l'on ouvre le parchemin : le paragraphe du texte, ou le menu de lecture. */
export type KlafSource = "text" | "menu";

export function openKlaf(kind: KlafKind, source: KlafSource): void {
  current.value = kind;
  analyticsService.capture("klaf_opened", { kind, source });
}

export function closeKlaf(): void {
  current.value = null;
}

/** Les deux parchemins, dans l'ordre où le menu les propose. */
export const KLAF_KINDS: readonly KlafKind[] = ["ketoret", "menora"];

/**
 * Les clés de traduction de chaque parchemin, écrites en clair : c'est sous
 * leur nom, entre guillemets, que le test des clés inutilisées les retrouve.
 */
export const KLAF_LABELS: Record<KlafKind, { open: string; title: string }> = {
  ketoret: { open: "textReading.klaf.ketoret.open", title: "textReading.klaf.ketoret.title" },
  menora: { open: "textReading.klaf.menora.open", title: "textReading.klaf.menora.title" },
};

/** L'icône de chaque parchemin, la même au paragraphe et au menu. */
export const KLAF_ICONS = { ketoret: "scroll", menora: "menorah" } as const;

// Lecteurs à l'écran qui portent chaque parchemin : un compteur plutôt qu'un
// drapeau, le temps qu'une page de lecture remplace l'autre (la suivante se
// monte avant que la précédente ne se démonte).
const offering = ref<Record<KlafKind, number>>({ ketoret: 0, menora: 0 });

export function addKlafOffer(kind: KlafKind): void {
  offering.value[kind] += 1;
}

export function removeKlafOffer(kind: KlafKind): void {
  offering.value[kind] = Math.max(0, offering.value[kind] - 1);
}

/**
 * Les parchemins que le texte lu porte : le menu de lecture les propose. Un
 * texte sans ketoret ni Lamnatséa'h (une guemara, les Tehilim) n'en offre
 * aucun.
 */
export const klafOffered = computed(() => KLAF_KINDS.filter((kind) => offering.value[kind] > 0));
