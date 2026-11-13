# Texts travel faster than code

This document says a single thing, and the rule that follows from it: **the
files in `public/texts/` are read by apps older than they are.** Whoever
writes a tefila text, or the recipe that produces it
(`scripts/build-sidour.mjs`), writes for those versions as much as for ours.

## Why they don't arrive together

The website and the apps ship from the same `vX.Y.Z` tag. The website is
live within the minute; the app, for its part, waits for Apple's and
Google's review, then for the device to be willing to update. An installed
version can stay months behind (that is the whole reason for
`appUpdateService`).

Meanwhile, the native app doesn't settle for the texts in its bundle. It
only bundles the Sidour (`src/datas/bundledTexts.json`), so that people can
pray without a network right from installation; all the rest of
`texts/tefila/` is removed by `scripts/prune-native-bundle.mjs` and gets
downloaded. And even the bundled Sidour is compared with the website
(`offlineTextStore.fetchTextResponse`): as soon as the website serves
another version, with a hash that guarantees it is indeed the latest
published, the app downloads it and then reads it instead of its own. The
result, and this is intended for content fixes:

> the file is from today, the code that reads it is from the installed
> version.

## What an older version does with a condition

The reader only displays a conditional passage if its condition holds among
the day's occasions (`textService.saidOn`, `dailyCycles.activeOccasions`).
But this list of occasions and this reading of conditions live in the code,
hence in the installed version:

| What the file writes                                    | What a version that doesn't know it does with it                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `when` on an occasion key it doesn't set                | it treats the condition as false: **the passage disappears**              |
| `when` with a syntax it doesn't split (`!`, `\|`)       | it looks for the whole string among the occasions: **the passage disappears** |
| a field it doesn't know (`unless`)                      | it ignores it: **the passage is displayed**                               |

The first case is the one nobody sees coming: it raises no error, it leaves
no trace, it removes tahanoun one morning, or the conclusion of a blessing in
the middle of the 'Amida, for readers we don't have in front of us. It
happened in Tichri 5787: the conclusion « Barouh ata Adonaï, boné
Yerouchalayim » and the whole tahanoun disappeared from every published
version, because the website had started writing `!tisha-beav` and
`tahanoun-ordinaire`, two forms their code could not read.

## The rule

1. **`when` only carries a simple key**, without `!` or `|`. Reading stays
   tolerant (`saidOn` can still read them), but the files no longer write
   them.
2. **What removes a passage goes through `unless`**, the exception: the
   ordinary conclusion of the third blessing has no condition; it is the ten
   days of techouva that remove it. An older version ignores `unless` and
   displays the ordinary text: it loses the nuance, not the text.
3. **An alternative is written as two passages**, one per key, when the two
   days are mutually exclusive (the Torah reading on Monday and Thursday, the
   one on fast days): each version displays the one it understands, and never
   both.
4. **A new occasion key only conditions new content.** Adding a key to the
   calendar costs nothing; moving a passage that already existed onto this
   new key makes it disappear everywhere else. To refine a passage already
   served, keep its key and add an `unless`.
5. **Every paragraph keeps an unconditional Hebrew fragment**, so that a
   paragraph can never be rendered mutilated, whatever the version.
6. **What a published version cannot hide, it must be able to read.**
   `unless` removes a passage for those that understand it, and leaves it for
   the others: a replaced conclusion (« Hamélekh hakadoch » during the ten
   days) is therefore displayed twice on those versions, and no key will
   change that, since their calendar cannot name "outside the ten days". They
   are then given the layout of the printed sidour, which writes both and
   puts the rule in between: a stage direction `{ when: clé, unless: clé }`,
   which only a reader ignoring `unless` displays (see
   `didascalieDeRemplacement` in build-sidour.mjs). It will be removed once
   the fleet has caught up.
7. **New coverage is named by a new key, never by a key already set.** Ata
   'honantanou is said under `jour-0`, which everyone knows; the end of Yom
   Tov, which is added to it, received `motsae-yom-tov` rather than `motsae`:
   the latter, set since v3.10.1, would have made the versions that know it
   without knowing `unless` say the passage twice on Saturday night.

8. **A text that leaves the catalog keeps its file.** The catalog
   (`src/datas/textStudies.json`) lives in the code, the file on the website:
   a published version keeps opening the text under its old name. The
   Hochanot, which went from one page per day to a single book that opens on
   the day (`hochanot.json`), therefore still write their eight former pages
   (`build-moadim.mjs`, `PAGES_DU_JOUR`), which the catalog no longer
   carries; the web addresses of those pages, for their part, redirect to the
   book.
