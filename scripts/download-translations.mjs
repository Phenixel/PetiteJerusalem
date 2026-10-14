/**
 * Télécharge les traductions libres des textes de la bibliothèque et les
 * aligne, ligne à ligne, sur nos fichiers hébreux.
 *
 * Lancer avec : node scripts/download-translations.mjs [--only=mishna] [--lang=fr]
 * La sortie va dans public/texts/traductions/<langue>/, au même chemin que le
 * fichier hébreu qu'elle traduit (texts/mishna/berakhot.json →
 * texts/traductions/fr/mishna/berakhot.json), avec un index
 * (texts/traductions/index.json) qui dit, pour chaque fichier hébreu, les
 * langues dans lesquelles il se lit.
 *
 * Quelles traductions : seulement des traductions humaines publiées, dans le
 * domaine public ou sous une licence qui permet de les reprendre en citant
 * leur auteur. Le registre, avec les raisons de chaque choix, est
 * docs/traductions.md ; la liste VERSIONS ci-dessous le suit, et rien d'autre
 * n'entre. On lit le fichier de chaque version par son titre exact, jamais un
 * « merged » de Sefaria, qui mêle des versions aux licences différentes.
 *
 * L'alignement se fait par le contenu, pas par la position. Nos fichiers
 * hébreux redécoupent souvent Sefaria (une paracha en montées, les douze
 * petits prophètes en un livre, un paragraphe du moussar coupé à ses <br>) :
 * chaque ligne hébraïque est donc retrouvée dans l'hébreu de Sefaria par ses
 * seules lettres, et reçoit la traduction du segment où elle se trouve. Une
 * ligne qu'on ne retrouve pas reste sans traduction : un trou se voit, une
 * traduction décalée d'un verset se lirait sans qu'on le remarque.
 *
 * Un fichier de traduction a la forme du fichier hébreu qu'il traduit, chaque
 * chaîne d'hébreu remplacée par sa traduction (vide quand il n'y en a pas) :
 *
 *   { "lang": "fr", "sources": [ … ], "text": <la forme de `he`> }
 *
 * Pour le moussar, `text` suit `sections` (une liste de listes) ; pour les
 * Tehilim, il suit l'objet des 150 psaumes. Le lecteur parcourt l'hébreu et la
 * traduction ensemble (textService.alignTranslation), si bien qu'il découpe
 * les deux de la même façon. Seuls <b> et <i> restent dans le texte traduit :
 * le Talmud de Steinsaltz met sa traduction littérale en gras et son
 * explication en romain, et la différence fait partie du texte.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEXTS = join(ROOT, "public", "texts");
const OUT = join(TEXTS, "traductions");
const CACHE = join(ROOT, "node_modules", ".cache", "sefaria-translations");
const BOOKS_URL = "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const ONLY = arg("only");
const ONLY_LANG = arg("lang");

// ---------- Ce qu'on reprend, et comment on le cite ----------

/**
 * Les licences qu'on accepte (docs/traductions.md, « La licence de l'app nous
 * ouvre le non commercial »), avec leur texte de référence. Une version dont
 * Sefaria donne une autre licence (ou « unknown ») n'entre pas, sauf si
 * CREDITS en établit une (une œuvre dont l'auteur est mort depuis plus de
 * soixante-dix ans est dans le domaine public, quoi qu'en dise la fiche).
 */
const LICENSES = {
  "Public Domain": null,
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY": "https://creativecommons.org/licenses/by/3.0/",
  "CC-BY-SA": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC-BY-NC": "https://creativecommons.org/licenses/by-nc/4.0/",
};

/**
 * Comment chaque version se cite : son nom, son auteur, sa date, son éditeur.
 * Le lecteur l'affiche au pied du texte, avec la licence et le lien vers la
 * source. `license` ne se donne que pour corriger la fiche de Sefaria.
 */
