# Implementation plan: prayer times reliability (September 2026)

This plan implements the findings of `docs/audit-horaires-2026-09.md`. It is
addressed to whoever does the work in a separate session: each batch says
what it changes, in which files, which texts and which tests, and how to tell
that it is done. The batches are independent unless stated otherwise; they
are delivered in the order given, one commit (or one PR) per batch.

## Guiding principle

The location decides, and each opinion gives the time its luah prints where
one is. An opinion is not a set of fixed parameters, it is a source (a luah,
a calendar) that itself adapts to the country: the Rabbi Ovadiah Yosef
calendar follows the Or Ha'Haïm in Israel and Amudei Horaah elsewhere, the
candle-lighting custom changes from city to city, the holiday calendar and
tahanoun change between Israel and the diaspora. The app must therefore
hold, for each opinion, one rule PER REGION, chosen from the position
(catalog city or device position, `isIsraelPlace` decides by time zone),
without asking the user anything. Any decision to "keep one country's
parameters everywhere" is ruled out: this plan applies the principle batch
by batch, and an opinion added later must apply it too.

## 0. Ground rules

- Read `CLAUDE.md` before writing a line: never an em dash or en dash,
  French non-breaking spaces (U+202F before `;`, `!`, `?`; U+00A0 before `:`
  and inside guillemets), comments and commit messages in French,
  liturgical domain identifiers in French.
- Start from `main` once PR 228 is merged (it touches `zmanimService.ts`,
  `zmanimOpinions.ts`, `tachanun.ts`, the three locales and the tests). If it
  is not merged yet, start from its branch
  `claude/rav-pozen-schedule-check-nfqf7n`.
- Every expected time in a test is computed and justified in the test's
  comment (location, date, definition), like the existing tests. No value
  "adjusted to make it pass".
- The three locales (`src/locales/fr.ts`, `en.ts`, `he.ts`) receive every
  new key; `src/__tests__/i18nUsage.test.ts` fails otherwise.
- Before each commit: `npm run verify` (type-check, lint, tests). The
  `typography.test.ts` and `frenchTypography.test.ts` tests also scan the
  documentation.
- Do not touch the calculation of Rav Posen's opinion (dawn 16.1°,
  michéyakir 11.5°, tsét 8.5°, end of fasts 7.083°, Rabbénou Tam 72 fixed
  minutes) except in batch 2 (rounding), which affects all opinions.

## 1. One hour off on the day the device changes its clock (audit 3.1)

**Cause.** In `node_modules/@hebcal/core/dist/esm/zmanim.js`, `zdtToDate`
calls `res.setMilliseconds(0)` and `sunriseOffset`/`sunsetOffset` call
`sunset.setSeconds(0, 0)`. `Date` setters rebuild the instant from the
device's local fields: within the ambiguous hour of the return to standard
time, the instant jumps by one hour. Reproduction: device set to
`America/New_York`, Paris, November 1, 2026, `sunrise()` returns 05:37 UTC
instead of 06:37.

**Change.** Apply a local fix with `patch-package` (dev dependency,
`postinstall: patch-package` script, `patches/` folder) on `@hebcal/core`:

- `zdtToDate`: `return new Date(Math.floor(zdt.epochMilliseconds / 1000) * 1000);`
- `sunriseOffset` and `sunsetOffset`, `roundMinute` branch: compute
  `const secs = Math.floor((t.getTime() % 60000) / 1000)`, then
  `t = new Date(Math.floor(t.getTime() / 60000) * 60000)` and, for a positive
  offset, `offset++` when `secs >= 30` (same rule as before, without a
  setter).
- The `dist/bundle.js` file carries the same code: the patch covers it too,
  or we check that no import goes through it.

Open an issue at `hebcal/hebcal-es6` with the reproduction (three lines) and
the fix, so the patch can be removed once a release includes it.

