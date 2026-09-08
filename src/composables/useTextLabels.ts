import { useI18n } from "vue-i18n";
import type { SectionHeading, TextBlock, TextSection } from "../services/textService";
import { formatNumberWithHebrew } from "../services/hebrewNumerals";

/**
 * Les titres des divisions d'un texte (« Chapitre 2 (ב) », « Daf 2a à 5b »)
 * écrits dans la langue du lecteur. textService les décrit sous forme
 * structurée (SectionHeading) et garde en `label` le libellé français que le
 * prérendu SEO sert aux moteurs ; ici, c'est la langue de l'interface qui
 * l'emporte, et le libellé français reste le repli des sections qui n'ont
 * pas de forme structurée (le nom d'un psaume, une montée nommée).
 */
export function useTextLabels() {
  const { t } = useI18n();

  function dafLabel(daf: string): string {
    return t("textReading.labels.daf", { daf });
  }

  function headingLabel(heading: SectionHeading | undefined, fallback: string): string {
    if (!heading) return fallback;
    switch (heading.kind) {
      case "chapter":
        return t("textReading.labels.chapter", { n: formatNumberWithHebrew(heading.n) });
      case "daf":
        return dafLabel(heading.daf);
      case "chapterDaf": {
        const chapter = t("textReading.labels.chapter", { n: formatNumberWithHebrew(heading.n) });
        const daf =
          heading.from === heading.to
            ? dafLabel(heading.from)
            : t("textReading.labels.dafRange", { from: heading.from, to: heading.to });
        return t("textReading.labels.chapterDaf", { chapter, daf });
      }
    }
  }

  const sectionLabel = (section: TextSection): string =>
    headingLabel(section.heading, section.label);
  const blockLabel = (block: TextBlock): string => headingLabel(block.heading, block.label);

  return { dafLabel, headingLabel, sectionLabel, blockLabel };
}
