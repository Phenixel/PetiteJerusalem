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

mkdirSync(`${OUT}/mishna`, { recursive: true });
mkdirSync(`${OUT}/talmud`, { recursive: true });
mkdirSync(`${OUT}/tanakh`, { recursive: true });

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
const mishnaEntries = textStudies.filter(t => t.type === 'Mishna');
await downloadMishnaOrTalmud(
  'Mishna', mishnaEntries, mishnaSederMap,
  mishnaNameFromLink,
  'Mishnah',
  t => `Mishnah ${t}`,
  `${OUT}/mishna`
);

// Talmud Bavli
const talmudEntries = textStudies.filter(t => t.type === 'Talmud Bavli');
await downloadMishnaOrTalmud(
  'Talmud Bavli', talmudEntries, talmudSederMap,
  talmudNameFromLink,
  'Talmud/Bavli',
  t => t,
  `${OUT}/talmud`
);

// ---------- Tanakh ----------

// Map from Sefaria URL ref to GCS path
const tanakhGcsMap = {
  // Torah
  'Genesis': 'Tanakh/Torah/Genesis',
  'Exodus': 'Tanakh/Torah/Exodus',
  'Leviticus': 'Tanakh/Torah/Leviticus',
  'Numbers': 'Tanakh/Torah/Numbers',
  'Deuteronomy': 'Tanakh/Torah/Deuteronomy',
  // Torah parashiyot (stored within their books by Sefaria - use book-level)
  // We skip individual parashiyot since they map to sub-sections of books
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
  'Amos': 'Tanakh/Prophets/Amos',
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
  'Ezra': 'Tanakh/Writings/Ezra',
  'Nehemiah': 'Tanakh/Writings/Nehemiah',
  'I Chronicles': 'Tanakh/Writings/I Chronicles',
  'II Chronicles': 'Tanakh/Writings/II Chronicles',
};

// Parasha to book + chapter range mapping
// Format: [bookRef, startChapter, endChapter]
const parashaChapterMap = {
  // Genesis parshiyot (note: first parasha "Berechit" entry links to "Genesis" - handled above)
  'Noah': ['Genesis', 6, 11],
  'Lech Lecha': ['Genesis', 12, 17],
  'Vayera': ['Genesis', 18, 22],
  'Chayei Sarah': ['Genesis', 23, 25],
  'Toldot': ['Genesis', 25, 28],  // 25:19 - 28:9
  'Vayetze': ['Genesis', 28, 32],
  'Vayishlach': ['Genesis', 32, 36],
  'Vayeshev': ['Genesis', 37, 40],
  'Miketz': ['Genesis', 41, 44],
  'Vayigash': ['Genesis', 44, 47],
  'Vayechi': ['Genesis', 47, 50],
  // Exodus parshiyot
  "Va'era": ['Exodus', 6, 9],
  'Bo': ['Exodus', 10, 13],
  'Beshalach': ['Exodus', 13, 17],
  'Yitro': ['Exodus', 18, 20],
  'Mishpatim': ['Exodus', 21, 24],
  'Terumah': ['Exodus', 25, 27],
  'Tetzaveh': ['Exodus', 27, 30],
  'Ki Tisa': ['Exodus', 30, 34],
  'Vayakhel': ['Exodus', 35, 38],
  'Pekudei': ['Exodus', 38, 40],
  // Leviticus parshiyot
  'Tzav': ['Leviticus', 6, 8],
  'Shemini': ['Leviticus', 9, 11],
  'Tazria': ['Leviticus', 12, 13],
  'Metzora': ['Leviticus', 14, 15],
  'Acharei Mot': ['Leviticus', 16, 18],
  'Kedoshim': ['Leviticus', 19, 20],
  'Emor': ['Leviticus', 21, 24],
  'Behar': ['Leviticus', 25, 25],
  'Bechukotai': ['Leviticus', 26, 27],
  // Numbers parshiyot
  'Nasso': ['Numbers', 4, 7],
  "Beha'alotcha": ['Numbers', 8, 12],
  'Shelach': ['Numbers', 13, 15],
  'Korach': ['Numbers', 16, 18],
  'Chukat': ['Numbers', 19, 22],
  'Balak': ['Numbers', 22, 25],
  'Pinchas': ['Numbers', 25, 30],
  'Matot': ['Numbers', 30, 32],
  'Masei': ['Numbers', 33, 36],
  // Deuteronomy parshiyot
  "Va'etchanan": ['Deuteronomy', 3, 7],
  'Ekev': ['Deuteronomy', 7, 11],
  "Re'eh": ['Deuteronomy', 11, 16],
  'Shoftim': ['Deuteronomy', 16, 21],
  'Ki Tetze': ['Deuteronomy', 21, 25],
  'Ki Tavo': ['Deuteronomy', 26, 29],
  'Nitzavim': ['Deuteronomy', 29, 30],
  'Vayelech': ['Deuteronomy', 31, 31],
  'Haazinu': ['Deuteronomy', 32, 32],
  "V'Zot HaBerachah": ['Deuteronomy', 33, 34],
};