const CREDITS = {
  "The Koren Jerusalem Bible": {
    name: "The Koren Jerusalem Bible",
    by: "Harold Fisch",
    publisher: "Koren Publishers Jerusalem",
  },
  "Mishnah Yomit by Dr. Joshua Kulp": {
    name: "Mishnah Yomit",
    by: "Joshua Kulp",
    publisher: "Conservative Yeshiva",
  },
  "William Davidson Edition - English": {
    name: "The William Davidson Talmud (Koren Noé)",
    by: "Adin Even-Israel Steinsaltz",
    publisher: "Koren Publishers Jerusalem",
  },
  "The Jerusalem Talmud, translation and commentary by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015":
    {
      name: "The Jerusalem Talmud",
      by: "Heinrich W. Guggenheimer",
      year: "1999-2015",
      publisher: "De Gruyter",
    },
  "Rashi Chumash, Metsudah Publications, 2009": {
    name: "Metsudah Rashi Chumash",
    by: "Avrohom Davis",
    year: "2009",
    publisher: "Metsudah Publications",
  },
  "Duties of the Heart, trans. Rabbi Yosef Sebag": {
    name: "Duties of the Heart",
    by: "Yosef Sebag",
  },
  "Duties of the Heart, trans. by Rabbi Moses Hyamson, New York, 1925": {
    name: "Duties of the Heart",
    by: "Moses Hyamson",
    year: "1925",
    publisher: "Bloch",
  },
  "Bible du Rabbinat 1899 [fr]": {
    name: "Bible du Rabbinat",
    by: "Zadoc Kahn",
    year: "1899-1906",
  },
  // Schwab est mort en 1918 : la fiche de Sefaria dit « unknown » sur le
  // Talmud de Jérusalem, « Public Domain » sur les mishnayot qu'elle en a
  // extraites. C'est la même traduction, dans le domaine public.
  "Le Talmud de Jérusalem, traduit par Moise Schwab, 1878-1890 [fr]": {
    name: "Le Talmud de Jérusalem",
    by: "Moïse Schwab",
    year: "1871-1890",
    license: "Public Domain",
  },
  "Maximes des Pères, trans. by Rabbi Rivon Krygier, 2023 [fr]": {
    name: "Maximes des Pères",
    by: "Rivon Krygier",
    year: "2023",
  },
};

/**
 * Les versions retenues, par langue et par corpus, dans l'ordre où elles se
 * consultent : une ligne prend la traduction de la première version qui en a
 * une. Le moussar complète ainsi Sebag par Hyamson, le Talmud complète
 * Steinsaltz par Guggenheimer (Chekalim, qui est du Talmud de Jérusalem) et
 * par Kulp (Kinim et Midot, sans guemara).
 */
const VERSIONS = {
  en: {
    tanakh: ["The Koren Jerusalem Bible"],
    tehilim: ["The Koren Jerusalem Bible"],
    mishna: ["Mishnah Yomit by Dr. Joshua Kulp"],
    talmud: [
      "William Davidson Edition - English",
      "The Jerusalem Talmud, translation and commentary by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015",
      "Mishnah Yomit by Dr. Joshua Kulp",
    ],
    rashi: ["Rashi Chumash, Metsudah Publications, 2009"],
    moussar: [
      "Duties of the Heart, trans. Rabbi Yosef Sebag",
      "Duties of the Heart, trans. by Rabbi Moses Hyamson, New York, 1925",
    ],
  },
  fr: {
    tanakh: ["Bible du Rabbinat 1899 [fr]"],
    tehilim: ["Bible du Rabbinat 1899 [fr]"],
    mishna: [
      "Le Talmud de Jérusalem, traduit par Moise Schwab, 1878-1890 [fr]",
      "Maximes des Pères, trans. by Rabbi Rivon Krygier, 2023 [fr]",
    ],
    talmud: ["Le Talmud de Jérusalem, traduit par Moise Schwab, 1878-1890 [fr]"],
    // Pas de traduction française humaine : seul le dépôt IA les remplit.
    rashi: [],
    moussar: [],
  },
};

/**
 * Le dépôt des traductions françaises assistées par IA (voir
 * scripts/translate-ia.mjs et docs/traduction-ia.md), par fichier, à la clé
 * de la ligne dans la forme de son hébreu. Il vient en dernier : une ligne
 * qu'une traduction humaine couvre ne prend jamais la version IA.
 */
const IA_STORE = join(ROOT, "data", "traductions-ia");
const readIaStore = (lang, rel) => {
  const path = join(IA_STORE, lang, rel);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};

// ---------- Les corpus : nos fichiers, et les livres de Sefaria où les retrouver ----------

const isTanakhBook = (b) =>
  b.categories[0] === "Tanakh" &&
  b.categories.length === 2 &&
  ["Torah", "Prophets", "Writings"].includes(b.categories[1]);
const isMishnah = (b) => b.categories[0] === "Mishnah" && /^Seder /.test(b.categories[1] ?? "");
const isBavli = (b) =>
  b.categories[0] === "Talmud" &&
  b.categories[1] === "Bavli" &&
  /^Seder /.test(b.categories[2] ?? "");
const RASHI = new Set(
  ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"].map((b) => `Rashi on ${b}`),
);

