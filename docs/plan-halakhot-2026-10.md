# Plan: two halakhot a day (October 2026)

This plan prepares a new goal in Mon parcours: two halakhot a day, on a
theme the reader chooses. It records what was decided with the owner in
October 2026, what we may use and on which terms (licenses checked one by
one), who does what, and the work in batches. Nothing in it is shipped yet.

The feature lives next to the others in Mon parcours (`docs/parcours.md`);
its look follows `docs/design.md`.

## 1. The goal, as decided

- **Two halakhot each study day**, on a theme the reader chooses (Chabbat,
  blessings, prayer, kashrout...). Nothing on Chabbat or on a Yom Tov: the
  phone stays off, and `restCalendar` (`src/services/parcours/calendar.ts`)
  already knows those days, in Israel and in the diaspora. Hol hamoed is a
  study day.
- **A long-term goal, without debt.** No end date: the card always shows the
  next two halakhot not yet learned. A missed day does not make four the
  next day. « Encore deux » lets a reader go further.
- **On the home deck until it is done**, then in the wallet, like every
  other card (`src/composables/useTodayDeck.ts`).
- **Progress per theme**, as a percentage, with an estimated end (« à ce
  rythme, fini en juin »).
- **Festival mode**, which the reader turns on or off: before a festival,
  the halakhot of that festival (see section 7).
- **Tisha BeAv** is not a rest day, but only sad subjects are studied: that
  day, its own laws or nothing.
- **Two levels.** The card gives the rule in three or four lines and the
  case of today (about two minutes). « Approfondir » opens the translated
  source text, the other opinions quoted, the explanation, and a link to the
  passage in our library (`/bibliotheque/halakha/hilkhot-chabbat/318`).

Orders of magnitude, counted with `@hebcal/core` in the diaspora: 321 study
days in 5787 (a leap year), 294 in 5788. About **600 halakhot a year** for a
reader who misses no day.

## 2. The collection is ours

The halakhot are not taken from one book: the collection is written by the
owner with Claude, crossing several sources, and validated by a rav.

| Who       | What                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The owner | The theme; the line to follow (section 8); indications chapter by chapter (what matters, which modern cases to cover); the decision when sources disagree; approval of every entry                                                           |
| Claude    | Gathering and translating the free sources; drafting the entries from the owner's indications; proposing quotations with their exact reference; flagging disagreements; checking references against the texts we hold; format and typography |
| A rav     | Validating the halakha of every entry. **Nothing is published without it.**                                                                                                                                                                  |

Readers are told how it is written, as the app already tells them when a
translation is made by AI: « Rédaction : Petite Jérusalem, avec l'aide de
l'IA ; relu par le Rav X. »

Claude can be wrong: a false reference, an opinion given to the wrong
author, a disagreement missed. Hence two checks before publication: every
reference checked in its text (Claude for the free sources, which we hold; a
person, in the book, for a protected one), and the rav.

## 3. What we may use

Licenses read in the version files of Sefaria's export (`license` field of
each version, the same as its API), October 2026.

| Source                               | Version                                           | License             | What we may do                                            |
| ------------------------------------ | ------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| Choulhan Aroukh, Ora'h Hayim, Hebrew | Torat Emet 363                                    | Public domain       | Anything                                                  |
| Michna Broura, Hebrew                | On Your Way                                       | Public domain       | Anything                                                  |
| Kitsour Choulhan Aroukh, Hebrew      | Torat Emet 357, On Your Way                       | Public domain       | Anything                                                  |
| Kitsour Choulhan Aroukh, English     | Rabbi Avrohom Davis, Metsudah, 1996               | CC BY               | Anything, with credit                                     |
| Ben Ich Haï, Hebrew                  | Jerusalem, 1898                                   | Public domain       | Anything                                                  |
| Sefer Ha'Hinoukh, English            | Rabbi Francis Nataf, 2018                         | CC0                 | Anything                                                  |
| Peninei Halakha, Hebrew (19 volumes) | Peninei Halakhah, Yeshivat Har Bracha             | CC BY-NC            | See below                                                 |
| Peninei Halakha, English (9 volumes) | Peninei Halakhah, English ed. Yeshivat Har Bracha | CC BY-NC            | See below; Women's Prayer is « unknown »: take its Hebrew |
| Wikipedia (Hebrew, French, English)  |                                                   | CC BY-SA 4.0        | Short quotations; an adaptation must itself be CC BY-SA   |
| Protected works (list below)         |                                                   | All rights reserved | Rulings and references in our own words; short quotations |

**Peninei Halakha** (Rav Eliezer Melamed) is the only contemporary code we
may adapt: we may translate it, cut it into short units and follow its
outline, on two conditions. The use stays non-commercial (the app is free,
without ads or purchases, as `docs/traductions.md` already requires; if that
changes, Peninei Halakha leaves the app). And we credit it: the author, the
license, and what we changed. We never suggest that Har Bracha endorses our
version.

