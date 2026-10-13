/**
 * Les outils du Sidour : de petits instruments qui servent pendant qu'on
 * prie, à côté des textes. La direction du Kotel, le miroir des téfilines,
 * les six côtés du na'anou'a.
 *
 * Chacun s'ouvre aussi depuis le texte où il sert (le titre de la 'Amida, la
 * pose des téfilines, les brahot du loulav) ; la page du Sidour les réunit,
 * pour qui les cherche sans passer par un office : le voyageur qui veut
 * savoir de quel côté se tourner, celui qui pose ses téfilines avant d'ouvrir
 * son sidour.
 *
 * Ajouter un outil : une entrée ici, sa fenêtre et son ouverture dans
 * SidourPage (`TOOL_OPENERS`) et, s'il a un moment ou une saison, sa règle
 * dans services/sidourMoment (`momentTools`). Le reste suit : la rangée, son
 * ordre, la mesure d'audience.
 */
import type { IconName } from "../components/icons/registry";

export type SidourToolId = "kotel" | "tefilin" | "naanouim";

export interface SidourTool {
  id: SidourToolId;
  /** Le même dessin que la pastille du texte : un outil se reconnaît partout. */
  icon: IconName;
  /** Son nom entier : sur la page, aucun titre de passage ne le précise. */
  labelKey: string;
  /**
   * Un outil de saison ne se propose que le temps de sa fête (voir
   * `momentTools`) ; hors saison, il reste au texte qui le porte.
   */
  seasonal: boolean;
}

/** Les outils, dans l'ordre où la rangée les pose quand aucun n'a son moment. */
export const SIDOUR_TOOLS: readonly SidourTool[] = [
  { id: "kotel", icon: "compass", labelKey: "textReading.kotel.title", seasonal: false },
  { id: "tefilin", icon: "mirror", labelKey: "textReading.mirror.title", seasonal: false },
  { id: "naanouim", icon: "compass", labelKey: "textReading.naanouim.title", seasonal: true },
];

/**
 * La rangée : les outils du moment d'abord, dans l'ordre donné, puis les
 * autres dans celui du registre. Un outil de saison n'y entre que s'il est de
 * saison.
 */
export function orderTools(
  first: readonly SidourToolId[],
  inSeason: ReadonlySet<SidourToolId>,
): SidourToolId[] {
  const offered = SIDOUR_TOOLS.filter((tool) => !tool.seasonal || inSeason.has(tool.id)).map(
    (tool) => tool.id,
  );
  const lead = first.filter((id, i) => offered.includes(id) && first.indexOf(id) === i);
  return [...lead, ...offered.filter((id) => !lead.includes(id))];
}
