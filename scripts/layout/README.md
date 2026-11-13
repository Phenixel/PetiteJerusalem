# The book's lines

This folder records where each line of the book breaks, and writes it into
`public/texts/torah-layout/` (the columns of the Sefer Torah, for the whole
Torah) and `public/texts/talmud-layout/` (the Vilna page). The format of
these files is described in `docs/compatibilite-textes.md`.

Nothing is transcribed. We already have the text (`public/texts/`); the
sources only serve to know where the lines break. On an image, no letter
is read: we record the lines and the width of their words, and we align
that sequence of widths with the words of the text, whose width in the
book's typeface we can predict.

## The Sefer Torah

The scroll recorded is the one with **245 columns of 42 lines**, where
each column begins with a vav (« vavé ha'amoudim »), except the six of
« בי"ה שמ"ו ». This is the layout of today's reading tikounim.

```bash
# The sources (once).
python3 scripts/layout/fetch.py tikkun-io
python3 scripts/layout/fetch.py scrollscraper
python3 scripts/layout/fetch.py sefaria-torah

# The check, without writing anything: what gets realigned, and why.
python3 scripts/layout/scroll.py --check

# The 54 files, then the manifest and the tests.
python3 scripts/layout/scroll.py --write
node scripts/texts-manifest.mjs
npx vitest run src/__tests__/textLayout.test.ts src/__tests__/scrollLayout.test.ts
```

Three sources, from the most convenient to the most reliable
(`scroll.py`):

1. **tikkun.io** (MIT license) gives the 245 columns line by line, as
   text. Its text is Sefaria's, like ours: the 79,977 words follow one
   another identically, so a line is recorded by the position of a word in
   our file, without any alignment.
2. **The images of the ORT tikoun** show the same lines. tikkun.io was
   most likely derived from them, through a splitting of verses that
   sometimes places a word one line too high or too low. Each line is
   therefore realigned against its image, and the image is right: eleven
   breaks corrected (columns 16, 82, 83 and 88), and two lines that
   tikkun.io stops before the edge although they are full.
3. **The written tradition** fixes the lines of the two chirot and their
   surroundings. Where both sources depart from it, it is right: the five
   lines after Az yachir begin with « ותקח, אחריה, סוס, ויצאו, ויבאו »
   (Rema, Yoré Déa 275, 6); in Haazinou, « ואילים » ends its line (Rambam,
   Hilkhot Sefer Torah 8, 4); the last line of Az yachir is in three
   pieces. Blank lines follow the rule: four between two books, one before
   and one after each chira.

What the check is worth. `scroll.py --probe 9` moves one break in nine
(1,075) by one word, then asks the check to find them: it finds them all,
with no false alarm. The columns of the two chirot (78, 242, 243) are
excluded from this, their letters being stretched on the image: the
tradition fixes them, and they were reviewed by eye.

What the record does not guarantee:

- **One scroll is not another.** These lines are those of the 245-column
  tikoun. A scroll written on another tikoun (the more spaced-out one by
  Rav Davidovitch, a Yemenite scroll, an old scroll) breaks its lines
  elsewhere.
- **Two witnesses, not three.** tikkun.io derives from the ORT images:
  outside the chirot, nothing else checks them. A line that the ORT tikoun
  broke differently from a printed tikoun would go unnoticed.
- **The six lines after Haazinou** are not those of the Rema (five lines,
  which require a very wide column): the 245-column scroll writes six, so
  that the next column begins with a vav.
- **The text** is Sefaria's (the Aleppo Masorah). Ashkenazi and Sephardi
  scrolls differ from it by a few letters (Berechit 9, 29; Devarim 23, 2):
  this changes no line, but it is not the letter of every scroll.
- The inverted nounim of Bamidbar 10, 35 are not written.

## The Vilna page

```bash
python3 scripts/layout/vilna.py beitzah --fetch          # the pages (one per second)
python3 scripts/layout/vilna.py beitzah --check          # what the alignment is worth
python3 scripts/layout/vilna.py beitzah --write          # public/texts/talmud-layout
python3 scripts/layout/vilna.py all --write              # the whole Shas
```

The source is one page per amoud, recomposed line for line after Vilna, as
a PDF (shas.org reader, see `sources.json`). The text there is real text:
`vilna.py` reads its words, their font and their position.

- **The word**: its letters and its box come from `pdftotext -bbox`, its
  font from `pdftohtml -xml`. They are matched by letters and by position,
  not by the middle of the box alone: in half of the tractates, the fonts
  report false ascenders and the box of a dibbour word is three lines
  high.
- **The zone** comes from the font, and the font is recognized by what it
  writes: the one whose words are those of our guemara, the one whose words
  are those of our commentaries (Rachi and Tossafot share it, not always at
  the same size), those of the dibbourim. The font's name is not used: in
  fifteen tractates it says nothing, and the same script is split into
  several fonts there. The margins have their own, which we leave alone.
- **The line** comes from the position. A word whose box is too tall is put
  back on its line: the one the body words leave free at that spot
  (`settle`). A cross-reference in small type, a word in square brackets, a
  piece of a compound word set apart join the line they touch (`adopt`); a
  guemara line alone in its font is recognized by its position
  (`missing_rows`). Footnote markers are not words.
- **The columns**: two neighboring columns are separated at their gutter,
  which falls at the same spot from one row to the next. A justification
  gap can look like one: two pieces of the same row that follow each other
  in our text are joined back together.
- **Whose commentary line it is**: Rachi's or Tossafot's according to the
  font of the dibbour it opens, otherwise according to its words. The side
  does not tell: on some pages Rachi takes up both columns.
- **Our words**: the page's text and ours are the same Talmud. They are
  aligned word by word; what differs between two matched words is an
  abbreviation (« ר' » for « רבי », « א"ל » for « אמר ליה »), and our words
  take the line of the printed word that corresponds to them. The page
  does not print the commentaries in our file's order: sequences of words
  left unmatched are searched for across the whole page.

- **What the book writes apart.** The opening word of a tractate or a
  chapter, very large above the guemara (`initial_words`: its box is
  measured on the ink, and it leaves the first line); « הדרן עלך … » at the
  end of a chapter (`closing_lines`; our commentaries repeat it, the book
  does not: it is treated as placed there); words written larger within
  their line (`big_words`).
- **A line stays readable.** Words of our text that the page does not have
  identically take the line of their neighbors; but a line does not carry
  many more letters than the book prints. Beyond that (an addition in
  square brackets in our text, which the book does not have), those words
  are left out: better a word missing from the page than a crushed line.
  Before that, a word at the edge of an overfull line moves to its
  neighbor if it has room; a cross-reference where our text names the
  tractate that the book implies, or a source that the edition added in
  parentheses, stays as the book prints it. And where it is our words
  themselves that weigh down the line (« המוציא מחברו עליו הראיה » for
  « המע"ה »), the file carries the book's abbreviation (`short`). `--check`
  counts the lines that are still overloaded.

- **The text we do not have.** Sefaria's text is not always the page's. A
  line in our columns with none of our words, caught between two lines of
  our commentary, or the end of a line that our text does not have, is
  written with the book's text (`book_lines`, `fill` in the file), if the
  page renders its letters properly (the noun above all). A commentary
  title is recognized by its words in the columns, even when its font is
  also used for margin notes; a line made of a single title stays whole.

### The witnesses

A record that looks good in figures can be wrong on screen. Three
witnesses tell:

1. **The text.** `--check` counts, per zone, the lines whose two edges are
   found word for word, the printed words found in our text, and our words
   placed on a line.
2. **The ink** (`ink_faults`). The same page is rendered as an image, and
   for each line we check whether the ink does stop at both its edges: ink
   just beyond (a word is missing from the line), blank just short of it
   (its box is too long). The text layer can be wrong without saying so;
   the image cannot.
3. **The book's scan.** The shas.org pages are a recomposition: we need to
   know whether it follows Vilna. The guemara lines of Berakhot (from 2a to
   10b) were compared with those read on the scan of the Romm edition (the
   pilot, below, which guesses words from their width): same number of
   lines on sixteen pages out of eighteen, 95% of line beginnings
   identical, and the differences, checked on the scan, prove the PDF
   right.

A page is only written if it is reliable. It is set aside, and the app then
lays it out its own way, when: four or more words are placed on top of
one another in the commentaries; fewer than 85% of guemara lines have both
their edges; less than 95% of our guemara is placed; fewer than 60% of a
commentary's printed words are found in ours; the ink contradicts more
than 6% of the lines (and more than four); more than two words out of five
of a commentary we have are printed neither on its page nor on its
neighbors. A tractate where fewer than half of the pages pass is not
written at all (none today).

The commentators who take over from Rachi or Tossafot come from Sefaria
like them (`scripts/download-texts.mjs`), and hold their column: the
Rachbam in Bava Batra (where Rachi stops) and in Pessa'him (next to Rachi,
from 99b); the Ran in Nedarim, in place of Tossafot, which appears there
only in the book's margin and remains only in the commentaries pane.
Without them, half of Nedarim did not pass the checks.

The page's text is the book's. Our words (Sefaria) give each line its place
in the text, the passage and the commentary that are opened; but where the
book writes something else (an abbreviation, « א"ר » for « אמר רבי »;
another reading; one word more or less), the file says so in `short` and
the page writes the book (`book_edits`). Our text only decides where the
PDF reading is doubtful: a font that does not render its nounim (you can
tell because the book writes fewer of them than we do on the same lines), a
word with a hole or printed twice, a footnote marker stuck to the word, a
cross-reference that the line read does not close, a word one letter away
from ours. A word that moves from one line to its neighbor only moves if
it leaves from one side and arrives from the other; otherwise the break
stays ours. The punctuation that Sefaria adds to the guemara stays where
the words are the same.

For the guemara, a second witness removes this doubt: the Vilna text from
Wikisource, which Sefaria publishes under CC-BY-SA (`witness.py`, in the
cache). What it confirms, word for word and in sequence, with the word
before or the one after, is written as it writes it, whatever the PDF's
font.

What the record does not carry: the catchwords and the margin notes; the
commentaries we do not have (the second Rachi of Mena'hot, the Rivan of
Makkot, the Chita Mekoubétset), whose text, when it is in the page's
columns, is written from the book; Kinnim; Chekalim and Middot, which our
files do not arrange by amoud. The « תוספות » at the foot of the page
(Keritot) are also written from the book, in their small type.

## The scan pilot

## What you need

- Python 3 with `numpy`, `opencv-python` and `Pillow`;
- `pdftoppm` and `curl` (Poppler: `brew install poppler`);
- for captures of our rendering: the app running (`npm run dev`) and
  Playwright's Chromium (`npx playwright install chromium`).

The scans and every image derived from them stay out of the repository, in
a cache: `~/.cache/petite-jerusalem/layout` (or `PJ_LAYOUT_CACHE`). **We
commit neither images nor PDFs**: only the break files, which are text.

## The sources

`sources.json` says where each source comes from and under which license.
The scans come from archive.org, marked "Public Domain Mark 1.0":

- the Vilna Shas of the Widow and Brothers Romm (from 1882 to 1887),
  digitized by the Duke University library;
- the tikoun soferim of Judah Pisa, _'Ezrat ha-Sofer_ (Amsterdam, 1769),
  digitized by the National Library of Israel.

The National Library of Israel and hebrewbooks.org close their pages to
programs (anti-bot check): we do not query them.

## The procedure

```bash
# 1. The scan (once).
python3 scripts/layout/fetch.py vilna v01
python3 scripts/layout/fetch.py ezrat-hasofer

# 2. The guemara: a passage of a tractate.
python3 scripts/layout/talmud.py berakhot --from 2a --to 2b --review /tmp/relecture

# 3. The Torah pilot on a scan: one paracha of the Pisa tikoun (264
#    columns). None of it goes into the repository, which carries the
#    245-column scroll (above).
python3 scripts/layout/torah.py 279 --review /tmp/relecture

# 4. The texts manifest, then the tests.
node scripts/texts-manifest.mjs
npx vitest run src/__tests__/textLayout.test.ts
```

A tractate is declared in `sources.json`: its volume, and the PDF page that
carries its first amoud (`firstPage`). A paracha is declared there by the
pages of the tikoun that carry it.

Without `--write`, nothing is written to the repository: the program only
says, page by page, what the alignment is worth (its cost per word, the
doubtful lines, the commentaries that the print does not give in the
file's order).

## Reviewing

The alignment makes mistakes: you have to look at it.

```bash
# Each line of the scan next to the words the alignment gives it.
python3 scripts/layout/talmud.py berakhot --from 2a --to 2b --review /tmp/relecture

# A random sample over the whole passage, to measure.
python3 scripts/layout/talmud.py berakhot --from 2a --to 10b --review /tmp/relecture --sample 44

# The scan on the left, our rendering on the right.
node scripts/layout/capture.mjs http://localhost:5173 /bibliotheque/talmud/berakhot/1 /tmp/rendu
python3 scripts/layout/compare.py talmud berakhot 2a 7a /tmp/rendu --out /tmp/comparaison
```

On a review sheet, the blue marks below the image are the words the
analysis saw; the orange marks, those it takes for margin
cross-references. A line in red is a line that the alignment itself finds
doubtful.

## The files

| File           | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `fetch.py`     | downloads a source into the cache                                   |
| `imaging.py`   | renders a page (`pdftoppm`), extracts the ink, straightens it       |
| `segment.py`   | the letters, the gutters, the lines, the words                      |
| `daf.py`       | the Vilna page: the guemara and the commentary columns              |
| `align.py`     | aligning the words seen with the words of the text                  |
| `texts.py`     | the words of the text, counted the way the reader counts them       |
| `talmud.py`    | the pilot: the guemara, Rachi and Tossafot read on a scan           |
| `torah.py`     | the pilot: the columns of a paracha read on the Pisa tikoun         |
| `scroll.py`    | the 245 columns of the Sefer Torah, for the whole Torah             |
| `vilna.py`     | the Vilna page line for line, read from typeset pages               |
| `review.py`    | the review sheets                                                   |
| `capture.mjs`  | the capture of our rendering (Playwright)                           |
| `compare.py`   | the images side by side                                             |
| `fonts.json`   | the letter widths of each typeface, measured (`--calibrate`)        |
| `sources.json` | the sources, their addresses, their licenses, their pages           |

## What the alignment cannot do

- **The guemara's abbreviations.** Our text writes « הקדוש ברוך הוא »
  where Vilna prints « הקב"ה ». When the abbreviation ends a line, the
  alignment sometimes leaves one or two of its words on the next line.
- **The order of the commentaries.** Sefaria places each commentary under
  the passage it explains; the page prints them in its own order. The
  program puts back those it recognizes; a short commentary (three or four
  words) is not always recognized.
- **What the file carries and the print does not have** (a duplicate, an
  addition in square brackets): filed under `absent`, it belongs to no
  line.
- **The chirot.** A line of Az yachir sometimes holds a single word at the
  edge of the column: the alignment is less reliable there than in prose.
