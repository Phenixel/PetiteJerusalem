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