9. **A new field only carries new content.** A block's reference to another
   text (`link`) and the marker that receives it (`anchor`) are ignored by
   published versions: the Cha'harit Hochanot block there keeps its first
   verse and the halakha that says where to read the rest. The same goes for
   the end of a repeated 'Amida (`hazara`): a published version doesn't
   display the 'hazara button, and nothing of the text is missing.
10. **A replacement that the calendar decides is done in the calendar.**
    On 'Hol haMoed, the holiday's psalm takes the place of Lamnatséa'h at
    Min'ha. The psalm receives a new key (`chir-moed-minha`), and it is the
    recent code that stops setting `lamnatseah-minha` on those days, instead
    of an `unless` in the file. A published version still sets
    `lamnatseah-minha` and doesn't know the new key: it keeps Lamnatséa'h, as
    before; a recent version only says the holiday's psalm. None loses text,
    none says both (enforced by `sidourOccasions.test.ts`).

    Same principle for the Kaddich on Moussaf days (key `moussaf`): the
    Kaddich Titkabal after Ouva letsion and the Kaddich yehé chelama before
    Moussaf carry `unless: "moussaf"`, the half-Kaddich that replaces them
    `when: "moussaf"`. A published version keeps the weekday order, and also
    sees, on Roch 'Hodech, the Kaddich Titkabal and the Kaddich yehé chelama
    that now follow Moussaf, as it already saw them on 'Hol haMoed: two
    collapsed 'hazan boxes, not a single word of the prayer duplicated.

11. **A passage that drops on certain evenings is removed through `unless`
    and a new key.** The vidouy of the bedtime Chema is not said on nights
    without tahanoun: it carries `unless: "sans-tahanoun-nuit"`, a key that
    the reader sets (`nightWithoutTachanun`, enforced by `tachanun.test.ts`)
    since it depends on hatsot at the end of Chabbat. A published version
    ignores `unless` and displays the vidouy every evening, as before.
    Likewise, the six-direction dial carried by the stage directions of the
    Hallel na'anou'im (`naanouim` on an `r` fragment) is an ignored field: a
    published version keeps the stage direction, without the button.

Points 1, 2, 5 and 6 are enforced by a test
(`src/__tests__/sidourCompatibilite.test.ts`); the keys used are checked
against those the calendar sets (`src/__tests__/sidourContent.test.ts`).

### The commentaries of the daf page

The guemara's Rachi and Tossafot live separately, in chunks of twenty amoudim
(`texts/talmud-meforshim/<traité>/<n>.json`, `{ title, from, rashi, tosafot,
rashbam? }`, written by `scripts/download-texts.mjs --only=meforshim`).
`rashi[a][p]` is the list of commentaries on passage `p` of amoud `a`, in
Sefaria's passage numbering, empty ones included: it is what the reader finds
again from `DafBlock.passages`, and **it is not renumbered** without also
regenerating the guemara. `rashbam` lists the amoudim of the chunk where the
Rachbam takes Rachi's place (Bava Batra). An installed version computes the
name of an amoud's chunk itself (`MEFORSHIM_CHUNK` in `textService.ts`):
**the chunk size doesn't change without changing the folder**, otherwise a
published version would request `3.json` for an amoud that is no longer
there, and would show the guemara without its commentaries. The amoud and
passage indexes are those of the tractate's guemara file;
a regenerated guemara that gained or lost an amoud is therefore regenerated
with its commentaries (enforced by `src/__tests__/pageForm.test.ts`, which
checks the alignment on every tractate).

### The commentaries of the Michna and of the Neviim / Ketouvim

Two corpora are added, written by `scripts/download-texts.mjs
--only=commentaires`, and read only by the study panel:

- `texts/mishna-meforshim/<traité>.json`, `{ title, bartenura,
tosafotYomTov }`: one file per tractate, named like that of its Michna;
- `texts/rashi/<id>.json` for the Neviim and Ketouvim entries (318 to 339),
  in the format of Rachi on a paracha (`{ title, he }`, without `fromBook` or
  `grouping`). The file for the book of Tehilim (328) also serves the psalms
  read one by one: its group `n - 1` is psalm `n`.