/** Les fichiers d'un dossier de public/texts, en chemin relatif à public/texts. */
const filesIn = (dir) =>
  readdirSync(join(TEXTS, dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => `${dir}/${f}`);

/**
 * `root` dit où est l'hébreu dans le fichier, et la forme du `text` écrit en
 * regard : le tableau `he` partout, la liste des `he` des sections pour le
 * moussar, l'objet des psaumes pour les Tehilim.
 */
const CORPORA = {
  tanakh: {
    files: () => filesIn("tanakh"),
    titles: isTanakhBook,
    root: (data) => data.he,
  },
  tehilim: {
    files: () => ["tehilim.json"],
    titles: (b) => b.title === "Psalms",
    root: (data) => Object.fromEntries(Object.entries(data).map(([n, psalm]) => [n, psalm.he])),
  },
  mishna: {
    files: () => filesIn("mishna"),
    titles: isMishnah,
    root: (data) => data.he,
  },
  talmud: {
    files: () => filesIn("talmud"),
    titles: (b) =>
      isBavli(b) ||
      b.title === "Jerusalem Talmud Shekalim" ||
      b.title === "Mishnah Kinnim" ||
      b.title === "Mishnah Middot",
    root: (data) => data.he,
  },
  rashi: {
    files: () => filesIn("rashi"),
    titles: (b) => RASHI.has(b.title),
    root: (data) => data.he,
  },
  moussar: {
    // 'Hovot Halévavot (400 à 410) ; le Pélé Yoets n'a pas de traduction.
    files: () => filesIn("moussar").filter((f) => Number(f.match(/(\d+)\.json$/)?.[1]) <= 410),
    titles: (b) => b.title === "Duties of the Heart",
    root: (data) => data.sections.map((s) => s.he),
  },
};

// ---------- Téléchargement (avec cache) ----------

async function fetchJson(url) {
  const cached = join(CACHE, encodeURIComponent(url).slice(-200));
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, "utf8"));
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(cached, text);
      return JSON.parse(text);
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url} : ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

/** Exécute `fn` sur chaque élément, `n` à la fois. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------- Nettoyage ----------

/** Les seules lettres hébraïques d'un texte : ce qui sert à le retrouver. */
const letters = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[^א-ת]/g, "");

/** Retire une balise et tout son contenu, balises du même nom imbriquées comprises. */
function removeElement(s, opening) {
  for (;;) {
    const start = s.search(opening);
    if (start < 0) return s;
    const tag = s.slice(start).match(/^<(\w+)/)[1];
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
    re.lastIndex = start;
    let depth = 0;
    let end = s.length;
    for (let m; (m = re.exec(s)); ) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    s = s.slice(0, start) + s.slice(end);
  }
}

/**
 * Une traduction prête à lire : les notes de bas de page retirées (le lecteur
 * n'a pas où les poser), le gras et l'italique gardés, tout le reste du HTML
 * réduit à son texte.
 */
export function cleanTranslation(raw) {
  let s = String(raw ?? "");
  s = removeElement(s, /<sup\b[^>]*class="footnote-marker"[^>]*>/);
  s = removeElement(s, /<i\b[^>]*class="footnote"[^>]*>/);
  s = removeElement(s, /<sup\b[^>]*>/);
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(\/?)strong\b[^>]*>/gi, "<$1b>")
    .replace(/<(\/?)(b|i)\b[^>]*>/gi, "<$1$2>")
    .replace(/<(?!\/?[bi]>)[^>]*>/g, "")
    .replace(/&nbsp;|&thinsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "‹")
    .replace(/&gt;/g, "›")
    .replace(/&amp;/g, "&")
    .replace(/<b>\s*<\/b>|<i>\s*<\/i>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Alignement ----------

/** Les chaînes d'une valeur imbriquée (tableau ou objet), dans l'ordre de lecture. */
function leaves(value, path = [], out = []) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, [...path, i], out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) leaves(v, [...path, k], out);
  return out;
}

/** La même forme que `value`, chaque chaîne passée par `fn` (sa position en second). */
function mapLeaves(value, fn, path = []) {
  if (typeof value === "string") return fn(value, path);
  if (Array.isArray(value)) return value.map((v, i) => mapLeaves(v, fn, [...path, i]));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, mapLeaves(v, fn, [...path, k])]),
    );
  return value;
}

/**
 * L'hébreu de Sefaria d'un corpus, à plat : un segment par chaîne, avec le
 * livre et la position qui permettront d'y lire la traduction.
 */