**Test.** `src/__tests__/zmanimDeviceTimezone.test.ts`: Node rereads
`process.env.TZ` on assignment. For each device time zone in
`["UTC", "America/New_York", "America/Los_Angeles", "Europe/Paris"]`, set
`process.env.TZ`, clear the cache (`setZmanimOpinion` to another opinion and
back, or expose `clearZmanimCache`), compute Paris on November 1, 2026 and
March 29, 2026, and require the same instants as in UTC (netz
`2026-11-01T06:37:17Z`, end of Chéma GRA `09:05:32Z`, end of Chéma MGA 16.1°
as computed in UTC). Restore `TZ` in `afterEach`. The test must fail without
the patch and pass with it.

**Done when**: the test above passes, `npm ci` applies the patch (check the
log), and `docs/tests.md` mentions the patch and the reason for it.

## 2. Rounding end times up to the next minute (audit 3.3)

**Rule.** A DEADLINE (last moment to do something) rounds down, an END
(moment from which something becomes permitted) rounds up. Rounding happens
at computation, not at display: the countdown, reminders, widgets and watch
then read the same minute as the page.

**Change, `src/services/zmanimService.ts`.**

- `ZMAN_DEFS`: add a `round: "down" | "up"` field per time. Up: `tzeit`,
  `chatzotNight`, `chatzotNightDawn`. Down: everything else (`sunrise`,
  `sunset`, the ends of Chéma and Amida, `chatzot`, min'ha, plag, dawn,
  michéyakir). A `roundMinute(date, round)` function (floor or ceiling of
  `getTime()` to a multiple of 60,000, never a `Date` setter, see batch 1)
  is applied in `computeZmanimFor` before pushing into `times`.
- `restPeriodAt`: `end` and `endRabbenouTam` rounded up (hebcal's Rabbénou
  Tam already is, to the minute; the ceiling then has no effect). `start`
  keeps the rounding down that hebcal already does.
- `fastAt`: `end` up, `start` down.
- `nightfallOf` (blessing of the moon, sidour): up.
- `chametzAt` (PR 228): the four deadlines down.
- `slihotWindow`: `start` up, `end` down.
- `formatZmanTime` does not change.

**Tests.** Update the expected values that rounding moves, with the original
second in a comment: in Paris, Tzom Guedalia 5787 ends at 20:44:19, so
displayed 20:45; the end of Chabbat on September 19, 2026 is 20:42:09, so
20:43. Add a test in `zmanim.test.ts` that, for one day and location, checks
that every `up` time has `getSeconds() === 0` and is not earlier than
hebcal's raw value, and the reverse for `down`. The PR 228 tests
(`zmanimInvariants.test.ts`) must keep passing: a ceiling does not break the
order of times, except for a tie within the same minute, to be tolerated.

**Done when**: no displayed end time is earlier than its computed instant.

## 3. Rav Ovadia Yossef's opinion in line with its source (audit 3.2, 3.6, 3.7, 3.9)

The source cited in `zmanimOpinions.ts` is the Rabbi Ovadiah Yosef calendar
(`ROZmanimCalendar.java`, `ZmanimFactory.java`). It does two things: in
Israel, the Or Ha'Haïm luah; outside Israel, by default, the Amudei Horaah
luah (Rav Leor Dahan). The app only applies Israel, everywhere, with two
wrong parameters. This batch makes the opinion faithful, in two modes,
chosen from the position: this is decided, there is no "Israel everywhere"
option to keep.

### 3a. The location enters the opinion's calculation

`OpinionZmanim`: each function receives a second parameter
`ctx: { il: boolean }` (`il` = `isIsraelPlace(place)`), and
`opinionZmanim(opinion)` keeps its signature. `zmanimService.ts` passes
`{ il }` wherever it calls an opinion function (`computeZmanimFor`,
`restPeriodAt`, `nightfallOf`, `fastAt`, `chametzAt`). The `POSEN` functions
ignore `ctx`.

The description fields become typed rules, so that the note under the card
says exactly what the calculation does:

```ts
type EndRule =
  | { kind: "degrees"; degrees: number } // nightfall at n degrees
  | { kind: "fixed"; minutes: number } // n fixed minutes after the chkia
  | { kind: "zmaniyot"; minutes: number } // n zmaniyot minutes after the chkia
  | { kind: "amudeiHoraah" }; // 7.165° below the horizon, at least 20 minutes
```

