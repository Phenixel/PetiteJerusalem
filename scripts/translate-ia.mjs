/**
 * Traduction française assistée par IA de ce qui n'existe qu'en anglais :
 * découpe le travail en lots, puis rassemble ce que les agents ont traduit.
 *
 *   node scripts/translate-ia.mjs prepare --out=<dossier> [--corpus=talmud] [--words=6000]
 *   node scripts/translate-ia.mjs collect --out=<dossier>
 *
 * `prepare` relève, dans public/texts/traductions/, chaque ligne qui a une
 * traduction anglaise et pas de française, et les range en lots d'environ
 * `--words` mots anglais, un lot ne couvrant qu'un seul fichier. Chaque lot
 * s'écrit dans <out>/lots/<id>.json : { id, rel, corpus, items: [{ k, en, he? }] },
 * où `k` est la position de la ligne dans le fichier (les index de la forme
 * de son hébreu, joints par « / »), `en` la traduction anglaise et `he`
 * l'hébreu, donné en appui (sauf pour le Talmud, où il doublerait le coût).
 * La liste des lots est <out>/lots.json.
 *
 * Un agent traduit un lot en suivant docs/traduction-ia.md et écrit
 * <out>/resultats/<id>.json : { "<k>": "<français>", … }.
 *
 * `collect` vérifie chaque résultat (toutes les lignes, du français, le gras
 * et l'italique gardés), corrige la typographie (espaces insécables, pas de
 * tiret long) et l'ajoute au dépôt des traductions IA,
 * data/traductions-ia/fr/<rel>, à la même clé `k`. Il dit quels lots sont à
 * refaire. scripts/download-translations.mjs prend ensuite ce dépôt comme
 * dernière source du français, après les traductions humaines.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEXTS = join(ROOT, "public", "texts");
const STORE = join(ROOT, "data", "traductions-ia", "fr");

const command = process.argv[2];
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const OUT = arg("out") ? resolve(arg("out")) : null;
if (!OUT || !["prepare", "collect"].includes(command)) {
  console.error("Usage : node scripts/translate-ia.mjs prepare|collect --out=<dossier>");
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const words = (s) => (String(s).match(/\S+/g) ?? []).length;

/** Les chaînes d'une valeur imbriquée, avec leur clé « 0/3/1 », dans l'ordre. */
function leaves(value, path = [], out = []) {
  if (typeof value === "string") out.push({ k: path.join("/"), text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, [...path, i], out));
  else if (value && typeof value === "object")
    for (const [key, v] of Object.entries(value)) leaves(v, [...path, key], out);
  return out;
}

/** Là où est l'hébreu dans un fichier (la forme du `text` des traductions). */
function hebrewRoot(rel, data) {
  if (rel === "tehilim.json") {
    return Object.fromEntries(Object.entries(data).map(([n, psalm]) => [n, psalm.he]));
  }
  if (rel.startsWith("moussar/")) return data.sections.map((s) => s.he);
  return data.he;
}

// ---------- prepare ----------

