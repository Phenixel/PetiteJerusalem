import { computed, ref } from "vue";
import { analyticsService } from "../services/analyticsService";
import type { KlafKind } from "../services/textService";

/**
 * Le parchemin (klaf) qu'on ouvre depuis le fil du sidour : le pitoum
 * haketoret tel qu'un sofer l'écrit, le psaume 67 écrit en forme de menora.
 *
 * Beaucoup lisent ces deux passages sur un parchemin plutôt que dans le
 * sidour : la ketoret dans la graphie du sofer, le Lamnatséa'h en regardant
 * la menora dans laquelle il est écrit. Le paragraphe du fil porte la
 * commande qui ouvre le parchemin (voir KlafViewer.vue) ; c'est la seule
 * porte : le menu de lecture ne le propose pas, on n'ouvre un parchemin qu'à
 * l'endroit où on le lit.
 *
 * Même forme que la boussole du Kotel et le miroir des téfilines : un état
 * partagé à l'échelle de l'app, parce que le paragraphe qui ouvre la fenêtre
 * et la fenêtre elle-même vivent dans des arbres de composants séparés.
 */

const current = ref<KlafKind | null>(null);

/** Le parchemin ouvert, ou null quand la fenêtre est fermée. */
export const klafOpen = computed(() => current.value);

export function openKlaf(kind: KlafKind): void {
  current.value = kind;
  analyticsService.capture("klaf_opened", { kind });
}

export function closeKlaf(): void {
  current.value = null;
}

/**
 * Les clés de traduction de chaque parchemin, écrites en clair : c'est sous
 * leur nom, entre guillemets, que le test des clés inutilisées les retrouve.
 */
export const KLAF_LABELS: Record<KlafKind, { open: string; title: string }> = {
  ketoret: { open: "textReading.klaf.ketoret.open", title: "textReading.klaf.ketoret.title" },
  menora: { open: "textReading.klaf.menora.open", title: "textReading.klaf.menora.title" },
};

/** L'icône de chaque parchemin, sur la commande du paragraphe. */
export const KLAF_ICONS = { ketoret: "scroll", menora: "menorah" } as const;