**The sites of Har Bracha** (yhb.org.il) state CC BY 4.0 on their pages, and
allow AI training with credit. This was seen in search results only: the
sites cannot be reached from the cloud sessions. If the notice covers
ph.yhb.org.il, the official French translation of Peninei Halakha becomes
usable as it is (section 5).

**Protected works**, used only for their rulings: Yalkout Yossef and its
Kitsour, Hazon Ovadia, Halacha Yomit, Chemirat Chabbat Kehilkhata, Halakha
Beroura, Piskei Techouvot, the French editions of Colbo and Gallia, the
contents of Torah-Box.

Two things were looked at and set aside: the Lindenbaum Center of YCT (CC BY
4.0, but a movement rejected by a large part of the Orthodox world), and
HaMikhlol (only its pages taken from Wikipedia are free).

## 4. The rules of writing

1. **Our own wording.** A ruling is free; the wording of a protected book is
   not. No sentence of an entry may be the translation, or a close
   paraphrase, of a protected text, and an entry does not follow a protected
   book halakha after halakha. Naming the author does not make a long reuse
   legal: only a short quotation is (Code de la propriété intellectuelle,
   L122-5), in quotation marks, with its author and source.
2. **Free sources may be translated in full**, with credit.
3. **What Claude is given.** The full text of the free sources only. For a
   protected book, the ruling noted by a person in one line, with its
   reference, in the form
   `<work> <volume>, <siman>:<seif>: <the ruling in a few words>`. Claude
   cannot read protected books from here, and may misremember them.
4. **Mixing licenses.**

   | Mixed in one text                | Result                                        |
   | -------------------------------- | --------------------------------------------- |
   | Public domain + CC BY + CC BY-NC | Allowed: credit each one, stay non-commercial |
   | CC BY + CC BY-SA                 | Allowed: the result is CC BY-SA               |
   | CC BY-NC + CC BY-SA              | Not in the same text: side by side only       |

5. **Our collection** is published under CC BY-NC 4.0, like the app, unless
   the owner decides otherwise.
6. **Credit.** An entry names its sources; a page « À propos du recueil »
   gives the licenses and what was changed, as the translations do
   (`docs/traductions.md`, « Crediting a translation »).
7. **Typography** as everywhere in the repository: no long dash, French
   non-breaking spaces (`CLAUDE.md`).

## 5. Who to ask

None of this blocks batches 1 to 11.

- **Har Bracha.** One email, two questions: does the CC BY 4.0 notice cover
  ph.yhb.org.il, French translations included; and may a free app cut the
  text into short daily units. A yes gives us their French, already
  reviewed.
- **Yalkout Yossef.** No contact could be verified online (yalkutyosef.co.il
  cannot be reached from here). The routes:
  - the copyright page of a volume, whose « להשיג » box gives the address
    and phone of the institute;
  - the office of Rav Yits'hak Yossef, through Yeshivat Hazon Ovadia in
    Jerusalem;
  - the Haketer Institute (Rabbi Yisrael Bitan), for the English Saka
    edition;
  - the bookseller Gallia in Paris, which sells the French series, to learn
    who holds the French rights;
  - the developer of the « Esh Yalkut Yossef » app (Elyahu Sheetrit), which
    sells the Kitsour Yalkout Yossef on the App Store: he can say how he
    obtained its rights, if he did.

  What to ask for: quoting longer passages of the Kitsour Yalkout Yossef,
  with a link to buy the books. Our method does not need it: rulings with
  their references are free.

- **Halacha Yomit** (rulings of Rav Ovadia Yosef, already in French): the
  contact form of its site, for the same request.
- **A rav**, before any publication.

## 6. An entry

Drafts and their sources live in `data/halakhot/` (not served); a script
builds the published entries into `public/texts/halakhot/<theme>.json`,
which the app downloads like its other texts.

| Field                      | What it holds                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                       | Stable, never reused or renumbered (`chabbat-0001`): progress is kept by `id`                                                        |
| `theme`, `order`           | The theme, and the place in it (with gaps, so that an entry can be inserted)                                                         |
| `status`                   | `draft`, `reviewed`, `published`: only `published` is built                                                                          |
| `title`                    | Per language (`fr`, `en`, `he`)                                                                                                      |
| `rule`                     | The card: three or four lines, per language                                                                                          |
| `today`                    | The modern case, optional                                                                                                            |
| `variants`                 | Sephardim, Ashkenazim, Israel, diaspora, when they differ                                                                            |
| `explanation`              | « Approfondir », per language                                                                                                        |
| `sources`                  | Work, reference, license; the text (free source) or a short `quote` (protected one); `library` link; `checkedBy` for a protected one |
| `reviewedBy`, `reviewedAt` | The rav, and the date                                                                                                                |