Their grid is that of the delivered text file: one group per group of the
file (chapter, book of the Twelve), one cell per **displayed** line (an empty
line in the source has none), one list of commentaries per cell, the dibbour
hamat'hil in `<b>…</b>`. A text read chapter by chapter (a Michna tractate,
Chir HaChirim) takes its chapter's group (`section.index - 1`); a text read
in one piece takes all the groups end to end. A published version only reads
these files for the parachiot (the chnei mikra Rachi option): the Neviim and
Ketouvim files change nothing for it. A regenerated text that gained or lost
a line is regenerated with its commentaries (enforced by
`src/__tests__/commentaryFiles.test.ts`).

### The book's lines: the Vilna page, the Sefer Torah columns

The page layout composes its lines on screen: they are not the book's. Two
folders say where the book breaks its own. They are written by
`scripts/layout/` (instructions in its `README.md`); they carry almost **no
words** (only the abbreviations in `short` and the text in `fill`, below),
mostly positions in the texts we already have. A published version doesn't
request them, and the existing files don't change.

- The Sefer Torah columns are recorded for the whole Torah, and read: the
  Sefer Torah layout writes line for line like the scroll
  (`TorahScroll.vue`, `scrollLayout.ts`).
- The lines of the Vilna page are read too: the daf page places each line of
  the guemara, of Rachi and of Tossafot where the book prints it
  (`TalmudPrintedPage.vue`, `dafLayout.ts`). A tractate without a line file
  is composed as before (`TalmudPage.vue`).

**The Vilna page**: `texts/talmud-layout/<traité>/<n>.json`, in chunks of
twenty amoudim like `talmud-meforshim` (same rule: the chunk size doesn't
change without changing the folder).

```text
{
  "edition": "vilna",
  "from": 0,
  "pages": [
    {
      "height": 16540,
      "pitch": [286, 254],
      "main": [[2968, 1500, 4048, [0, 0, 7]], [2968, 2056, 4032, [0, 15, 1], [1, 0, 7]]],
      "rashi": [[5127, 206, 4857, [0, 0, 9]], [7063, 698, 2921, [3, 21, 6, 4]]],
      "tosafot": [[0, 190, 4841, [0, 0, 12]]]
    }
  ]
}
```

- `pages[a]`: the page of amoud `from + a` (`null` if it has no lines).
  Everything there is counted in **ten-thousandths of the page width**,
  guemara and commentaries included, margins excluded. `height`: its height;
  `pitch`: the line spacing of the guemara, then that of the commentaries.
- A line is `[x, y, width, piece, piece…]`: its left edge, the middle of its
  height, its width, then the pieces of our text that it carries.
- A piece is `[passage, word, count]`. The passage is that of the guemara
  file (`he[amoud][passage]`, `DafBlock.passages`). In `main`, the word is
  counted in `gemaraPageText([passage]).split(" ")`. In `rashi` and
  `tosafot`, it is counted in the passage's commentaries end to end, each
  read by `parseRashiComment` (its dibbour, then its text), split on spaces.
  A fourth number gives the amoud when it is not the page's: a commentary
  begun on the previous page, or that the book prints a few pages after the
  place where our file stores it.
- A line carries several pieces when the page doesn't print the commentaries
  in the order of Sefaria's passages, or when a line ends one commentary and
  begins another.
- `initial` (optional): the opening word of a tractate or a chapter, written
  very large above the guemara. `[x, y, width, height,
passage, word, count]`: its left edge, the middle and height of its
  letters, then its position in the guemara. It is in no line of `main`.
- `big` (optional): the guemara words that the book writes larger within
  their line, `[passage, word, count]`.
- `closing` (optional): « הדרן עלך … », the line that closes a chapter,
  written separately in large type. Same shape as `initial`.
- `short` (optional): the book's abbreviations, where our fully spelled-out
  words don't fit in the line. `[zone, passage, word, count,