`restEndRule(ctx)` and `fastEndRule(ctx)` replace `restEndMinutes` and
`fastEndMinutes`; `FastPeriod.endMinutes` becomes `endRule: EndRule`;
`RestTimes.vue` and `FastTimes.vue` translate the rule through one locale
key per `kind` (`zmanim.rest.exit.degrees`, `.fixed`, `.zmaniyot`,
`.amudeiHoraah`, and likewise under `zmanim.fast.end.*`). The old keys
`exitAtNightfall`, `exitAfterSunset`, `endStars`, `endAfterSunset` are
removed from the three locales.

### 3b. Israel (Or Ha'Haïm), `ctx.il === true`

- **End of fasts**: `fromSunset(z, 20)` (20 ZMANIYOT minutes), rule
  `{ kind: "zmaniyot", minutes: 20 }`. Source: `getTzeitLChumra()`,
  `20 * (getShaahZmanisGra() / 60)`.
- **End of Chabbat and holidays**: chkia + 30 fixed minutes
  (`{ kind: "fixed", minutes: 30 }`). Source: "30 minutes after sunset in
  Israel", header of `ROZmanimCalendar.java`.
- **Michéyakir**: `fromSunrise(z, -60)`. Source:
  `getMisheyakir60ZmaniyotMinutes`, the talith time; the 66 are the "great
  need" time.
- Dawn 72 zmaniyot, tsét 13.5 zmaniyot, Rabbénou Tam 72 zmaniyot, Maguen
  Avraham from 72 to 72 zmaniyot, min'ha guedola "the latest", plag Yalkout
  Yossef: unchanged.

### 3c. Outside Israel (Amudei Horaah), `ctx.il === false`

Principle (`getPercentOfShaahZmanisFromDegrees`): we measure, at the
location itself, on March 17 of the civil year of the computed day, how many
sha'ot zmaniyot (of the Gaon) separate sunrise from the sun at n degrees
below the horizon; we apply that percentage to the sha'a zmanit of the
requested day.

```ts
// Share of a sha'a zmanit taken by the sun's descent to `degrees`
// below the horizon, measured at the equinox (March 17) at the same location.
function equinoxShare(
  z: Zmanim,
  degrees: number,
  evening: boolean,
): number | null;
```

