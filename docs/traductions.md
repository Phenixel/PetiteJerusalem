# Text translations: free sources and coverage

This document says where to find a **human, published** translation of each
corpus in the library, under which license, and what share of the text it
covers. It serves as a registry: a translation is only added to the app if
it appears here, with its license and how to credit it.

No machine translation, nor AI translation: that is the starting rule.

The versions selected below have been **in the app** since October 2026:
see "In the app" for where they live, how they are rebuilt and how the
reader shows them.

State of play as of October 2026, measured on Sefaria's public export
(`Sefaria-Export/books.json`, generated on October 2, 2026).

## The app's license opens "non-commercial" to us

The app and the site are free, without ads or in-app purchases, and are
themselves published under CC BY-NC 4.0. They meet Creative Commons'
definition of "NonCommercial": a use not primarily intended for commercial
advantage or monetary compensation. Translations under **CC BY-NC** are
therefore open to us, just like the public domain, CC0, CC BY and CC BY-SA.

This choice binds us: if the app became paid, carried ads or purchases, the
NC translations (English Talmud, English Tanakh from JPS or Koren) would
have to be removed.

## Coverage, as a share of each corpus's Hebrew words

Measurement: for each version, the share of Hebrew words (segment by
segment, on Sefaria's segmentation, the one our files use) whose segment
has a non-empty translation.

| Corpus                |  Hebrew words |    Free English | Free French |
| --------------------- | ------------: | --------------: | ----------: |
| Torah                 |        70,130 |            100% |        100% |
| Neviim                |       125,409 |            100% |        100% |
| Ketouvim (Tehilim)    |        76,656 |            100% |        100% |
| Mishna (63 tractates) |       192,537 |            100% |         58% |
| Talmud Bavli (37)     |     1,928,381 |           99.9% |          0% |
| Rachi on the Torah    |       166,480 |           99.7% |          0% |
| Hovot Halévavot       |        89,075 |             96% |          0% |
| Pélé Yoets            |       233,554 | 7% (unreliable) |          0% |
| **Total**             | **2,882,222** |         **92%** |     **13%** |

For the Torah, the Mishna and the Talmud combined (2.19 million words):
**99.9% in English, 8% in French**. The Talmud accounts for two thirds of
the whole library: it is what makes the gap.

## The selected versions

### English

| Corpus                  | Version (exact title in Sefaria)                                                  | License                              | Notes                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Entire Tanakh           | The Koren Jerusalem Bible                                                         | CC BY-NC                             | A single version for the whole Tanakh, an Orthodox translation.                                                                 |
| Entire Tanakh, fallback | The Holy Scriptures A New Translation JPS 1917                                    | Public domain                        | Dated English, but with no conditions at all.                                                                                   |
| Torah, alternative      | Metsudah Chumash, Metsudah Publications, 2009                                     | CC BY                                | Literal; the "with Onkelos" variant is under CC BY-NC.                                                                          |
| Mishna                  | Mishnah Yomit by Dr. Joshua Kulp                                                  | CC BY 3.0                            | All 63 tractates, Avot included, fully filled in.                                                                               |
| Talmud Bavli            | William Davidson Edition - English                                                | CC BY-NC 4.0                         | Koren Steinsaltz. See below: translation and explanation are interwoven.                                                        |
| Rachi                   | Rashi Chumash, Metsudah Publications, 2009                                        | CC BY                                | 99.5%.                                                                                                                          |
| Rachi, alternative      | Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934 | Public domain (according to Sefaria) | An English work: in the United States, each volume only enters the public domain 95 years after publication (the last in 2030). |
| Hovot Halévavot         | Duties of the Heart, trans. Rabbi Yosef Sebag                                     | CC BY                                | 75%; supplemented by Hyamson (1925, public domain) it reaches 96%.                                                              |
| Pélé Yoets              | Sefaria Community Translation                                                     | CC0                                  | 7%, anonymous and unreviewed translators: not usable.                                                                           |

### French

| Corpus           | Version (exact title in Sefaria)                                 | License       | Notes                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Entire Tanakh    | Bible du Rabbinat 1899 [fr]                                      | Public domain | Zadoc Kahn and the Rabbinate, 1899 and 1906; transcribed from Wikisource, verse by verse. Only Joshua 21:36 and 21:37 are missing.           |
| Tanakh, fallback | La Bible, Traduction Nouvelle, Samuel Cahen, 1831 [fr]           | Public domain | Cahen died in 1862 (Sefaria shows "unknown").                                                                                                |
| Mishna           | Le Talmud de Jérusalem, traduit par Moise Schwab, 1878-1890 [fr] | Public domain | 39 tractates: those of the Jerusalem Talmud (Zeraïm, Moèd, Nachim, part of Nezikin, the beginning of Nida). Footnotes removed at build time. |
| Pirké Avot       | Maximes des Pères, trans. by Rabbi Rivon Krygier, 2023 [fr]      | CC BY-NC      | Complete tractate.                                                                                                                           |

What is missing in French, and why:

- **Mishna**: all of Kodachim, all of Taharot except Nida (chapters 1 to
  4), Édouyot. The Jerusalem Talmud does not comment on them, so Schwab did
  not translate them. Maasser Chéni has only 7 mishnayot out of 57 at
  Sefaria (a digitization gap: Schwab translated it in full).
- **Talmud Bavli**: no free, structured French translation. The 19th-century
  translations (Chiarini 1831 for Berakhot; Rabbinowicz, from 1873 to 1880,
  for the three Bava, Sanhedrin and Makot) exist only as scans, often
  abridged or reorganized, and have never been aligned with the daf. The
  complete Steinsaltz translation into French (completed in June 2026) is
  under copyright.
- **Rachi**: no French translation before 1957; all editions (Fondation
  Samuel et Odette Lévy, Colbo, Cerf) are under copyright.
- **Hovot Halévavot** and **Pélé Yoets**: only recent translations
  (Chouraqui 1950, Frajerman 2018), under copyright.

## Pitfalls to avoid

- **Never the `merged` files** for a translation. They assemble, segment by
  segment, versions with different licenses (the Genesis one starts with
  JPS). `scripts/download-texts.mjs` currently reads `English/merged.json`:
  for a translation, you must read the file of the chosen version, named by
  its exact title.
- **Sefaria also publishes machine translations.** They sometimes carry a
  "✧" in their title ("Sefaria Kli Yakar, 2026 Claude 3.7"), sometimes the
  mention "DeepL" or « établie à partir de la traduction anglaise » ("based
  on the English translation"). We only take the versions listed here.
- **"Sefaria Community Translation"** is CC0 but anonymous and unreviewed:
  we do not rely on it, even where it is provided (78% of the Mishna).
- **Steinsaltz's English Talmud**: the literal translation is in bold
  (`<b>`) and Steinsaltz's explanation slips in in roman type, within the
  same sentence. Both must be displayed and the bold kept, not the
  explanation removed: the bold alone gives a choppy text.
- **Sefaria's licenses are declarative.** For a few versions, only Sefaria
  displays them and the publisher confirms them nowhere: JPS 1985,
  Metsudah, Sebag. They remain usable (Sefaria has distributed them this way
  for years), but a contested version should leave the app without delay.

## Crediting a translation

At the foot of the text, a single line: « Traduction : » ("Translation:")
and the name of the person who translated (« Traduction : Moïse Schwab »),
nothing else. Not the edition's title, not the license, not Sefaria, not
what was retouched: the reading page stays uncluttered (owner's decision,
October 2026).

The name is a link to the translation on Sefaria, whose page gives the
edition, the publisher and the license. That is what keeps us compliant: CC
licenses require crediting the author, the license and the modifications,
but allow doing so through a link to a page that carries them. Each
translation's file, for its part, keeps all its sources (`sources`: name,
author, year, publisher, license and its link).

## Going further in French: ask

The public domain will never cover the Talmud, Rachi or musar in French.
The only way is permission from the rights holders, as Koren granted Sefaria
for English:

- **Talmud**: the Steinsaltz Center and Biblieurope, for the French
  translation completed in 2026;
- **Mishna**: the Rabbinate (Presses du Temps Présent), or the publisher of
  the Mishna Kehati in French, for Kodachim and Taharot;
- **Rachi**: the Fondation Samuel et Odette Lévy, or Colbo.

A free app, without ads, that credits and links back to the publisher, is
the easiest request to accept.

## In the app

### What is integrated

The versions from the two tables above, except the "fallback" and
"alternative" ones, plus two supplements for the files in the Talmud
section that have no Babylonian gemara:

- **Chekalim** (`talmud/shekalim.json`), which is from the Jerusalem
  Talmud: Guggenheimer in English ("The Jerusalem Talmud", De Gruyter, CC
  BY) and Schwab in French;
- **Kinim** and **Midot**, which only have their michna: Kulp.

Measured in reader lines (a verse, a michna, a sentence of gemara) at build
time:

| Corpus              | English |                     French |
| ------------------- | ------: | -------------------------: |
| Tanakh and Tehilim  |    100% |                       100% |
| Michna              |    100% |   100% (60% human, 40% AI) |
| Talmud              |   99.6% | 99.6% (AI; Chekalim human) |
| Rachi (chnei mikra) |   99.5% |                 99.5% (AI) |
| 'Hovot Halévavot    |     98% |                   98% (AI) |

### The AI-assisted French translation

What exists only in English is translated into French by agents (Claude
Sonnet), from the human English translation and the Hebrew, following
`docs/traduction-ia.md`: it is a first version, to be reviewed. The
translated lines live in `data/traductions-ia/fr/<fichier>`, keyed by their
line, and `download-translations.mjs` takes them last, after any human
translation. The foot of the text says so: « Traduction : Joshua Kulp
(traduit de l'anglais par IA) » ("Translation: Joshua Kulp (translated from
English by AI)"). The license is that of the English translation it comes
from (an adaptation keeps it).

`scripts/translate-ia.mjs` splits the work into batches and gathers the
results (checked line by line: complete, in French, bold and italics kept,
repository typography); a rejected batch goes back in the next round. A bold
opened inside a bold becomes the source's italics again: it is the mistake
the agents make most often on a transliterated Talmud term.

The few lines without a translation are those that the alignment cannot
find at Sefaria (a sentence of gemara split differently): they stay empty
rather than receive another line's translation.

### Where they live

`public/texts/traductions/<langue>/`, at the path of the Hebrew file they
translate (`texts/mishna/berakhot.json` → `texts/traductions/fr/mishna/berakhot.json`),
and an index (`texts/traductions/index.json`) that gives, for each Hebrew
file, its languages. A translation file has the shape of its Hebrew, each
string replaced by its translation, and carries its sources (name, author,
license, link): it is what says how to credit it.

Separate from the Hebrew, not in the same file: whoever reads in Hebrew
downloads nothing more, and the English Talmud (58 MB for English in total)
alone weighs more than all the Hebrew texts. For the same reason, the native
app does not bundle them (`scripts/prune-native-bundle.mjs`): they are read
online.

### Rebuilding them

```bash
node scripts/download-translations.mjs              # everything
node scripts/download-translations.mjs --only=mishna --lang=fr
node scripts/texts-manifest.mjs                     # then the manifest
```

The script reads each version by its exact title (never a `merged`),
refuses a license outside the list and a title that betrays a machine
translation, and aligns each Hebrew line of our files with Sefaria's Hebrew
by its letters alone: our files re-split Sefaria (aliyot of a paracha, Trei
Asar, musar paragraphs), so alignment by position would go wrong. Adding a
version means adding it to `VERSIONS` and `CREDITS` in the script, and to
this registry.

`src/__tests__/translations.test.ts` covers the rest: each file has the
shape of its Hebrew, each reader section has as many translated lines as
Hebrew lines, each source has a license from the list and a link, and each
corpus keeps at least the coverage announced above.

### In the reader

A « Traduction » ("Translation") command in the text's toolbar, and the same
setting in the reading settings, with the choice of language when the text
has two (`composables/useTranslation.ts`). Off at first, it then persists
from one text to the next. The language follows the choice made, then the
interface's, then what exists: a French speaker reads the Talmud in English,
and a sentence tells them so. The translation sits under each verse; in the
Talmud, the gemara then goes from its block per daf to a series of
sentences, each followed by its own. The daily reading and the chnei mikra
follow the same setting, Rachi included. At the foot of the text, the
translator's name (`TranslationCredit.vue`, see "Crediting a translation").
No translation on a tefila.

The commentaries follow it too: in the study panel (`CommentaryPanel.vue`),
Rachi on the Torah has its translation under each comment, in the language
the text would take, with the AI notice above and the translator's name
below (`loadTanakhRashi`, `usePassageCommentaries`). Turning the setting on
or off, or changing the language, reloads the open panel. The other
commentaries (Rachi on the Nach, those of the gemara, the Michna and the
Choulhan Aroukh) have no translation yet and stay in Hebrew.

The pages that read several texts one after the other (the chnei mikra, the
Tehilim of the day, the daily reading of Mon parcours, a session's texts)
follow the setting text by text (`DailyReadingItem.vue`), and carry the same
command in their reading menu, with the choice of language
(`composables/useEntriesTranslation.ts`): a translation turned on in the
library must be turned off where it shows. `commentaryTranslation.test.ts`
checks both.

An AI translation is announced at the top of the text, in the reader as in
the daily reading (Rachi included): « Traduction en français faite par IA à
partir du texte anglais : elle peut contenir des erreurs » ("French
translation made by AI from the English text: it may contain errors")
(`TranslationAiNotice.vue`). The reader recognizes it by the `ai: true` flag
that `download-translations.mjs` sets on its source; an older version of the
app ignores it. `translations.test.ts` checks that every AI source, and it
alone, carries it.

### What remains to be done

- **The AI-assisted French** is to be reviewed, and replaced by a human
  translation as soon as one is obtained (see "Going further in French:
  ask").
- **The Pélé Yoets** has no free translation in any language.
- **Offline**: downloading a book does not download its translation.
  Offline, the command is not offered (its index cannot be read); if it was
  turned on before the connection dropped, a sentence says that the
  translation is read online.
- **The prerendering** of the library pages (search indexing) only carries
  the Hebrew.

## How to redo the measurement

1. Download `https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json`.
2. For each book, take the `merged` Hebrew and each English or French
   version (a French version carries `"actualLanguage": "fr"` and a title
   ending in `[fr]`). The `license` field of each version file gives its
   license.
3. Count, segment by segment, the Hebrew words whose translated segment is
   not empty, and divide by the corpus total.
