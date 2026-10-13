import { useI18n } from "vue-i18n";
import type { Chiour, TextStudyJsonEntry } from "../models/models";
import { chapitreKind, chiourTexte, texteTitle } from "../services/chiourTexte";
import { formatNumberWithHebrew } from "../services/hebrewNumerals";

/**
 * Les mots du lien entre un cours et son texte, dans la langue du lecteur :
 * « Chaar Habita'hon · Chapitre 4 », « Paracha Vayetze · Montée 2 »,
 * « Pélé Yoets, Aleph · Sujet 11 ».
 */
export function useTexteLabels() {
  const { t, locale } = useI18n();

  function chapitreLabel(entry: TextStudyJsonEntry, chapitre: number): string {
    switch (chapitreKind(entry, chapitre)) {
      case "introduction":
        return t("chiourim.texte.introduction");
      case "topic":
        return t("chiourim.texte.topic", { n: chapitre });
      case "aliya":
        return t("chiourim.texte.aliya", { n: chapitre });
      default:
        return t("chiourim.texte.chapter", { n: formatNumberWithHebrew(chapitre) });
    }
  }

  function texteLabel(entry: TextStudyJsonEntry, chapitre: number | null): string {
    const title = texteTitle(entry, locale.value);
    return chapitre === null ? title : `${title} · ${chapitreLabel(entry, chapitre)}`;
  }

  /** Le texte d'un cours en une ligne, ou "" s'il n'en a pas. */
  function chiourTexteLabel(chiour: Chiour): string {
    const link = chiourTexte(chiour);
    return link ? texteLabel(link.entry, link.chapitre) : "";
  }

  return { chapitreLabel, texteLabel, chiourTexteLabel };
}