Computed with `new Zmanim(gloc, new Date(année, 2, 17, 12), false)`; this
therefore requires the `GeoLocation`: add `gloc` to `ctx`
(`ctx: { il: boolean; gloc: GeoLocation }`), or expose an
`equinoxZmanim(z)` factory in `zmanimService`. Memoize per location and
year. When the angle is not reached at the equinox (beyond about 60° of
latitude) the function returns `null` and the time is absent, as for the
degree-based opinion (PR 228's `zmanimGap` already reports it).

- **Dawn**: `sunrise - share(16.04°, morning) × shaahZmanit`.
- **Michéyakir**: the same share × 10/12 (60 minutes out of 72).
- **Ordinary tsét**: `sunset + share(3.7°, evening) × shaahZmanit`.
- **End of fasts**: `sunset + share(5.075°, evening) × shaahZmanit`
  (`getTzeitLChumra`, Amudei Horaah mode).
- **End of Chabbat and holidays** (`getTzeitShabbatAmudeiHoraah`): the sun
  at 7.165° below the horizon (`z.tzeit(7.165)`); if chkia + 20 minutes is
  later, take chkia + 20; if solar midnight is earlier than 7.165°, take
  solar midnight. Rule `{ kind: "amudeiHoraah" }`.
- **Rabbénou Tam**: the earlier of chkia + 72 fixed and chkia + 72 zmaniyot
  (`getTzais72ZmanisAmudeiHoraahLkulah`). `rabbenouTamZmaniyot` also becomes
  a typed rule (`"fixed" | "zmaniyot" | "earliest"`), with its locale key.
- **Maguen Avraham**: unchanged (the source keeps
  `getSofZmanShmaMGA72MinutesZmanis` in this mode).
- **Plag**: formula unchanged, but based on this mode's tsét.
- **Min'ha guedola, min'ha ketana**: unchanged.

### 3d. Texts

- `zmanim.opinions.ovadia.hint` (three locales) describes the two modes in
  one sentence each. Name: « Rav Ovadia Yossef (Or Ha'Haïm en Israël, Amudei
  Horaah ailleurs) » ("Rav Ovadia Yossef (Or Ha'Haïm in Israel, Amudei
  Horaah elsewhere)").
- The note on the fast and rest cards follows the typed rule (3a).
- `docs/`: the header of `zmanimOpinions.ts` is the documentation of the
  opinion; rewrite it with the two modes and the source Java functions.

### 3e. Tests (`zmanimOpinions.test.ts`, `zmanimFasts.test.ts`)

Values to obtain, taken from the audit (Ovadia opinion):

- Paris, Tzom Guedalia Monday September 14, 2026: end 20:26:57 before
  rounding (chkia 20:05:50, sha'a zmanit 63.3 minutes), so 20:27 with batch
  2; the old value 20:25 (20 fixed) must fail.
- Paris, 17 Tamouz Thursday July 2, 2026: the end must be 6 to 7 minutes
  later than with 20 fixed minutes.
- Jerusalem, Chabbat September 12, 2026: end 19:19 (chkia 18:49 + 30), not
  19:29.
- Paris, Chabbat June 27, 2026: end 22:51 (7.165°), not 22:38; London
  22:21; Paris December 26, 2026: 17:44.
- Paris, June 21, 2026: michéyakir 60 zmaniyot, later than the previous 66.
- Amudei Horaah dawn, Paris, June 21, 2026: about 123 minutes before sunrise
  (72 zmaniyot gave 96). Check the order of magnitude, and that in Jerusalem
  on March 17 the Amudei Horaah dawn and the 72 zmaniyot dawn coincide to
  the minute (the method is calibrated for that).
- Helsinki, June 21, 2026: Amudei Horaah dawn and tsét exist (the equinox
  reaches 16.04° there), where the degree-based opinion has nothing.
- Tromsø: `equinoxShare` returns `null` for 16.04° if the angle is not
  reached on March 17; otherwise the times exist.

`zmanimInvariants.test.ts` (PR 228) sweeps both opinions: it must pass with
the new rules (order of times, end of Chabbat after tsét, end of fast before
the end of Chabbat).

**Done when**: at the locations above, the app gives the same times as the
source calendar's formulas, to the minute.

## 4. Tahanoun: two wrong days (audit 3.4)

`src/services/tachanun.ts`, in `saidTachanun`, before the call to hebcal:

- **The day after 'Hanouka.** hebcal removes tahanoun from 25 to "33"
  Kislev, which spills over onto 3 Tévet (30-day Kislev) or 4 Tévet (29-day
  Kislev). Rule: if `hd` is in Tévet, day 3 or 4, and
  `getHolidaysOnDate(hd)` has no event carrying `flags.CHANUKAH_CANDLES`, do
  not read hebcal for that day: `shacharit = true`, and `mincha` follows the
  ordinary rule (true except Friday, and except if the next day is a day
  without tahanoun: reuse `saidTachanun(hd.next())` with the
  `keepsPreviousMincha` exception).
- **Chouchan Pourim Katan.** Leap year, 15 Adar I:
  `{ shacharit: false, mincha: false }` (Choul'han Aroukh, Ora'h 'Haïm
  697, 1: neither the 14th nor the 15th of Adar I). The day before, 14 Adar
  I, is already without tahanoun.

Tests, `src/__tests__/tachanun.test.ts` (create it if it does not exist,
otherwise extend it): 3 Tévet 5787 (December 13, 2026) `full`; 4 Tévet 5787
`full`; 2 Tévet 5787 `none` ('Hanouka); in a year where Kislev has 29 days
(5790: 'Hanouka runs from 25 Kislev to 3 Tévet), 3 Tévet `none` and 4 Tévet
(December 10, 2029) `full`; 15 Adar I 5787 (February 22, 2027) `none`; 15
Adar of an ordinary year unchanged.

The sidour (`dailyCycles.activeOccasions`) and the widget read the same
function: nothing else to change, but check `sidourOccasions.test.ts`.

## 5. Candle lighting in Israel (audit 3.5, gap 4.3)

`src/services/zmanimService.ts`:

```ts
const CANDLE_LIGHTING_BY_CITY: Record<string, number> = {
  Jérusalem: 40,
  Haïfa: 30,
};
const CANDLE_LIGHTING_ISRAEL_MINUTES = 20;
const CANDLE_LIGHTING_MINUTES = 18;

export function candleLightingMinutes(place: ZmanimPlace): number {
  const local = place.city ? CANDLE_LIGHTING_BY_CITY[place.city] : undefined;
  if (local !== undefined) return local;
  return isIsraelPlace(place)
    ? CANDLE_LIGHTING_ISRAEL_MINUTES
    : CANDLE_LIGHTING_MINUTES;
}
```

A device position in Israel (time zone `Asia/Jerusalem`) therefore follows
20. The comment above the table cites the sources (Israeli luhot, the Rabbi
Ovadiah Yosef calendar's `setCandleLightingOffset(20)` for the Or Ha'Haïm,
Haifa 30 at hebcal and Chabad.org). Petah Tikva, Safed and Tiberias stay at
20: the custom is split, and it is the setting below that decides.

**User setting.** A device preference `pj_candle_minutes`
(`devicePreference`, `null` = location default), choice among 18, 20, 30,
40: in `ZmanimSettings.vue` (app) and in `ZmanimOpinionModal.vue` (site),
under the followed opinion, label « Allumage : n minutes avant la chkia
(usage du lieu : n) » ("Candle lighting: n minutes before the chkia (local
custom: n)"). `candleLightingMinutes(place)` reads the preference first. The
Chabbat start reminder (`zmanReminderService.planRestReminders`) and the
widgets go through `restPeriodAt`, so they follow.

SEO pages (`src/content/zmanimSeoPages.ts`, `jerusalemNote`): generalize into
a note when `minutes !== 18` (« À Haïfa, l'usage est d'allumer 30 minutes
avant la chkia », "In Haifa, the custom is to light 30 minutes before the
chkia"), `cityCandleNote` keys in `zmanimGuideStrings.ts` for the three
languages; extend `zmanimSeoPages.test.ts` for Haifa and Tel Aviv.

Tests: `candleLightingMinutes` for Jerusalem (40), Haifa (30), Tel Aviv
(20), a device position in `Asia/Jerusalem` (20), Paris (18), and the
preference taking precedence.

## 6. Intermediate candle lightings within a rest block (gap 4.1) and érouv tavchilin (4.2)

`RestPeriod` gains:

```ts
/** A candle lighting inside the block: every evening except the first. */
export interface RestLighting {
  /** The Hebrew day that begins with this lighting. */
  day: HDate;
  at: Date;
  rule: "beforeSunset" | "afterShabbat" | "afterNightfall";
}
lightings: RestLighting[];
/** The civil day on which to make the érouv tavchilin, or null. */
eruvTavshilin: Date | null;
```

In `restPeriodAt`, for each day `d` from `first` to `last.prev()`, the
evening of `d` opens `d.next()`:

- `d.next()` is a Chabbat (`getDay() === 6`): `beforeSunset`, chkia of `d`
  minus `candleLightingMinutes` (like `start`), from an existing flame if `d`
  is Yom Tov.
- `d` is a Chabbat and `d.next()` a Yom Tov: `afterShabbat`, at
  `opinion.restEnd` of `d`.
- `d` and `d.next()` are both Yom Tov: `afterNightfall`, at `opinion.tzeit`
  of `d` for Rav Posen (8.5°), and at the end of fast (tsét le'houmra, 20
  zmaniyot or 5.075° depending on the mode) for Rav Ovadia: that is what
  `ZmanimFactory` does ("Yom Tov going into Yom Tov: getTzeitLChumra"). To
  that end, add `yomTovLighting(z, ctx)` to `OpinionZmanim`.

Érouv tavchilin: if a Yom Tov day of the block has `getDay() === 5`
(Friday) and the block continues into Chabbat, `eruvTavshilin` = the civil
day preceding the block's first Yom Tov (Wednesday for Thursday-Friday,
Thursday for Friday alone). Kippour never falls on a Friday; Roch Hachana on
Thursday-Friday is the most frequent case.

`RestTimes.vue`: one row per candle lighting between the start and the end,
labeled « Allumage du 2e soir (après la sortie des étoiles) » ("Second
evening candle lighting (after nightfall)"), « Allumage de Chabbat (avant la
chkia, depuis une flamme) » ("Chabbat candle lighting (before the chkia,
from a flame)"), « Allumage après la sortie du Chabbat » ("Candle lighting
after the end of Chabbat"); under the note, « Érouv tavchilin : mercredi 21
avril » ("Érouv tavchilin: Wednesday April 21") when there is one. Keys
`zmanim.rest.lighting.beforeSunset`, `.afterShabbat`, `.afterNightfall`,
`zmanim.rest.eruvTavshilin`, three locales. `CalendarPage.vue` shows the
same rows under the block's entry. `zmanReminderService`: a start reminder
one hour before each `beforeSunset` candle lighting of the block, not only
the first (the existing reminder is scheduled per block; schedule it per
lighting).

Tests, `zmanimRestLightings.test.ts` (Paris, Rav Posen, before rounding):

- Roch Hachana 5787 (Saturday 12 and Sunday 13 September 2026): an
  `afterShabbat` lighting on Saturday at nightfall, 20:58 (hebcal: "Candle
  lighting: 8:58pm" on September 12).
- Pessah 5787 (Thursday April 22 to Saturday April 24, 2027):
  `afterNightfall` Thursday 21:44, `beforeSunset` Friday 20:35;
  `eruvTavshilin` Wednesday April 21.
- Chavou'ot 5789 (Sunday 20 and Monday 21 May 2029, block from Friday the
  18th): `afterShabbat` Saturday, `afterNightfall` Sunday.
- An ordinary Chabbat: `lightings` empty, `eruvTavshilin` null.
- Cross-check test: for the year 5787 in Paris, each `LIGHT_CANDLES_TZEIS`
  or `LIGHT_CANDLES` event of
  `HebrewCalendar.calendar({ candlelighting: true, candleLightingMins: 18, havdalahDeg: 8.5 })`
  has a candle lighting in a `yearCalendar` block, at the same minute.

## 7. Elevation (audit 3.8)

After batch 3, because it only concerns Rav Ovadia's opinion.

- `City` and `ZmanimPlace` gain `elevation?: number` (meters).
  `scripts/generate-cities.mjs`: the current source has no elevation; add a
  manual table for the Israeli cities (the 35 in the catalog, geonames
  elevation, `dem` column), and leave the others without a value for now.
  Jerusalem 754, Safed 900, Tiberias -200 (hebcal rejects a negative
  elevation: pass 0).
- `geoLocationOf(place, useElevation)`: `new GeoLocation(name, lat, lon, place.elevation ?? 0, tzid)`;
  `new Zmanim(gloc, day, useElevation)` with `useElevation = opinion === "ovadia" && place.elevation !== undefined`.
  Caution: `chatzot()` stays at sea level in hebcal, and the angles (dawn,
  degree-based tsét) do not depend on elevation; only sunrise, sunset and
  everything derived from them move. `getTemporalHourByDeg` is not
  affected.
- Device position: do not use the GPS elevation (imprecise, often zero on
  the web); the nearest city (`nearestCity`) can lend its own if it is
  within `IN_CITY_KM`.
- `zmanim.disclaimer`: « niveau de la mer » ("sea level") becomes « niveau
  de la mer, sauf pour l'avis du Rav Ovadia dans les villes d'Israël, qui
  suit l'altitude du lieu » ("sea level, except for Rav Ovadia's opinion in
  Israeli cities, which follows the location's elevation").

Test: Jerusalem, September 18, 2026, Ovadia opinion: chkia between 4 and 5
minutes later than at sea level (18:41 becomes about 18:45), and tsét,
candle lighting and end of fast shifted by the same amount; Posen opinion
unchanged.

## 8. Birkat Halevana based on the molad (audit 3.10)

`src/services/zmanimService.ts`:

```ts
/** The window for the blessing of the moon for the month of `hd`. */
export function birkatHalevanaWindow(hd: HDate): { start: Date; end: Date };
```

`start` = `new Molad(année, mois).getInstant()` + 7 days;
`end` = molad + 14 days 18 hours 22 minutes (half of 29 d 12 h 793
'halakim, Choul'han Aroukh Ora'h 'Haïm 426, 3, the opinion adopted by Rav
Ovadia Yossef). First check the semantics of `getInstant()` against a
published molad (the molad of Tichri 5787 as announced on Chabbat
Mevarekhim; hebcal returns `2026-09-11T18:38:06Z`, to be compared with
"Friday 20:59 and 1 'helek" counted from 18:00 the day before, Jerusalem
time).

`saysBirkatHalevana(place, hd)` (widened signature): true if the night that
opens `hd`, that is `nightfallOf(place, hd.prev())`, is within the window,
with the two customary postponements kept (Av: not before the end of Tich'a
beAv; Tichri: not before the end of Kippour) and the tsét of the followed
opinion. `birkatHalevanaLastDay(place, hd)`: the last Hebrew day whose
opening night precedes `end`. Callers: `BirkatHalevanaBanner.vue`,
`hebrewOccasions.ts` (the header comment), the sidour if it reads the
blessing (`grep saysBirkatHalevana`).

Tests: Nissan 5787 in Paris, the night that opens 7 Nissan is permitted
(molad Tuesday 28 Adar II 14:07, plus 7 days), the night that opens 14
Nissan no longer is (limit on 13 Nissan around 8:30 a.m.); Tichri 5787:
nothing before the night that opens the 11th, permitted on the 14th.

## 9. Calendar: remove what is not a holiday (audit 3.11)

`yearCalendar`, filter on `ev.basename()` with the constants
`holidayDesc.LEIL_SELICHOT`, `holidayDesc.ROSH_HASHANA_LABEHEMOT`,
`holidayDesc.CHAG_HABANOT` from `@hebcal/core` (exported). Test: the year
5787 in Paris carries none of the three entries; 'Hanouka, Pourim, Tou
biChvat, Lag ba'Omer remain.

## 10. Kippour and Ta'anit Bekhorot (gaps 4.4, 4.5)

- `RestTimes.vue`: when `period.festivals` contains Kippour (recognize the
  event by `flags.MAJOR_FAST` and `flags.CHAG` together in `restPeriodAt`,
  expose `period.fastStarts: boolean`), the start row is titled « Allumage
  et début du jeûne » ("Candle lighting and start of the fast"). Key
  `zmanim.shabbat.candleLightingAndFast`.
- `fastAt`: `FastPeriod.firstbornOnly: boolean` true for Ta'anit Bekhorot
  (`ev.basename() === "Ta'anit Bechorot"`, check the spelling in
  `staticHolidays`). `ZmanimPage.vue`: this fast never goes first
  (`fastFirst` false) and its card carries the note « Jeûne des
  premiers-nés ; un siyoum en dispense » ("Fast of the firstborn; a siyoum
  exempts from it") (`zmanim.fast.noteFirstborn`). The 'hamets card (PR 228)
  keeps first place that day.

## 11. Delivery

Each batch: commit in French, with no model identifier, a message that says
what the user sees change. One PR per batch, or one PR for batches 1 and 2
(they affect all opinions), one for batch 3 (Rav Ovadia's opinion), one for
4, 5, 9, 10 (small), one for 6, one for 7 and 8. In each PR description: the
times before and after for Paris and Jerusalem for a Chabbat, a fast and a
holiday, so that a reviewer can set them next to a luah.

After the last batch, rerun the audit matrix (59 locations, 30 dates, three
device time zones: the method is described in
`docs/audit-horaires-2026-09.md`, section 1) and add its fixed points to
`zmanimInvariants.test.ts`: sunrise and sunset within ten seconds of the
reference values for five cities at the solstices and equinoxes.
