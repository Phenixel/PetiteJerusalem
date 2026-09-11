#!/usr/bin/env node
/**
 * Régénère `src/datas/hiloulot.json` et `src/datas/hiloulot.he.json`, les
 * hiloulot (jours de disparition) des grands rabbanim, jour hébraïque par jour
 * hébraïque.
 *
 * D'où vient la liste : du calendrier « Rabbi Ovadiah Yosef Calendar »
 * d'Elyahu Jacobi, publié sous licence MIT, lui-même compilé du calendrier
 * Or Ha'Haïm et de plusieurs recensements (le fichier d'origine cite ses
 * sources entrée par entrée). C'est la seule liste de cette ampleur qu'on
 * trouve sous une licence qui en permette la reprise ; la mention de licence
 * voyage avec elle dans `src/datas/hiloulot.LICENSE.txt`.
 *
 * Ce que le script garde : les NOMS, rien d'autre. Le fichier d'origine porte
 * aussi une notice biographique par rabbin, longue et reprise de sites tiers :
 * elle n'a pas sa place ici, ni par le poids (1 Mo par langue), ni par le
 * droit.
 *
 * La clé est le mois et le jour hébraïques sur quatre chiffres, `MMJJ`, avec
 * la numérotation de hebcal, qui ouvre l'année à Nissan : 0101 est le 1er
 * Nissan, 1220 le 20 Adar, 13xx Adar II. Voir services/hiloulot.ts pour la
 * façon dont une date de l'année en cours retrouve sa clé.
 *
 * Usage : node scripts/generate-hiloulot.mjs
 * (le résultat est versionné : ce script ne tourne qu'à la mise à jour)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = "https://raw.githubusercontent.com/Elyahu41/RabbiOvadiahYosefCalendarApp/master";
const SOURCES = [
  { url: `${REPO}/app/src/main/res/raw/en.json`, out: "hiloulot.json", label: "latin" },
  { url: `${REPO}/app/src/main/res/raw/he.json`, out: "hiloulot.he.json", label: "hébreu" },
];

const DATAS = join(import.meta.dirname, "..", "src", "datas");

/** Les mois hébraïques, dans la numérotation hebcal (Nissan = 1, Adar II = 13). */
const MONTHS = 13;
/** Le plus grand jour qu'un mois hébraïque puisse porter. */
const MAX_DAY = 30;

/** Une clé bien formée : deux chiffres de mois, deux chiffres de jour. */
function validKey(key) {
  if (!/^\d{4}$/.test(key)) return false;
  const month = Number(key.slice(0, 2));
  const day = Number(key.slice(2));
  return month >= 1 && month <= MONTHS && day >= 1 && day <= MAX_DAY;
}

/**
 * Le nom, aux espaces resserrés et sans tiret long : la source en porte une
 * vingtaine, là où elle accole un surnom au nom ("Rav X \u2013 le Y"), et le
 * dépôt n'en veut nulle part (voir CLAUDE.md). Un trait d'union les remplace,
 * comme dans le reste de la liste.
 */
function cleanName(name) {
  return String(name)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

for (const source of SOURCES) {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`generate-hiloulot: ${source.url} a répondu ${response.status}`);
  }
  const raw = await response.json();

  const days = {};
  let total = 0;
  let skipped = 0;
  for (const [key, entries] of Object.entries(raw)) {
    if (!validKey(key) || !Array.isArray(entries)) {
      skipped++;
      continue;
    }
    const names = [];
    for (const entry of entries) {
      const name = cleanName(entry?.name ?? "");
      // Un doublon dans la source : deux recensements ont nommé le même rav.
      if (name && !names.includes(name)) names.push(name);
    }
    if (names.length === 0) continue;
    days[key] = names;
    total += names.length;
  }

  const out = join(DATAS, source.out);
  writeFileSync(out, `${JSON.stringify(days, null, 0)}\n`, "utf8");
  console.log(
    `generate-hiloulot: ${total} hiloulot (${source.label}) sur ${Object.keys(days).length} jours écrites dans ${out}` +
      (skipped ? ` (${skipped} clé(s) ignorée(s))` : ""),
  );
}