function buildSequence(hebrewBooks) {
  const seq = [];
  for (const { title, text } of hebrewBooks) {
    for (const { path, text: s } of leaves(text)) {
      const key = letters(s);
      if (key) seq.push({ title, path: path.join("/"), key });
    }
  }
  const byKey = new Map();
  seq.forEach((seg, i) => {
    if (!byKey.has(seg.key)) byKey.set(seg.key, []);
    byKey.get(seg.key).push(i);
  });
  return { seq, byKey };
}

/** Combien des lignes qui suivent `from` continuent au segment `pos` et après. */
function runLength(seq, keys, from, pos) {
  let n = 0;
  for (let k = from; k < Math.min(keys.length, from + 6); k++) {
    const key = keys[k];
    if (!key) continue;
    let found = false;
    for (let p = pos; p < Math.min(seq.length, pos + 4); p++) {
      if (seq[p].key === key || seq[p].key.includes(key)) {
        found = true;
        pos = p;
        break;
      }
    }
    if (!found) break;
    n++;
  }
  return n;
}

/**
 * À chaque ligne hébraïque de notre fichier, le segment de Sefaria où elle se
 * trouve (son index dans `seq`), ou -1. On avance dans l'ordre : une ligne se
 * cherche juste après la précédente ; perdue, on la recherche dans tout le
 * corpus en gardant la position que les lignes suivantes confirment.
 */
function alignKeys(keys, { seq, byKey }) {
  const WINDOW = 40;
  const out = new Array(keys.length).fill(-1);
  let cursor = -1;
  keys.forEach((key, i) => {
    if (!key) return;
    // 1. Juste après la ligne précédente, à l'identique.
    if (cursor >= 0) {
      for (let p = cursor + 1; p <= Math.min(seq.length - 1, cursor + WINDOW); p++) {
        if (seq[p].key === key) {
          out[i] = cursor = p;
          return;
        }
      }
      // 2. Un morceau du segment courant ou d'un suivant (paragraphe coupé).
      for (let p = cursor; p <= Math.min(seq.length - 1, cursor + 3); p++) {
        if (seq[p].key.includes(key)) {
          out[i] = cursor = p;
          return;
        }
      }
    }
    // 3. Ailleurs : la position que confirment les lignes suivantes, de
    // préférence après la précédente (le texte avance).
    const candidates = byKey.get(key) ?? [];
    let best = -1;
    let bestScore = -1;
    for (const p of candidates) {
      const score = runLength(seq, keys, i + 1, p + 1) * 2 + (p > cursor ? 1 : 0);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best >= 0) out[i] = cursor = best;
  });
  return out;
}

// ---------- Construction ----------

const LANGS = Object.keys(VERSIONS).filter((l) => !ONLY_LANG || l === ONLY_LANG);

console.log("Index Sefaria-Export…");
const books = (await fetchJson(BOOKS_URL)).books;

const index = existsSync(join(OUT, "index.json"))
  ? JSON.parse(readFileSync(join(OUT, "index.json"), "utf8"))
  : { files: {} };

