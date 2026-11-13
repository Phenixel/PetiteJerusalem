# Prayer times audit (September 2026)

In-depth review of the prayer times page and the holiday calendar: weekday
times, fasts, Chabbat and holidays, under both opinions (Rav Posen and Rav
Ovadia Yossef). Every time computed by the app was compared against
independent tools, at 59 locations around the globe (the catalog cities plus
device positions: La Paz, Quito, Tromsø, Reykjavik, Anchorage, Kathmandu, Lord
Howe...), on 30 dates (solstices, equinoxes, clock-change days in six
countries, every fast and holiday from 5786 to 5788), and under three device
time zones (UTC, Auckland, Los Angeles).

This document records what is wrong, what is missing, and what was checked
with no discrepancy. It fixes nothing: each item says where to start in the
code. PR 228 ('hamets deadlines, missing times at extreme latitudes) is taken
into account: what it already settles is flagged as such.

## 1. Method

Comparison tools, all independent of hebcal:

- **PyEphem** (VSOP87 ephemerides): sunrise, sunset, transit, and the angles
  16.1°, 11.5°, 8.5° and 7.083°, with and without horizon dip due to
  elevation.
- **kosher-zmanim** (port of KosherJava, the reference for English-language
  luhot): every named zman, at sea level and at elevation.
- **suncalc**: sunrise, sunset, solar noon and solar midnight.
- **pyluach**: Hebrew calendar dates, holidays and observed fasts.
- **The source code of the "Rabbi Ovadiah Yosef" calendar** (Elyahu Jacobi,
  `ROZmanimCalendar.java` and `ZmanimFactory.java`): this is the source that
  `zmanimOpinions.ts` cites for Rav Ovadia's opinion, reread line by line.
- **hebcal itself** through a different path: the candle-lighting and ending
  events that `HebrewCalendar.calendar` publishes, compared with the rest
  blocks from `restPeriodAt`.

What could not be done: hebcal.com, Chabad.org, MyZmanim, the Consistoire and
Torah-Box are unreachable from the environment (proxy). Rav Posen's opinion
was therefore not checked against a printed French luah. Section 5 gives the
times to check by hand in the Consistoire calendar.

## 2. What is correct

- **The solar engine.** Sunrise, sunset, 'hatsot and all the angles (dawn,
  michéyakir, tsét, end of fasts) fall within 6 seconds of PyEphem and
  suncalc across the 1,770 location/date pairs, poles included. The sha'ot
  zmaniyot (Chéma, Amida, min'ha, plag) are within 2 seconds of kosher-zmanim
  (except in Auckland, where it is kosher-zmanim that reads the wrong civil
  day).
- **The dates.** Holidays and fasts from 5786 to 5788 are identical to
  pyluach, postponements included: Ta'anit Esther on Thursday March 9, 2028
  (5788), Tich'a beAv never on Chabbat, Roch Hachana 5787 on Saturday
  September 12.
- **The time zones.** Casablanca goes back to UTC+0 during Ramadan (March 1,
  2026: 18:30, March 27: 19:30), Israel changes its clocks on Friday March
  27, 2026 at 2 a.m., Kathmandu (+5:45) and Lord Howe (+10:30/+11) display
  correctly.
- **Independence from the device time zone.** The 3,540 rows computed under
  UTC and under Auckland are identical. One exception: item 3.1.
- **The rest blocks.** Adjacent Chabbat and Yom Tov merge correctly (Roch
  Hachana 5787: candle lighting Friday September 11 at 19:54 in Paris, end
  Sunday 13th at 20:55, as in hebcal), Pessah gives two blocks, Kippour keeps
  its ordinary nightfall ending.
- **The fasts.** All six fasts have their times, Tich'a beAv starts at sunset
  the evening before, Kippour stays within its rest frame.
- **The server-side pre-chkia reminder** (`functions/src/sunsetReminder.ts`)
  reproduces the same NOAA algorithm: nothing to report.

## 3. Errors

In decreasing order of severity.

### 3.1 One hour off on the day the DEVICE changes its clock

On the device, on the day of the switch to standard time, some times come out
one hour off, for any displayed location. Reproduced with hebcal alone (6.9.1
and 6.9.2, its latest version):

| Device set to       | Displayed location | Day         | Wrong time                             |
| ------------------- | ------------------ | ----------- | -------------------------------------- |
| America/New_York    | Paris              | Nov 1, 2026 | netz 06:37 displayed 05:37 (UTC)       |
| America/New_York    | Paris              | Nov 1, 2026 | end of Chéma MGA 08:29 displayed 07:44 |
| America/Los_Angeles | Paris              | Nov 1, 2026 | end of Chéma GRA 09:05 displayed 08:05 |

Cause: `zdtToDate` in `@hebcal/core/dist/esm/zmanim.js` calls
`res.setMilliseconds(0)` on the `Date` obtained from the exact instant. But
`Date` setters recompute the instant from the device's LOCAL FIELDS; during
the ambiguous hour of the return to standard time (01:00 to 02:00 in New
York, which occurs twice), JavaScript picks the other occurrence, and the
instant moves back or forward by one hour. `sunsetOffset` (candle lighting)
and `sunriseOffset` have the same defect with `setSeconds(0, 0)`. Any time
whose instant falls within the device's ambiguous hour is affected,
regardless of the displayed location.

Impact: a French device on October 25, 2026 (ambiguous hour 2 a.m. to 3 a.m.,
i.e. midnight to 1 a.m. UTC) is affected only for times falling there (none
in Paris that day, but the night 'hatsot of a city further west); a device
set to an American time zone viewing Paris or Jerusalem is affected on the
netz, the end of Chéma and of the Amida. Rare, but it is the kind of "glitch"
that gets reported and cannot be reproduced the next day.

Fix: upstream (`hebcal/hebcal-es6`), replace `setMilliseconds(0)` with
`new Date(Math.floor(zdt.epochMilliseconds / 1000) * 1000)` and
`setSeconds(0, 0)` with a truncation on the epoch; in the meantime, the same
fix can be applied here through `patch-package` on both functions.

### 3.2 End of fasts per Rav Ovadia: 20 FIXED minutes instead of zmaniyot

`zmanimOpinions.ts` (`OVADIA_FAST_END_MINUTES`) gives 20 fixed minutes after
the chkia, citing the Rabbi Ovadiah Yosef calendar. That calendar does
something else: `getTzeitLChumra()` computes `20 * (shaahZmanisGra / 60)`,
i.e. 20 ZMANIYOT minutes, and `ZmanimFactory` uses that time for the end of
every fast (`FAST_ENDS_ZMAN`). The difference, app minus luah:

| Location     | Fast                     | Difference |
| ------------ | ------------------------ | ---------- |
| Paris        | 17 Tamouz 2026 (July 2)  | -6.8 min   |
| Paris        | Tich'a beAv 2026         | -5.8 min   |
| Paris        | 10 Tévet 2026 (Dec 20)   | +6.2 min   |
| Jerusalem    | 17 Tamouz 2026           | -3.6 min   |
| Jerusalem    | 10 Tévet 2026            | +3.2 min   |
| Montreal     | 17 Tamouz 2026           | -6.0 min   |
| Buenos Aires | 17 Tamouz 2026 (winter)  | +3.5 min   |

In summer, the app has people break the fast up to seven minutes too early;
in winter, it makes them wait six minutes too long. At the equinox (Guedalia,
Esther), the difference is zero, which explains why the tests, written on
Tzom Guedalia, did not catch it. File: `zmanimOpinions.ts`, `fastEnd` of
`OVADIA`, and the note `zmanim.fast.endAfterSunset` which announces fixed
minutes.

### 3.3 End times are truncated on display: up to 59 seconds too early

`formatZmanTime` goes through `Intl.DateTimeFormat`, which truncates seconds.
That is correct for a DEADLINE (end of Chéma at 10:37:48 displayed as 10:37,
which errs on the safe side), but wrong for an END: nightfall at 20:44:21
displays as 20:44, the end of Chabbat at 20:42:09 displays as 20:42, the end
of the fast at 20:44:19 displays as 20:44. Across the matrix, 907 tsét out of
1,742 have 30 seconds or more; 557 rest endings out of 565 and 902 fast
endings out of 912 carry non-zero seconds. Luhot round endings UP to the next
minute (the Rabbi Ovadiah Yosef calendar marks each zman `ROUND_EARLIER` or
`ROUND_LATER`; hebcal rounds its havdala to the nearest minute). Candle
lighting, for its part, is already rounded down by hebcal.

Where: `formatZmanTime` (`zmanimService.ts`) has no notion of direction;
`ZMAN_DEFS` could carry, per time, whether it rounds up (tsét, end of rest,
end of fast, Rabbénou Tam, night 'hatsot) or down (everything else), and
`RestPeriod.end`, `FastPeriod.end` could round up to the next minute before
display and reminder.

### 3.3 bis The rounding direction, checked against the source

The plan (batch 2) put everything that is not an ending under "deadlines,
rounded down". The Rabbi Ovadiah Yosef calendar, reread zman by zman
(`ROUND_EARLIER` and `ROUND_LATER` in its `ZmanimFactory.java`), puts five of
them on the other side: talith, netz, min'ha guedola, min'ha ketana and plag.

This is not a substantive contradiction; it is the plan's enumeration that
missed its own rule: these five times are BEGINNINGS, the first moments when
something is permitted, just like an ending. One does not put on the talith
two seconds before the time, one does not pray min'ha before min'ha guedola.
The direction adopted is therefore that of the source:

| Down (last moment) | Up (first moment) |
| ------------------ | ----------------- |
| dawn, end of Chéma and of the Amida (both opinions), 'hamets deadlines, hatsot, chkia, candle lighting | talith, netz, min'ha guedola, min'ha ketana, plag, nightfall, end of Chabbat, end of fast, night hatsot |

Dawn stays rounded down: it does not open a permission, it opens the Maguen
Avraham's day, from which deadlines are counted. That is also the direction
the source gives it.

One visible consequence: the netz displays at the next minute in the day's
list (06:27:44 becomes 06:28), but the Sli'hot window, which it CLOSES, keeps
the previous minute. The same instant, two roles.

### 3.4 Tahanoun: two wrong days, inherited from hebcal

- **The day after 'Hanouka.** hebcal removes tahanoun from 25 to 33 Kislev
  (`range(25, 33)`), without checking whether Kislev has 29 or 30 days. The
  33rd of Kislev spills over onto 3 Tévet when Kislev is full (5787: Sunday
  December 13, 2026, « Pas de Ta'hanoun » ("No Ta'hanoun") wrongly), and onto
  4 Tévet when it is not. 3 Tévet 5787 is well after 'Hanouka (25 Kislev to
  2 Tévet).
- **Chouchan Pourim Katan** (15 Adar I, Monday February 22, 2027): the app
  says tahanoun. The Choul'han Aroukh (Ora'h 'Haïm 697) omits it on the 14th
  AND 15th of Adar I; hebcal only knows about the 14th.

Where: `tachanun.ts`, which already corrects hebcal on three points; these
two are added to the same list. The sidour (`dailyCycles`) reads the same
function.

A clarification, found while writing the fix: the test cannot rely on
`flags.CHANUKAH_CANDLES`, as the plan suggested. The LAST day of 'Hanouka
("Chanukah: 8th Day") does not carry this flag, since nothing is lit anymore
on it: the rule would have restored tahanoun on 3 Tévet 5790, which is
precisely that eighth day. It is the event name (`basename()`) that decides.

Addition from October 2026, reported in use: **the end of Tichri**. hebcal
says tahanoun from 25 to 30 Tichri (it only lists them among the days on
which some communities omit it); the Sephardic custom the app follows does
not say it for the whole month. `saidTachanun` therefore removes it up to and
including Roch 'Hodech 'Hechvan. Test: `tachanun.test.ts`, « la fin de
Tichri » ("the end of Tichri").

### 3.5 Candle lighting in Israel: 18 minutes everywhere except Jerusalem

`CANDLE_LIGHTING_BY_CITY` only knows Jerusalem (40). However:

- **Haifa** lights 30 minutes before the chkia (established custom, adopted
  by hebcal and Chabad.org); the app gives 18.
- **The rest of Israel** lights at 20 minutes, not 18: this is what Israeli
  luhot print, and the Rabbi Ovadiah Yosef calendar says so of the Or
  Ha'Haïm ("change `setCandleLightingOffset` to 20 if you want to replicate
  the exact times of the Ohr Hachaim calendar"). Under Rav Ovadia's opinion,
  the app therefore announces 2 minutes too late in 33 Israeli cities.
- **Petah Tikva** is split between the Jerusalem custom (40) and 20; **Safed
  and Tiberias** follow 20, except those who follow Jerusalem.

Where: `CANDLE_LIGHTING_BY_CITY` and `candleLightingMinutes`
(`zmanimService.ts`). A device position in Israel also follows 18, lacking a
name: the rule could take the time zone into account (`isIsraelPlace`) and
not only the name.

### 3.6 End of Chabbat per Rav Ovadia: 40 fixed minutes everywhere

`OVADIA_REST_END_MINUTES = 40` applies in Israel as elsewhere. The cited
calendar does two different things:

- **In Israel**, 30 minutes after the chkia ("30 minutes after sunset in
  Israel"). The app ends Chabbat 10 minutes too late in Jerusalem, all year
  round.
- **Outside Israel**, the calendar switches by default to the **Amudei
  Horaah** luah (Rav Leor Dahan, endorsed by Rav Yits'hak Yossef), whose
  ending is the sun at 7.165° below the horizon, with a 20-minute floor. That
  is later than 40 minutes as soon as one goes up in latitude in summer:

| Saturday     | Location | App (chkia + 40) | Amudei Horaah (7.165°) | Difference |
| ------------ | -------- | ---------------- | ---------------------- | ---------- |
| June 27, 2026 | Paris    | 22:38           | 22:51                  | -13 min    |
| June 27, 2026 | London   | 22:01           | 22:21                  | -20 min    |
| June 27, 2026 | Montreal | 21:27           | 21:34                  | -7 min     |
| Dec 26, 2026  | Paris    | 17:39           | 17:44                  | -5 min     |
| Sept 12, 2026 | Paris    | 20:50           | 20:49                  | +1 min     |

The app therefore releases Chabbat up to twenty minutes before the luah it
cites, in summer, in the north. Where: `restEnd` of `OVADIA`.

### 3.7 Michéyakir per Rav Ovadia: the "great need" time

`OVADIA_MISHEYAKIR_MINUTES = 66`. In the cited calendar, 66 zmaniyot minutes
is `getMisheyakir66ZmaniyotMinutes`, documented "THIS TIME SHOULD ONLY BE
USED FOR PEOPLE IN GREAT NEED" and reserved for the weekly display; the
ordinary talith time is `getMisheyakir60ZmaniyotMinutes`, 60 zmaniyot
minutes. Paris, June 21, 2026: 04:17 (app) versus 04:26 (luah); Jerusalem,
December 21: 05:39 versus 05:44. Where: `misheyakir` of `OVADIA`.

### 3.8 Elevation is ignored, including where the cited luah accounts for it

`geoLocationOf` sets the elevation to 0 and `useElevation` to false. For Rav
Posen's opinion (the European calendars), that is the custom. For the Or
Ha'Haïm, it is not: "The Ohr Hachaim calendar uses elevation adjusted sunrise
and sunset for all of its zmanim", and that shifted sunset drives candle
lighting, tsét (13.5 zmaniyot after it), the end of the fast and the end of
Chabbat. Measured with kosher-zmanim and PyEphem (both agree), sunset later
and sunrise earlier by:

| Location     | Elevation  | Shift          |
| ------------ | ---------- | -------------- |
| Jerusalem    | 754 m      | 4.1 to 4.7 min |
| Safed        | 900 m      | 4.6 to 5.3 min |
| Geneva, Bern | 375, 540 m | 3.6 to 5.5 min |
| Denver       | 1,609 m    | 6.7 to 8.0 min |
| Mexico City  | 2,240 m    | 6.4 to 7.2 min |
| Bogota       | 2,640 m    | 6.6 to 7.2 min |
| La Paz       | 3,640 m    | 8.1 to 8.9 min |

In Jerusalem under Rav Ovadia's opinion, everything read off the chkia
(candle lighting, tsét, end of fast, end of Chabbat) is therefore shifted by
more than four minutes relative to the printed luah. The catalog has no
elevation; hebcal's `cities.json` carries one for its cities (Beer Sheva 285,
Ashdod 27...), and so does geonames, already used by
`scripts/generate-cities.mjs`. The note `zmanim.disclaimer` does say « niveau
de la mer » ("sea level"): it remains true, but it contradicts the « Or
Ha'Haïm » label.

### 3.8 bis Elevation: batch 7 is on hold

Batch 7 proposed enabling elevation for Rav Ovadia's opinion in Israeli
cities, based on a geonames elevation table. Rereading the source calendar
contradicts this on two counts, so the batch is set aside rather than applied
wrongly.

**The direction.** The Rabbi Ovadiah Yosef calendar does not turn elevation
on in Israel, it turns it OFF. Its startup screen writes
`useElevation = !inIsrael` (`InIsraelActivity.saveInfoAndStartActivity`):
answering "I am in Israel" sets elevation to zero. And the second entry
point, when the position is clearly outside Israel, also writes
`useElevation = false` (`GetUserLocationWithMapActivity`). The sentence the
audit quoted, "The Ohr Hachaim calendar uses elevation adjusted sunrise and
sunset for all of its zmanim", is a comment on `getCandleLighting()`: it
explains why this method reads the ADJUSTED sunset rather than the sea-level
one when elevation is enabled, not that it always is. In Israel, the calendar
actually takes its sunrise from ChaiTables (`getHaNetz`), which accounts for
the real mountain horizon, far better than an average elevation.

**The data.** The source calendar carries no elevation table: it queries
geonames.org at computation time, three times, and averages the results
(`LocationResolver.resolveElevation`). Elevation there is a PER-POSITION
value, which the user can also enter by hand (`SetupElevationActivity`). The
thirty-five elevations the batch asked for therefore exist nowhere in the
source, and geonames is not reachable from the work environment: making them
up would be precisely the "value adjusted to make it pass" that the plan
forbids.

**What it would cost.** Enabling elevation in Jerusalem pushes the chkia back
by four to five minutes, and with it candle lighting, tsét, the end of fasts
and the end of Chabbat, for every user in the country. A shift of that size
is not made on a premise the source refutes.

**What would be faithful**, if the topic is picked up again: a per-location
elevation setting, off by default, fed by manual entry or by an elevation
service, as the source does. That is a product decision, not an audit fix,
and it falls outside this project.

### 3.9 The "Rav Ovadia" opinion applies Israel's parameters to the whole world

The cited calendar only uses the Or Ha'Haïm (72 zmaniyot minutes, 13.5, 72)
in Israel; outside Israel, it switches to Amudei Horaah: dawn and tsét are
first measured in degrees (16.04° and 3.7°) at the equinox at the location
itself, then converted into zmaniyot. In Paris, 72 zmaniyot minutes of dawn
give 96 minutes before sunrise in June; the same calendar, for Paris, gives
about 123. Rabbénou Tam there is the earlier of 72 fixed and 72 zmaniyot (Rav
Ovadia himself followed the zmaniyot), while the app always takes the
zmaniyot: 23:35 on June 27, 2026 in Paris, when the luah would print 23:09.

This is not a calculation error, it is unfaithfulness to the source cited in
the settings screen. Decision made: the location decides, and the opinion
must give the time of its luah where one is, Or Ha'Haïm in Israel and Amudei
Horaah elsewhere (see `docs/plan-horaires-2026-09.md`, guiding principle and
batch 3).

### 3.9 bis What batch 3 changes for Paris, and what the plan said about it

To test batch 3, the plan gave two Paris times taken from the table in item
3.2: Tzom Guedalia 2026 at 20:26:57 (twenty zmaniyot minutes) and 17 Tamouz
"six to seven minutes later" than the twenty fixed minutes. Those two values
are the Or Ha'Haïm ones, measured before item 3.9 was decided.

But Paris is not in Israel: batch 3 applies Amudei Horaah there, and the end
of fasts is measured at 5.075° at the equinox. The true times are therefore:

| Paris, Rav Ovadia opinion  | 20 fixed (before) | 20 zmaniyot (Or Ha'Haïm) | Amudei Horaah (adopted) |
| -------------------------- | ----------------- | ------------------------ | ----------------------- |
| Tzom Guedalia, Sept 14, 2026 | 20:25:50        | 20:26:57                 | 20:33:09                |
| 17 Tamouz, July 2, 2026      | 22:17:16        | 22:24:05                 | 22:31:58                |

It was the plan that contradicted itself, not the source: its batch 3c does
say that Paris follows Amudei Horaah, and the cited calendar confirms it
(`getTzeitLChumra`, `amudehHoraah` branch). The tests use the times in the
right-hand column, and keep the other two in a comment so the comparison
stays readable.

### 3.10 Birkat Halevana: a fixed-day window, ignoring the molad

`saysBirkatHalevana` allows the nights that open the 8th to the 14th of the
month. The rule (seven full days since the molad, until the middle of the
lunation, 14 d 18 h 22 min) is counted from the molad, and Roch Hodech falls
zero to two days after it. In 5787:

- **Nissan 5787**: molad on Tuesday 28 Adar II at 14:07; seven days later is
  6 Nissan at 14:07, but the app only opens the night of the 8th. The
  half-lunation falls on 13 Nissan around 8:30 a.m.; the app still allows the
  night that opens the 14th, about ten hours after the limit.
- **Tichri 5787**: molad on Friday 29 Eloul at 20:59, seven days at 7 Tichri
  in the evening; the half-lunation at 14 Tichri at 3 p.m. Here, the
  postponement after Kippour (night of the 11th) and the end on the 14th come
  out right.

Where: `saysBirkatHalevana` and `birkatHalevanaLastDay`. hebcal computes the
molad (`Molad`): the start could be "molad + 7 days" and the end "molad + 14
d 18 h 22 min", in Jerusalem time, with the custom of the followed opinion
for rounding.

### 3.10 bis The dates in item 3.10, recomputed

Item 3.10 gave, for Nissan 5787, a half-lunation "on 13 Nissan around 8:30
a.m.", and concluded that the app allowed one night too many at the end.
hebcal's molad says otherwise: the limit falls on April 21, 2027 at 08:08
(Paris time), which is 14 Nissan. The night that opens the 14th is therefore
indeed permitted, and it was only at the START that the window was wrong that
month: seven full days have elapsed as of the night that opens the 7th.

The other months tested lean the other way, the molad following Roch Hodech
more closely there:

| Month         | Day-count window      | Molad window          |
| ------------- | --------------------- | --------------------- |
| Av 5786       | nights of 8th to 14th | nights of 8th to 15th |
| Eloul 5786    | nights of 8th to 14th | nights of 8th to 15th |
| Tichri 5787   | nights of 8th to 14th | nights of 8th to 15th |
| Nissan 5787   | nights of 8th to 14th | nights of 7th to 14th |

The underlying error that item 3.10 pointed out is therefore real, and off by
one day in both directions; it is its two example dates that were off.

### 3.11 The holiday calendar includes days that are not holidays

`CALENDAR_FLAGS` includes `MINOR_HOLIDAY`, which brings in "Lel Selihot" (23
Eloul, ASHKENAZI custom: Sephardim say Sli'hot from Roch Hodech Eloul, and
the app offers them that way), "Roch Hachanah LaBehemot" (1 Eloul) and "Hag
HaBanot" (30 Kislev). In a Sephardic calendar, the first is wrong and the
other two are noise. Where: `yearCalendar`, filter on `ev.basename()`.

### 3.12 A day marker rendered in the location's time zone

Found while replaying the matrix, after the project (batch 11).

Some fields do not carry a time but a DATE: the Chabbat day of a block
(`RestPeriod.shabbat`), the day of the érouv tavchilin, the day of a fast
whose dawn cannot be computed. They are set at the machine's LOCAL noon
(`civilNoon`, `HDate.greg`), and that is their reference frame.

The cards passed them to `formatZmanDay`, which renders them in the
LOCATION's time zone. As long as the machine and the location are close,
this is invisible; as soon as they are far apart, the marker moves back one
day: noon in Auckland is still the previous evening in New York. It is the
trap of item 3.1 at the scale of the day rather than the hour.

Fixed with batch 11: `formatMarkerDay` reads a marker back in its own frame,
and both cards use it. `CalendarPage` already did this correctly, without
naming it.

## 4. Gaps

### 4.1 Intermediate candle lightings within a rest block

A block has only one start and one end. Yet between the two there are candle
lightings users look for, which hebcal computes:

- **The second evening of a two-day Yom Tov**: lighting after nightfall, from
  an existing flame. Roch Hachana 5787: Saturday September 12, 2026, 20:58 in
  Paris. Missing.
- **Friday within a block**: lighting before the chkia. Pessah 5787
  (Thursday, Friday, Chabbat): Friday April 23, 2027, 20:35 in Paris.
  Missing.
- **A Yom Tov that starts on Saturday night**: lighting after the end of
  Chabbat (Chavou'ot 5789, Sunday May 20, 2029). Missing.

The card's note says « on allume après la sortie, à partir d'une flamme déjà
allumée » ("light after nightfall, from an already lit flame"), without
giving the time. `restPeriodAt` already has `first` and `last`: a list of
candle lightings (one per evening, with its rule) would suffice.
`HebrewCalendar.calendar({ candlelighting: true })` serves as a reference
(`LIGHT_CANDLES_TZEIS` events).

### 4.2 Erouv tavchilin

When a Yom Tov falls on Thursday and Friday (Pessah 5787) or on Friday alone,
the érouv tavchilin must be made the day before. Neither the page nor the
calendar says so; hebcal marks those days (`flags.EREV` with `YOM_TOV_ENDS`
on Friday, or its `hasEruvTavshilin` test on the KosherJava side).

### 4.3 The candle-lighting offset setting

18, 20, 30 or 40 minutes: it is the custom of a community, not of a city
(Petah Tikva has two). A setting, with the per-location default from 3.5,
would avoid deciding on the user's behalf.

### 4.4 Kippour without "start of the fast"

Kippour only has the rest frame, whose start is called « Allumage des
bougies » ("Candle lighting"). Someone looking for "what time does the fast
start" does not find the word. A « Début du jeûne » ("Start of the fast")
line (same time) in the card, when the block includes Kippour, would remove
the doubt.

### 4.5 Ta'anit Bekhorot for everyone

On the day before Pessah, the fast of the firstborn rises to the top of the
page like a public fast, with an end « à la sortie des étoiles » ("at
nightfall") that nobody follows (the siyoum lifts it). It only concerns the
firstborn; PR 228 adds the 'hamets deadlines, which is what everyone looks
for that day. The fast card could be hidden or placed below.

## 5. To check by hand in a French luah

Since the Consistoire and Torah-Box are unreachable from here, here are the
app's times (Rav Posen opinion, Paris, coordinates 48.8534 / 2.3488) for the
Chabbat of September 18 to 19, 2026, to set next to the printed calendar:

| Time                                                       | App           |
| ---------------------------------------------------------- | ------------- |
| Alot haCha'har (16.1°)                                     | 05:55         |
| Michéyakir (11.5°)                                         | 06:25         |
| Netz                                                       | 07:31         |
| End of Chéma (Maguen Avraham, 72 fixed min, before PR 228) | 10:01         |
| End of Chéma (Vilna Gaon)                                  | 10:37         |
| 'Hatsot                                                    | 13:44         |
| Plag hamin'ha                                              | 18:39         |
| Candle lighting (chkia 19:57, minus 18)                    | 19:39         |
| End of Chabbat (8.5°, Saturday)                            | 20:42         |
| Rabbénou Tam (72 min, Saturday)                            | 21:07         |
| Tzom Guedalia, Monday 14th: start / end (7.083°)           | 05:48 / 20:44 |

If the Consistoire calendar gives an end of Chabbat other than 20:42 or an
end of fast other than 20:44, it is the definition (the degrees) that needs
revisiting, not the calculation.

## 6. What PR 228 already settles

- Rav Posen's Maguen Avraham moves from 72 fixed minutes to 16.1° (checked:
  the new value is that of kosher-zmanim's
  `getSofZmanShmaMGA16Point1Degrees`, within 2 seconds; the old one deviated
  from it by 8 minutes on average, up to 76 in Manchester in July).
- Sorted times, false fasts (Yom Kippour Katan, BeHaB) removed, tahanoun on
  tachloumin days, missing times explained at latitudes where 16.1° does not
  occur (Lille and London in June, Helsinki from June to August, also noted
  here), nullable end and start, the 'hamets deadlines.

Nothing in that PR touches items 3.1 to 3.11 or section 4.

## 7. Suggested order

1. 3.1 (one hour off, two-line patch) and 3.3 (rounding of endings): these
   are the only two items that also affect the default opinion.
2. 3.2, 3.6, 3.7 (Rav Ovadia's opinion does not do what its source does),
   then the decision on 3.9.
3. 3.4 and 3.5 (tahanoun, candle lighting in Israel), small and unambiguous.
4. 4.1 (intermediate candle lightings), the most visible gap.
5. 3.8, 3.10, 3.11, 4.2 to 4.5.