if (command === "prepare") {
  const CORPUS = arg("corpus");
  const MAX_WORDS = Number(arg("words") ?? 6000);
  const index = readJson(join(TEXTS, "traductions", "index.json")).files;
  mkdirSync(join(OUT, "lots"), { recursive: true });
  const lots = [];
  let total = 0;
  for (const [webPath, langs] of Object.entries(index)) {
    if (!langs.includes("en")) continue;
    const rel = webPath.replace(/^\/texts\//, "");
    const corpus = rel.includes("/") ? rel.split("/")[0] : rel.replace(/\.json$/, "");
    if (CORPUS && corpus !== CORPUS) continue;
    const en = new Map(
      leaves(readJson(join(TEXTS, "traductions", "en", rel)).text).map((l) => [l.k, l.text]),
    );
    const frPath = join(TEXTS, "traductions", "fr", rel);
    const fr = existsSync(frPath)
      ? new Map(leaves(readJson(frPath).text).map((l) => [l.k, l.text]))
      : new Map();
    // Déjà traduit par un lot précédent : on ne le refait pas.
    const storePath = join(STORE, rel);
    const done = existsSync(storePath) ? readJson(storePath) : {};
    const he = new Map(
      leaves(hebrewRoot(rel, readJson(join(TEXTS, rel)))).map((l) => [l.k, l.text]),
    );

    let current = null;
    for (const [k, text] of en) {
      if (!text || fr.get(k) || done[k]) continue;
      const n = words(text);
      if (!current || current.words + n > MAX_WORDS) {
        current = {
          id: `${rel.replace(/\.json$/, "").replace(/\//g, "--")}--${String(lots.length).padStart(4, "0")}`,
          rel,
          corpus,
          words: 0,
          items: [],
        };
        lots.push(current);
      }
      const item = { k, en: text };
      // L'hébreu du Talmud doublerait le coût d'un lot pour peu d'aide :
      // la traduction de Steinsaltz le suit déjà de près.
      if (corpus !== "talmud" && he.get(k)) item.he = he.get(k).replace(/<[^>]*>/g, "");
      current.items.push(item);
      current.words += n;
      total += n;
    }
  }
  for (const lot of lots) {
    writeFileSync(join(OUT, "lots", `${lot.id}.json`), JSON.stringify(lot, null, 1));
  }
  writeFileSync(
    join(OUT, "lots.json"),
    JSON.stringify(
      lots.map(({ id, rel, corpus, words: w, items }) => ({
        id,
        rel,
        corpus,
        words: w,
        lines: items.length,
      })),
      null,
      1,
    ),
  );
  const byCorpus = {};
  for (const lot of lots) byCorpus[lot.corpus] = (byCorpus[lot.corpus] ?? 0) + lot.words;
  console.log(`${lots.length} lots, ${total} mots anglais`, byCorpus);
}

// ---------- collect ----------

/**
 * La typographie du français du dépôt (CLAUDE.md) : pas de tiret long,
 * espaces insécables avant la ponctuation double et dans les guillemets.
 * Les deux-points d'une référence (« Exode 1:7 », « 10:30 ») restent collés.
 */
function frenchTypography(s) {
  return s
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .replace(/(\S) ?([!?;]+)/g, "$1\u202f$2")
    .replace(/(\S) ?:(?=\s|$|<|»)/g, "$1\u00a0:")
    .replace(/« ?/g, "«\u00a0")
    .replace(/ ?»/g, "\u00a0»")
    .trim();
}

/** Les balises <b> et <i> s'ouvrent et se ferment dans l'ordre. */
function balanced(s) {
  const stack = [];
  for (const [, close, tag] of s.matchAll(/<(\/?)([bi])>/g)) {
    if (!close) stack.push(tag);
    else if (stack.pop() !== tag) return false;
  }
  return stack.length === 0;
}

/** Une ligne qui semble encore en anglais (le modèle a recopié la source). */
function looksEnglish(fr, en) {
  if (fr.trim() === en.trim() && words(en) > 3) return true;
  const plain = fr.replace(/<[^>]*>/g, " ").toLowerCase();
  const english = (plain.match(/\b(the|and|of|is|that|which|with|from|this)\b/g) ?? []).length;
  const french = (plain.match(/\b(le|la|les|et|de|des|du|est|que|qui|une|un|dans)\b/g) ?? [])
    .length;
  return words(plain) > 8 && english > french;
}

if (command === "collect") {
  const lots = readJson(join(OUT, "lots.json"));
  const redo = [];
  const byRel = new Map();
  let lines = 0;
  for (const { id, rel } of lots) {
    const resultPath = join(OUT, "resultats", `${id}.json`);
    if (!existsSync(resultPath)) {
      redo.push({ id, why: "pas de résultat" });
      continue;
    }
    let result;
    try {
      result = readJson(resultPath);
    } catch {
      redo.push({ id, why: "JSON illisible" });
      continue;
    }
    const lot = readJson(join(OUT, "lots", `${id}.json`));
    const problems = [];
    const accepted = {};
    for (const { k, en } of lot.items) {
      const fr = typeof result[k] === "string" ? result[k].trim() : "";
      if (!fr) problems.push(`${k} : manquante`);
      else if (!balanced(fr)) problems.push(`${k} : gras ou italique déséquilibré`);
      else if (looksEnglish(fr, en)) problems.push(`${k} : encore en anglais`);
      else if (fr.length < en.length * 0.4 || fr.length > en.length * 2.5) {
        problems.push(`${k} : longueur suspecte`);
      } else accepted[k] = frenchTypography(fr);
    }
    // Un lot se prend ligne à ligne : ce qui est bon entre au dépôt, le
    // reste repassera dans un lot suivant (prepare ne reprend que le manque).
    if (problems.length)
      redo.push({ id, why: problems.slice(0, 5).join(" ; "), count: problems.length });
    const store =
      byRel.get(rel) ?? (existsSync(join(STORE, rel)) ? readJson(join(STORE, rel)) : {});
    Object.assign(store, accepted);
    byRel.set(rel, store);
    lines += Object.keys(accepted).length;
  }
  for (const [rel, store] of byRel) {
    const path = join(STORE, rel);
    mkdirSync(dirname(path), { recursive: true });
    const sorted = Object.fromEntries(
      Object.entries(store).sort(([a], [b]) => {
        const pa = a.split("/").map(Number);
        const pb = b.split("/").map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          if ((pa[i] ?? -1) !== (pb[i] ?? -1)) return (pa[i] ?? -1) - (pb[i] ?? -1);
        }
        return 0;
      }),
    );
    writeFileSync(path, `${JSON.stringify(sorted, null, 1)}\n`);
  }
  writeFileSync(join(OUT, "a-refaire.json"), JSON.stringify(redo, null, 1));
  const files = existsSync(STORE) ? readdirSync(STORE, { recursive: true }).length : 0;
  console.log(
    `${lines} lignes ajoutées au dépôt (${files} entrées), ${redo.length} lots à reprendre`,
  );
  for (const r of redo.slice(0, 20)) console.log(`  ${r.id} : ${r.why}`);
}