for (const [corpusName, corpus] of Object.entries(CORPORA)) {
  if (ONLY && ONLY !== corpusName) continue;
  const langs = LANGS.filter((l) => VERSIONS[l][corpusName]);
  if (langs.length === 0) continue;
  console.log(`\n=== ${corpusName} ===`);

  const hebrew = books.filter(
    (b) => b.language === "Hebrew" && b.versionTitle === "merged" && corpus.titles(b),
  );
  const hebrewBooks = await pool(hebrew, 8, async (b) => ({
    title: b.title,
    text: (await fetchJson(b.json_url)).text,
  }));
  const sequence = buildSequence(hebrewBooks);
  const titles = new Set(hebrew.map((b) => b.title));

  // Nos fichiers, et pour chacun le segment de Sefaria de chaque ligne.
  const ours = corpus.files().map((rel) => {
    const data = JSON.parse(readFileSync(join(TEXTS, rel), "utf8"));
    const root = corpus.root(data);
    const lines = leaves(root);
    const segs = alignKeys(
      lines.map((l) => letters(l.text)),
      sequence,
    );
    return { rel, root, lines, segs };
  });

  for (const lang of langs) {
    // Les traductions de chaque version, par livre puis par position.
    const versions = [];
    for (const versionTitle of VERSIONS[lang][corpusName]) {
      // Une version hébraïque peut porter le même titre (Metsudah) : les
      // traductions, françaises comprises, sont rangées sous « English ».
      const entries = books.filter(
        (b) => b.language === "English" && b.versionTitle === versionTitle && titles.has(b.title),
      );
      const files = await pool(entries, 8, async (b) => ({
        title: b.title,
        data: await fetchJson(b.json_url),
      }));
      const byTitle = new Map();
      let license = CREDITS[versionTitle]?.license ?? null;
      for (const { title, data } of files) {
        license ??= data.license;
        const byPath = new Map();
        for (const { path, text } of leaves(data.text)) {
          const clean = cleanTranslation(text);
          if (clean) byPath.set(path.join("/"), clean);
        }
        byTitle.set(title, byPath);
      }
      if (!(license in LICENSES)) {
        console.warn(`  ⚠ ${versionTitle} : licence « ${license} », version écartée`);
        continue;
      }
      if (/✧|DeepL|Claude|GPT/i.test(versionTitle)) {
        throw new Error(`${versionTitle} : traduction automatique, refusée`);
      }
      versions.push({ versionTitle, license, byTitle });
    }

    let totalLines = 0;
    let totalTranslated = 0;
    for (const { rel, root, lines, segs } of ours) {
      const used = new Set();
      const sourcesUsed = new Map();
      const byPath = new Map();
      lines.forEach((line, i) => {
        const p = segs[i];
        if (!letters(line.text)) return;
        totalLines++;
        if (p < 0) return;
        const seg = sequence.seq[p];
        // Un segment coupé en plusieurs lignes (le moussar) : sa traduction
        // va à la première, les suivantes restent vides.
        const segId = `${seg.title}|${seg.path}`;
        if (used.has(segId)) return;
        for (const v of versions) {
          const text = v.byTitle.get(seg.title)?.get(seg.path);
          if (!text) continue;
          used.add(segId);
          byPath.set(line.path.join("/"), text);
          const titles = sourcesUsed.get(v) ?? new Set();
          titles.add(seg.title);
          sourcesUsed.set(v, titles);
          totalTranslated++;
          break;
        }
      });
      // Ce que les traductions humaines laissent vide, le dépôt IA le
      // complète, ligne à ligne.
      const ia = readIaStore(lang, rel);
      let iaLines = 0;
      if (ia) {
        for (const line of lines) {
          const key = line.path.join("/");
          if (!letters(line.text) || byPath.has(key) || !ia[key]) continue;
          byPath.set(key, ia[key]);
          iaLines++;
          totalTranslated++;
        }
      }
      const outPath = join(OUT, lang, rel);
      const webPath = `/texts/${rel}`;
      if (byPath.size === 0) {
        index.files[webPath] = (index.files[webPath] ?? []).filter((l) => l !== lang);
        continue;
      }
      const sources = [...sourcesUsed].map(([v, usedTitles]) => {
        const credit = CREDITS[v.versionTitle] ?? { name: v.versionTitle };
        const first = [...usedTitles][0].replace(/ /g, "_");
        return {
          name: credit.name,
          ...(credit.by ? { by: credit.by } : {}),
          ...(credit.year ? { year: credit.year } : {}),
          ...(credit.publisher ? { publisher: credit.publisher } : {}),
          license: v.license,
          ...(LICENSES[v.license] ? { licenseUrl: LICENSES[v.license] } : {}),
          url: `https://www.sefaria.org/${encodeURIComponent(first)}?ven=${encodeURIComponent(v.versionTitle.replace(/ /g, "_"))}&lang=bi`,
        };
      });
      // La version IA se cite par la traduction anglaise d'où elle vient :
      // son auteur, sa licence (une adaptation garde celle de sa source).
      if (iaLines) {
        const enPath = join(OUT, "en", rel);
        const enSources = existsSync(enPath)
          ? JSON.parse(readFileSync(enPath, "utf8")).sources
          : [];
        for (const source of enSources) {
          sources.push({
            ...source,
            name: `${source.name} (traduction française par IA)`,
            by: `${source.by ?? source.name} (traduit de l'anglais par IA)`,
          });
        }
      }
      const text = mapLeaves(root, (_, path) => byPath.get(path.join("/")) ?? "");
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify({ lang, sources, text }));
      const langs = new Set(index.files[webPath] ?? []);
      langs.add(lang);
      index.files[webPath] = [...langs].sort();
    }
    const pct = totalLines ? ((100 * totalTranslated) / totalLines).toFixed(1) : "0";
    console.log(`  ${lang} : ${totalTranslated} lignes traduites sur ${totalLines} (${pct} %)`);
  }
}

for (const [k, v] of Object.entries(index.files)) if (!v.length) delete index.files[k];
index.files = Object.fromEntries(Object.entries(index.files).sort(([a], [b]) => (a < b ? -1 : 1)));
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `\n✓ ${relative(ROOT, join(OUT, "index.json"))} : ${Object.keys(index.files).length} textes traduits`,
);