text]` (zone 0 for the guemara, 1 for Rachi, 2 for Tossafot; a sixth number
  gives the amoud when it is not the page's): the page writes `text`
  (« המע"ה ») in place of those words. It is the only text a line file
  carries, and only on lines that would be unreadable without it.
- `fill` (optional): the book's own text, where ours has nothing (Sefaria's
  text is not always the page's: it lacks words, sometimes a paragraph).
  `[zone, x, y, width, text, dibbour]`, zone 1 for Rachi, 2 for Tossafot;
  `dibbour` says how many of the first words are the dibbour hamat'hil.
  These words come from the book, not from our files: they are not linked to
  any passage.
- `formula` (optional): « הדרן עלך … » when our texts store the formula on
  the neighboring page, `[x, y, width, height, text]`, with our words.
- What the page prints and we don't have has no line: the catchwords,
  Rabbénou 'Hananel, the Ein Michpat, the Massoret haChass, and the
  commentaries typeset like Rachi that our files don't carry (the Rachbam on
  Pessa'him, the Chita Mekoubétset). Their place stays blank.

Where these lines come from (`scripts/layout/vilna.py`): pages recomposed
line for line after Vilna, as PDFs, where the text is real text. The font
gives the zone, the position gives the line; the page's text is used to find
the words of ours, and doesn't go into the repository. These files are heavy
(about 5 KB per amoud): the app doesn't bundle them (`PRUNED_DIRS`), it gets
them from the website like the guemara.

**The Sefer Torah columns**: `texts/torah-layout/<id>.json`, one file per
paracha (264 to 317), under the number of its text file. The scroll is the
one with 245 columns of 42 lines, where each column begins with a vav, the
one of today's reading tikounim (`edition: "tikkun-245"`).

```text
{
  "title": "Beshalach",
  "edition": "tikkun-245",
  "columns": [
    {
      "column": 76,
      "from": 17,
      "lines": [[null, [0, 0]], [[0, 1]], [[5, 6], null], [], [[57, 8], [58, 0]]]
    }
  ],
  "big": [],
  "small": []
}
```

- `columns`: the scroll columns the paracha occupies, by their number in the
  scroll (1 to 245). `from`: the line of the column (from 0 to 41) where the
  paracha begins; the following columns begin at 0, and all but the last go
  down to the forty-second line.
- `lines`: the lines, in order. A line is the sequence of its **pieces**, each
  noted by the position of its first word, `[verse, word]`; the verse is that
  of the flattened paracha file (like `data-line` in the reader), the word is
  counted in `scrollVerseWords(verse)`. A piece goes from its first word to
  that of the next piece. Between two pieces of a line, a blank: a setouma, a
  brick of Az yachir.
- `null` stands for a blank at the edge of the line. At the end
  (`[[5, 6], null]`), the line stops before the edge: it is a petou'ha, or
  else the next paracha continues on the same line. At the start
  (`[null, [0, 0]]`), what precedes in the line belongs to the previous
  paracha: fourteen parachiot begin this way in the middle of a line.
- `[]`: a blank line (before and after Az yachir, after Haazinou). The four
  blank lines that separate two books, and the one before Haazinou, are in no
  file: they are read from `from`.
- `halves`, on a column: from which line to which line (positions in
  `lines`) Haazinou is written, each line in two halves of equal width.
- `big`, `small`: the large and small letters, each by its verse, its word
  and its position in the word. They come from the markup of Sefaria's text.

These files weigh 216 KB in total and stay in the app binary (they are not in
`PRUNED_DIRS` of `scripts/prune-native-bundle.mjs`): a downloaded paracha has
its lines without a network.

Where these lines come from, in increasing order of authority
(`scripts/layout/scroll.py`): the tikkun.io columns (MIT license), whose
text is ours word for word; the images of the ORT tikoun, against which each
line is realigned (eleven breaks corrected out of 10,270 lines); the written
tradition for the two chirot and their surroundings (Rambam, Hilkhot Sefer
Torah 8, 4; Rema, Yoré Déa 275, 6: five corrections). The details, and what
this survey does not guarantee, are in `scripts/layout/README.md`.

What the tests enforce (`src/__tests__/textLayout.test.ts`): every position
written exists and the lines share the text word for word; the 54 files
follow one another with no gap from one end of the 245 columns of 42 lines
to the other; each column begins with a vav, except the six that tradition
names; the two chirot have their lines. For the Vilna page: each piece
designates words that exist, no word is on two lines, and the guemara lines
carry its whole text. These indexes are those of the text files:
a regenerated guemara, commentaries or paracha require redoing the survey. A
line file that no longer matches its text is not read: the column is then
written our way, justified (`scrollColumns` returns `null`).

## When the fleet has caught up

These constraints are not eternal: they hold as long as earlier versions
read our files. The day all installed versions can read `!` and `|` (v3.10.1
and later), point 1 may be relaxed, knowingly, by changing the test that
enforces it. Point 4, however, will always hold: the calendar will always
move faster than the phones.