A published entry is never removed: installed apps read newer texts than
their code (`docs/compatibilite-textes.md`), and a reader's progress points
to it.

## 7. Festival mode

The rule exists: the laws of Pessah are studied thirty days before
(Pessahim 6a, Choulhan Aroukh, Ora'h Hayim 429:1). Generous windows cost a
lot, counted in the diaspora for 5787:

| Window                                       |                     Study days |
| -------------------------------------------- | -----------------------------: |
| From Elloul to Kippour                       |                             31 |
| Souccot (from 11 to 22 Tichri)               |                              9 |
| 'Hanouka (a week before, and the eight days) |                             13 |
| Pourim (from 1 to 14 Adar)                   |                             12 |
| Pessah (thirty days before, and the moed)    |                             29 |
| Chavouot (a week before)                     |                              6 |
| The three weeks                              |                             19 |
| **Total**                                    | **119, about 40% of the year** |

With these windows, the chosen theme would move forward six months out of
ten. Proposal, to be decided (section 8): half and half (one halakha of the
theme, one of the festival), two of the festival in the last days. Each
year starts again with the practical essentials of the festival, then goes
on where the reader stopped the year before.

## 8. Decisions for the owner

1. **The line.** For instance: the Sephardim according to Rav Ovadia Yosef
   (Yalkout Yossef, Halacha Yomit), the Ashkenazim according to the Michna
   Broura; or both side by side.
2. **The first theme.**
3. **Festival mode**: full replacement, half and half, or short windows.
4. **The rav** who validates.
5. **The language of validation**: French if the rav reads French; Hebrew
   first otherwise, then translated.

## 9. The work

Each batch is one commit (or one PR), with `npm run verify` before it.

### Phase 1: the collection, without the app (safe now)

1. **The charter of the collection**, `docs/halakhot.md`: the entry, the
   order of preference of the sources, the rules of section 4, the line
   once decided, the mention of the AI. Done when the owner approves it.
2. **The map of the themes**: the themes and, for each, its outline drawn
   from Peninei Halakha (whose license allows it) and the Kitsour, the
   number of entries planned and the days it takes. For scale, Peninei
   Halakha has 3,660 halakhot over 19 volumes (Chabbat 372, Kashrut 400,
   Berakhot 229, Prayer 235, Pessah 161), each about 450 Hebrew words: too
   long for a card, which is why our entries are shorter. Done when the
   owner picks the first theme.
3. **The source kit of the first theme**: a script gathers the free sources
   (Peninei Halakha from the exact version files of Sefaria's export, never
   `merged`; the Kitsour, Hebrew and Metsudah; the Choulhan Aroukh and the
   Michna Broura already in `public/texts/halakha/`) into `data/halakhot/`,
   chapter by chapter.
4. **The pilot**: ten entries in French on the first theme, from the
   owner's indications, in `draft`. Done when the owner and the rav have
   read them and the format is settled.

### Phase 2: the goal in the app

Built and tested on drafts; released only with a validated theme (batch 12).

5. **The model**: a new kind of objective, `halakhot` (`theme`, festival
   mode), in `src/services/parcours/model.ts`. An installed version keeps a
   kind it does not know, without giving it a task
   (`src/services/parcours/schedule.ts`, `default` branch), and the merge
   keeps it.
6. **The day**: two tasks on study days only, the next two entries not yet
   learned, no debt. A learned entry is written in `DayLog.done` as
   `halakha:<id>`, like `aliya:3` for the chnei mikra: an older version
   keeps it.
7. **The card and « Approfondir »**: the deck card, the sheet with its two
   levels, the link to the library, the credit line.
8. **Creation and settings**: the new kind in the creation page, the theme
   picker with each theme's progress, the festival mode switch, the rite
   shown first (Sephardi or Ashkenazi; the app has no such setting yet).
9. **Festival mode**: windows computed with `@hebcal/core`, the Tisha BeAv
   rule, the festival progress carried from year to year.
10. **Tracking**: new events in snake_case and past tense (proposals:
    `halakhot_goal_created`, `halakhot_learned`, `halakhot_theme_completed`),
    documented in `docs/tracking-plan.md`.
11. **Tests and documentation**: a guard test on the collection (unique,
    stable `id`; a published entry never removed; every published entry with
    a reviewer and a source; no protected source without `checkedBy`);
    tests of the day (rest days, no debt, festival windows, Tisha BeAv);
    `docs/tests.md` and `docs/parcours.md` updated.

### Phase 3: theme by theme

12. **Writing**: entries drafted in batches of about twenty, read by the
    owner, validated by the rav, then `published` and built. English and
    Hebrew are translated from the validated French and reread.
13. **Release**: once the first theme holds at least a hundred validated
    entries (about two months of reading), and the writing keeps ahead of
    the readers.
