/**
 * Script to download all referenced texts from the public Sefaria GCS export.
 * Run with: node scripts/download-texts.mjs
 * Output goes to public/texts/
 *
 * Text license: Sefaria texts are public domain or CC BY-SA / CC BY-NC depending on the version.
 * The "merged" versions combine public domain sources.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'public/texts');
const GCS = 'https://storage.googleapis.com/sefaria-export/json';

// `--only=tanakh` (ou tehilim/mishna/talmud/rashi) pour ne régénérer qu'un
// corpus. `tefila` n'est jamais du lot par défaut : ses fichiers sont mis en
// forme à la main après téléchargement, il faut le demander nommément (voir
// plus bas).
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : null;
const shouldRun = corpus => !ONLY || ONLY === corpus;

mkdirSync(`${OUT}/mishna`, { recursive: true });
mkdirSync(`${OUT}/talmud`, { recursive: true });
mkdirSync(`${OUT}/tanakh`, { recursive: true });
mkdirSync(`${OUT}/rashi`, { recursive: true });
mkdirSync(`${OUT}/tefila`, { recursive: true });

// ---------- Utilities ----------

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

function cleanTextArray(arr) {
  if (!arr) return [];
  if (typeof arr === 'string') return arr ? [stripHtml(arr)] : [];
  if (Array.isArray(arr)) {
    return arr.map(item => {
      if (typeof item === 'string') return stripHtml(item);
      if (Array.isArray(item)) return item.map(s => stripHtml(s || ''));
      return '';
    }).filter(item => item !== '' && !(Array.isArray(item) && item.every(s => !s)));
  }
  return [];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function withRetry(fn, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      console.warn(`  Retry ${i + 1} for ${label}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ---------- Read textStudies.json ----------

const textStudies = JSON.parse(readFileSync(`${ROOT}/src/datas/textStudies.json`, 'utf8')).textStudies;

// ---------- Build GCS lookup from books.json ----------

console.log('Loading books index from Sefaria-Export...');
const booksIndex = await withRetry(
  () => fetchJson('https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json'),
  'books.json'
);

// Build lookup: title -> { he_url, en_url }
const lookup = {};
for (const b of booksIndex.books) {
  if (!b.json_url || !b.json_url.includes('merged.json')) continue;
  const title = b.title;
  if (!lookup[title]) lookup[title] = {};
  if (b.language === 'Hebrew') lookup[title].he_url = b.json_url;
  if (b.language === 'English') lookup[title].en_url = b.json_url;
}


// ---------- TEHILIM (150 Psalms) ----------

if (shouldRun('tehilim')) {
console.log('\n=== Tehilim (Psalms) ===');
try {
  const [heData, enData] = await Promise.all([
    withRetry(() => fetchJson(`${GCS}/Tanakh/Torah/../Writings/Psalms/Hebrew/merged.json`.replace('Torah/../', '')), 'Psalms/He'),
    withRetry(() => fetchJson(`${GCS}/Tanakh/Writings/Psalms/English/merged.json`), 'Psalms/En'),
  ]);

  const heText = heData.text; // Array[150][verses]
  const enText = enData.text;
  const tehilim = {};
  for (let i = 0; i < 150; i++) {
    const psalmNum = i + 1;
    tehilim[psalmNum] = {
      he: cleanTextArray(heText[i] || []),
      en: cleanTextArray(enText[i] || []),
    };
  }
  writeFileSync(`${OUT}/tehilim.json`, JSON.stringify(tehilim), 'utf8');
  console.log('  ✓ tehilim.json');
} catch (e) {
  console.error('  ✗ Tehilim:', e.message);
}
}

// ---------- Mishna ----------

// Seder mapping for Mishna tractates
const mishnaSederMap = {
  'Berakhot': 'Seder Zeraim', 'Peah': 'Seder Zeraim', 'Demai': 'Seder Zeraim',
  'Kilayim': 'Seder Zeraim', 'Sheviit': 'Seder Zeraim', 'Terumot': 'Seder Zeraim',
  'Maasrot': 'Seder Zeraim', 'Maaser Sheni': 'Seder Zeraim', 'Challah': 'Seder Zeraim',
  'Orlah': 'Seder Zeraim', 'Bikkurim': 'Seder Zeraim',
  'Shabbat': 'Seder Moed', 'Eruvin': 'Seder Moed', 'Pesachim': 'Seder Moed',
  'Shekalim': 'Seder Moed', 'Yoma': 'Seder Moed', 'Sukkah': 'Seder Moed',
  'Beitzah': 'Seder Moed', 'Rosh Hashanah': 'Seder Moed', 'Taanit': 'Seder Moed',
  'Megillah': 'Seder Moed', 'Moed Katan': 'Seder Moed', 'Chagigah': 'Seder Moed',
  'Yevamot': 'Seder Nashim', 'Ketubot': 'Seder Nashim', 'Nedarim': 'Seder Nashim',
  'Nazir': 'Seder Nashim', 'Sotah': 'Seder Nashim', 'Gittin': 'Seder Nashim',
  'Kiddushin': 'Seder Nashim',
  'Bava Kamma': 'Seder Nezikin', 'Bava Metzia': 'Seder Nezikin', 'Bava Batra': 'Seder Nezikin',
  'Sanhedrin': 'Seder Nezikin', 'Makkot': 'Seder Nezikin', 'Shevuot': 'Seder Nezikin',
  'Eduyot': 'Seder Nezikin', 'Avodah Zarah': 'Seder Nezikin', 'Avot': 'Seder Nezikin',
  'Horayot': 'Seder Nezikin',
  'Zevachim': 'Seder Kodashim', 'Menachot': 'Seder Kodashim', 'Chullin': 'Seder Kodashim',
  'Bekhorot': 'Seder Kodashim', 'Arakhin': 'Seder Kodashim', 'Temurah': 'Seder Kodashim',
  'Keritot': 'Seder Kodashim', 'Meilah': 'Seder Kodashim', 'Tamid': 'Seder Kodashim',
  'Niddah': 'Seder Tahorot',
};

// Talmud seder mapping
const talmudSederMap = {
  'Berakhot': 'Seder Zeraim',
  'Shabbat': 'Seder Moed', 'Eruvin': 'Seder Moed', 'Pesachim': 'Seder Moed',
  'Shekalim': 'Seder Moed', 'Yoma': 'Seder Moed', 'Sukkah': 'Seder Moed',
  'Beitzah': 'Seder Moed', 'Rosh Hashanah': 'Seder Moed', 'Taanit': 'Seder Moed',
  'Megillah': 'Seder Moed', 'Moed Katan': 'Seder Moed', 'Chagigah': 'Seder Moed',
  'Yevamot': 'Seder Nashim', 'Ketubot': 'Seder Nashim', 'Nedarim': 'Seder Nashim',
  'Nazir': 'Seder Nashim', 'Sotah': 'Seder Nashim', 'Gittin': 'Seder Nashim',
  'Kiddushin': 'Seder Nashim',
  'Bava Kamma': 'Seder Nezikin', 'Bava Metzia': 'Seder Nezikin', 'Bava Batra': 'Seder Nezikin',
  'Sanhedrin': 'Seder Nezikin', 'Makkot': 'Seder Nezikin', 'Shevuot': 'Seder Nezikin',
  'Eduyot': 'Seder Nezikin', 'Avodah Zarah': 'Seder Nezikin', 'Horayot': 'Seder Nezikin',
  'Zevachim': 'Seder Kodashim', 'Menachot': 'Seder Kodashim', 'Chullin': 'Seder Kodashim',
  'Bekhorot': 'Seder Kodashim', 'Arakhin': 'Seder Kodashim', 'Temurah': 'Seder Kodashim',
  'Keritot': 'Seder Kodashim', 'Meilah': 'Seder Kodashim', 'Tamid': 'Seder Kodashim',
  'Niddah': 'Seder Tahorot',
};

// Extract tractate name from link for Mishna
// link: "https://www.sefaria.org/Mishnah_Berakhot" → "Berakhot"
function mishnaNameFromLink(link) {
  return link.replace('https://www.sefaria.org/Mishnah_', '').replace(/_/g, ' ');
}

// Extract tractate name from link for Talmud
// link: "https://www.sefaria.org/Berakhot" → "Berakhot"
function talmudNameFromLink(link) {
  return link.replace('https://www.sefaria.org/', '').replace(/_/g, ' ');
}

async function downloadMishnaOrTalmud(type, entries, sederMap, getNameFn, gcsPrefix, gcsNameFn, outDir) {
  const seen = new Set();
  const tasks = [];
  for (const entry of entries) {
    const tractate = getNameFn(entry.link);
    if (seen.has(tractate)) continue;
    seen.add(tractate);
    tasks.push({ tractate, entry });
  }

  console.log(`\n=== ${type} (${tasks.length} tractates) ===`);

  // Process in batches
  const BATCH = 5;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);
    await Promise.all(batch.map(async ({ tractate }) => {
      const gcsName = gcsNameFn(tractate);
      const seder = sederMap[tractate];
      if (!seder) {
        console.warn(`  ⚠ No seder for ${tractate}, skipping`);
        return;
      }
      const heUrl = `${GCS}/${gcsPrefix}/${seder}/${gcsName}/Hebrew/merged.json`;
      const enUrl = `${GCS}/${gcsPrefix}/${seder}/${gcsName}/English/merged.json`;
      const slug = tractate.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
      const outPath = `${outDir}/${slug}.json`;

      try {
        const [heData, enData] = await Promise.all([
          withRetry(() => fetchJson(heUrl), `${tractate}/He`),
          withRetry(() => fetchJson(enUrl), `${tractate}/En`).catch(() => ({ text: [] })),
        ]);
        const result = {
          title: tractate,
          he: cleanTextArray(heData.text),
          en: cleanTextArray(enData.text),
        };
        writeFileSync(outPath, JSON.stringify(result), 'utf8');
        console.log(`  ✓ ${tractate} → ${slug}.json`);
      } catch (e) {
        console.error(`  ✗ ${tractate}: ${e.message}`);
      }
    }));
    if (i + BATCH < tasks.length) await new Promise(r => setTimeout(r, 200));
  }
}

// Mishna
if (shouldRun('mishna')) {
  const mishnaEntries = textStudies.filter(t => t.type === 'Mishna');
  await downloadMishnaOrTalmud(
    'Mishna', mishnaEntries, mishnaSederMap,
    mishnaNameFromLink,
    'Mishnah',
    t => `Mishnah ${t}`,
    `${OUT}/mishna`
  );
}

// Talmud Bavli
if (shouldRun('talmud')) {
  const talmudEntries = textStudies.filter(t => t.type === 'Talmud Bavli');
  await downloadMishnaOrTalmud(
    'Talmud Bavli', talmudEntries, talmudSederMap,
    talmudNameFromLink,
    'Talmud/Bavli',
    t => t,
    `${OUT}/talmud`
  );
}

// ---------- Tanakh ----------

// Map from Sefaria URL ref to GCS path
const tanakhGcsMap = {
  // Torah, the book links (Genesis…) resolve to the FIRST parasha of the book,
  // never the whole book (see torahBookFirstParasha below).
  // Nevi'im
  'Joshua': 'Tanakh/Prophets/Joshua',
  'Judges': 'Tanakh/Prophets/Judges',
  'I Samuel': 'Tanakh/Prophets/I Samuel',
  'II Samuel': 'Tanakh/Prophets/II Samuel',
  'I Kings': 'Tanakh/Prophets/I Kings',
  'II Kings': 'Tanakh/Prophets/II Kings',
  'Isaiah': 'Tanakh/Prophets/Isaiah',
  'Jeremiah': 'Tanakh/Prophets/Jeremiah',
  'Ezekiel': 'Tanakh/Prophets/Ezekiel',
  // Ketuvim
  'Psalms': 'Tanakh/Writings/Psalms',
  'Proverbs': 'Tanakh/Writings/Proverbs',
  'Job': 'Tanakh/Writings/Job',
  'Song of Songs': 'Tanakh/Writings/Song of Songs',
  'Song_of_Songs': 'Tanakh/Writings/Song of Songs',
  'Ruth': 'Tanakh/Writings/Ruth',
  'Lamentations': 'Tanakh/Writings/Lamentations',
  'Ecclesiastes': 'Tanakh/Writings/Ecclesiastes',
  'Esther': 'Tanakh/Writings/Esther',
  'Daniel': 'Tanakh/Writings/Daniel',
  'I Chronicles': 'Tanakh/Writings/I Chronicles',
  'II Chronicles': 'Tanakh/Writings/II Chronicles',
};

// Special name mappings from textStudies link refs to standard names
const refToStdName = {
  'Song_of_Songs': 'Song of Songs',
  'Shmuel Aleph': 'I Samuel',
  'Shmuel Bet': 'II Samuel',
  'Melachim Aleph': 'I Kings',
  'Melachim Bet': 'II Kings',
  'Divrei Hayamim Aleph': 'I Chronicles',
  'Divrei Hayamim Bet': 'II Chronicles',
};

const TORAH_BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];

// A book-level Torah link ("Genesis") means the first parasha of that book.
const torahBookFirstParasha = {
  'Genesis': 'Bereshit',
  'Exodus': 'Shemot',
  'Leviticus': 'Vayikra',
  'Numbers': 'Bamidbar',
  'Deuteronomy': 'Devarim',
};

// Catalog spellings that differ from Sefaria's parasha sharedTitle
// (both sides are compared after parashaKey() normalization).
const parashaAliases = {
  'berechit': 'bereshit',
  'noah': 'noach',
  'chayeisarah': 'chayeisara',
  'vayetze': 'vayetzei',
  'shemini': 'shmini',
  'achareimot': 'achreimot',
  'shelach': 'shlach',
  'ekev': 'eikev',
  'kitetze': 'kiteitzei',
  'vayelech': 'vayeilech',
};

const parashaKey = name => {
  const k = name.toLowerCase().replace(/[^a-z]/g, '');
  return parashaAliases[k] ?? k;
};

// "Genesis 25:19-28:9" (ou "Deuteronomy 31:1-30", même chapitre) → { book, c1, v1, c2, v2 }
function parseRef(ref) {
  const m = ref.replace(/[\u2013]/g, '-').match(/^(.+) (\d+):(\d+)-(?:(\d+):)?(\d+)$/);
  if (!m) throw new Error(`Ref non reconnue : ${ref}`);
  return { book: m[1], c1: +m[2], v1: +m[3], c2: m[4] ? +m[4] : +m[2], v2: +m[5] };
}

// Verses of a chapter:verse range, flattened across chapter boundaries.
// `chapters` is the RAW he array (no filtering, so verse indexes stay exact).
function sliceRef(chapters, { c1, v1, c2, v2 }) {
  if (c1 === c2) return chapters[c1 - 1].slice(v1 - 1, v2);
  const out = [...chapters[c1 - 1].slice(v1 - 1)];
  for (let c = c1 + 1; c < c2; c++) out.push(...chapters[c - 1]);
  out.push(...chapters[c2 - 1].slice(0, v2));
  return out;
}

const ALIYA_LABELS = ['1re montée', '2e montée', '3e montée', '4e montée', '5e montée', '6e montée', '7e montée'];

// The twelve minor prophets (Trei Asar), concatenated with per-chapter labels.
const TREI_ASAR_BOOKS = [
  ['Hosea', 'Hochéa'], ['Joel', 'Yoël'], ['Amos', 'Amos'], ['Obadiah', 'Ovadia'],
  ['Jonah', 'Yona'], ['Micah', 'Mikha'], ['Nahum', 'Nahoum'], ['Habakkuk', 'Havakouk'],
  ['Zephaniah', 'Tsefania'], ['Haggai', 'Hagaï'], ['Zechariah', 'Zekharia'], ['Malakhi', 'Malakhi'],
];
const TREI_ASAR_GCS = {
  'Hosea': 'Tanakh/Prophets/Hosea', 'Joel': 'Tanakh/Prophets/Joel', 'Amos': 'Tanakh/Prophets/Amos',
  'Obadiah': 'Tanakh/Prophets/Obadiah', 'Jonah': 'Tanakh/Prophets/Jonah', 'Micah': 'Tanakh/Prophets/Micah',
  'Nahum': 'Tanakh/Prophets/Nahum', 'Habakkuk': 'Tanakh/Prophets/Habakkuk', 'Zephaniah': 'Tanakh/Prophets/Zephaniah',
  'Haggai': 'Tanakh/Prophets/Haggai', 'Zechariah': 'Tanakh/Prophets/Zechariah', 'Malakhi': 'Tanakh/Prophets/Malachi',
};

const tanakhEntries = textStudies.filter(t => t.type === 'Tanakh');

if (shouldRun('tanakh')) {
  console.log('\n=== Tanakh ===');

  // Parasha structures (verse-exact boundaries + the 7 aliyot) from the Sefaria index.
  const parashaIndex = {}; // parashaKey -> { book, wholeRef, refs }
  for (const book of TORAH_BOOKS) {
    const index = await withRetry(
      () => fetchJson(`https://www.sefaria.org/api/v2/raw/index/${book}`),
      `index/${book}`
    );
    for (const node of index.alt_structs.Parasha.nodes) {
      parashaIndex[parashaKey(node.sharedTitle)] = {
        book,
        wholeRef: node.wholeRef,
        refs: node.refs,
      };
    }
  }
  console.log(`  ✓ Index des parachiot (${Object.keys(parashaIndex).length} parachiot, montées incluses)`);

  // Targoum Onkelos des 5 livres (chnei mikra) : même grille chapitre:verset
  // que le texte massorétique, donc découpable avec les mêmes refs de montées.
  const onkelosCache = {}; // book -> [...chapters][...verses]
  await Promise.all(TORAH_BOOKS.map(async (book) => {
    try {
      const data = await withRetry(
        () => fetchJson(`${GCS}/Tanakh/Targum/Onkelos/Torah/Onkelos ${book}/Hebrew/merged.json`),
        `Onkelos ${book}`
      );
      onkelosCache[book] = (data.text ?? []).map(ch => (ch ?? []).map(v => stripHtml(v ?? '')));
      console.log(`  ✓ Downloaded Onkelos ${book}`);
    } catch (e) {
      console.error(`  ✗ Onkelos ${book}: ${e.message}`);
    }
  }));

  // Books needed: referenced Na"kh books, the 5 Torah books, Trei Asar, Ezra+Nehemiah.
  const booksNeeded = new Set(TORAH_BOOKS);
  for (const entry of tanakhEntries) {
    const rawRef = entry.link.replace('https://www.sefaria.org/', '');
    const stdName = refToStdName[rawRef] ?? rawRef;
    if (tanakhGcsMap[stdName]) booksNeeded.add(stdName);
    if (rawRef === 'Ezra-Nehemiah') { booksNeeded.add('Ezra'); booksNeeded.add('Nehemiah'); }
    if (rawRef === 'Trei Asar') for (const [gcsName] of TREI_ASAR_BOOKS) booksNeeded.add(gcsName);
  }

  const gcsPathOf = book =>
    TORAH_BOOKS.includes(book) ? `Tanakh/Torah/${book}` :
    book === 'Ezra' ? 'Tanakh/Writings/Ezra' :
    book === 'Nehemiah' ? 'Tanakh/Writings/Nehemiah' :
    TREI_ASAR_GCS[book] ?? tanakhGcsMap[book];

  // Download each needed book. `raw` keeps the untouched verse grid (for
  // verse-exact slicing); `clean` is the stripped version written to files.
  const bookCache = {}; // book -> { raw: [...chapters], clean: [...chapters] }
  const BATCH = 4;
  const bookList = [...booksNeeded];
  for (let i = 0; i < bookList.length; i += BATCH) {
    const batch = bookList.slice(i, i + BATCH);
    await Promise.all(batch.map(async (book) => {
      const gcsPath = gcsPathOf(book);
      if (!gcsPath) return;
      try {
        const heData = await withRetry(() => fetchJson(`${GCS}/${gcsPath}/Hebrew/merged.json`), `${book}/He`);
        const raw = (heData.text ?? []).map(ch => (ch ?? []).map(v => stripHtml(v ?? '')));
        bookCache[book] = { raw, clean: cleanTextArray(heData.text) };
        console.log(`  ✓ Downloaded ${book}`);
      } catch (e) {
        console.error(`  ✗ ${book}: ${e.message}`);
      }
    }));
    if (i + BATCH < bookList.length) await new Promise(r => setTimeout(r, 300));
  }

  // Now generate per-entry files
  for (const entry of tanakhEntries) {
    const rawRef = entry.link.replace('https://www.sefaria.org/', '');
    const slug = String(entry.id);
    const outPath = `${OUT}/tanakh/${slug}.json`;

    // Case 1: parasha (verse-exact, grouped by aliya). A Torah book link means
    // the first parasha of the book; "Parashat_X" links name the parasha directly.
    const parashaName = torahBookFirstParasha[rawRef] ?? rawRef.replace(/^Parashat_/, '').replace(/_/g, ' ');
    const parasha = parashaIndex[parashaKey(parashaName)];
    if (parasha && entry.livre !== "Nevi'im (Prophets)") {
      const book = bookCache[parasha.book];
      if (!book) { console.error(`  ✗ ${entry.name}: livre ${parasha.book} absent`); continue; }
      const whole = parseRef(parasha.wholeRef);
      const aliyot = parasha.refs.map(ref => sliceRef(book.raw, parseRef(ref)));
      const onkelos = onkelosCache[parasha.book];
      const targum = onkelos ? parasha.refs.map(ref => sliceRef(onkelos, parseRef(ref))) : undefined;
      writeFileSync(outPath, JSON.stringify({
        title: entry.name,
        fromBook: parasha.book,
        range: `${whole.c1}:${whole.v1}-${whole.c2}:${whole.v2}`,
        grouping: 'aliyot',
        blockLabels: ALIYA_LABELS.slice(0, aliyot.length),
        he: aliyot,
        ...(targum ? { targum } : {}),
      }), 'utf8');
      console.log(`  ✓ ${entry.name} (${parasha.wholeRef}, ${aliyot.length} montées${targum ? ', targoum' : ''}) → tanakh/${slug}.json`);
      continue;
    }

    // Case 2: Trei Asar, the 12 books concatenated, labelled per chapter.
    if (rawRef === 'Trei Asar') {
      const he = [];
      const blockLabels = [];
      let missing = false;
      for (const [gcsName, label] of TREI_ASAR_BOOKS) {
        const book = bookCache[gcsName];
        if (!book) { console.error(`  ✗ Trei Asar: ${gcsName} absent`); missing = true; break; }
        book.clean.forEach((chapter, i) => {
          he.push(chapter);
          blockLabels.push(`${label} ${i + 1}`);
        });
      }
      if (missing) continue;
      writeFileSync(outPath, JSON.stringify({ title: entry.name, blockLabels, he }), 'utf8');
      console.log(`  ✓ ${entry.name} (12 livres, ${he.length} chapitres) → tanakh/${slug}.json`);
      continue;
    }

    // Case 3: Ezra-Nehemiah, both books, labelled per chapter.
    if (rawRef === 'Ezra-Nehemiah') {
      const ezra = bookCache['Ezra'];
      const nehemiah = bookCache['Nehemiah'];
      if (!ezra || !nehemiah) { console.error('  ✗ Ezra-Nehemiah: livre absent'); continue; }
      const he = [...ezra.clean, ...nehemiah.clean];
      const blockLabels = [
        ...ezra.clean.map((_, i) => `Ezra ${i + 1}`),
        ...nehemiah.clean.map((_, i) => `Nehemia ${i + 1}`),
      ];
      writeFileSync(outPath, JSON.stringify({ title: entry.name, blockLabels, he }), 'utf8');
      console.log(`  ✓ ${entry.name} → tanakh/${slug}.json`);
      continue;
    }

    // Case 4: direct book mapping (Na"kh)
    const stdName = refToStdName[rawRef] ?? rawRef;
    if (tanakhGcsMap[stdName] && bookCache[stdName]) {
      const payload = { title: entry.name, he: bookCache[stdName].clean };
      // The full-Psalms entry gets "Tehilim n" labels instead of "Chapitre n".
      if (stdName === 'Psalms') {
        payload.blockLabels = payload.he.map((_, i) => `Tehilim ${i + 1}`);
      }
      writeFileSync(outPath, JSON.stringify(payload), 'utf8');
      console.log(`  ✓ ${entry.name} → tanakh/${slug}.json`);
      continue;
    }

    console.warn(`  ✗ ${entry.name} (${rawRef}): no mapping found`);
  }
}

// ---------- Rachi sur la Torah (option du chnei mikra) ----------
//
// Un fichier par entrée-paracha, séparé du fichier de la paracha
// (public/texts/rashi/<id>.json) : le commentaire ne se télécharge que quand
// le lecteur active l'option Rachi, la paracha seule reste légère.
//
// La découpe par montées ne repasse pas par l'index Sefaria : elle marche sur
// les fichiers de paracha DÉJÀ générés (fromBook, range, longueur de chaque
// montée), si bien que chaque fichier Rachi est aligné verset à verset sur le
// fichier de paracha réellement livré. Le lecteur aplatit les deux de la même
// façon et se repère par index (textService.loadParashaRashi) ; un verset sans
// commentaire garde un tableau vide. Seul le gras du dibbour hamat'hil
// (<b>…</b>) est conservé, le lecteur le met en avant.

/** Nettoyage de Rachi : tout le HTML sauf <b>…</b> (dibbour hamat'hil). */
function cleanRashiText(str) {
  if (!str) return '';
  return str
    .replace(/<(?!\/?b>)[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&thinsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Le texte d'un verset tel que le lecteur le voit (vide = ligne non affichée). */
function verseText(verse) {
  return (Array.isArray(verse) ? verse.flat(Infinity).join(' ') : String(verse ?? ''))
    .replace(/<[^>]*>/g, '')
    .replace(/\{[א-ת]\}/g, '')
    .trim();
}

if (shouldRun('rashi')) {
  console.log('\n=== Rachi sur la Torah ===');

  // Rachi calé sur la grille massorétique : Sefaria tronque les chapitres
  // après le dernier verset commenté, un chapitre plus court décalerait tous
  // les versets suivants de la marche par montées.
  const rashiCache = {}; // book -> [...chapters][...verses][commentaires]
  await Promise.all(TORAH_BOOKS.map(async (book) => {
    try {
      const [heData, rashiData] = await Promise.all([
        withRetry(() => fetchJson(`${GCS}/Tanakh/Torah/${book}/Hebrew/merged.json`), `${book}/He`),
        withRetry(
          () => fetchJson(`${GCS}/Tanakh/Rishonim on Tanakh/Rashi/Torah/Rashi on ${book}/Hebrew/merged.json`),
          `Rashi ${book}`
        ),
      ]);
      const grid = heData.text ?? [];
      const rashi = rashiData.text ?? [];
      rashiCache[book] = grid.map((chapter, c) => (chapter ?? []).map((_, v) => {
        const raw = rashi[c]?.[v];
        return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(cleanRashiText).filter(Boolean);
      }));
      console.log(`  ✓ Downloaded Rashi ${book}`);
    } catch (e) {
      console.error(`  ✗ Rashi ${book}: ${e.message}`);
    }
  }));

  for (const entry of tanakhEntries) {
    let parashaFile;
    try {
      parashaFile = JSON.parse(readFileSync(`${OUT}/tanakh/${entry.id}.json`, 'utf8'));
    } catch {
      continue; // Pas de fichier : entrée non générée, rien à commenter.
    }
    if (parashaFile.grouping !== 'aliyot' || !parashaFile.fromBook || !parashaFile.range) continue;
    const rashiBook = rashiCache[parashaFile.fromBook];
    if (!rashiBook) { console.error(`  ✗ ${entry.name}: Rachi ${parashaFile.fromBook} absent`); continue; }

    const m = parashaFile.range.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    if (!m) { console.error(`  ✗ ${entry.name}: range illisible (${parashaFile.range})`); continue; }
    // Curseur chapitre/verset (base 0) avançant sur la grille massorétique,
    // une case par verset du fichier de paracha.
    let c = +m[1] - 1;
    let v = +m[2] - 1;
    let lastC = c;
    let lastV = v;
    const groups = (parashaFile.he ?? []).map(group => {
      const comments = [];
      for (const verse of group) {
        // Un verset vide n'est pas affiché par le lecteur : pas de ligne Rachi
        // non plus, les index restent alignés.
        if (verseText(verse)) comments.push(rashiBook[c]?.[v] ?? []);
        lastC = c;
        lastV = v;
        v++;
        if (v >= (rashiBook[c]?.length ?? 0)) { c++; v = 0; }
      }
      return comments;
    });
    if (lastC !== +m[3] - 1 || lastV !== +m[4] - 1) {
      console.error(`  ✗ ${entry.name}: fin de marche ${lastC + 1}:${lastV + 1} ≠ range ${parashaFile.range}`);
      continue;
    }

    const commented = groups.flat().filter(comments => comments.length > 0).length;
    writeFileSync(`${OUT}/rashi/${entry.id}.json`, JSON.stringify({
      title: entry.name,
      fromBook: parashaFile.fromBook,
      grouping: 'aliyot',
      he: groups,
    }), 'utf8');
    console.log(`  ✓ Rachi ${entry.name} (${commented} versets commentés) → rashi/${entry.id}.json`);
  }
}

// ---------- Tefila : Sli'hot + Brahot (liturgie) ----------
//
// Textes du rite séfarade (Edot HaMizrach), comme le public de l'application.
// Un fichier par entrée du catalogue, nommé par son id (comme le Tanakh), au
// format tefila : une suite de blocs { label?, when?, lines }. `label` pose
// une séparation dans le fil du texte ; `when` (Chabbat, Roch Hodech,
// Hanouka…) réserve le bloc au jour où son ajout se dit, le lecteur le rend
// alors dans une carte (voir dailyCycles.activeOccasions et TextBlock.when).
//
// CE CORPUS NE SE RÉGÉNÈRE PAS AVEC LES AUTRES. Ce que le script écrit ici
// n'est que le fil brut de Sefaria ; les fichiers livrés portent en plus une
// mise en forme liturgique écrite à la main, que ce script ne sait pas
// produire et qu'il écraserait : didascalies en trois langues (`rubric`),
// reprises de l'assemblée (`b`), répétitions (`repeat`), strophes (`lead`,
// `tight`), encadrés des dix jours (`fold`), variantes (`variants`), et deux
// piyoutim absents de la source. Il faut donc le demander explicitement,
// `node scripts/download-texts.mjs --only=tefila`, et reprendre la mise en
// forme après coup (src/__tests__/tefilaTexts.test.ts la vérifie).

if (ONLY === 'tefila') {
  console.log('\n=== Tefila (Sli\'hot + Brahot) ===');

  const tefilaEntries = textStudies.filter(t => t.type === 'Slihot' || t.type === 'Brahot');
  const tefilaEntry = latin => {
    const entry = tefilaEntries.find(t => t.name.includes(`(${latin})`));
    if (!entry) throw new Error(`Entrée absente du catalogue : ${latin}`);
    return entry;
  };
  // Fichiers nommés par le slug latin de l'entrée, même règle que
  // textService.resolveFilePath (« Brakha A'harona » → brakha-aharona.json).
  const tefilaSlug = latin => latin.toLowerCase().replace(/ /g, '-').replace(/['’‘`]/g, '');
  const writeTefila = (latin, blocks) => {
    const entry = tefilaEntry(latin);
    const file = `tefila/${tefilaSlug(latin)}.json`;
    writeFileSync(`${OUT}/${file}`, JSON.stringify({
      title: entry.name,
      blocks,
    }), 'utf8');
    console.log(`  ✓ ${latin} → ${file} (${blocks.length} blocs)`);
  };
  // Les repères textuels se cherchent sans vocalisation.
  const stripNiqqud = s => s.normalize('NFC').replace(/[֑-ׇ]/g, '');
  const checkAnchor = (lines, [at, needle]) => {
    if (!stripNiqqud(stripHtml(lines[at] ?? '')).includes(needle)) {
      throw new Error(`repère « ${needle} » attendu à la ligne ${at}, structure amont changée`);
    }
  };

  // Sli'hot : le rite quotidien d'Eloul et des dix jours. Le texte est plat
  // chez Sefaria ; on y pose des séparations aux grands jalons du rite,
  // chacun validé par son incipit.
  const SELICHOT_SECTIONS = [
    [0, 'קמתי', 'Kamti béachmoret'],
    [1, 'אשרי', 'Achré'],
    [3, 'בן אדם', 'Ben Adam'],
    [12, 'אל מלך', 'El Melekh · Vayaavor (13 middot)'],
    [14, 'רחמנא', 'Rahamana'],
    [54, 'אנשי אמונה', 'Anché émouna'],
    [57, 'תמהנו', 'Tamahnou méraot'],
    [60, 'אנחנו בושנו', 'Vidoui (Achamnou)'],
    [71, 'שמע ישראל', 'Chéma Israël'],
    [86, 'אלהינו שבשמים', 'Élohénou chébachamayim'],
    [150, 'ברגז רחם', 'Anénou'],
    [155, 'אל רחום שמך', 'El rahoum chemakh'],
    [169, 'עשה למען', 'Assé lemaan'],
    [185, 'אביוניך', 'Piyoutim'],
    [193, 'אל מלך', 'El Melekh · Vayaavor'],
    [195, 'בזכרי', 'Lekha Éli'],
    [201, 'לדוד אליך', 'LeDavid élékha (Tehilim 25)'],
    [202, 'אתאנו', 'Ataanou'],
    [208, 'אבינו אב הרחמן', 'Hochiénou lemaan chemekha'],
    [220, 'אבינו מלכנו', 'Avinou Malkénou'],
    [222, 'שומר ישראל', 'Chomer Israël'],
    [226, 'קדיש', 'Kaddich et clôture'],
  ];
  try {
    const data = await withRetry(
      () => fetchJson(`${GCS}/Liturgy/High Holidays/Selichot Edot HaMizrach/Hebrew/merged.json`),
      'Selichot',
    );
    const raw = data.text ?? [];
    for (const [at, needle] of SELICHOT_SECTIONS) checkAnchor(raw, [at, needle]);
    const blocks = SELICHOT_SECTIONS.map(([from, , label], i) => {
      const to = i + 1 < SELICHOT_SECTIONS.length ? SELICHOT_SECTIONS[i + 1][0] : raw.length;
      return { label, lines: cleanTextArray(raw.slice(from, to)) };
    });
    writeTefila("Sli'hot", blocks);
  } catch (e) {
    console.error(`  ✗ Sli'hot: ${e.message}`);
  }

  // Siddur Edot HaMizrach : Birkat Hamazon (« Post Meal Blessing »),
  // Brakha A'harona (« Al Hamihya » + Boré nefachot) et Birkat Halevana.
  try {
    const data = await withRetry(
      () => fetchJson(`${GCS}/Liturgy/Siddur/Siddur Edot HaMizrach/Hebrew/merged.json`),
      'Siddur Edot HaMizrach',
    );

    // Birkat Hamazon : le fil du texte en blocs sans titre (des paragraphes,
    // pas de séparations), et les ajouts du calendrier en blocs `when`.
    // Les lignes d'instruction qui ne font qu'énoncer la condition (« בשבת
    // אומרים ») sont retirées : la carte et son titre les remplacent.
    const BIRKAT_ZONES = [
      { from: 1, to: 16 },
      { from: 18, to: 20, when: 'nissim', label: 'Al hanissim', check: [17, 'בחנוכה ופורים'] },
      { from: 21, to: 22 },
      { from: 24, to: 24, when: 'shabbat', label: 'Retsé véhahalitsénou', check: [23, 'בשבת'] },
      { from: 26, to: 33, when: 'moed', label: 'Yaalé véyavo', check: [25, 'בראש חודש'] },
      { from: 34, to: 34 },
      { from: 35, to: 40, when: 'shabbat-or-moed', label: "En cas d'oubli de Retsé ou de Yaalé véyavo", check: [35, 'אם שכח'] },
      { from: 41, to: 42 },
      { from: 44, to: 44, when: 'shabbat', label: 'Chabbat', check: [43, 'בשבת'] },
      { from: 46, to: 46, when: 'rosh-chodesh', label: 'Roch Hodech', check: [45, 'בר'] },
      { from: 48, to: 48, when: 'rosh-hashana', label: 'Roch Hachana', check: [47, 'ברה'] },
      { from: 50, to: 50, when: 'sukkot', label: 'Souccot', check: [49, 'בסוכות'] },
      { from: 52, to: 52, when: 'moadim', label: 'Jours de fête', check: [51, 'במועדים'] },
      { from: 54, to: 54, when: 'yom-tov', label: 'Yom Tov', check: [53, 'ביו'] },
      { from: 55, to: 58 },
    ];
    const pm = data.text?.['Post Meal Blessing'] ?? [];
    checkAnchor(pm, [0, 'ברכת המזון']);
    for (const zone of BIRKAT_ZONES) if (zone.check) checkAnchor(pm, zone.check);
    writeTefila('Birkat Hamazon', BIRKAT_ZONES.map(zone => ({
      ...(zone.label ? { label: zone.label } : {}),
      ...(zone.when ? { when: zone.when } : {}),
      lines: cleanTextArray(pm.slice(zone.from, zone.to + 1)),
    })));

    // Brakha a'harona : le Mé'ein chaloch complet du siddour (avec ses
    // variantes selon l'aliment et les mentions des jours, telles qu'un
    // siddour les imprime), puis Boré nefachot.
    const mihya = data.text?.['Al Hamihya'] ?? [];
    checkAnchor(mihya, [0, 'מעין שלוש']);
    const enjoyments = data.text?.['Blessings on Enjoyments'] ?? [];
    const nefashot = enjoyments.find(l => stripNiqqud(stripHtml(l)).includes('בורא נפשות'));
    if (!nefashot) throw new Error('Boré nefachot introuvable dans le siddour');
    writeTefila("Brakha A'harona", [
      { label: "Mé'ein chaloch (Al hami'hya)", lines: cleanTextArray(mihya.slice(1)) },
      { label: 'Boré nefachot', lines: cleanTextArray([nefashot]) },
    ]);

    const levana = data.text?.['Blessing of the Moon'] ?? [];
    checkAnchor(levana, [0, 'ברכת הלבנה']);
    writeTefila('Birkat Halevana', [{ lines: cleanTextArray(levana.slice(1)) }]);
  } catch (e) {
    console.error(`  ✗ Siddur Edot HaMizrach: ${e.message}`);
  }

  // Cheva Brahot : les sept bénédictions, du livret Birkat Hamazon.
  try {
    const data = await withRetry(
      () => fetchJson(`${GCS}/Liturgy/Other Liturgy Works/Birkat Hamazon/Hebrew/merged.json`),
      'Birkat Hamazon (livret)',
    );
    const sheva = cleanTextArray(data.text?.['Sheva Brachot']);
    if (sheva.length === 0) throw new Error('section vide : Sheva Brachot');
    writeTefila('Cheva Brahot', [{ lines: sheva }]);
  } catch (e) {
    console.error(`  ✗ Cheva Brahot: ${e.message}`);
  }
}

console.log('\n✅ Done!');
