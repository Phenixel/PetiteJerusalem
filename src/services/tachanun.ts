import { HDate, months, tachanun } from "@hebcal/core";

/**
 * Dit-on le tahanoun, office par office ?
 *
 * hebcal répond presque juste. Sa règle de base est la bonne : la veille d'un
 * jour sans tahanoun, on ne le dit pas non plus à Min'ha. Trois lendemains
 * font pourtant exception, et le tahanoun se dit quand même la veille à
 * Min'ha :
 *
 *  - la veille de Roch Hachana (29 Eloul) ;
 *  - la veille de Kippour (9 Tichri) ;
 *  - Pessah Cheni (14 Iyar).
 *
 * hebcal connaît ces trois jours (sa liste `yesPrev`), mais y range le
 * 29 Eloul de l'année précédente : aucune date n'a jamais ce jour-là pour
 * lendemain, et l'exception ne se déclenche donc jamais. Résultat, le 28 Eloul
 * l'application annonçait « pas de tahanoun à Min'ha » alors qu'on le dit.
 *
 * On refait donc la vérification ici, pour les trois jours, plutôt que
 * d'attendre la correction en amont. Les deux autres cas passent déjà : les
 * refaire ne change rien, et le jour où hebcal corrigera le premier, cette
 * fonction dira toujours la même chose.
 */
export interface TachanunSaid {
  shacharit: boolean;
  mincha: boolean;
}

/** Ce lendemain-là laisse-t-il le tahanoun à la Min'ha de la veille ? */
function keepsPreviousMincha(next: HDate): boolean {
  const day = next.getDate();
  switch (next.getMonth()) {
    case months.ELUL:
      return day === 29;
    case months.TISHREI:
      return day === 9;
    case months.IYYAR:
      return day === 14;
    default:
      return false;
  }
}

export function saidTachanun(hd: HDate, il: boolean): TachanunSaid {
  const said = tachanun(hd, il);
  // Le vendredi reste à l'écart : ce qui retient sa Min'ha, c'est le Chabbat
  // qui vient, pas le jour d'après.
  if (said.shacharit && !said.mincha && hd.getDay() !== 5 && keepsPreviousMincha(hd.next())) {
    return { shacharit: true, mincha: true };
  }
  return { shacharit: said.shacharit, mincha: said.mincha };
}

/**
 * Les clés d'occasion qui disent « le tahanoun se dit » (voir
 * dailyCycles.activeOccasions), et celle qui prend leur place.
 *
 * Le calendrier n'est pas seul à retirer le tahanoun : on ne le dit pas non
 * plus dans une maison de deuil, le jour d'une brit mila, devant un marié ou
 * un bar-mitsva. L'application ne peut pas le savoir ; le lecteur le lui dit
 * (réglage « sans tahanoun » du menu de lecture), et les occasions du jour
 * sont refaites comme si le calendrier l'avait retiré : ce qui tombe avec lui
 * (les supplications du lundi et du jeudi, El erekh apayim) tombe aussi, et
 * ce qui se dit à sa place (Yehi chem) vient à sa place.
 */
const TACHANUN_KEYS: Record<string, string> = {
  tahanoun: "sans-tahanoun",
  "tahanoun-minha": "sans-tahanoun-minha",
};
const WITH_TACHANUN_ONLY = ["tahanoun-ordinaire", "tahanoun-lundi-jeudi"];

/** Les occasions du jour, le tahanoun retiré comme un jour où il ne se dit pas. */
export function withoutTachanun(occasions: Set<string>): Set<string> {
  const result = new Set(occasions);
  for (const [said, notSaid] of Object.entries(TACHANUN_KEYS)) {
    if (result.delete(said)) result.add(notSaid);
  }
  for (const key of WITH_TACHANUN_ONLY) result.delete(key);
  return result;
}
