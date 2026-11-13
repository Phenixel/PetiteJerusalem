/**
 * Écrit `src/datas/parcoursUnits.json` : ce que compte chaque texte qu'on peut
 * se donner à finir dans Mon parcours, chapitre par chapitre.
 *
 * Un programme (« finir le séder Moed d'ici Roch Hachana ») se découpe en
 * portions : des michnayot pour la Michna, des côtés de daf pour la Guemara,
 * des chapitres pour le Tanakh. Dire chaque jour « Chabbat 7:1 à 7:3 » sans
 * charger douze traités demande de savoir, d'avance et hors ligne, combien
 * chaque chapitre en compte. Ce fichier le dit, pour tous les textes.
 *
 * Il se tire des textes eux-mêmes (`public/texts/`), jamais du catalogue :
 * `totalSections` y est faux pour trois traités de la Michna (Bikourim,
 * Avot, Midot), et le compte de michnayot n'y figure pas.
 *
 * Lancer avec : node scripts/parcours-units.mjs [--check]
 *
 * `--check` ne réécrit rien : il échoue si le fichier ne correspond plus aux
 * textes, ce que vérifie src/__tests__/parcoursUnits.test.ts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEXTS = join(RACINE, "public", "texts");
const CATALOGUE = join(RACINE, "src", "datas", "textStudies.json");
const SORTIE = join(RACINE, "src", "datas", "parcoursUnits.json");

const SEFARIA = "https://www.sefaria.org/";

/** Même règle que tractateSlug (services/textService.ts). */
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/['’‘`]/g, "");

const nomDuLien = (link, sansMishnah = false) => {
  let name = link.replace(SEFARIA, "");
  if (sansMishnah) name = name.replace(/^Mishnah_/, "");
  return name.replace(/_/g, " ");
};

const lire = (chemin) => JSON.parse(readFileSync(chemin, "utf-8"));

/** Les livres de la Torah se lisent par paracha : ils ne se finissent pas ici. */
const LIVRES_DE_LA_TORAH = new Set(["Berechit", "Chemot", "Vayikra", "Bamidbar", "Devarim"]);

function construire() {
  const { textStudies } = lire(CATALOGUE);
  const chapitresDuTalmud = lire(join(TEXTS, "talmud-chapters.json"));
  const unites = {};
  for (const entry of textStudies) {
    const id = String(entry.id);
    if (entry.type === "Mishna") {
      const fichier = join(TEXTS, "mishna", `${slug(nomDuLien(entry.link, true))}.json`);
      if (!existsSync(fichier)) continue;
      const { he } = lire(fichier);
      unites[id] = { unit: "mishna", sizes: he.map((chapitre) => chapitre.length) };
    } else if (entry.type === "Talmud Bavli") {
      const perakim = chapitresDuTalmud[slug(nomDuLien(entry.link))];
      if (!perakim?.length) continue;
      unites[id] = {
        unit: "amud",
        first: perakim[0].startIdx,
        sizes: perakim.map((perek) => perek.endIdx - perek.startIdx + 1),
      };
    } else if (entry.type === "Tanakh" && !LIVRES_DE_LA_TORAH.has(entry.livre)) {
      const fichier = join(TEXTS, "tanakh", `${entry.id}.json`);
      if (!existsSync(fichier)) continue;
      unites[id] = { unit: "chapter", count: lire(fichier).he.length };
    }
  }
  return unites;
}

const serialise = `${JSON.stringify(construire())}\n`;

if (process.argv.includes("--check")) {
  let actuel = null;
  try {
    actuel = readFileSync(SORTIE, "utf-8");
  } catch {
    // Fichier absent : le message ci-dessous dit quoi faire.
  }
  if (actuel !== serialise) {
    console.error(
      "parcours-units: src/datas/parcoursUnits.json ne correspond plus aux textes.\n" +
        "Lancez « node scripts/parcours-units.mjs » et validez le fichier obtenu :\n" +
        "sans lui, les portions d'un programme ne tomberaient plus sur les bons chapitres.",
    );
    process.exit(1);
  }
} else {
  writeFileSync(SORTIE, serialise);
  console.log(`parcours-units: ${SORTIE}`);
}
