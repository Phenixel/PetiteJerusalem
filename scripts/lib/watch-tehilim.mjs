/**
 * Les Tehilim, préparés pour les apps de montre (Wear OS et watchOS).
 *
 * La montre embarque les 150 psaumes plutôt que de les recevoir du téléphone :
 * ils ne changent jamais, ils pèsent trois cents kilo-octets, et les faire
 * voyager à chaque changement de langue coûterait de la bande passante et de
 * la batterie pour rien. Embarqués, ils se lisent sans téléphone à portée.
 *
 * Le fichier de `public/texts/` vient de Sefaria et porte la mise en forme de
 * sa source (balises de note, entités HTML, marqueurs de paracha). L'app la
 * retire à l'affichage (`cleanText` dans src/services/textService.ts) ; on la
 * retire ici une fois pour toutes, pour que le natif n'ait aucune règle de
 * texte à tenir, et pour qu'aucune des deux plateformes n'en invente une
 * variante. Les deux nettoyages doivent rester d'accord : c'est ce que
 * vérifie src/__tests__/watchTehilim.test.ts, sur le corpus entier.
 *
 * Ce module ne touche pas au disque : il prend le JSON de Sefaria, il en rend
 * un autre. De quoi le tester sans montre (comme scripts/lib/xcode-widgets.mjs).
 */

/** Le livre en compte 150, et l'asset embarqué les porte tous. */
export const TEHILIM_CHAPTERS = 150;

/** Nom du fichier embarqué, des deux côtés. */
export const TEHILIM_ASSET = "tehilim.json";

/**
 * Le nettoyage de `cleanText` (src/services/textService.ts), à l'identique et
 * dans le même ordre : les remplacements ne commutent pas (retirer les balises
 * avant les entités, sans quoi un `&lt;i&gt;` deviendrait une balise).
 */
export function cleanTehilimLine(line) {
  return line
    .replace(/<[^>]*>/g, "") // balises HTML (notes, mise en forme)
    .replace(/\{[א-ת]\}/g, "") // marqueurs de paracha (petou'ha / setouma)
    .replace(/&thinsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Le livre prêt à embarquer : `{ "1": ["verset", …], … }`, numéros de chapitre
 * en clés (des chaînes, JSON oblige) et versets nettoyés, les vides retirés.
 *
 * Échoue si un chapitre manque : mieux vaut un setup qui s'arrête qu'une
 * montre qui ouvre un psaume vide.
 */
export function buildTehilimAsset(raw) {
  const book = {};
  for (let chapter = 1; chapter <= TEHILIM_CHAPTERS; chapter++) {
    const entry = raw[String(chapter)];
    const lines = (entry?.he ?? []).map(cleanTehilimLine).filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new Error(`Tehilim ${chapter} absent ou vide de public/texts/tehilim.json`);
    }
    book[String(chapter)] = lines;
  }
  return book;
}
