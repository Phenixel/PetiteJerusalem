import { HDate, getHolidaysOnDate, months, tachanun } from "@hebcal/core";

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
 * S'y ajoute le 9 au 12 Sivan, pour une autre raison : voir `isTashlumin`.
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

/**
 * Les jours de tachloumin, après Chavou'ot.
 *
 * hebcal range le 1er au 8 Sivan parmi les jours où AUCUNE communauté ne dit
 * le tahanoun, et le 9 au 13 parmi ceux où CERTAINES l'omettent seulement.
 * Cette seconde nuance, il la porte dans un champ à part (`allCongs`) que ses
 * réponses `shacharit` et `mincha` ignorent : l'application annonçait donc
 * « On dit Ta'hanoun » du 9 au 12 Sivan.
 *
 * Or on ne le dit pas : les sept jours de tachloumin, pendant lesquels on
 * pouvait encore monter l'offrande de la fête, courent jusqu'au 12 Sivan, et
 * l'usage séfarade comme achkénaze est de ne pas dire le tahanoun tant qu'ils
 * durent. Le 13, il reprend.
 *
 * Les autres jours que hebcal signale de la même façon (Pessah Cheni, du 25
 * au 30 Tichri, Yom haAtsmaout, Yom Yerouchalayim) gardent sa réponse : là,
 * l'usage est réellement partagé.
 */
const TASHLUMIN_LAST_DAY = 12;

function isTashlumin(hd: HDate): boolean {
  return hd.getMonth() === months.SIVAN && hd.getDate() <= TASHLUMIN_LAST_DAY;
}

/**
 * Le lendemain de 'Hanouka, que hebcal laisse encore sans tahanoun.
 *
 * hebcal retire le tahanoun « du 25 au 33 Kislev », sans regarder si Kislev
 * compte 29 ou 30 jours. Or 'Hanouka dure huit jours, pas neuf : quand Kislev
 * est plein, elle finit le 2 Tévet et le 33e jour déborde sur le 3 ; quand il
 * est creux, elle finit le 3 Tévet et le débordement tombe sur le 4. Un
 * dimanche de décembre 2026, l'application annonçait donc « Pas de
 * Ta'hanoun » un jour où il se dit.
 *
 * Le test ne peut pas être le drapeau des bougies : le DERNIER jour de
 * 'Hanouka (« Chanukah: 8th Day ») ne le porte pas, puisqu'on n'y allume plus
 * rien. C'est le nom de l'événement qui tranche, et lui seul.
 */
const CHANUKAH = "Chanukah";
const TEVET_OVERFLOW_DAYS = [3, 4];

function isChanukahOverflow(hd: HDate, il: boolean): boolean {
  if (hd.getMonth() !== months.TEVET || !TEVET_OVERFLOW_DAYS.includes(hd.getDate())) return false;
  return !(getHolidaysOnDate(hd, il) ?? []).some((ev) => ev.basename() === CHANUKAH);
}

/**
 * Chouchan Pourim Katan, le 15 Adar I des années à treize mois.
 *
 * Le Choul'han Aroukh (Ora'h 'Haïm 697, 1) omet le tahanoun les 14 ET 15
 * Adar I. hebcal ne connaît que le 14 : l'application disait le tahanoun le
 * 15, lundi 22 février 2027 par exemple.
 */
function isShushanPurimKatan(hd: HDate): boolean {
  return hd.getMonth() === months.ADAR_I && hd.getDate() === 15 && hd.isLeapYear();
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
  if (isTashlumin(hd) || isShushanPurimKatan(hd)) return { shacharit: false, mincha: false };
  // Le lendemain de 'Hanouka : on ne lit pas hebcal pour ce jour-là, il s'y
  // trompe. Le tahanoun s'y dit, et sa Min'ha suit la règle ordinaire, celle
  // qui regarde le lendemain.
  if (isChanukahOverflow(hd, il)) {
    const next = hd.next();
    return {
      shacharit: true,
      mincha:
        hd.getDay() !== 5 && (saidTachanun(next, il).shacharit || keepsPreviousMincha(next)),
    };
  }
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
