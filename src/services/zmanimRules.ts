import { numberFormat } from "./intlCache";
import type { EndRule, RabbenouTamRule } from "./zmanimOpinions";

/**
 * Comment DIRE la règle qu'un avis a posée avec l'heure.
 *
 * Le cadre du repos et celui du jeûne affichent tous deux une sortie, et tous
 * deux la font suivre d'une note qui explique comment elle est comptée. Cette
 * note ne peut pas être écrite en dur : la règle change avec l'avis suivi ET
 * avec le lieu (l'Or Ha'Haïm en Israël, l'Amudei Horaah ailleurs, voir
 * zmanimOpinions). Elle est donc calculée avec l'heure, puis traduite ici,
 * au même endroit pour les deux cadres : une seule règle, une seule phrase.
 *
 * Avant ce détour, la note annonçait « à la sortie des étoiles » pendant que
 * le cadre affichait quarante minutes après la chkia.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Les degrés écrits dans la langue de l'interface : « 8,5 » et non « 8.5 ». */
const degreesIn = (locale: string, degrees: number): string =>
  numberFormat(locale, { maximumFractionDigits: 3 }).format(degrees);

/** La phrase qui dit comment une sortie ou une fin de jeûne est comptée. */
export function describeEndRule(rule: EndRule, t: Translate, locale: string): string {
  switch (rule.kind) {
    case "degrees":
      return t("zmanim.endRule.degrees", { degrees: degreesIn(locale, rule.degrees) });
    case "fixed":
      return t("zmanim.endRule.fixed", { minutes: rule.minutes });
    case "zmaniyot":
      return t("zmanim.endRule.zmaniyot", { minutes: rule.minutes });
    case "equinoxDegrees":
      return t("zmanim.endRule.equinoxDegrees", { degrees: degreesIn(locale, rule.degrees) });
    case "amudeiHoraah":
      return t("zmanim.endRule.amudeiHoraah", {
        degrees: degreesIn(locale, rule.degrees),
        minutes: rule.floorMinutes,
      });
  }
}

/**
 * La phrase qui dit comment la sortie de Rabbénou Tam est comptée.
 *
 * Les clés sont écrites en toutes lettres, et non composées : `i18nUsage`
 * balaye les sources pour vérifier que chaque clé de la locale a bien un
 * lecteur, et une clé construite lui échappe.
 */
const RABBENOU_TAM_KEYS: Record<RabbenouTamRule, string> = {
  fixed: "zmanim.rest.rabbenouTamNote.fixed",
  zmaniyot: "zmanim.rest.rabbenouTamNote.zmaniyot",
  earliest: "zmanim.rest.rabbenouTamNote.earliest",
};

export function describeRabbenouTamRule(rule: RabbenouTamRule, t: Translate): string {
  return t(RABBENOU_TAM_KEYS[rule]);
}