// Special name mappings from textStudies link refs to standard names
const refToStdName = {
  'Song_of_Songs': 'Song of Songs',
  'Ezra-Nehemiah': 'Ezra', // Will handle Nehemiah separately if needed
  'Shmuel Aleph': 'I Samuel',
  'Shmuel Bet': 'II Samuel',
  'Melachim Aleph': 'I Kings',
  'Melachim Bet': 'II Kings',
  'Divrei Hayamim Aleph': 'I Chronicles',
  'Divrei Hayamim Bet': 'II Chronicles',
  'Trei Asar': null, // The Twelve Minor Prophets - skip (too complex)
};

console.log('\n=== Tanakh ===');
const tanakhEntries = textStudies.filter(t => t.type === 'Tanakh');

// First download Torah books (needed for parashiyot too)
const booksNeeded = new Set();
for (const entry of tanakhEntries) {
  const rawRef = entry.link.replace('https://www.sefaria.org/', '');
  const stdName = refToStdName[rawRef] ?? rawRef;
  if (tanakhGcsMap[stdName]) {
    booksNeeded.add(stdName);
  } else if (parashaChapterMap[rawRef]) {
    const [bookRef] = parashaChapterMap[rawRef];
    booksNeeded.add(bookRef);
  }
}

// Download each needed book
const bookCache = {}; // bookRef -> { he: [...chapters], en: [...chapters] }
const BATCH = 4;
const bookList = [...booksNeeded];
for (let i = 0; i < bookList.length; i += BATCH) {
  const batch = bookList.slice(i, i + BATCH);
  await Promise.all(batch.map(async (bookRef) => {
    const gcsPath = tanakhGcsMap[bookRef];
    if (!gcsPath) return;
    try {
      const [heData, enData] = await Promise.all([
        withRetry(() => fetchJson(`${GCS}/${gcsPath}/Hebrew/merged.json`), `${bookRef}/He`),
        withRetry(() => fetchJson(`${GCS}/${gcsPath}/English/merged.json`), `${bookRef}/En`).catch(() => ({ text: [] })),
      ]);
      bookCache[bookRef] = {
        he: cleanTextArray(heData.text),
        en: cleanTextArray(enData.text),
      };
      console.log(`  ✓ Downloaded ${bookRef}`);
    } catch (e) {
      console.error(`  ✗ ${bookRef}: ${e.message}`);
    }
  }));
  if (i + BATCH < bookList.length) await new Promise(r => setTimeout(r, 300));
}

// Now generate per-entry files
for (const entry of tanakhEntries) {
  const rawRef = entry.link.replace('https://www.sefaria.org/', '');
  const slug = String(entry.id);
  const outPath = `${OUT}/tanakh/${slug}.json`;

  // Case 1: direct book mapping
  const stdName = refToStdName[rawRef] ?? rawRef;
  if (tanakhGcsMap[stdName] && bookCache[stdName]) {
    writeFileSync(outPath, JSON.stringify({ title: entry.name, ...bookCache[stdName] }), 'utf8');
    console.log(`  ✓ ${entry.name} → tanakh/${slug}.json`);
    continue;
  }

  // Case 2: parasha (extract relevant chapters from Torah book)
  const parashaInfo = parashaChapterMap[rawRef];
  if (parashaInfo) {
    const [bookRef, startCh, endCh] = parashaInfo;
    const book = bookCache[bookRef];
    if (book) {
      // chapters are 0-indexed in the array, 1-indexed in the parasha map
      const heChapters = book.he.slice(startCh - 1, endCh);
      const enChapters = book.en.slice(startCh - 1, endCh);
      writeFileSync(outPath, JSON.stringify({
        title: entry.name,
        fromBook: bookRef,
        chapters: `${startCh}-${endCh}`,
        he: heChapters,
        en: enChapters,
      }), 'utf8');
      console.log(`  ✓ ${entry.name} (parasha ${bookRef} ${startCh}-${endCh}) → tanakh/${slug}.json`);
      continue;
    }
  }

  if (refToStdName[rawRef] === null) {
    console.log(`  ⚠ ${entry.name} (${rawRef}): skipped (complex text)`);
  } else {
    console.warn(`  ✗ ${entry.name} (${rawRef}): no mapping found`);
  }
}

console.log('\n✅ Done!');
