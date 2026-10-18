# Design guidelines

This document is the reference for how the site and the app look. It says
what we use, and above all what we no longer use. Every new page fits into
it; every exception is discussed and written down here.

The guiding thread fits in one image: Jerusalem stone. Plain, warm surfaces
laid flat; solid colors that catch the eye where action is needed; nothing
hazy.

## 1. The background, the surfaces

| Role                          | Token                    | Light        | Dark          |
| ----------------------------- | ------------------------ | ------------ | ------------- |
| Page background               | `--color-bg-beige`       | `#fff9f3`    | `#111827`     |
| Surface (card, panel, window) | `--color-surface`        | `#ffffff`    | `#1f2937`     |
| Soft surface                  | `--color-surface-soft`   | `#f8f5ef`    | `#273244`     |
| Text                          | `--color-text-primary`   | `#35312a`    | `#f3f4f6`     |
| Secondary text                | `--color-text-secondary` | `#6d6759`    | `#9ca3af`     |
| Rule                          | `--color-line`           | black at 8 % | white at 10 % |

A surface stands out from the background through its shadow, never through a
border. The three shadows (`--shadow-card`, `--shadow-card-hover`,
`--shadow-pop`) are tinted warm to stay in the beige family.

### The card is clickable, and says so without an arrow

A card leads somewhere: it is a link or a button, entirely, margins
included. The little gray chevron at its end only repeated what the card
already made clear; it added a target that is not one (the click works
everywhere) and it stole room from the content. There are none on cards
anymore.

Three arrows remain, because they do not say "clickable":

- **direction** (the next chiour, the previous chapter, the following month);
- **expansion** (an arrow that rotates on a block that opens);
- the **list row** in a panel (the profile pages), which has neither frame
  nor shadow and where the chevron is the only mark of the link.

Corollary: a block that leads nowhere is not a clickable card. It may remain
a surface (a settings panel, a form), but it never takes `card-hover`, whose
deepening shadow promises a click.

### A command placed in a text carries its name

In a text, an icon alone does not read as a command. The reader sees an
ornament of the passage, one more mark in a page that already carries many
(verse numbers, stage directions, cross-references), and does not tap it.
The Kotel compass and the tefilin mirror sat next to their titles without
anyone guessing they could be touched.

A command placed in a text is therefore a pill in the theme color, carrying
its drawing AND its name spelled out: « Direction du Kotel » ("Direction of
the Kotel"), « Miroir » ("Mirror"), the scroll of a paragraph. The
background, even a light one, sets it apart from the text; the name says
what it does before it is touched.

At a passage's title, it sits opposite the title, at the end of its line,
and not stuck to the last word: stuck there, it passes for the rest of the
title. Its size does not follow that of the text being read, unlike the pill
of a scroll, which lives in the flow of reading: a title command is an
interface object, and two of them look exactly alike, on any page and at
any reading size.

### The frame must be earned

Not everything has to be in a card. A card says "here is an answer to a
question you are asking yourself": my reading for today, the upcoming time,
a session in progress. It holds a piece of data, a state, something that
changes.

A mere place to go is not one: the site's three doors, on the home page, sit
directly on the beige, nothing between them but a gap, with the title taking
on color on hover while the drawing comes alive. No rule either: a line
between them redrew the boxes they had just been taken out of. Framed, they
competed for attention with
the dashboard cards and the page became a stack of boxes; without a frame,
the only white surfaces are the ones that answer, and the page reads in two
steps.

Nothing else signals the click: no chevron at the end, no arrow appearing on
hover. The color that comes onto the title is enough, and on a touch screen
none of these marks show anyway.

In the app, these three doors fit on a single line, a drawing and a title,
without the introductory sentence: the screen is narrow, the bottom bar
waits just below, and you know what the library is once you have installed
the app. The sentence serves the site visitor, not the regular.

On the times page, two appointments likewise take a frame amid the lines of
the day: rest (Chabbat, a holiday, with its start and end) and the fast (its
start and end). These are not moments of the day but appointments of the
week, and both announce themselves the day before, at the bottom of the
page, then move ahead of the times on the day they begin: on Friday, the
candle-lighting time is what you come to check; on the eve of a fast, you
look up until what time you can eat.

### The instructions do not hold the page

An explanation is read once. « Instructions », laid out in full between the
progress of a chain and the list of its texts, pushed the texts down by four
lines on every visit, including for the regular who has long known how to
reserve. It joins the row of pills describing the chain (the type, the
deadline, the creator) and opens in a window when touched.

And it shows rather than explains: each gesture (search, reserve, return,
mark as read, read) plays out in miniature, in a **drawn** screenshot
(`src/components/mock`), which follows the theme and the language, weighs
almost nothing and does not age from one redesign to the next as a video
would. A sentence alone ("check the boxes to reserve") does not say much
until you have seen the box get checked.

Hence the rule of this row: a pill **states**, except the one that carries
an **icon**, which **opens**. Nothing else distinguishes it, neither chevron
nor arrow; on hover its tint darkens, and on a touch screen the icon is
enough.

A **number that counts people opens onto their names** in the same way: the
progress bar says how many take part, touching it says who, and where each
one stands in their readings.

Corollary: what no longer offers anything disappears instead of being
grayed out. The random draw card disappears when all the Tehilim are taken,
rather than offering a grayed-out button. In « Je participe » ("I'm taking
part"), the chain expanded by default is the first one where I still have
something to read, not the first in the list: one I have fully read no
longer expects anything from me. And the library's « Reprendre ma lecture »
("Resume my reading") row offers only the last one: closing it makes it
disappear, it does not walk back through the history text by text (each
text, for its part, always reopens where it was left).

Same rule for « Comment ça marche » ("How it works"), the timeline on the
reading-sharing page: it now only shows to those discovering it. It
withdraws for good as soon as the principle is known, through « J'ai
compris » ("Got it") under the timeline, or on its own at the first session
created or joined; the device remembers it (`useShareHowItWorks`,
`shareHowItWorks.test.ts`).

### A tip plays out on the page, once

The introduction says what the app contains; it cannot say how each screen
is handled. A times row you pull to set a reminder, the round button on a
reading page that opens the table of contents and the settings: nobody
guesses a gesture, and a command nobody knows about serves nobody. These two
had been explained nowhere, and so were never used.

The tip therefore plays out **where the command is**, the first time you
arrive on the page (`FeatureTour.vue`, `useFeatureTips`): a veil darkens the
page, a spotlight cuts out the command, a border in the theme color breathes
around it, and a bubble with its arrow says in two sentences what it does.
Four rules hold it:

- **the command stays live under the spotlight.** The veil is not painted
  there: touching it does what it usually does, and the tip moves to the
  next step or goes away; you have understood. It also **shows** when it
  can: on the times page, a drawn finger (`MockTouch`) lands on the first row, pulls it to the
  left up to its bell and lets go, for the length of the step, then the
  city name, which is the button that changes it, takes the spotlight; on a
  reading, the tip opens the panel to light up the text download, then the
  settings circle;
- **it can be skipped with one gesture**: « Passer » ("Skip"), the veil,
  Escape or the Android back button. The veil only listens once the tip has
  settled (`VEIL_GRACE_MS`): a tap in the instant it appears is the previous
  gesture continuing (the times arrow tapped one more time), and it used to
  close the tip for good before it had been read. « Suivant » ("Next") or
  « Compris » ("Got it") take it to the end. Never more than two or three
  steps. A step with no command to light up (pinching the text, the double
  tap) places the bubble in the middle and **shows** the gesture in a drawn
  screenshot (`src/components/mock`);
- **once per device, and only one per app opening.** Once closed, it is
  recorded as seen (in both storages, see docs/app-native.md), even if you
  leave the page midway: a tip that comes back is no longer help. And four
  bubbles in a row while changing pages would be a tutorial nobody asked
  for: the next one waits for the next opening (an app relaunch, or a
  return to the foreground after half an hour elsewhere). On the same page,
  one tip can wait for another: the reading gestures come one opening after
  the menu. « Revoir les astuces » ("See tips again", app profile, Help
  group) puts them back in play, page by page;
- **« Plus tard »** ("Later"): you do not always have time to read. The
  bubble withdraws without counting the tip as seen, and it comes back, on
  the same page, at the next opening;
- **never on top of something else**: not the introduction, not an open
  window, not another tip, not a command off screen; and it waits for the
  page to settle. Under the introduction, it waits for it to close: that is
  the case of the home page tip, at the first opening.

**The Mon parcours tutorial** (`useParcoursTours`) is an exception to two
rules. Its gestures cannot be guessed (swiping a card, pulling the stack,
long-pressing a volume, pinching the wall): one tour per screen, of three
or four steps, on the first visit to each; the home page (the stack, the
day bar, the light, the shelf), Mon parcours (the light, the wall, the
shelf, « Nouvel objectif » ("New goal")), Nouvel objectif (finishing a text,
a cycle, a habit), a program (the portion, « Rattraper » ("Catch up"),
« Lire la suite » ("Read on"), « Modifier » ("Edit")). A step whose command
is not on screen (no backlog, nothing further to read) is skipped. And it
also shows **on the site** (`web`): nobody arrives there from a search
engine with an account, and the gestures are the same. On the home page, it
comes before the settings tip, which waits for the next opening. The
commands are found by their `data-tour` marker.

The home page carries the first one: where the app is adjusted to your
taste (the tab at the bottom right, theme, font, dark mode), then the
account, what it brings (sharing readings, the daily reading, your settings
on another device) and, above all, that it is not mandatory. It lights up
the « Créer un compte » ("Create an account") button as long as the home
page shows it, and is not offered to those who already have an account.

The others, each on its own page: the times (the reminder by gesture, the
location), the calendar (your own dates, which come back on the home page
and send reminders), the reading (the menu, reading offline, the settings;
then the gestures, one opening later), reading sharing (creating a chain,
joining one, the first in the list under the spotlight) and the daily
reading (composing your list, the reminder bell). A tip only presents what
the page offers: no reminder on the site, no download when the text has
none.

A tip can also be **called up by a gesture** rather than by arriving on the
page: the one for the times calendar (`zmanim-date`) only shows on the
third tap in a row on a day arrow. People were seen tapping the arrow up to
37 times to reach a Chabbat or a holiday, the calendar remaining ignored
under the date title (`docs/audit-usage-posthog-2026-10.md`, 2.3). The
spotlight lands on the date, which is the calendar button; whoever has
opened it on their own will never see it. The others' rules apply to it:
once per device, only one per app opening.

Native app only, like the introduction: a site visitor arrives through a
specific page, and a bubble across what they came to read would be a
nuisance. `?tips` in the address forces them wherever the command exists (or
`?tips=reading-gestures` for a single one), to show and try them on the
preview channels.

### The introduction sets things up first; gestures come last

The first-opening introduction (`OnboardingFlow.vue`) sets a few settings,
says what the app contains, then shows the gestures to those who want to see
them. It used to have six pages, consent included, with animated
screenshots from the third one: nearly half of people skipped it, almost all
from the first page after consent. It now has five, each one short:

- **consent**, in three lines, because it requires a choice;
- **settings**: the language, light or dark, the theme and higher
  contrast, nothing more (`AppearanceSettings essentials`). Higher contrast
  is there from the first launch because whoever needs it cannot read the
  rest comfortably until it is on. Fonts and holiday themes wait in the
  profile;
- **texts to take along**, the only setting that does something;
- **the essentials**: the library, the times, the daily reading, one line
  each, and the button that composes the daily reading;
- **gestures**: the reading menu, pinching, double tap, as screenshots, with
  the texts of the reader's tips.

The first four have no « Passer » ("Skip"): we want them read, and they are
short so that people read them. Only the gestures can be skipped (the
button, Escape), at no cost: the same ones come back as tips on the reading
page. A new page must earn its place against the others, and what is
learned by doing goes with the gestures, not before.

### What's new plays once, after the update

When an update moves things around, those who knew the app before must be
told where things went: 4.0 moved the library and the classes under
« Étude » and gave the Sidour its own tab, and a reader looking for
« Bibliothèque » in the bar would not find it. The first launch after the
update plays a video of about ninety seconds on what changed
(`WhatsNewVideo.vue`, `useWhatsNew.ts`), in the reader's language: where the
tabs went first, then what is new.

- **Once, and only to those who are updating.** A fresh install sees the
  introduction, never this video: it shows a change to someone who never
  knew the app before it. The device notes the version it played, and
  « Revoir les nouveautés » ("Replay what's new"), in the profile's Help
  group next to the introduction and the tips, plays it again.
- **Nothing shows while it loads.** The video is served by the site
  (`public/videos/`), not bundled: a few megabytes per language, for a
  minute and a half of viewing. At launch, the screen only appears once the
  video can play; offline, nothing shows and nothing is noted, and it plays
  at a later launch.
- **It is written to be read.** Every change is said in a sentence on the
  screen; the music only goes with it. Where the system refuses sound
  without a touch, it plays muted and offers « Activer le son » ("Turn the
  sound on").
- **One can always leave.** « Fermer » ("Close") at the top, the Android
  back gesture, Escape; at the end, « C'est parti » ("Let's go") closes it
  and « Revoir la vidéo » ("Watch again") replays it. The page behind does
  not move.
- **It wears the page background** (`bg-bg-beige`), the same as the video's,
  so the bars above and below the picture on a tall phone do not show.

The video is made with the promotional videos (section 10, `promo/`, the
`nouveautes-*` compositions) from the app's own screens. A next one changes
`WHATS_NEW_VERSION` and is published under its name, in the three languages
(`whatsNew.test.ts` checks that the files the code asks for exist).

### Neighboring pages, a set of tabs

The app's bottom bar holds four tabs, not one more: Accueil (Home), Sidour,
Étude (Study) and Profil (Profile), with the times circle in the middle (see
"The navigation banner"). Pages that belong together therefore do not all
have a place there, and they ended up impossible to find: reading sharing
was only reachable from the home page, the holiday calendar through a small
link lost under the times title. They are grouped together, where you
already are (`PageTabs.vue`, native app only):

- **Bibliothèque** (Library), **Chiourim** and **Partage** (Sharing), at the
  top of Study: reading a text, listening to a class, sharing a reading
  among several people;
- **Horaires** (Times) and **Calendrier** (Calendar): today's times, or the
  year's holidays.

On the site, these tabs are not used: the banner leads there in one click
(the holiday calendar has had its own entry there since).

Three tabs did not fit with the two-tab padding: « Bibliothèque »,
« Chiourim » and « Partage » needed about 356 px for 327 on a 375 px phone.
Each tab therefore has 16 px of padding on each side (`px-4`), and all three
fit in all three languages.

Changing tabs makes **the white pill slide** from the tab left to the one
touched, stretching to its width: the new tab's bar (another page, hence
another instance) picks up the position recorded on touch. Arriving any
other way (bottom bar, link), the pill is simply in place, without movement
(see "Motion answers a gesture").

Two rules hold there:

- these are two **real pages**, not two panels. Each keeps its address, and
  hence its shareable link, its Android back behavior and its scroll
  restoration; the tab only links them.
- the tabs **stand in for the title** on these pages. « Lecture »
  ("Reading") above « Bibliothèque » said the same thing twice and cost two
  lines at the top of a phone screen; the `h1` remains, as `sr-only`, for
  screen readers.

### A page title is centered

On the site as in the app, a page's title is centered, and what serves it
(the location the times are computed for, an explanatory sentence) stays
centered beneath it. A page that aligned its title left while the others
centered it gave the impression of having been forgotten.

The commands that accompany it are real buttons (`btn`), centered in turn:
as small colored links, on a phone, nobody saw that they could be touched,
and thumbs missed them.

Under the times title, the location fits on **one line**: the city name,
which is the button that changes it, and « Ma position » ("My location"),
which picks it up. Both are small buttons (`btn-sm`), and the second says
only that: « Utiliser ma position » ("Use my location") and « Actualiser ma
position » ("Update my location") wrapped the button onto the next line as
soon as the city had a slightly long name, and the distinction only matters
for the label read by a screen reader. If the city name still does not fit,
it is the one that gives way, clipped, rather than the line wrapping: it is
one of the physically fixed boxes where truncation remains allowed (see
"Nothing gets cut off").

The sentence saying what these times are and what happens to the location
does not hold the page either: a small "i", next to the coordinates, opens
it in a window (see "The instructions do not hold the page"). A location
refusal, on the other hand, stays in plain view: it is urgent, and it
changes what is displayed.

In the bottom bar, the Study tab stays lit on the library, its corpora, the
chiourim and all of sharing; the Sidour tab, on its page and on each
liturgy text, even though these texts live under /bibliotheque
(`config/navSections.ts`: the address decides, since RouterLink's
`active-class` compares declared routes and not addresses). Held by
`src/__tests__/bottomTabBar.test.ts`.

### The app's home page greets; it does not pitch

In the app, the home page for a signed-out visitor opens on a greeting
(« Bonjour », « Bonsoir »: "Good morning", "Good evening"), aligned left like
that of a signed-in visitor, and on the account buttons at regular size. The
site's hook (big title and introductory paragraph) does not appear: whoever
has installed the app no longer needs convincing, and those lines pushed the
times and the three doors below the fold. The site, for its part, keeps its
centered hook.

### A list row can become a command

In the app, a times row is no longer just text: touching it sets a
reminder, pulling it to the left reveals, on the time side, a background in
the theme color carrying a bell (see `ZmanRow.vue`). On the site, the same row stays
text: there is nothing to schedule in a browser, and a command that leads
nowhere would be worse than no command at all.

Four rules follow, valid for any list animated this way.

The gesture has three outcomes, and the finger chooses which. Held back, it
lets the row return. Stopped midway, it opens the row onto its bell, which
you then touch to open the settings: you have time to read what you are
triggering. Pushed decisively, past half the row or with a quick flick, it
acts on its own and the row closes on its result, announced by a toast. The
shortcut rewards confidence without trapping hesitation, and it asks no
question: the reminder it sets reuses the last delay chosen (15 minutes
before until another one is chosen), because whoever sets reminders half an
hour ahead wants them all that way.

The revealed background is solid, in the theme color, and it occupies
exactly the room the row frees as it moves away: there is no frame and no
intermediate surface, and its icon sits in the middle of what was revealed,
never straddling what remains. The corner marker, for its part, fades out
during the gesture: placed against a drawer of the same color, it would no
longer have been a marker but a smudge.

The first decisive movement arbitrates between scrolling and swiping.
Without this arbitration, a thumb running down the page opened rows along
the way. And only one row stays open at a time, otherwise the list gets
covered in half-open drawers.

What a gesture has produced is seen without being read. A reminder that has
been set marks its row with a small solid triangle in the corner, on the
time side: a bell placed in the text would have eaten the room for the name
on a phone, and every other row marked would have made a column of icons.
The corner takes nobody's place and can be spotted at a glance when scanning
the list. The triangle follows the reading direction (logical borders), so
it switches sides in Hebrew.

### Two columns on a phone, only if the second one is capped

A calendar card carries two things: the holiday's name with its dates, and
its times. Side by side on a phone, they do not fit. The longest label in
the times column (« Allumage après la sortie du Chabbat », "Lighting after
Chabbat ends") alone decided its width, which took the whole card: the name
was left the width of one word, « Chabbat Roch Hachanah » came down like a
staircase, and the two columns ended up overlapping.

Hence the rule, valid for any two-column card. As long as the screen is
narrow, the second goes under the first, separated by a rule, each time
ending its line as on the times page. As soon as there is room (`sm`), it
comes back alongside, but capped in width: a column that sizes itself to
its longest label eats the card, and what you read first, the name, comes
last.

A date range, finally, writes only once what its two ends repeat: « du 1 au
2 Tichri 5787 », and not « du 1 Tichri 5787 au 2 Tichri 5787 ». Three lines
fewer on a phone, and nothing lost (`formatHebrewRangeStart`).

### What you come looking for takes the color, solid

Highlighting a card without putting color on it does not work. A tinted
frame is one more border in a page made only of borders; a background at a
few percent of the theme color does not stand out from the beige; and ink
alone, which is enough to mark the day's next time in a list of rows
(`ZmanRow`), gets lost in a list of cards, where each one already carries
three levels of text.

The calendar's next holiday therefore takes the theme tint at full strength,
over its whole card, and its text switches to the color that is written on
it (`on-brand`: white, or dark text in higher contrast). It is the
only colored card on the page, and you find it without having to read.

This text steps down in three tones there, as on the profile banner: the
holiday's name and its times at full strength, the dates and time labels
below, the Hebrew date lower still. Otherwise everything would weigh the
same and the card would no longer read.

Past dates keep their fading: fading and standing out are two opposite
means; they do not get in each other's way.

### A highlighted card can carry its object

The card of the moment already says, through its color, that it is what you
come looking for. It additionally carries the object of what it announces,
drawn in the colors of the real thing (`CardArt.vue`, the drawings in
`components/art`):

- the **sidour**, bound in midnight-blue leather, gilt title, red ribbon,
  for a service, the current one or the upcoming one;
- the **moon**, at its evening phase, on the nights of the blessing: the
  visible face, in the grays of the real one. The outlines of the seas are
  traced from a photo of the full moon (blurred, thresholded at the darkest
  third, edges simplified), not drawn from memory: they join in one piece,
  from the Ocean of Storms to Fecundity, with the bright bays of Copernicus
  and Kepler, their darker floors, Crises alone on the eastern edge, Tycho
  and its fine rays in the southern highlands;
- the **'hanoukkia** on the evenings of 'Hanouka;
- the **chofar** of Sli'hot, the bell open at the top, facing forward, and
  the mouthpiece at the bottom;
- the **loulav and etrog**, when the Souccot holiday takes the card;
- the **sheaf** of barley of the 'Omer;
- the **havdala**: the braided candle, blue and white strands, several
  wicks under a single flame, and beside it the silver cup of red wine;
- the shelf **volume**, with the binding and title of its section, on the
  inserts that open a section of the library: chnei mikra (Tanakh) and the
  day's Tehilim (Tehilim). It replaces the book icon they carried on the
  left.

These colors contrast with everything else in the app, which is made only of
theme tones: that is the point, an object recognized at a glance before the
name has been read.

- **The card does not grow for it.** The object has its own size, and it is
  the one that slips under the bottom edge when the card is short. A first
  version reserved an end margin for the drawing: the title wrapped, the
  card took sixty pixels for nothing, and looked big for the sake of being
  big. Nor does it take more than 42 % of the card's width: on a small
  phone, it shrinks rather than eating the title.
- **Behind the text.** The title passes in front of the object when it is
  long; on a dark object (the book, the loulav, the candles), the card's
  text reads as is. On a light object (the moon, the chofar), it takes a
  halo in the card's color, and only the time line leaves it its place. A
  service's pills (Hallel, Moussaf...) pass in front of the book.
- **In the line-end corner** (the right in French, the left in Hebrew), and
  **outside the card, only through the top**: the top of the book, the
  candles and their flames, the tip of the chofar, the loulav's palm cross
  the card's line. The moon, larger, is additionally cut by the card's edge,
  but only below the top of the card: what sticks out at the top is a whole
  cap, never a straight cut extended above the card. Held by
  `src/__tests__/cardArt.test.ts`.
- **The shape follows the day.** The moon is at its evening phase (its age
  since the molad, `moonAge`): gibbous on the 10th of the month, nearly full
  on the 14th, lit from the right as it is seen waxing from France; its dark
  part is a veil barely lighter than the background, the earthshine. The
  'hanoukkia carries as many candles as the evening counts, placed from
  right to left, plus the chamach: box candles, in every color, and tall;
  they are what must be seen. Lit once evening has come, unlit when the card
  announces tonight's lighting.
- **It rises once.** On its first appearance of the session, the object
  rises diagonally from the bottom corner of the card, the bottom edge
  serving as the horizon; the 'hanoukkia then lights up in the order in
  which it is lit: the chamach, the evening's candle (the leftmost), then
  the others toward the right. Coming back to the page finds it in place,
  without movement (see "Motion answers a gesture": it is the only arrival
  that moves, because it is the occasion itself that is arriving). Each card
  has its own rise. Never in reduced motion, nor in degraded rendering
  (`perf-lite`).
- **In flat colors.** Two or three tones per material (the face and the
  shadow of silver, the wax and its side, the flame and its core), never a
  gradient.
- **With its shadow**, like the cards: a light drop shadow sets what sticks
  out apart from the page background. Without it, the light moon melted into
  the beige above the card, and looked cut at the top edge.

On the home page, the cards of the moment carry the same object, small, on
their light surface: the sidour on « Faire Cha'harit » ("Pray Cha'harit"),
the moon on the blessing of the moon, the sheaf on the counting of the
'Omer. So do the lines under the Sidour's card: the sidour for a service,
the havdala, the moon all through its nights; they used to carry an icon on
the left, which said less and broke this rule. The moon takes slightly deeper tones there to stand out from the
white.

One more object is drawn in `components/art`, with these rules, and takes
its place in `CARD_ART_GEOMETRY` (size, proportions, what sticks out at the
top, inset from the edge).

### An icon before a title must say something

An icon to the left of a card title is placed only if nothing else says
what the card is. When the card already carries its object (the sidour, the
moon, the sheaf) or its large number on the right (the time on the times
card, the percentage of the daily reading), the icon says it again, less
well: a rising sun before « Faire Cha'harit » next to the book, a clock
before « Netz haHama » next to 08:08, an hourglass before the counting of
the 'Omer next to the sheaf. These cards therefore have none, and their
title aligns with the edge of the card. Held, for the cards that carry their
object, by `src/__tests__/cardArt.test.ts`.

The icon stays where it alone distinguishes: the cake of a birthday and the
candle of a leilouy nichmat among the dates you have added, the
« Aujourd'hui » ("Today") and « Hors ligne » ("Offline") rows of the
library, the section titles of the times.

### The play triangle is centered on its weight

A triangle centered on its box looks shifted toward its base: its weight is
at a third of its width. The play icon (`play-solid`) is therefore drawn
with its center of gravity in the middle, and its tip overflows
accordingly. The round button carrying it centers it like any other icon,
with no extra margin: a margin pushed it 1 to 2 px toward the tip, and the
triangle looked shifted to the right. Held by
`src/__tests__/playIcon.test.ts`.

### The Sidour opens on the moment

What is said (the tefilot, the brahot, the holiday texts) lived in three
books of the library, mixed with what is studied. It has its own page, the
Sidour, the second tab of the bottom bar, in the place and under the drawing
of the former library: it was through this open book that you went to find
the service; the gesture does not change, it just leads there faster.

The page has three tiers (`SidourPage.vue`):

- **the moment**, as a full-color card, the only one on the page (see "What
  you come looking for takes the color, solid"): **one single thing**, the
  most important at this hour. The service whose time it is, with the time
  until which it is said and, as pills, what the day adds to it (Ya'alé
  véyavo, Hallel, Moussaf, 'Al hanissim, Ata 'honantanou, the counting of
  the 'Omer...), the same occasions as those that color the text (see "What
  the day adds in a tefila"). A rare occasion goes ahead of the everyday
  service: the lighting on an evening of 'Hanouka, the Sli'hot from 'hatsot
  until sunrise. The blessing of the moon, on the nights it is said, comes
  after Arvit, as in the home stack: it takes the card once Arvit is said
  (or its time is over). Between two
  services, the current holiday takes the card if there is a text to say
  now or tonight (the loulav until chkia, the evening lighting, the night
  Sli'hot); otherwise the card announces the upcoming service rather than
  disappearing: on the home page, an empty card withdraws; here, it is the
  page's reason for being;
- **a service already said gives way**: checked off in Mon parcours (the
  « trois tefilot » habit) or swiped on the home page, it no longer holds
  the card, which goes to what comes next (the holiday, then the next
  service not yet said: Min'ha once Cha'harit is said, tomorrow's
  Cha'harit after Arvit). Under an occasion, it is no longer the line
  either (`useOfficesDone`, held by `src/__tests__/sidourMoment.test.ts`,
  « a service already said gives way »);
- **said with a swipe**: the card of the service whose time it is, or of
  the moon, is swiped right to say it is done, as in the home stack (the
  « C'est fait » pill coming out from under its left edge, darkening past
  110 px). It flies off to the right and the next one rises in its place;
  under it, « Arvit : c'est fait · Annuler » for a few seconds. A service
  whose time has not come and a holiday text are not swiped. With the
  « trois tefilot » habit, the swipe checks the habit's task; without it,
  the device remembers it, as for the deck's extra card. The same is said
  at the end of the service's text: the ring pulled upward of the day's
  portion (`PullToMark`, see "An open volume, its settings, the reader"),
  « Fin de l'office » (`OfficeDoneCard.vue`), which leads back to the
  Sidour. It stays a pull, not a tap: the same gesture as the day's
  portion. The lines under the card are swiped the same way, when what they
  announce can be said now (havdala, the moon, the service under an
  occasion): a line said leaves the page (`SidourLine.vue`);
- **the moon, from nightfall**: on the nights it is said, the moon has its
  line under the card (« Cette nuit, jusqu'au 15 'Hechvan »), as long as it
  does not hold the card and is not marked done (by its card in the stack
  or on this page): it comes back about ten nights a month and gets missed
  for lack of a reminder. It is a line of its own, alongside the one below.
  It is put forward only once it can be said: not by day, where « Ce soir »
  announced it from the morning;
- **one line below, at most** (besides the moon's), and only on an evening
  of an occasion: the service under the lighting, the Sli'hot or the moon,
  which preceded it in the card; havdala on the evening a Chabbat or a holiday ends. On other
  days, nothing. The card first announced up to three lines (the bedtime
  Chema, tikoun 'hatsot, the loulav, the Hochanot): three highlights meant
  highlighting none, and at Souccot the loulav and the Hochanot were
  repeated above the holiday's list, which moves up just below. The service
  alone holds the card; the rest is one gesture further down. On a motsaé
  Chabbat of the moon, havdala and the moon are both there, one under the
  other, until each is swiped;
- **a search field**, under the highlighted cards and above the tools: it
  filters the page's own texts with the library's search (Hebrew and Latin
  names, the other names everyone types, one typo away: `searchSidour`, held
  by `src/__tests__/sidourGroups.test.ts`). While it holds a term, its
  results replace the tools and the list;
- **all the texts**, in one list, without the books that separated them,
  but not without landmarks: light subheadings by use (the services, the
  evening, the brahot, the occasions, life stages), then the holidays at
  the bottom. During a holiday season (from Eloul to Kippour, from Kippour
  to Sim'hat Torah, 'Hanouka), its texts move up to the top, marked « en ce
  moment » ("right now"). In the app, they then download on their own: they
  must open without a network, at the synagogue as anywhere else.

Between the moment and the list, a row of **tools**: the small instruments
used while praying (see "The Sidour tools" below).

The texts keep their address under /bibliotheque: it is published (the
Sidour widget, shared links, indexed pages, synced reading positions) and an
installed version of the app still reads it. The old lists
/bibliotheque/sidour, /moadim and /brahot lead to /sidour (routes.ts, and
firebase.json on the server side). The Birkat Hamazon and the brahot now
travel with the app, like the rest of the Sidour
(`src/datas/bundledTexts.json`).

### The Sidour tools

The direction of the Kotel, the tefilin mirror and, during Souccot, the six
directions of the na'anou'a could only be opened from the text where they
are used: the title of the 'Amida, that of putting on tefilin, the brahot of
the loulav. Whoever looked for them without going through a service (the
traveler who wants to know which way to face, the person putting on tefilin
before opening their sidour) could not find them. The Sidour page brings
them together, in the app as on the site.

- **The same pill as in the text.** A tool is recognizable everywhere: the
  pill in the theme color, its drawing and its name spelled out (see "A
  command placed in a text carries its name"), a little larger since it
  alone carries its name. On the page, no passage title specifies what it
  opens: it takes the full name (« Miroir des téfilines », "Tefilin mirror",
  not « Miroir »).
- **A scrolling row**, under the « Outils » ("Tools") subheading, and not
  pills that wrap: two full names do not fit side by side on a phone, and
  stacked, they took the height of three cards. The pill cut off at the
  screen edge says there are others; the row keeps its height when there
  are five tools.
- **The one for the moment in front**, like the text of the moment: the
  mirror in the morning of a day when tefilin are worn (Cha'harit in
  progress, or opening within the hour; not Chabbat, Yom Tov, 'Hol hamoed,
  or the 9th of Av, when they are put on at Min'ha), the six directions on
  the day the loulav is taken. The compass leads the rest of the time: it
  serves at every 'Amida.
- **A seasonal tool only shows in season**: the six directions, from the
  start of Souccot to the end of Hochana Rabba. Out of season, they remain
  with the text that carries them, just as the holiday texts remain at the
  bottom of the list.
- **On hover, the drawing comes alive** (the compass needle seeks its
  heading, the mirror pivots on its handle), like that of the home page
  doors. On touch, the window opens immediately: no other movement to see.

The windows are mounted with the page, closed: the mirror must request the
camera within the very gesture that opens it (Safari refuses without asking
anything one loop turn later); a window loaded after the fact would arrive
too late.

Adding a tool: an entry in `src/content/sidourTools.ts`, its window and its
opener in `SidourPage.vue` (`TOOL_OPENERS`), and, if it has a moment or a
season, its rule in `momentTools` (`services/sidourMoment.ts`). The order is
held by `src/__tests__/sidourMoment.test.ts` (« les outils du moment », « la
rangée d'outils »).

The library search also covers the liturgy: whoever types « Birkat
Hamazon » in Study does not leave empty-handed; the result is filed
separately, « Dans le Sidour » ("In the Sidour").

Held by `src/__tests__/sidourMoment.test.ts` (what the card offers, at the
current time) and `src/__tests__/sidourGroups.test.ts` (each text filed once
and only once, the holidays that move up).

### A Hebrew title is not letter-spaced

The titles of the drawn books (the library shelf, the volumes of Mon
parcours) are SVG text. As soon as an SVG text carries letter spacing
(`letter-spacing`) or a `textLength`, WebKit (Safari, the iPhone app) places
its letters one by one, from left to right: in Hebrew, the words read
backward. A Hebrew title therefore never carries any; Hebrew is not
letter-spaced anyway. Letter spacing stays for titles in Latin script, and a
Hebrew word too long for its frame shrinks instead of tightening. Held by
`src/__tests__/hebrewSvgTitles.test.ts`.

### A book says whether it is on the phone

In the app, each book on the shelf carries in the top corner of its cover a
small white pill: a check mark when the whole book is on the phone (the same
sign as on each text in its list), a ring that fills when it is only partly
there, nothing at all otherwise. The shelf stays bare as long as nothing has
been downloaded; the Tehilim, bundled, carry their check mark from the
start. The share is counted in books of the corpus, like the list you find
when opening it. The link announces it to screen readers (« Talmud, en
partie sur ce téléphone », "Talmud, partly on this phone").

The « Tout télécharger » ("Download all") button no longer holds the top of
the library, between the search and the shelf, for an action done once: it
becomes a row at the bottom of the page, « Hors ligne » ("Offline"), in the
same design as the « Aujourd'hui » ("Today") rows (`LibraryOfflineRow.vue`).
The whole row starts the download; the trash can is at its end.

It says what matters at each moment:

- **before**, the size of what remains, and what is already there. It is an
  estimate (the weight of the corpus spread across its books): a book only
  has a size on the device once downloaded, and an order of magnitude is
  enough to decide;
- **during**, the percentage in large type at the end of the row (see "The
  number up front always lands in the same place"), the time remaining,
  deduced from the speed held since the start and rounded to five seconds
  or to the minute so as not to jump around, and a thin bar at the foot of
  the card;
- **after**, what everything takes up, and the trash can.

A second tap during the batch restarts nothing (`useBookDownload`). Held by
`src/__tests__/libraryOffline.test.ts` and
`src/__tests__/offlineDownloadAll.test.ts`.

### Motion answers a gesture

The app is allowed to move, on one condition: that it is in response to
something you have just done. Motion then says that the gesture was
received, and what it produced; it extends the finger. What moves by
itself, at every arrival on a page, ends up tiresome, and comes across as
showy.

What moves, then:

- the icon of a bottom-bar tab you touch (the Sidour book tilts and
  straightens, the Study reader sways);
- the pill of a page's tabs, which slides to the one touched;
- a card or a row you press, which sinks barely under the finger
  (`.press-feedback`, `main.css`);
- a light of the streak you have just earned, which grows in its leaf and
  whose halo opens (the completed task lit it);
- « Tout télécharger »: the arrow dives into its tray on touch, the books'
  rings fill as it goes, a book that has fully arrived traces its check mark
  and lifts for a moment from the shelf, and the row's check mark is traced
  at the end of the batch; the pill fades when you delete;
- the class player bar, which expands to full screen when touched (or swiped
  up on a phone), and the full screen that shrinks back into the bar when
  closed (or pulled down, and it follows the finger). See
  `components/chiourim/sheetMotion.ts`.

What does not move: arriving on a page (beyond the simple fade already in
place), a state already there at load time (a book downloaded yesterday
does not animate its check mark), and anything that would change without
you having done anything. The books that land one by one on the shelf
remain the exception already allowed, now and then (see `useShelfIntro`),
with a second one: the object of a highlighted card (the book or the moon
rising, the 'hanoukkia lighting up), once per session and per card, because
it is the occasion itself that is arriving (see "A highlighted card can
carry its object"). The streak lights also live on their own, gently (see
"The streak lights").

Everything is cut when the system asks for fewer animations, and on a small
machine (`perf-lite`): the final state is displayed right away, nothing is
missing, only the path disappears (`composables/useMotion.ts`). One
exception: the transition from the player bar to full screen is cut only at
the system's request. Lite mode turns on for a good share of Android phones
(4 GB of declared memory is enough), and this movement, brief and tied to
the gesture, says where the full screen comes from and where it goes back
to: without it, the gesture of pulling it down would no longer make sense.
The home page stack is the second exception (the check mark, the next card
rising, the ring): these cues say that a card is done and that another has
arrived in front. The arrival of a goal you have just created is the third
(the volume falling onto its shelf, the habit slipping into its list): it
says where it has been filed (`prefersReducedMotion`,
`composables/useMotion.ts`).

### A gesture is shown, rarely

The one motion that answers nothing: the swipe, shown. Whoever stays on the
home page or the Sidour without a gesture may not know that the card is
swiped. So the card that can be swiped (the stack's top card, the Sidour's
card of the moment) leaves to the right on its own, as far as the gesture's
threshold (120 px, a slight tilt), the « C'est fait » pill appearing whole at
its edge as under a finger, then springs back past its place and settles:
1.6 s, as if a finger had started the gesture and let go (`useSwipeHint`).

It must stay rare to stay useful, and not become a fidget:

- only to whoever has not swiped (done, later, a wallet card, a line of the
  Sidour) on this device for three days, or ever: whoever swipes knows;
- at most once a day, wherever it played, and once per visit of the page;
- after eight seconds without a touch, a key or a scroll, the page in view;
  never under a tip or the introduction, never on a card that cannot be
  swiped (a service whose time has not come), nor in the home page's edit
  mode, nor while the Sidour's search holds a term;
- never when less motion is asked for, nor on a small machine (`perf-lite`).

Held by `src/__tests__/swipeHint.test.ts`.

### Touch answers

The phone answers the finger when something happens (`services/haptics.ts`),
with four kinds of feedback, always the same:

- **done** (two beats, the system's "success"): a task done, via the stack,
  the wallet, the sheet, a program's portion, the player's ring or a day's
  leaf; a section of a reading chain marked read; a goal added; a streak
  light earned;
- **undone** (one light beat): a task unchecked or postponed, a section set
  back to unread;
- **threshold** (barely): during a gesture, the moment when, released, it
  would act (the card or row swiped far enough, the stack pulled down far
  enough, the ring full), the day thread's dot moving from one marker to
  the next, the volume you have just created touching its shelf, a home
  page block changing place, a unit box touched, the wall opening as you
  pinch; at most one beat every 60 ms;
- **long press** (one firm beat): a card's sheet, the home page setting.

In the app, it is the phone's motor (`@capacitor/haptics`), which follows
the system setting; on the site, the browser's vibration where it exists
(Android), nothing on iPhone, which does not offer it to the web. Feedback
that fails stays silent without hindering the gesture. Held by
`src/__tests__/haptics.test.ts`.

### What is yours is filed with the rest

The dates you add to the calendar (a birthday, a leilouy nichmat) do not
form a separate list, under the holidays or behind a tab. They are filed in
the year's calendar, on their date, between Chemini Atzéret and 'Hanouka if
need be: the question asked is the same, "what is coming this year", and
two lists forced you to ask it twice.

What distinguishes them is the drawing that opens them, not a frame or a
background color: a candle for a leilouy nichmat, a cake for a birthday. A
card then reads like a holiday, and its icon says at a glance that it is
ours. It is moreover the only one that can be touched: you land back on its
setting, where you put it.

But the calendar is not somewhere you go every day, and a date you took the
trouble to enter deserves to come forward: it appears on the home page in
the week it arrives, in the column of the moment, with the service's sidour
and the blessing of the moon, then fades for the rest of the year. Three at
most: beyond that, it is no longer a reminder but a list, and the list
belongs in the calendar.

Such a date outlives a phone: it follows the account, and can therefore be
added from the site just as well. What remains specific to the app is the
reminder, which only a phone can ring: its setting does not appear where it
could not keep its word.

Nor is it deleted by a sliding finger: the trash can asks the question, with
the date's name, before acting (`useConfirm`). This is the rule for
everything that goes away with no way back, and only for that: what can be
redone with a gesture, a checked box, a reminder set, is not asked for
confirmation, otherwise the question would no longer mean anything.

### A date is entered the way you know it

A personal date recurs on its Hebrew date, and that is what is asked for
first: the day and the month, without the year. But many people only know
the civil date of a birth or a death. A button under the two lists,
« Saisir la date civile » ("Enter the civil date"), opens the house
calendar, year included (the list of years goes back to 1900; a birth date
goes further back than a deadline); the Hebrew date is computed and shown
under the field, and it alone is saved. The form does not change its
nature; it gains a path, and you come back from it with one gesture through
the same button.

A civil date does not give its Hebrew date with certainty: the Hebrew day
begins at sunset. Any entry in this direction therefore carries a switch
« Après le coucher du soleil » ("After sunset"), off by default, rather than
letting a leilouy nichmat be engraved one day off.

The civil date also knows what the Hebrew date alone does not tell: the
year. A date that fell in Adar I of a thirteen-month year is saved as such
(`firstAdar`), and comes back in Adar I in those years, not in Adar II, a
month after its day. The month picker still offers only one Adar, the one of
the date being set; « Adar I » is added only for the date that comes from
it, and the list names it likewise (`hebrewDateConverter.test.ts`,
`occasionCivilEntry.test.ts`).

For a leilouy nichmat, a line under the date's label says which one to
enter: the date of death, from which the years are counted. Only the first
one is an exception: when the death has just occurred, the first year is
counted from the day of the burial. The line appears only for this choice;
it says nothing to someone entering a birthday
(`occasionCivilEntry.test.ts`).

The same computation serves the calendar's converter, next to « Mes dates »
("My dates"): a window, three tabs named after what you already know (a
Hebrew date, a civil date, a child's birth for their bar-mitsvah). The answer
reads in a soft-surface block, under the form, with no button to press: it
changes with each setting. It is not one more page; it is a question you ask
yourself in front of the calendar, and it is asked there.

### A choice is not forgotten from one year to the next

The converter keeps the **chosen** day and month separate from what it shows
for the current year. A year that lacks that month or that day shows the
nearest one (Adar II becomes Adar in a regular year, 30 'Hechvan becomes the
29th when the month only has 29 days), and the following year finds the
choice again: 14 Adar II comes back in Adar II, the 30th on the 30th.
Bringing the choice back in place erased it; three arrows later, Pourim had
become Pourim Katan.

Adar chosen in a regular year reads as Adar II in thirteen-month years: that
is the rule for personal dates and hebcal's rule for birthdays, and Pourim
falls there. Adar I chosen in a thirteen-month year stays Adar I. Held by
`src/__tests__/dateConverterChoice.test.ts`.

### A search finds what you meant

The same name is spelled ten ways: « Chabbat », « Shabbat », « Shabat »;
« Berakhot », « Brakhot », « Brahot »; « Pessa'him », « Pesachim ». The
catalog itself mixes Sefaria's English and French. A search bar that only
returns the exact spelling therefore only finds those who guessed ours, and
answers "no results" to everyone else.

All the site's search bars (library, daily reading, reading chains and
their texts, chiourim, cities for the times, guests, administration) go
through the same search, `services/fuzzySearch`, which answers in three
tiers:

1. the text as is, ignoring case, accents, apostrophes and Hebrew vowels;
2. its phonetic key, where the spellings of a single sound merge (ch, sh,
   kh and h; tz and ts; b and v; k, c and q; the e of the chva whether
   written or not; doubled letters);
3. the same key within one or two typos, depending on its length.

The third tier only speaks for lack of anything better: as soon as a result
matches the first two, the near matches stay silent. Otherwise « bava »
would bring back « Shabbat », one letter off, and the list would lose its
straightforwardness.

Several words are each searched on their own, in any order, and all must
match; a number is searched as a number (« 23 » finds Tehilim 23, never 123
or 24). Two letters only count at the start of a word, and a description is
only explored by word beginnings, with no typos: across a whole sentence,
everything would match everything. The phonetic key, too, is only searched
from the start of a word (« babametsia », typed in one go, finds Bava
Metzia): in the middle of a word, « chabbat » landed in the « Ahavat » of
Chaar Ahavat Hachem (held by `fuzzySearch.test.ts`).

What phonetics cannot guess is written down: « Genèse » for Berechit,
« Maariv » for Arvit, « Psaume 23 », the Hebrew names of the parachiot
(`datas/catalogAliases`), « London » or « ירושלים » for cities
(`datas/cityAliases`). These other names are never displayed; they only
serve for finding. When someone cannot find a text they were looking for,
that is where the word they typed gets added.

The library keeps the catalog order, its results grouped by corpus and by
book; the other lists sort from most to least relevant, the name that starts
with the query first (« lon »: Londres before Toulon).

### Three settings tabs, three questions

The settings do not form a single list. **Appearance** answers "what it
looks like" (theme, fonts, text size), **Notifications** "what rings",
**Preferences** "how the application behaves": the opinion followed for the
times, auto-scroll, and whatever will come to be filed there. A single
screen mixing all three forced you to read the whole page to find the line
you were looking for.

What lands in Preferences arrives as a **section**, with its title, and the
section is made of ROWS separated by a rule, like the list of times. No
card: a card answers a question you came to ask (see "The frame must be
earned"); a setting is a row you touch. Put in cards, three sections stacked
on a beige background gave three white boxes in a row, and the tab will only
get longer. The sections are separated by the same rule as their rows.

### The app profile is a list, not a menu

On the site, the profile is a menu on the left and a panel on the right:
there is room, and a click switches panels. Placed as is on a phone, that
menu went to the top of the page, the panel below, and each tab scrolled
down to its content: you never knew which tab you were on, nor what was set
without opening it. The app therefore has its own profile
(`NativeProfileHome.vue`), organized like a phone's settings; the site keeps
its own, which suits it.

- **Mon parcours, on the circle and in a row.** Signed in, the streak pill
  (the light and the count of consecutive days, together, on a light
  background) straddles the bottom of the initial circle, on the end side,
  set off by a border in the page color (`ProfileStreakPill.vue`); touching
  it opens « Mes lumières » ("My lights"). The « Mon parcours » row, at the
  top of Mes lectures ("My readings") and there for everyone, leads to the
  page and tells the day: « 1 sur 4 » ("1 of 4") at the end, and its bar
  under the name (`ProfileParcoursRow.vue`, the `progress` option of
  `SettingsRow`).
- **The site's profile banner** (`ProfileHeader.vue`): flat, in the theme
  tint. At the top, the initial circle (as soon as there is room; on a
  phone, the name takes the line), the name and, next to it, the same streak
  pill, the address below. On the light pill, the light reads whatever its
  color (a golden menorah got lost in the orange), and so does the count.
  Below, without a rule, across the full width: the day (« Aujourd'hui, 1
  sur 4 », "Today, 1 of 4", the light and the record), « Mon parcours », and
  the bar (`ProfileParcours.vue`). All in the banner's ink, in three tones.
- **A page of rows, grouped.** Mes lectures (the shortcuts), Réglages
  (Settings: appearance, language, notifications, preferences), Mon compte
  (My account: security, sign-out), Aide (Help), Informations. Each group is
  a panel (`SettingsGroup`), a surface without `card-hover`, and its rows
  (`SettingsRow`) run edge to edge, separated by a rule. The group's title is
  written in lowercase, above.
- **A row says where it leads and what is set there.** At the end, before
  the chevron: « Océan · Système », « Français », « 2 rappels » ("2
  reminders"), « Rav Posen ». You read the state without opening the page.
  What is wrong says so in place of the number: notifications blocked by the
  phone announce themselves as « Bloquées » ("Blocked"), in amber.
- **Three forms, one look.** An app page (chevron), an in-place action (no
  chevron: nothing opens behind it, « Revoir l'introduction », "See the
  introduction again"), sign-out (in red). Each row is at least 52 px tall
  and responds to touch with a background, in the absence of hover.
- **Sign-out asks the question, in the app only.** On the site, it is a
  separate button; here, a row among others, which a thumb touches by
  accident when aiming at its neighbor, and signing back in requires a
  password and a network. So it is not irreversible, but undoing it costs
  too much for the rule "what can be redone with a gesture is not
  confirmed".
- **The sub-pages are real pages** (`NativeProfileSection.vue`,
  `/profile/appearance`, `/profile/language`, `/profile/notifications`,
  `/profile/preferences`, and for an account `/profile/account`,
  `/profile/security`): their own address, their Android back behavior,
  their iOS swipe. A discreet link at the top (« Profil », or « Réglages »
  without an account) goes back in the history rather than stacking it, and
  the title is centered. They reuse the site's settings as they are: only
  the way of getting there changes. The bottom bar tab stays lit on them
  (`activeOn`).
- **Language has its own row.** On the site, it opens the Appearance tab; in
  the app, it is rarely changed, and three languages read better as a
  checked list than as tiles (`AppearanceSettings`, `with-language` set to
  false).
- **Identity at the top, without a banner.** Signed in: an initial circle,
  in the theme color (the only solid touch on the page), the streak light
  straddling it, the name, the address and « Modifier mon profil » ("Edit my
  profile"). Without an account: the title « Réglages » and a card offering
  an account, two buttons, without insisting.
- **The site footer ends the page,** in small type: who makes the app, its
  social networks and the installed version, which we ask for from anyone
  writing about a bug.

The test `nativeProfile.test.ts` holds the page: what appears with and
without an account, the sub-pages each row leads to, the state shown at the
end.

### A message thread reads like a conversation

« Nous écrire » ("Write to us", `/contact`) and a message's sheet in the
backoffice show the same thread, through the same component
(`SupportConversation.vue`), like a messaging app: each message in a flat
bubble (surface radius, `rounded-control`), those of the viewer on the end
side, on the theme tint at 15 %, those of the other party on the start side,
on `surface-soft`. The time reads in small type in the bubble, the day as a
separator when it changes, and the other side's name only on the first
message of a run. The person's line breaks are kept.

- **A thread has its own page.** The person's page lists their messages as
  cards: the kind (in gray), the state and, when applicable, « Nouvelle
  réponse » ("New reply") on the solid tint (the only pill that demands
  attention), the first line of the message, then the beginning of our last
  reply. The whole card opens the thread's page (`/contact/:id`), without an
  arrow. Expanding cards in place put several conversations and several
  reply fields on the same page.
- **A thread's page is a messaging app.** In the app, it takes the whole
  screen, bottom bar included: a fixed header (back, subject on one line,
  kind and state below, « Détails » ("Details")), the thread scrolling on
  its own and opening on the last message (a short thread sits at the
  bottom, against the compose bar), and the compose bar fixed at the bottom
  (a
  rounded field that grows with the text up to six lines, the round send
  button beside it), which stays above the keyboard. On the site, the same
  messaging app fits in a card on the page. There is no state frame above
  the thread: the state is told like a line of the messaging app, as a gray
  pill centered under the last message (« Bien reçu. Nous le lirons et vous
  répondrons ici. », "Received. We will read it and reply to you here."). What
  the person sent and how the reply will reach them open through « Détails »,
  in a window.
- **The state speaks to whoever reads it.** The person sees « Envoyé »
  ("Sent"), « En cours » ("In progress"), « Répondu » ("Replied"),
  « Terminé » ("Closed"); the team sees « À traiter » ("To handle") in place
  of « Envoyé », in amber, like everything awaiting a decision in the
  backoffice (`AdminSupportStatus.vue`, the tones of `AdminStatus`). In the
  backoffice, the kind (idea, bug, error) stays gray: on the default theme,
  the theme tint and amber blended together, and only the status should draw
  the eye.
- **An unread reply is counted on the profile tab.** In the app, the bottom
  bar carries on the profile icon (or the settings icon, without an account)
  a pill with its number, on the theme tint, set off by a border in the bar's
  color; the profile's « Nous écrire » row says « 1 nouvelle réponse » ("1
  new reply"). Opening the thread turns both off.
- **Before sending, you know where the reply will arrive.** Under the
  backoffice reply field, a line says so (in the app with a notification,
  without one, by email only, nowhere), and the buttons that would have no
  effect do not appear.

### What cannot be edited does not look like a field

A field frame (`.field`) promises that you can type in it. In the profile,
the email address and the account ID carried one without being editable,
and they were tapped repeatedly (PostHog audit of October 2026, 2.7). They
now read as text, under their label; only the display name keeps its field,
since it can be edited. The ID is selected with one tap, for whoever needs
to copy it when writing to the team.

### Deleting your account is confirmed with what opened it

Firebase only accepts deleting an account after a sign-in less than five
minutes old. Google and Apple confirm through their own window; a password
account, however, had no way to do so from the screen, and had to sign out
and sign back in. The deletion confirmation therefore asks for its password
(« Mot de passe actuel », "Current password"), and the button stays disabled
as long as it is empty. Held by `src/__tests__/accountDeletion.test.ts`.

### A gesture that surprises must be able to be turned off

The double tap that starts auto-scroll happens by itself: two taps close
together on a phone happen, and the text starts moving down without anyone
knowing why. A switch in Preferences then removes it completely, gesture
included, rather than leaving people to figure out how to stop it every
time.

This is not the same as turning a feature off by default: it remains
offered to everyone, and only whoever complains turns it off. That setting
is kept on the device, and twice rather than once (see docs/app-native.md):
a setting made in order NOT to be surprised anymore must not come back by
itself at the next launch.

### A permission is requested after a gesture, never in the background

The system permission dialog only appears after a gesture that requires it:
touching « Télécharger » ("Download"), enabling a reminder. A background task
that would need it waits until it is granted, without asking for it. On
Android 10, the silent update of the Sidour thus made the storage permission
pop up when opening a service, without anyone having asked for anything
(`docs/app-native.md`). And a refusal is stated for what it is, with where to
go to change it, rather than sending people off to check their connection.

### The compass is requested on opening, states its accuracy, and is held flat

The Kotel compass (`KotelCompass.vue`) sometimes sent people praying in the
wrong direction without anything saying so. Three rules came out of it.

- **The permission goes out with the gesture that opens the window.** iOS
  only gives the orientation after a gesture; the window requested it one
  loop turn too late, Safari refused without asking anything, and you had to
  touch « Activer la boussole » ("Enable the compass") right after touching
  « Direction du Kotel ». The window now starts the compass within the
  gesture itself (a synchronous `watch`, like the tefilin mirror for the
  camera). When the button remains necessary (a gesture that did not take),
  it sits **on the dimmed dial** (grayed, blurred, the arrow removed), and
  not under it: a dial that looks like it works makes nobody look for a
  button, and its arrow, frozen with north at the top, would point the wrong
  way.
- **Accuracy is visible, and can be restored.** Under the dial, three bars
  like network bars and a word (good, medium, low), given in degrees when
  the device provides it (Safari). On the dial, a halo in the arrow's color
  covers the sector where the Kotel lies: narrow, you follow the arrow; wide,
  you need to calibrate. « Calibrer » ("Calibrate") opens, in place of the
  dial, a phone tracing a figure 8 and the three gestures to perform;
  accuracy is followed live there until « La boussole est calibrée » ("The
  compass is calibrated"). The command is solid when accuracy is low,
  discreet otherwise, and remains offered when the device says nothing about
  its accuracy (Chrome on the site): « La flèche vous semble fausse ? »
  ("Does the arrow seem wrong?"). The low level is written in amber, the
  warning tint already used by the information notices. Where accuracy comes from:
  `webkitCompassAccuracy` on iOS, the magnetometer calibration status in the
  Android app (PjCompass plugin, `docs/app-native.md`).
- **The dial tilts opposite to the phone.** It stays horizontal, like the
  card of a marine compass on its gimbal: with the top of the phone raised,
  the top of the dial sinks into the screen; laid flat, it faces you. You
  want to straighten it, and you lay the phone down. The tilt follows the
  hand (the hand is what produces it, see "Motion answers a gesture"),
  capped at 55° so the arrow stays readable; the instruction « Tenez le
  téléphone à plat » ("Hold the phone flat") becomes « Le téléphone est à
  plat » ("The phone is flat") when it is. A bubble level in the center was
  ruled out: less visible, and one more dot on a dial that has only one
  thing to show.

Held by `src/__tests__/kotelCompass.test.ts` (the permission requested in
the opening gesture, the button placed on the dimmed dial, accuracy and
calibration, the tilt) and `src/__tests__/nativeCompassAccuracy.test.ts`
(the bridge to PjCompass).

### A setting goes where it can be reached

The opinion followed for the times (Rav Posen, Rav Ovadia Yossef) governs
all the times in the application: it therefore belongs with the other
settings, in the profile's Preferences tab. Except that on the site, the
settings page is reserved for accounts, and the opinion you follow must not
be: a button then carries it on the times page itself, next to the city
name, and it announces the current opinion rather than a vague word like
« Réglages ».

It is the same rule as for the location used for the computation: the city
name IS the button that changes it. What you read and what you set are in
the same place, and the button states the current state before offering the
change.

In the app, the button is not repeated: the page there is already topped by
two tabs and a bottom bar, and the settings are one gesture away.

### The reading menu opens above its button

On a library text, a round button at the bottom right (`ReadingMenu.vue`)
stands in for the back-to-top button: it opens the text's table of
contents, the font size and the Hebrew / phonetic toggle. The panel pops up
**above** the button, and the button stays: it becomes the cross that
closes. What you touched to open is what you touch to close, in the same
place, without looking for a cross in the panel; the panel never replaces
what opened it.

To the right of this cross appears a second circle, the reading settings
one, which switches the panel from the table of contents to the settings.
The two circles then swap roles: the left one takes back the table of
contents icon and returns to it, the right one becomes the cross. The cross
is always on the circle touched last: you leave from where you came in.

These settings are the ones you change **while** reading, not before:
auto-scroll (the same switch as in Preferences, see "A gesture that
surprises must be able to be turned off") and, on a service, « sans
tahanoun » ("without tahanoun"). The latter tells the application what the
calendar cannot know: a brit mila, a groom or a bar-mitsva in the
congregation, a house of mourning. The text is then rebuilt as on a day when
tahanoun is not said, with what drops out and what comes in its place. It is
valid only for **the day** it is set and turns off the next day: a simhá is
a one-day affair, and a forgotten switch would remove tahanoun for weeks
without anything showing it, the page never saying what it leaves out.

« Masquer les halakhot » ("Hide the halakhot") joins them, where the text
being read carries some: the legal instructions accompanying a passage (what
to repeat in case of omission) then leave the flow. They are there for
whoever is in doubt and clutter whoever knows, and a service is said every
day. Unlike « sans tahanoun », it is a reading preference, not a one-day
affair: it holds until changed, and it is off at the start, since nobody
should discover that a halakha existed on the day they would have needed
it. The setting only shows on a text that carries some: offering to hide
what the page does not display would suggest something was missed.

On the chnei mikra page, its two options join them too: « Chaque verset deux
fois » ("Each verse twice", on at the start: it is the practice itself) and
« Commentaire de Rachi » ("Rashi's commentary"), each with its hint. They
used to be two switches above the text, under the paracha's name: the only
reading options of the library left outside the menu, and one more block
between the title and the text. They stay shared with the daily reading
(`useChneiMikraOptions`). Held by `src/__tests__/readingMenu.test.ts` (« ne
propose les options du chnei mikra que sur sa page ») and
`src/__tests__/chneiMikraPage.test.ts` (« propose les options de lecture
dans le menu de lecture, et les retient »).

Under the switches, a rule, then what is done with a gesture instead of
being set: sharing the text being read, writing to the team, and, on the
site, getting the app. These three were only in the footer or in the About
tab, that is, where you finish; yet it is while reading that you want to
send a text to someone, and while reading that you see the typo to report.
They are rows, like the table of contents entries, and not solid buttons:
the panel stays a reading panel, not a toolbar. Sharing carries the text's
**public** address, the site's, never that of the in-session page nor the
local address of the app's webview, which nobody else could open.

Corollary: no bookmark on a tefila (Sidour, Sli'hot, Brahot). A service or a
blessing is read from the beginning; you do not come back to a paragraph as
to a verse of Tehilim; the menu's table of contents already leads to each
passage.

### The progress bar takes you through the text

The thin progress line at the bottom of a reading (`ReadingProgressBar.vue`)
is also a slider. A finger (or the mouse) laid on it takes the page to the
same share of the text, and the page follows while it slides: whoever looks
for the Amida in a whole Shaharit, or the end of a long daf, gets there in
one gesture instead of three screens of scrolling. The strip that catches
the finger is taller than the line, which no finger would hit: on the site,
3 rem, so that the slide can start well above the very bottom of the screen,
where the browser's own gesture leaves the page; in the app, 1.5 rem. In
Hebrew the bar fills from the right, and slides the same way.

In the app, the line runs along the top edge of the bottom bar, over it, and
the bar's white rises in a bump over its round times button instead of the
button sticking out of it: the line rides over the bump
(`composables/tabBarHump.ts`, one shape for both, a 12 px bell that clears
the button with a margin). A notch in the strip leaves the button its
touches. While the mini player lies there, the line stays flat, under it.

The finger pulls the line. Under it, the bar rises in a bump (64 px, a bell
rather than a peak: the line is stretched, it does not break), like a string
held between two fingers, with a round thumb on top; the paper under the
line hides the text it rises over. The titles of the text (the landmarks of
the reading menu) sit on the line, **with no frame**: the one being read
rides on top of the bump, large and straight, in Playfair Display and in the
primary color; the others lie along the bar on each side, small, leaning
with the line, each kept to its share of it so that two neighbors never
overlap. A halo of the page's color keeps them legible over the text. The
share reached (« 42 % ») stays on top of the bump, just above the finger:
the titles say which passage, the share how far into the text. A text
without titles shows it alone, larger.

It moves like something held: the bump follows the finger with a little
give, the titles glide from one to the next (the next one climbs the slope
and grows until it is on top, straightening up, while the one it replaces
slides down and shrinks), and, let go, the line springs back flat with a
small rebound. These are springs (`stepSpring`,
`composables/readingScrub.ts`), run frame by frame and only while the line
moves. When the system asks for less motion, the line goes straight where it
is going, without give or rebound. Crossing from one title to the next is
felt as a threshold (`tick`, see "Touch answers"). The round buttons of the
menu step aside during the gesture.

On the site, the mini player lies over the bottom of the screen: the bar is
then a line again, and the player keeps its touches. Two touches in a row on
the bar are two slides: the double tap that starts the automatic scrolling
does not apply there (`data-own-gestures`, held by
`src/__tests__/autoScroll.test.ts`).

On a text with landmarks, the round menu button names the one being read as
soon as one scrolls: it grows to the left around the title, then shrinks
back to a circle 1.8 s after the page stands still. Whoever sees the name of
the passage appear there understands that the button leads to the passages,
and that another one is a touch away. Not while the page scrolls by itself
(the title would never leave the text), nor with the panel open, which lists
them all. The button keeps its name for screen readers; the title is a hint
for the eye.

Held by `src/__tests__/readingScrub.test.ts` (the bump clearing the round
button: « clears the round button, with a margin, and the line riding over
it too »).

### One bookmark per book, and it shows

A book has only one ribbon: placing a bookmark removes the one the text
already carried (in the library, and separately in the daily reading).
Those that a previous version left in multiples remain until the next one
is placed (`readingProgressBookmarks.test.ts`).

The bookmark is a ribbon, like that of a real book (`BookmarkRibbon.vue`),
in the design of the ribbons that come out of the app's volumes
(`ArtVolume.vue`, `ArtSiddur.vue`): a red silk ribbon lying on the page just
before the marked verse. It comes out of the binding, on the right (the
spine of a Hebrew book), sticks out a little into the margin, runs a few
centimeters above the start of the verse (8 rem, not the full width) and
ends in a swallowtail, the split end that says "bookmark". The fold, darker,
is where it comes out of the page; a light line suggests the silk; a short
shadow sets it on the page. It is visible while scrolling, without coloring
any of the text. Its red has its own token, `--color-ribbon`, that of the
ribbon of the sidour drawn on the home page (`ArtSiddur.vue`), and not
`--color-danger`: it is not an error. In the gemara and the daily reading,
where passages follow one another within the same paragraph, the ribbon
opens a line before the marked passage. Only the tikoun does not get one:
its lines are those of the scroll, nothing is slipped in; there the passage
takes a light background and a solid stroke in the ribbon's red
(`.reading-bookmarked`).

### The reader toolbar fits on one line

Above the text, the bookmarks, the size, the tikoun vowels, the translation
and the Hebrew / form / phonetic toggle fit on a single line, even on a
phone. The toggle is always at the end of the line (on the right; on the
left in Hebrew, since the line reads from right to left): the commands that
come and go depending on the text line up in front of it, without ever
moving it, and the hand finds it in the same place from one text to the
next. Below the `sm` width, the text size leaves the bar (the reading menu
still carries it), and the toggle keeps the name of the chosen mode; the
other two take the abbreviated names they have in the menu (א, the drawing
of the form, Aa), their full name remaining in the tooltip and for screen
readers. Abbreviating everything made you lose sight of the mode you were
reading in. The translation is not offered in the page form (Vilna daf,
tikoun): neither one shows it.

### Chnei mikra is checked off aliyah by aliyah

On the chnei mikra page, each aliyah ends with « Marquer comme lue » ("Mark
as read", then « Lue », "Read", with its check in the theme color): the
same button, at the same place, as a psalm of « Mes Téhilim » or a text of
the daily reading. Chnei mikra is read over the course of the week, an
aliyah or two at a time, and one checks it off where one stops reading. The
aliyah's title above the text stays a plain marker.

At the top of the page, under the paracha's name, a bar says where the week
stands (« Montées lues : 3 sur 7 », "Aliyot read: 3 of 7", its percentage,
and the `ProgressBar`), fourteen for a double paracha. No card around it
and no list of the aliyot: an earlier version put a card « Les montées de
la semaine » above the text, with the seven aliyot by name to tick, and a
pill beside each title in the text; two ways of doing one thing, and a
frame more at the top of a page that is already long. The owner asked for
the pattern of the Tehilim instead.

The checks are stored by week (the Chabbat of the paracha): the following
week starts from zero, and browsing back to a past paracha finds its own.
They are kept in Mon parcours, carried along by the account and tied to the
« une montée par jour » ("one aliyah a day") chnei mikra (see
`docs/parcours.md`). The daily reading, which also shows chnei mikra, does
not carry them: it already has « Marquer lu » per section.

### The translation reads under the verse

The translation (`docs/traductions.md`) is not another page or another
column: it sits under each verse, in the Latin reading font
(`--font-reading`), one step below the Hebrew and in the secondary text
color. The Hebrew remains the text being read; the translation accompanies
it, and two columns would not fit on a phone. In the Talmud, the daf stops
being a single block: each sentence of the gemara is followed by its own,
otherwise you would no longer know what translates what. Steinsaltz's bold
stays there (the literal translation), in the text color, and his
explanation in roman: the difference is part of the text.

The command sits in the toolbar, after the Hebrew / phonetic toggle, with
its drawing and its name (« Traduction », "Translation"); when on, it takes
the theme color. It only appears on a translated text, and not on a tefila.
The same setting lives in the menu's reading settings, with the choice of
language when the text has two, the interface language first. When the
reader's language is missing (the Talmud, which we only have in English), a
sentence says so above the text before showing the other: nobody discovers
an English translation without knowing why.

Who translated it reads at the end of the text, where what closes a page is
read, in one line: « Traduction : » and the translator's name, nothing else.
The name leads to the translation on Sefaria, which carries the edition and
the license (`docs/traductions.md`, "Crediting a translation").

### A text also reads in the form of its page

The gemara and the Torah have a form the reader knows by heart: the Vilna
page, identical from one edition to the next (one cites "the top of 2b"), and
the column of the Sefer Torah. The reader offers them as a third way of
showing the text, between Hebrew verse by verse and phonetics: a single
group of three buttons in the toolbar (« Hébreu » ("Hebrew"), the form,
« Phonétique » ("Phonetic")) and, abbreviated, in the reading menu (א, the
form's icon, Aa). The form button carries its drawing and its name: an open book and
« Page » for the gemara, a scroll and « Tikoun » for the Torah (the name of
the book in which the reading is prepared, whose right-hand column is that
of the Sefer Torah; « Sefer Torah » read like an object, not like a way of
reading). It
only appears on texts that have a form (a gemara, a paracha); the Prophets
have petou'hot but no Sefer Torah column to reproduce. The choice is kept on
the device (`usePageForm`, a single preference for both); phonetics takes
precedence while it is being read and gives back the form when returning to
Hebrew.

**The daf page** (`TalmudDafPages.vue`, `TalmudPage.vue`): one amoud per
page, under its « Daf 2a » marker (the reading menu's anchor). The gemara is
in the center, without vowels or modern punctuation, in square letters
(`--font-hebrew`); Rachi is on the binding side (on the right on amoud a,
the left-hand page of the open book, on the left on amoud b), Tossafot on
the edge side, in Rachi script. The commentaries share the first four lines,
run alongside the gemara, and the one that outlasts it passes beneath it in
its half; the one that ends earlier lets it widen. The layout is measured on
screen (floating blanks over three stacked layers, in the manner of
daf-renderer) and redone when the width, the reading size or the fonts
change. The sizes follow the page's width, to keep its proportions, without
going below 13 px for the gemara, then the reading size. The page has no
frame or background of its own: the text draws the form. Rachi and Tossafot
only load when the page is opened; if they are missing, a line says so and
the gemara remains alone in the center.

**The daf page is the book's, line for line.** Each line of the gemara, of
Rachi and of Tossafot is placed where Vilna prints it, with the words it
puts there (`TalmudPrintedPage.vue`, `dafLayout.ts`,
`public/texts/talmud-layout`): same lines, same page shape, on every screen.
Our fonts do not have the widths of the book's: the size of each script is
the one that makes its median line fit without distorting it. **Each line
fills its box from edge to edge**: shorter, it is justified (its spaces open
up, its letters widen only slightly); longer, it tightens. Both edges of a
column are therefore straight, as in the book. The true width of each line
is read on screen once written, not estimated. **The opening word** of a
tractate or a chapter is written very large, in bold, in the blank the
commentaries leave above the gemara, without a frame; « מתני׳ », « גמ׳ » and
the first word of a chapter beginning mid-page are in bold within their
line; « הדרן עלך … » is centered, in bold, at the end of the chapter. **A
line stays readable**: where our text spells out in full what the book
abbreviates, to the point that the line would be crushed, the page writes
the book's abbreviation (« המע"ה »); everywhere else our words stay whole.
Only the pages near the screen are written: a thirty-page chapter opens as
fast as a single page. The
dibbour hamat'hil is
in bold square letters, including when the file does not mark it (it then
ends at the first period). **Where our text has nothing and the book has lines** (a word, a
paragraph Sefaria does not provide), the page writes the book's text, in
its column's script: it has no hole. What the book prints and we do not
have is not invented: not the catchwords, not the marginal notes, not a
commentary we do not have (its place stays blank). A page whose lines have
not been recorded is laid out our way, in the same form
(`TalmudPage.vue`).

**The reading size is a magnifier there.** A− / A+, and pinching in the
app, do not enlarge the text of the daf page: its lines would move, and a
Vilna page is recognized by its lines. They enlarge the whole page
(`TalmudDafPages.vue`): it takes from 85 to 160 % of the available width,
its characters follow its width, its proportions remain those of the book.
The enlarged page first overflows the reading column, equally on the left
and the right, into the room the screen leaves around it (`pageZoom.ts`): on
a computer it can be read whole, without sliding anything, which a mouse
without a touchpad cannot do. It keeps 16 px from the edge of the screen,
and from the commentary pane when it is open. What still overflows, on a
phone from the first step, is reached by sliding the page sideways. A page
opened already enlarged presents itself by its middle, the gemara; when the
magnifier changes, the middle of what you were looking at stays in place.
The setting is the same as everywhere, a single one, kept on the device:
whoever reads large also reads the page large.

**The beginning of each part is in bold**, on the daf page as in the gemara
read in one piece (`talmudOpenings`, `MarkedText.vue`): the « מתני׳ » that
opens a Michna and the « גמ׳ » that opens the Guemara, with the word that
follows them, the first word of the tractate (its Michna has no « מתני׳ »),
and the formula « הדרן עלך … » that closes a chapter. That is what the
printed page does, and it is how you find at a glance where you are. On the
daf page, Rachi and Tossafot likewise have their dibbour hamat'hil in bold
square letters.

**A passage and its commentaries answer each other.** On the daf page, you
touch a passage of the gemara that Rachi or Tossafot explains: it is
highlighted, and all its commentaries with it, each in its column; the words
they quote are underlined in the passage. You touch a commentary: it is
highlighted alone, with its passage, where its own words are underlined. The
color is that of the selected passage everywhere in reading
(`--color-selection`), for the passage as for the commentary: it is what says
they go together. Only one selection at a time in the chapter; touching it
again releases it, and so does touching a passage without commentary. Under
a mouse, what can be touched takes a light tint. Nothing changes width; the
page is not re-laid out (`dafLinks.ts`, `TalmudPage.vue`).

**The Sefer Torah** (`TorahScroll.vue`): the letters alone, in the sofer's
script, **line for line and column for column like the scroll**. The scroll
is the one with 245 columns of 42 lines, where each column begins with a
vav: its lines are recorded for the whole Torah
(`public/texts/torah-layout`, `scrollLayout.ts`, `scripts/layout/scroll.py`).
The petou'ha ends the line, the setouma leaves a blank within the line, Az
yachir is written in bricks and Haazinou in two halves, where the scroll
puts them; a paracha that begins in the middle of a line begins in the
middle there. The large and small letters are large and small. Each verse
remains a passage for the reader: you touch it to open its commentaries,
and it is highlighted across all the lines it spans.

**A line fills the column the way the sofer fills it.** He does not spread
his words apart: he widens or narrows his letters. Each line is therefore
stretched in width, letters and spaces together, from 0.86 to 1.16
(`fitLine`); beyond that, the spaces take the rest, which only happens on
one line in two hundred. The column is 16.75 em wide, the width of the
scroll's median line in the sofer's script: half the lines stretch, the
other half tighten, almost all by less than a tenth. The pieces of a line
with blanks keep their script, and it is the blanks that take up the room. A
column wider than the others in the scroll (that of Az yachir, by a third)
is written smaller, to fit in the same page.

**Three blank lines separate two columns.** Nothing is written there, no
number and no rule: the blank is what says column. The scroll's blank lines
(before and after a chira) are, for their part, blank lines.

**The aliyah marker is in the margin**, as in a tikoun: a small label in the
theme color, in the interface font, written top to bottom to the right of
the line where the aliyah begins. It takes no room in the line. A thin
stroke above the first word of the aliyah says where it begins in the line.

**The column keeps its lines on every screen.** It is 18 em wide everywhere,
margin included: on a phone it is its characters that shrink (18 px instead
of 24 on a 375 px screen); it does not wrap. The reading size enlarges it as
a whole, like the daf page (`pageZoom.ts`, `useReadingColumn.ts`): it
overflows the reading column as long as there is room, then can be slid
sideways. Enlarged beyond the screen, it presents itself by its right edge,
where the lines begin.

**Without the scroll's lines, the column is written our way.** The line file
may be missing (no network) or no longer match the text: the column is then
justified over 21 em, with the marks and chirot recognized in the text
(`pageForm.ts`), a blank every forty-two lines (`scrollPages.ts`). While the
file is awaited, nothing is written: the column is not written twice.

**Vowels and teamim sit on it without moving anything.** A « Voyelles »
("Vowels") button, at the top of the page next to the forms, and a switch in
the reading menu display them on the column (`useScrollPointing.ts`). The
read word sits over the written word, in the same place
(`scrollPointing.ts`): the lines, the blanks and the chirot do not move. It
is in the reading font, which the reader chooses, since the sofer's script
does not carry these signs; the qri is read in place of the ktiv. A second
switch in the menu, « Appui long pour basculer » ("Long press to toggle"),
shows the other form as long as you keep pressing on the text, and returns
when you let go. It is off at the start: a long press usually serves to
select a passage, and this setting disables text selection and the system
menu on the column.

### The scroll pill is its own stop

During automatic scrolling, a pill at the bottom of the screen
(`AutoScrollPill.vue`) says that the page is moving on its own, and it is
the only sign of it. One tap opens it onto the speed, the next one stops.

It is the rule of the reading menu, just above: what you touched to open is
what you touch to finish, in the same place. Stopping used to be one more
row in the panel, under the speeds, that is, where you do not think to go
back when you simply want it to stop. A tap beside it closes the setting
without stopping anything: closing and stopping are not the same gesture,
and it is the broadest gesture that should do nothing.

The speed is set with a notched slider, from slowest on the left to fastest
on the right, and not in a list of labels. A list requires reading each row
to understand that they form a scale; a slider shows it, and is pushed with
the thumb without aiming at a row.

The slider has twenty notches, from 1 to 20; it used to have only four, one
per named speed (slow, medium, fast, very fast), and a reader asked for finer
steps. The chosen notch is shown as a number at the end of the « Vitesse »
("Speed") label, in tabular figures so that it does not jump around under the
thumb: a number is remembered from one reading to the next, "a little more
than medium" is not. The four named speeds remain as landmarks, a dot under
the track directly beneath their notch; twenty dots would make a ruler, not a
setting. Both ends carry the names of the extreme speeds, because that is
what they are. In Hebrew, the track flips with the page, and the slowest moves
to the right; the landmarks are therefore placed from the start of the line
(`inset-inline-start`), not from the left.

### What closes a page is read at the end

The day's hiloulot close the times page, under the last time and before the
footnote, just as the printed calendar puts them at the bottom of its
column. No card: a card answers a question you came to ask, and this one is
not asked when opening the page (see "The frame must be earned"). A group
title, the same as those for the moments of the day, and names.

Some days carry nineteen. Four are shown, the rest expands: the page ends on
a line, not on a directory.

### Writing to the team is offered where you finish, not where you start

The support form (an idea, a bug, an error in a text) is a window, not a
page: you open it from where you are and come back by closing it, without
losing the reading in progress. It opens from three places, all at the end
of a path: the site footer, the app profile (Help group), and
the bottom of the home page.

A fourth door opens in the middle of reading, in the menu settings (see "The
reading menu opens above its button"): that is where you see the error in a
text, and scrolling up to the footer to report it means losing your line. It
does not contradict the rule: it is still the person who goes looking for
it, behind two gestures, and not the application interrupting them.

On the home page, it fits in one line under the dedication, small and gray,
with the only underlined link: « Une idée, un problème ? Écrivez-nous »
("An idea, a problem? Write to us"). No card or solid button: the home page
did not come to ask this question, and a colored button at the very bottom
would compete for attention with the site's doors. Discreet then, but
visible: the line exists in the app as on the site, where you arrive after
having seen everything.

The window says what it attaches without asking (the medium, the platform,
the version) under the form, in small type: nothing goes out without the
person knowing, and nobody has to copy down a version number.

The site also asks the question on its own, once: « Tout se passe bien ? »
("Is everything going well?"), a small card at the bottom of the home page,
for those who have opened the app on three different days. On the home page
only, never on a reading page or while listening to a chiour, and never on
top of something else (introduction, open window, consent banner still
unanswered): a question asked of someone busy is an interruption, not a
kindness. It waits a few seconds after arrival, withdraws as soon as it is
answered (« Tout va bien », "All good", or the form) and does not insist: at
most three times, a week apart, then never again.

### The team speaks up when it has something to say

The team's information notices (a new feature, an incident, a question, see
`docs/informations.md`) have no reserved spot on the home page. A card only
appears there when there is something new, and it goes at the top of the
shortcuts of the moment, next to the greeting: an incident may explain what
is not working further down, so it is read first.

It has two forms. Not yet read, the announcement shows as a preview: its kind
as a pill, « Nouveau » ("New") as a solid pill, the title in bold and two
lines of the text, enough to know what it is about without opening it, then
« Lire la suite » ("Read more"). Once read, it shrinks for a week to the form
of the other shortcuts (a drawing, a line, a detail in small type): you know
the team has spoken, and it no longer takes the place of something new. Its
drawing is a bell, or, for an incident, the amber warning triangle.

The rest of the time, the list is not on the home page: it is found in the
site footer and in the app profile (the home page keeps, at the very bottom,
only « Écrivez-nous »). On the page itself, each
announcement is a card (it answers "what has changed?"), with its kind as a
pill and « Nouveau » as a solid pill, computed from the previous visit.

### The perpetual chain is entrusted with a name; it is not created

The perpetual Tehilim chain (`docs/chaine-perpetuelle.md`) is the only chain
you can always join. On the sharing home page, it sits under the create
button (`PerpetualChainCard`), in a card like those of the other chains: a
white frame, clickable as a whole, whose title takes on color on hover. It
does not take the theme color as a flat fill: on a page of chains, a solid
card read like an ad among the others. Color only marks what sets it apart,
« Toujours ouverte » ("Always open"), the number up front and the progress
bar. That number, at the end of the line, is the number of times it has
been completed; on the first round, there is nothing to count, and it does
not appear.

The card names nobody: « On y lit pour 5 personnes » ("We read for 5 people
here"). The names are those of the sick and the departed; they are read on
the chain's page, where people come for them, and not in passing on the home
page.

On its page, the header says « Lecture continue » ("Continuous reading") and
the current round where an ordinary chain gives its deadline and its
creator. Next come the counter (a single large number, three below that
support it), then « Pour qui l'on lit » ("Who we read for"), before the
draw: the names are said before reading. A line follows them, in small type:
a reserved Tehilim is read within 24 hours, then becomes free again. Nobody
owns the chain to free a forgotten spot; might as well tell whoever
reserves.

The names run on one after another, separated by a middle dot, like a
dedication, and not in rows: twenty rows would have pushed the reading three
screens down. Eight per group, the rest expands. Two groups, distinguished
by their drawing: the heart for a refoua chelema, the candle for a leilouy
nichmat (the same as for calendar dates). A name does not break across lines
(`whitespace-nowrap`).

The reader's own names are pills in the theme color, with a pencil, at the
top of their group: they are the only ones that open, and that is the pill
rule ("a pill states, except the one that carries an icon, which opens").
Those not being read at the moment (expired, or a departed person outside
the week of their anniversary) stay within reach of their author, as gray
pills under the list.

The « Proposer un nom » ("Suggest a name") window composes the name the way
it is said: the two first names side by side, and between them « ben » or
« bat », which follows the man or woman choice in view. A preview shows the
line as it will appear. For a leilouy nichmat, the date of death is chosen
like a calendar date (day, Hebrew month), and the sentence under the fields
says, even before it is chosen, what the date changes: without it, the name
is read for thirty days; with it, it comes back every year, in the week
before the anniversary.

« Signaler » ("Report"), on the chain, targets a name: the button does not
turn off after a first report, and the window asks for the name in question
instead of promising hiding at the third report. The « Bloquer ce créateur »
("Block this creator") checkbox does not appear: the creator is the team,
and blocking it erased the chain from the device.

Without a network, a name's window does not freeze: it says what is
happening and keeps what was entered. Offline, nothing goes out. If the
device believes it is online but the server is silent, it gives control
back after ten seconds: the request will go out on its own when the
connection returns, there is no need to redo it, and the name joins the list
when it arrives.

In the reader, « Vous lisez pour » ("You are reading for") keeps the two
groups of the chain page, each with its drawing: a refoua chelema and a
leilouy nichmat are not said the same way (`PrayerNamesLine`). Removing a
name asks the question, with the name (`useConfirm`); extending it does not:
it can be redone with a gesture.

A finished round is announced (« Tour terminé ! », "Round complete!") and
freezes nothing: the page, like « Un autre Téhilim » ("Another Tehilim") in
the reader, waits for the next round on its own, a few attempts over about
forty seconds, then shows the draw card. Beyond that, it does not insist: a
chain that does not restart is a failure, which reloading the page will
reveal, not an endless wait.

When creating a Tehilim session, the perpetual chain is offered in a
discreet line under the type, in small type: it does not divert from
creation, and does not promise a reader count that is not known.

### The backoffice is a tool, and it reads like a dashboard

The backoffice (`/admin`) is only for the team, most often on a computer
screen. It keeps the design guidelines (the beige, the borderless surfaces,
the round controls, Playfair for section titles) but not the layout of the
public pages: its titles are left-aligned, its lists are dense, and it goes
straight to what awaits a decision.

- **It opens on an overview**: four numbers (chiourim online, listens,
  sessions, authors), then « À traiter » ("To handle"), a list of rows that
  each lead to the already filtered list (`?filtre=draft`). When there is
  nothing to handle, the page says so in one sentence, with a green check
  mark.
- **Tabs count what is waiting**: a pill in the theme color for pending work
  (chiourim to review), red for a problem (reported sessions, ongoing
  incident).
- **A list is a single panel** of rows separated by a rule, and not a stack
  of cards: you scan it at a glance. Its filters are pills carrying their
  count; the active filter takes the solid color.
- **States have five tones, always the same** (`AdminStatus`): green for
  what is online, amber for what is waiting (draft, to review), red for what
  is withdrawn or reported, the theme color for a kind, gray for a detail. A
  state pill states; it is not touched.
- **The common action is a button, not the pill**: « Publier » ("Publish")
  next to a draft. Unpublishing, rarer and heavier, stays on the detail
  sheet or in bulk processing, behind a confirmation.
- **A selection brings up its bar at the bottom of the screen**, which stays
  within reach while you check items, and disappears when you clear it.
- **A detail sheet puts first what you came to check**: for a chiour, the
  audio player, then the content on the left and the filing on the right.
  What deletes is at the bottom, in red, never next to « Enregistrer »
  ("Save").

### A short chain is confirmed

A deadline that falls tonight or tomorrow night (`services/sessionDeadline.ts`)
is not forbidden: a vigil, an urgent refoua chelema fit in one day. But in
September 2026, three chains out of nine had as their deadline the very day
they were created, and two stayed empty. The « Créer » ("Create") button
therefore first asks the question (`useConfirm`): « Attention, votre date
semble proche d'aujourd'hui » ("Careful, your date seems close to today"),
the end stated plainly (tonight, tomorrow night). « Oui, créer la session »
("Yes, create the session") creates; « Changer la date » ("Change the date")
returns to the field. Beyond tomorrow, nothing intervenes. Held by
`src/__tests__/newSessionDeadline.test.ts` and `sessionDeadline.test.ts`.

### What was entered for a chain survives signing in

Creating a chain requires an account, but the form opens without one: the
visitor fills everything in, clicks « Créer », and the prompt sends them to
sign in. On return, the form was empty. The input (title, description, type,
selected books, date, guests' emails) is therefore saved at that moment, for
the tab only (`sessionStorage`, nothing goes to the server), restored on
return and erased on creation. Held by
`src/__tests__/newSessionDraft.test.ts`.

### No icon on the left of a bar or a dialog

Icons set on the left of a text are being removed, little by little: they
repeat what the words say and take the width a phone needs. Where a picture
helps, it is a small illustration, drawn like the others, not an icon in a
tinted circle.

- **The selection bar** (`BatchSelectionBar.vue`, on a chain's page and on
  its management page) says how many texts are selected and what the
  button will do, with the button on the right. The two checks in a tinted
  square on its left are gone.
- **The confirmation dialog** (`ConfirmDialog.vue`): the title and the
  message, then the buttons. The question mark (or the warning triangle)
  in a circle is gone; an action that cannot be undone is still told by
  its red button.
- **The titles of the dialogs**: no icon before the title (« Rappels de
  lecture », « Instructions », « Convertir une date », « Mes dates », « Me
  rappeler cet horaire », « Avis suivi pour les horaires »). A back arrow,
  when the dialog has a second screen, stays: it is a command, not a
  decoration.

### One piece of information is said once

In one block (a bar, a card, a dialog, a header), a fact is said once. Two
ways of saying it (a count and a percentage, a status chip and a sentence,
a title and a card that repeats it) make the reader check that they agree.
Keep the more precise one; where the big figure at the end of a line is
the design (a download), keep it and drop the line that repeats it.
One exception, for the look: a progress card keeps its percentage beside
the count (« Lus : 1 sur 3 » and « 33 % » on « Mes Téhilim », the daily
reading, Ma journée in the library), and a chain's card keeps « 100%
réservé » beside « Complet ».

| Where                             | Kept                                       | Removed                                                                                             |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Selection bar, chain page         | « 2 textes sélectionnés », the button      | « Confirmer la réservation », « 2 Téhilim choisis » (a guest keeps « Finaliser en tant qu'invité ») |
| Selection bar, management page    | « Attribuer à un invité » for « Réserver » | « Supprimer les réservations sélectionnées », the mixed label, « (3) » on a lone button             |
| Library, download in progress     | the time left, the big « 50 % »            | « 12 Mo sur 40 Mo »                                                                                 |
| A text objective's page           | the title                                  | the same title in the « Aujourd'hui » card                                                          |
| Perpetual chain counter           | the big count                              | « Le tour 3 » in the sentence, the average after one round                                          |
| A program's portion or week, done | « Ce soir, c'est fait » and what was read  | « Portion faite », « Semaine faite »                                                                |
| New program, at one's own pace    | the stepper                                | the same pace repeated in the card                                                                  |
| Mes dates                         | « 12 Adar », then the civil date           | the Hebrew date again in brackets                                                                   |
| Audio queue                       | « 8 cours »                                | « (8) » on « Voir toute la file »                                                                   |
| Chain management card             | each row's name                            | « Par : David » above, « 1 réservation » under « Réservé »                                          |
| Write to us                       | « Nouvelle réponse »                       | « Répondu » beside it                                                                               |
| Home day bar                      | « Journée pleine »                         | « 5 sur 5 »                                                                                         |
| Paracha page                      | « Berechit », then « Lire »                | « Lire Berechit » (a double paracha still names each half)                                          |
| A closed poll                     | the « Sondage clos » chip                  | « Ce sondage est clos. »                                                                            |

Held for the download line by `src/__tests__/libraryOffline.test.ts`.

### A chain is shared as soon as it is created

A chain nobody sees stays empty: those that filled up had had from 6 to 24
visitors, the empty ones never more than two. On creation, the chain's page
therefore opens on the existing share window (`ShareModal.vue`), titled
« Votre session est prête » ("Your session is ready") and preceded by a
sentence: remember to share it around you, so that others take part. The
signal goes through the address (`?partager=1`), removed immediately: a
reload does not reopen the window.

### The Tehilim of a chain are read one after the other

Someone who takes several psalms in a Tehilim chain used to open them one
by one from the list, come back, mark each read, open the next. From two
psalms taken (`BATCH_READING_MIN`), the chain offers to read them at once,
on a page of their own (« Mes Téhilim », "My Tehilim",
`/share-reading/session/:slug/lecture`, `SessionReadingPage.vue`), laid out
like the daily reading of Mon parcours:

- **The reader's psalms of this chain**, read or not, in the order of the
  book; an abandoned draw (expired) is no longer theirs. A guest is
  recognized by the device, as everywhere else. The Yehi ratson once
  before, the three verses once after.
- **Each psalm is checked where it is read** (« Marquer comme lu »), and
  the list beside the text (at the top on a phone) checks it in one tap,
  with where one stands (« Lus : 2 sur 5 », and its bar). What is checked
  is the reservation itself, the switch of the chain's list: the chain
  counts it at once.
- **Nothing goes to Mon parcours**: it is the reading of one chain, for
  now, not an objective on the shelf.
- **Two doors**: « Tout lire maintenant » ("Read them all now"), a button
  beside the « Mes réservations » heading of the chain's page (no extra
  frame: the page is long enough), as long as there are several psalms
  taken and one is still to read; and, right after a reservation that
  leaves such a list, the question « Les lire maintenant ? » ("Read them
  now?"). A guest who declines sees the signup dialog as before.
- **On the perpetual chain, nothing is reserved, everything is read**: the
  boxes say « Choisir » ("Pick") and the bar has a single button, « Lire
  maintenant » ("Read now"): it opens the page straight away, without the
  question asked on the other chains. No name is asked (a guest reads anonymously, as with the draw). The reader's
  group is « Mes Téhilim à lire », a psalm being read says « En lecture par
  … », and « Tout lire maintenant » shows from one psalm. A psalm picked and
  not read goes back to the chain after an hour, pushed back while the page
  stays open (see `docs/chaine-perpetuelle.md`, « Read right away »).
- **Tehilim chains only**: a psalm is read whole, in one slot. A chapter
  taken in a Talmud or Michna chain would need the reader to show that
  chapter alone.

Held by `src/__tests__/sessionBatchReading.test.ts` (« reading the Tehilim
of a chain at once »).

### Remaining days are counted on the calendar

The « Je participe » pill counts calendar days until the deadline, not
rounded hours: « J-1 » the day before, and on the day itself **« Jour J »**
(« Last day », « היום האחרון ») rather than a « J-0 » that reads poorly. Each
language has its three forms, with Hebrew agreeing in the singular (« עוד
יום אחד »). Held by `src/__tests__/myParticipatedSessions.test.ts` (« Je
participe : jours restants »).

### A public name is never an email address

An account created by email without a « Nom affiché » ("Display name") (the
field is optional) took its address as its name, and that name goes out as
is into data readable by everyone: « Créée par jean.dupont@exemple.fr »
("Created by jean.dupont@exemple.fr") on a chain's card, the name on a
reservation. Without a display name, the account name is now what precedes
"@" (« jean.dupont »). Chains and reservations already saved keep what they
carry. Held by `src/__tests__/publicNameWithoutEmail.test.ts`.

### « Complet » means there is no spot left

A chain's percentage (`getSessionReservationStats`) is rounded to the unit,
except that it never says 100 % as long as a spot remains free: it then caps
at 99. On the Talmud (327 spots), 326 reserved displayed « 100 % » and
« Complet » ("Full") in red, and the last spot no longer found anyone. The
card decides « Complet » based on the spots themselves, no longer on the
percentage. Held by `src/__tests__/reservationHelpers.test.ts` (« ne dit pas
100 % tant qu'il reste une place »).

### A guest stays themselves from one visit to the next

A guest who reserves with their email makes it the identifier of their
reservation (`chosenByGuestId`). The form emptied on reload: the device no
longer knew who they were, and the guest could neither cancel nor mark as
read their own reading. The device therefore remembers the emails used to
reserve on it (`guestService.rememberGuestEmail`, key `pj_guest_emails`, the
five most recent), just as it already remembers the local identity of
guests without email, and they count in the guest's identity
(`getGuestIdentifiers`). Same scope as the local identity: this browser, not
another device. Held by `src/__tests__/guestEmailIdentity.test.ts`.

### A chain's deadline is the same in every time zone

The creator chooses a day; the chain ends at the end of that day, wherever
the person looking at it is. It used to be saved as an instant (end of day
in the creator's time zone), read back in the reader's time zone: created in
Paris for October 5, a chain read « 6 octobre » ("October 6") in Jerusalem,
and the edit modal saved it again as the 6th for someone who only corrected
the title, from Montreal to Paris. Chains therefore also carry the chosen
day (`dateLimitDay`, « YYYY-MM-DD »), which published versions ignore; the
display, the end of the chain, the remaining days and the modal read it
through `deadlineDayOf` (`services/dateService.ts`). It is authoritative only
if it matches the instant: an older version that moves the date rewrites the
instant without knowing about it, and then the instant is what counts.
Chains created before keep their previous reading. Held by
`src/__tests__/deadlineAcrossTimezones.test.ts`.

### The sign-in screen says what to do

A failure never shows Firebase's raw error (« Firebase: Error
(auth/invalid-credential). », in English in an app in French): each known
code has its sentence (`describeEmailAuthError`, `services/authErrors.ts`),
and the raw message only goes to PostHog, where it is useful. Under the
sentence, **the way out that goes with it**, a command with its drawing and
its name:

- the address or password rejected: « Créer un compte avec cette adresse »
  ("Create an account with this address"), keeping what was entered.
  Firebase does not say whether the address exists; the sentence therefore
  also covers an account created with Google or Apple;
- the address already registered: « Me connecter avec cette adresse » ("Sign
  in with this address");
- the device's last sign-in was with Google or Apple: the sentence recalls
  it, and the way out is that button.

A lost password has its own way out, always there under the password field:
**« Mot de passe oublié ? »** ("Forgot password?"), a padlock and its name.
Without it, the help went in circles: the rejected password offered to create
the account, the already registered address offered to sign in to it. It
keeps the entered address, clears the password, and has only one field; the
email goes out through Firebase Auth (`sendPasswordResetEmail`, in the
screen's language), and « Retour à la connexion » ("Back to sign-in")
returns to the form. The answer is **the same whether or not the address has
an account** (« Si un compte existe avec l'adresse… », "If an account exists
with the address…"): the screen is not a way to check who is registered.
Held by `src/__tests__/loginPasswordReset.test.ts` and
`e2e/firebase/auth.spec.ts`.

The last method used on the device (`services/lastAuthMethod.ts`) also
carries a pill, **« Dernière utilisation »** ("Last used"), placed on the top
edge of its button, outside the button whose label remains that of the
command; for email, next to the field's label. It survives sign-out: that is
precisely when it is needed. The trap it avoids was the most common on the
screen: an account created with one tap with Google, then, weeks later, an
address and password that never existed. Held by
`src/__tests__/loginEmailErrors.test.ts` and `emailAuthErrors.test.ts`.

### What an account leaves on the device does not join the next one

On sign-out, bookmarks, reading positions and personal dates stay on the
device: they belong there as much as before signing in. But when another
account signed in (a family phone, the synagogue computer), the merge poured
them into that account, another family's hazkarot and birthdays included.

The device therefore remembers the last account it followed, and enough to
recognize what belongs to it: for reading, the moment it left
(`pj-reading-owner`), everything dated before being its own; for dates,
which carry no timestamp, the list of those the account carried
(`pj_hebrew_occasions_owner`). Another account that signs in finds its own
instead.

What was entered without an account always joins the account that signs in,
whether before any sign-in or after an account left: it exists nowhere else,
and setting it aside would lose it. The same account coming back finds
everything, along with what was entered in its absence.

Two accounts of the same person (Google, then address) are two accounts: the
device cannot link them, and when in doubt it does not pour one's data into
the other. Each keeps its own; nothing is lost.

A device from before this rule cannot tell whose dates it holds: it applies
the old rule one last time (everything joins an account never adopted)
rather than setting things aside blindly. Held by
`src/__tests__/accountSwitchLocalData.test.ts`.

### Classes are listened to like a playlist

Audio classes have taken the form everyone knows from listening apps: a
series is a playlist, a rav an artist, a class a track. You no longer read a
grid of cards that all look alike; you browse, play, resume.

- **The catalog in rows.** « Reprendre l'écoute » ("Resume listening", the
  classes started on this device), the series, the rabbanim, then new
  releases and all classes as rows. A row scrolls sideways and overflows to
  the screen edge to say so; on a computer, two arrows scroll it. A search
  or a topic narrows everything into a single list.
- **Filters are asked for.** At the top, the search and, next to it, a
  « Filtres » ("Filters") button (its drawing and its name; the number of
  filters set as a pill). It opens a panel, the topics then the rabbanim,
  which closes on « Voir les N cours » ("See the N classes"). Closed, each
  filter set stays under the search as a solid pill, removed with one
  gesture. An always-open row of topics turned the header into a keyword
  cloud before the first class even appeared.
- **A row plays.** The whole row of a class starts it, and the displayed
  list becomes the player's queue: the end of a class chains into the next.
  Touching the playing class pauses it. It takes the theme color and its
  three bars, which freeze when paused and do not move in reduced motion. A
  started class carries a thin bar of what has been listened to, and what
  remains in place of its duration; a finished class, a check mark.
- **A series, a class, a rav: a playlist page.** The cover, the title, the
  rav (their circle and name), the duration; then a row of actions, « Lire le
  texte » ("Read the text") or share on one side, the big round listen button
  at the end (it resumes the started episode, and says which one to screen
  readers); then the list. A class page has no player of its own: it is the
  page you share, with the text studied, the description, the series.
- **The player is at the bottom.** A bar floating above the app's bar that
  follows from one page to another: the cover, the title and the rav,
  play, the next class while listening (close, when paused), the progress
  along the bottom edge. On a wide screen, it takes the full width with the
  controls and the progress bar in the middle, the speed and close on the
  right.
- **The full-screen player.** A tap anywhere on the bar opens it (its
  buttons keep their role), as does an upward swipe on a phone: the bar
  grows until it covers the screen. The arrow at the top, back, Escape, or
  on a phone the full screen pulled down (it follows the finger) close it:
  it shrinks until it becomes the bar again. You used to have to aim at the
  cover or the arrow, and nothing said where this page came from (held by
  `playerBarOpen.test.ts`). Where the listening comes from (« Lecture depuis
  Chaar Habitahon », "Playing from Chaar Habitahon"), the large cover, the
  title and the rav, the progress bar, then back 15 s, previous, play as a
  large circle, next, forward 30 s. The speed, to the right of the title (on
  a wide screen, in the bar, on the right): a pill that states it, and opens
  the list of speeds, from 0.75× to 2×, the current one checked; you touch
  the one you want (held by `playerSpeed.test.ts`). Cycling through it tap by
  tap forced you through all of them to go back. Further down, the text
  studied, what follows in the
  queue, and « À propos du cours » ("About the class"), which leads to its
  page. On a wide screen, two columns: the class on the left, what follows on
  the right.
- **The queue reads at a glance.** « En cours » ("Now playing") first, set
  apart: the cover, the full title, the chapter and what remains, the
  dancing bars. Then « À suivre » ("Up next"), ten rows and the rest one
  gesture away: one row per class, separated by a rule, the number, the
  title on two lines at most and, below, the chapter studied and the
  duration. A compact list of one line per class did not show where you
  were. Above « En cours », collapsed, the earlier classes: a « Précédents »
  ("Previous") row and their count, which one tap expands in the same
  design, in series order. A class started in the middle of a series showed
  only what followed, and the start of the queue was lost (held by
  `nowPlayingQueue.test.ts`).
- **A title does not repeat its series.** In a list where the series is
  already stated (a series page, the player's queue), « Shaar Habitahon
  Shiour 10 Chapitre 2 » becomes « Shiour 10 Chapitre 2 » (`shortTitle`).
- **The player's color.** The bar and the full screen take on the series'
  binding, darkened, as a flat fill (`playerTone`), and write on it in
  cream; the play button is a cream circle carrying the binding. It is the
  only place where an app surface leaves the theme: like the holiday card,
  you recognize at a glance what is playing. No gradient, unlike Spotify.
- **The cover.** Classes have no image: each series receives a binding, like
  the shelf volumes, in a warm matte tint derived from its identifier (the
  same on every visit). In an embossed frame, its title in Playfair, in the
  center, as large as the cover allows: its size follows the cover's width
  (container units) and the title's length, without any word overflowing, on
  balanced lines. At the bottom, under a fleuron (two strokes, a diamond),
  the rav in small caps. A title written small in a corner got lost in the
  tint. At small sizes, the series' initials. A rav has the same binding,
  round. Outside the theme, identical in dark mode, in flat colors, the title
  cream at 4.5:1 at least on each tint (`components/chiourim/cover.ts`, held
  by `chiourCover.test.ts`).
- **Outside the app, like music.** The playing class shows in the Android
  notification and on the iOS lock screen, with its cover: the same binding,
  drawn as an image (`components/chiourim/coverArtwork.ts`), its title, the
  rav and the series. The controls there are the player's (back 15 seconds,
  forward 30, previous and next class). See `docs/app-native.md`, « Écoute
  des cours en arrière-plan ».
- **Titles keep their language.** A title, a series or rav name, a
  description are written by the authors: in Hebrew in the French interface,
  in French in the Hebrew interface. They carry `dir="auto"`: when cut, they
  lose their end and not their beginning, and their punctuation stays in
  place; they still align like the page around them, and an endless word
  wraps instead of overflowing (the `[dir="auto"]` rule in
  `assets/main.css`). A long title is limited to two lines in tiles and the
  player's queue, three under the full-screen cover; `line-clamp` sets its
  own `display`, so it is never paired with `block`, which cancels it.
- **The text studied.** A class attached to a library book
  (`services/chiourTexte.ts`) says so on its page and in the full-screen
  player, through a card that leads to the book down to the chapter (« Chaar
  Habita'hon · Chapitre 4 »); a series, through « Lire le texte ». In the
  other direction, under the chapter you have just read (or at the top of a
  book), « Cours sur ce chapitre » ("Classes on this chapter"): those of the
  chapter first, three to five rows, the rest one gesture away. Nothing under
  a tefila: people come there to pray.

No image, no gradient: the progress bar is a track in two flat colors under
the native slider.

### Mon parcours: the wall is built in stones, and only it

Mon parcours (`/parcours`) tracks what you have set yourself to keep up: a
text to finish by a date, a habit, the month's Tehilim, the week's paracha, a
text reread every day. What has been done shows as a wall being built, one
stone per day (`components/parcours/StoneWall.vue`): one column per week,
from Sunday at the top to Chabbat at the bottom, the highest row like a
foundation course.

- **Stones are for history, and only for it.** The wall of the last five
  weeks, the whole wall, its legend. A stone laid, everything done; half
  laid, part of it; white, Chabbat, a holiday or nothing planned; a hollow,
  nothing checked; the dotted spot, yet to come. What is planned or chosen
  stays **flat**: a program's week is a bar chart (`WeekBars.vue`), a habit's
  week flat boxes, like the choice of days. In the middle of a page,
  stones said "built" for what was only a plan.
- **Stones are outside the theme**, like bindings: the tint of Jerusalem
  stone, in flat colors with a mineral grain (a texture, not a gradient),
  shared by the global class `.pj-stone`. Only the mortar darkens in dark
  mode.
- **The wall opens on today**, at the end of the reading direction (on the
  right in French, on the left in Hebrew), and fills the screen's width; you
  go back in time by swiping. A touched stone opens and can be completed,
  months later if need be.

### Nothing counts against you

The streak (consecutive days on which you did something) carries a
terracotta lamp, drawn as in the mockup (`ParcoursLamp.vue`): its flame
rises when the day is full, and lowers on a missed day without ever going
out. Chabbat and holidays do not break it: nothing is asked then. « Pas
aujourd'hui » ("Not today") removes a task from the day without counting it
missed. Today breaks nothing as long as it is not over. A past day can be
checked afterward, from the wall (that day's sheet). A backlog is stated
(« 6 michnayot de retard », "6 michnayot behind") with « Rien ne presse »
("No rush"), and is caught up as you choose (the week, by the end, all at
once, by pushing back the end, or « Déjà fait », "Already done"); the day's
portion never grows on its own.

### The streak lights

The higher the streak, the bigger what gives light
(`services/parcours/lights.ts`, `StreakLight.vue`): the old lamp at the
start, the candle at 3 days, the lantern at 7, the menorah at 14, the
lighthouse at 21, the moon at 30, the sun at 50 (from Pessa'h to Chavouot),
the stars at 75, the galaxy at 100, the supernova at 150, the quasar at 250,
and the light of the first day after a year. Held by
`parcoursLights.test.ts`.

- **Objects, not icons**, in the colors of the real thing and in flat
  colors, at the lamp's size (80 by 62): they take its place on the home
  page, in Mon parcours and the profile without moving anything. What burns
  keeps its flame, which rises and lowers like the lamp's; what radiates has
  a halo, a more or less vivid flat fill.
- **They live gently**, wherever they are (home page, Mon parcours,
  profile, « Mes lumières », the sheet of an earned light): the flame
  flickers, the halo breathes, the stars twinkle, the rays of the sun and of
  dawn turn slowly, the lighthouse sweeps from one beam to the other, the
  galaxy's arms turn in their disk seen at an angle (tips trailing), the
  supernova's shell moves away and its glow pulses, the quasar's jets turn
  around its core while pulsing. This is a deliberate exception to "Motion
  answers a gesture": a light that does not flicker looks out. The
  movement stays slow and small, a light still to be earned stays still, and
  everything freezes in reduced motion and lite rendering (`perf-lite`), on
  the settled state (`StreakLight.vue`, `ParcoursLamp.vue`).
- **You see the light of the current streak; you keep those of the
  record.** A streak that falls back lowers the light shown, never those you
  have earned: « Mes lumières » keeps them all.
- **« Mes lumières » is a list** (a sheet, `LightsSheet.vue`): the text at
  the start of the row (the name, the threshold, the sentence), the light at
  the end, placed without a background; the one for the current streak
  circled, « Votre lumière » ("Your light"). Taller than the screen, the
  sheet opens at half height, on its title, and unfolds when swiped up
  (`BottomSheet`, `tall`); it is the veil that scrolls, with no gesture to
  program.
- **What is coming stays in the shadow.** A light to be earned is only a
  blurred shadow, « À découvrir » ("To discover"), with its threshold (the
  next one says in how many days): you can make out a shape, nothing more.
  Slightly enlarged and pushed toward the edge, it overflows its card, which
  cuts it. You know there is something, not what.
- **An earned light is celebrated, once** (`LightCelebration.vue`): a
  moment after the gesture that lit it, a sheet rises, the light grows in it
  and its halo opens twice, with its name, its sentence and « Voir mes
  lumières » ("See my lights"). The last celebrated record is kept on the
  device; the first time, and when the record jumps all at once (the account
  read back on a new device), nothing is celebrated: we only celebrate what
  you have just done. Held by `e2e/firebase/parcours.spec.ts` (« la série
  qui franchit un palier allume une lumière, une fois »).
- **The light opens with a touch**, with no button beside it: on Mon
  parcours and in the profile (its pill, on the circle in the app, next to
  the name on the site), touching the light opens « Mes lumières ». It is the
  object itself, like
  the home page lamp that leads to Mon parcours; on Mon parcours, its name
  is written just below (« La ménorah · prochaine lumière dans 1 jour », "The
  menorah · next light in 1 day"), and its accessible name says so
  everywhere (« Mes lumières, La ménorah »).

### One goal, one volume

What is read (a program, a calendar reading, the day's texts) is a bound
volume on the shelf of Mon parcours and of the home page
(`ProgramVolume.vue`, `VolumeShelf.vue`), in the binding of its section
(`config/bindings.ts`, the same as the library shelf). A red ribbon sticks
out when the day's portion is waiting; the gilt border goes around the
cover as you advance, and a line under the volume says where you stand.
Habits are not books: they have their list, and their week in flat boxes.

- **All the same size, not the same thickness.** Volumes of different heights
  make a wobbly shelf: the cover is the same for all, and it is the page edge
  that tells the length (thin for a tractate or few texts of the day,
  ordinary for a seder or a calendar reading, thick for several sedarim, the
  thickest for the whole corpus).
- **Bound like the sidour** (`ArtSiddur`): the spine one tone lighter, its
  gilt bands and its hinge; a double gilt rule around the title (the border
  that fills up, and a fine rule inside); the title in gilt letters, a
  fleuron, the subtitle smaller below.
- **The title fits in its frame**, never beyond the border: it shrinks a
  little on its line (« Tehilim 1 » is not split for so little), then goes
  onto several lines, word by word (« Kodachim / Toharot »), three at most;
  a word too long even at the smallest size tightens rather than
  overflowing.
- **The day's texts make a single volume**, « Lecture du jour » ("Daily
  reading"): two psalms, ten, a page you love do not make ten books on the
  shelf. When they are only psalms, it is called « Mes Tehilim journaliers »
  ("My daily Tehilim") (« Tehilim » on the cover, « Chaque jour », "Every
  day", below), so that you know at a glance what it holds; the page takes
  the same name, the home page card its short form, « Mes Tehilim », which
  fits next to the volume it carries (`dailyName`). A text from another
  corpus brings everything back to « Lecture du jour ».
  Its thickness says how many it holds, its border fills with the texts read
  today, and it opens their page (see "The daily reading, back again"),
  where the list is composed.

- **A volume touched on the home page opens the text**, at the place where
  you are (`readRoute`): a program's day portion if it is waiting, otherwise
  the continuation of what you have read; the daily reading; the day's
  Tehilim; the paracha. A long press, or a right-click, opens its page and
  its settings; a paused or finished goal opens its page. It used to open
  its page, which for a daily text or a cycle was made only of settings. In
  Mon parcours, the volume always opens its page; that of a text or a cycle
  begins with what there is to read today and « Lire » ("Read")
  (`ObjectiveTodayCard.vue`).
- **With a mouse, several shelves.** With a finger, the shelf scrolls
  sideways; with a mouse, it does not scroll (not everyone has a touchpad):
  the volumes move onto one more shelf, each row with its own shelf across,
  as in a bookcase.

Choosing what you read happens on the same shelf: the sedarim standing up,
one touch takes one, another puts it back, you take as many as you like. A
single tractate is found by its name (the search) and comes out of its seder
like a thin book, placed in front of it.

### A program is read by the day or by the week

Three rhythms: every day, every day except Chabbat and holidays, or by the
week (the week's portion, to be spread as you like). No monthly rhythm: a
monthly portion gets put off until the next day until the end of the month,
and a program split that way gets abandoned. The pace is
shown before starting (« 3 michnayot par jour, 12 min environ », "3
michnayot per day, about 12 min"); changing the date or the rhythm restarts
from today, at the position reached.

### The home page deck

On the home page (in the app, with or without an account; on the site, for
an account), Mon parcours follows the P2-Accueil mockup to the letter
(`components/parcours/home/`): the greeting and the Hebrew date, the lamp
beside them, the deck, its bar, the times card (the location, the upcoming
time, the time in large type), the untitled shelf.

- **The stack.** The top card, in solid color at the dimensions of the
  Sidour's card of the moment (124 px, the title in Playfair, the object
  that only sticks out through the top), says what there is to do now; two
  cards can be made out underneath, offset and reduced, paler and paler. An
  extra card (catch up) shows in light, the title in ink.
- **Touching opens the page**, directly (the text, the service), without a
  second touch. A card with no page (tefilin, guarding your tongue) opens its
  sheet.
- **The stack's gestures**: swipe right, it is done; left, later (the card
  goes under the stack). Below 110 px, the card comes back. What the gesture
  will do attaches to the edge of the card being swiped: a light pill (the
  check mark and « C'est fait » ("Done"), coming out from under its left
  edge; the clock and « Plus tard » ("Later"), from under its right edge),
  at mid-height, which follows the card and darkens to the theme color once
  the threshold is passed. Placed under the stack, the word used to stick to
  the edge of the card below. The open wallet does the same for each card
  (« Pas fait » ("Not done"), « Remettre aujourd'hui » ("Put back today")
  depending on its state). Pulled down, the stack spreads out, the cards
  underneath faster than the top one, and opens beyond 50 px. A
  long press (550 ms) opens the sheet; so do a right-click and the context
  menu key. A swipe never opens the page.
- **You see the next one arriving.** Once done, the card receives a check
  mark (a light circle, on the left side still visible, 260 ms), then flies
  off to the right, accelerating; at the same time, the card underneath
  rises to take its place, with a decisive step that carries it a little
  beyond before settling, and takes on its color; then an ink ring escapes
  from it once. Put off until later, the card flies off to the left, the
  next one rises the same way, and it goes back under the stack. It never
  comes back from the side it left: you do not confuse it with the next
  one. A screen reader hears « C'est fait. Ensuite : Arvit » ("Done. Next:
  Arvit"). These cues say what has just happened: a small machine
  (`perf-lite`) keeps them, and only the system setting asking for fewer
  animations makes everything happen at once.
- **The stack and scrolling.** With a finger, the page scrolls, even when
  resting on a card: the stack keeps a vertical gesture only to unfold,
  pulled down when the page is at the top. The open wallet scrolls like the
  rest of the page too; you fold it with « Replier » ("Fold") (with a mouse,
  by pushing it up). Sideways gestures remain for the cards. Held by
  `e2e/firebase/parcours.spec.ts` (« l'accueil au doigt »).
- **The wallet**: all the day's cards, from morning to bedtime, overlapping
  every 80 px, the object small in the corner. The top card keeps its solid
  color, those to do wait on a light background, those that are done go dim
  (soft background, gray text, faded drawing). Swipe right: done, even after
  the fact; left: later, or not done if it was. At the top, « Aujourd'hui, 3
  sur 8 » ("Today, 3 of 8") and « Replier ». No checkbox: the gesture is
  enough, and the sheet says it again as buttons. Each card keeps its
  element from one state to another: unfolding makes them slide from the
  stack to their place, those already done coming out from under the stack.
- **The sheet** is a panel rising from the bottom (`BottomSheet.vue`, the
  handle at the top): the moment, the name in large type, what there is to
  do, then two buttons per row (done, open, later, not today) and « Voir le
  programme » ("See the program"). Each gesture has its button there, for
  those who do not swipe, and on the site.
- **The order**: the 'Hanouka lighting at its time, the service whose time
  it is (the card says « Maintenant » ("Now") and until when), the moon and
  the 'Omer, then the present moment, those coming up, those already past,
  « Rattraper », and finally what was put off until later. A service says
  until when, or from when if it is upcoming.
- **Not time yet.** A service whose time has not come (Min'ha in the
  morning) goes after everything that is done now, even what was put off
  until later: the stack never offers in solid color what cannot be done
  yet. When it is the only one left, it waits at the top, set back: the card
  light and flat (a rule, no shadow), a clock and « Pas encore l'heure »
  ("Not time yet"), from when, the sidour faded. It cannot be swiped (pulled
  sideways, it comes back without marking anything); a touch opens its
  sheet, from which you can check it anyway. At its time, it takes back its
  color and its place. A habit likewise waits for its marker (chosen on the
  bar for study, the template's otherwise): « à midi » ("at midday") from
  'hatsot, « avec Min'ha » ("with Min'ha")
  from Min'ha guedola, « avec Arvit » ("with Arvit") and « au coucher » ("at
  bedtime") from nightfall (the bedtime Chema is not offered in the
  morning); « au réveil » ("on waking"), « avec Cha'harit » ("with
  Cha'harit") and « toute la journée » ("all day") do not wait. A habit from
  before markers, set at bedtime, also waits for night. Programs and cycles,
  for their part, never wait: their moment orders them, and study is done
  when you can. Held by
  `src/__tests__/parcoursDeck.test.ts`.
- **Occasion cards** (the moon on the nights it is blessed, the counting of
  the 'Omer in the evening, the 'Hanouka lighting) take their place in the
  stack, at their time, and open the same way; their banners stay silent as
  long as the parcours has started. They do not count in the day: once
  done, the device remembers them (`services/parcours/occasions.ts`), so
  that a blessed moon does not come back the following night.
- **The services are in the stack for everyone.** Without the « trois
  tefilot » habit (or on a day it leaves out), the service whose time it is
  still comes into the stack, as an extra card: « Maintenant », until when,
  the sidour, in solid color like the habit's (what you come looking for
  takes the color, counted or not). It opens the text, is swiped done like an occasion,
  and does not count in the day, on the wall or in the streak: only the
  habit, chosen, counts the services. It replaces the Sidour shortcut of
  the home page, which stays silent once the parcours has started. On a
  night of the moon, Arvit comes first and the moon right after: once
  Arvit is swiped, the moon is on top. What is swiped here is also what the
  Sidour page knows is said, and what is said there (swiped, or at the end
  of the text) leaves the stack (see "The Sidour opens on the moment").
  Held by `src/__tests__/parcoursDeck.test.ts`.
- **« Rattraper »** ("Catch up"), an extra card for a program that is behind
  (« si vous avez un moment », "if you have a moment"), leads to the catch-up
  sheet; swiped right, the backlog is marked as read.
- **The day bar**, under the folded stack, is a button: one round box per
  task, ordered by moment; in ink, done; half tinted, the top card; gray,
  what is coming. The count at the end (« 3 sur 8 »). Touching it opens the
  wallet.
- **Under the home page volumes**, what is waiting and where (« ce soir
  7:1 », "tonight 7:1"), what is done (« fait ce soir », "done tonight"), or
  the position (« 72 sur 150 », "72 of 150"); in Mon parcours, the progress
  and the backlog (« 6 % · 9 en retard », "6 % · 9 behind").

### Ma journée, removed

Ma journée ("My day", `/parcours/journee`, the P2-Journee mockup) has been
removed, to simplify: the home page's stack and wallet already show the
day, in the order in which it is done. What it alone offered has found
another place:

- a past day is completed from the Mon parcours wall, in that day's sheet;
- the evening reminder and the notice about texts to download for offline
  use are at the bottom and the top of Mon parcours;
- its address (`/parcours/journee`) leads to the home page; that of the
  daily reading (`/bibliotheque/lecture-du-jour`, which the widgets, the
  watch and the evening reminder keep) has got its page back (see below);
- « Ma journée », in the study tab, also leads to the home page.

Two decisions remain from it: the back link at the top of Mon parcours pages
is a chevron and a name, in ink (`ParcoursBack.vue`); the page background
has its own token, `--color-page`, which darkens in dark mode.

### An open volume, its settings, the reader

A paused goal is visible without opening its settings: on the shelf, its
volume fades and carries an « En pause » ("Paused") pill (the drawing and the
word); at the top of its page, a strip says since when, that nothing is
lost, and « Reprendre » ("Resume") with one touch (`PausedNotice.vue`). The
pause used to be readable only in a switch, at the bottom of the settings. A
paused program shows no backlog; on resuming, its end moves back by as many
days as the pause lasted, and the pace restarts from where you were
(`resumeProgram`, held by `parcoursPlan.test.ts`). Otherwise you resumed
with weeks "behind" that you had chosen not to read.

- **A daily program** (P2-Programme): the volume in large size, its gilt
  border showing progress and its ribbon when a portion is waiting; « Vous
  en êtes à » ("You are at") and the position; the year's track; the day's
  portion, the only colored surface, which you open with « Lire » and swipe
  right when it is done (it then shows the next one); the backlog, without
  alarm (« Environ 4 jours. Rien ne presse. », "About 4 days. No rush."); the
  week as a bar chart; the planned end, the eve of the holiday when it is
  one.
- **A weekly program** (P2-Semaine): « Semaine 3 sur 52 » ("Week 3 of 52"),
  the week's card (the one on the home page), the portion's boxes to touch
  (« Où j'en suis cette semaine », "Where I am this week"), and the weeks,
  one stone each, named after their paracha.
- **Getting ahead.** Once a portion is done (daily or weekly), its page
  offers « Lire la suite », the next portion, and the volume touched on the
  home page leads there too; at the bottom of the reading, the ring marks it
  read today (« Lu en avance », "Read ahead"), and still offers what comes
  next. The lead is stated under the portion (« 4 michnayot d'avance », "4
  michnayot ahead"), without fanfare: the portions keep their size, the end
  comes sooner. Lightening the upcoming portions would change what you
  promised yourself without your having asked.
- **Chnei mikra, one aliyah a day** (`aliyot.ts`): one card each day, the
  sixth and seventh aliyot on Friday; a forgotten aliyah does not disappear,
  the next day's card shows two (« Noah, 3e et 4e montées », "Noah, 3rd and
  4th aliyot"). It opens the chnei mikra page reduced to these aliyot, with
  « Toute la paracha » ("The whole paracha") for the rest, and at the bottom
  the ring that checks it. The paracha setting switches from one to the
  other (« Une montée par jour », "One aliyah a day").
- **Rattraper** rises from the bottom like the sheet: the five ways as
  pills, the week redrawn with each choice, what was planned in the stone
  tint and what the catch-up adds in color.
- **Modifier** ("Edit", P2-Reglages): grouped rows, like the phone's
  settings (the rhythm, the moment, then pause and « Ranger le volume » ("Put
  the volume away"), in red, `--color-danger`); a touched row opens its
  sheet.
- **The whole wall** states above it the months being viewed (« De Av 5786
  à Tichri 5787 », "From Av 5786 to Tichri 5787"); the Mon parcours wall also
  opens there by spreading two fingers on it.
- **A day of the wall** opens as a sheet: the day as title, one node per
  task, « Fermer » ("Close").
- **At the bottom of a reading** coming from Mon parcours, the end of the
  portion: a ring you pull upward; it fills as you go, and when released at
  the end, the portion is done (« Le signet a avancé », "The ribbon has moved
  forward"), with « Annuler » ("Undo"). For those who do not pull, the ring
  is a button.
- The stones are in `components/parcours/stones.css`, which every component
  that lays them imports.

### New goal, on a single page

Creation follows P2-Creer1 to 3 and P2-Habitude, but on a single page: at
the top, the back link to Mon parcours, then the question in large type,
aligned to the start. What you choose at the top stays marked (the volume
pulled out of its shelf, the others set back; the pill in color), and the
next step unfolds below, under a rule, the page sliding down to it: the
part, then « d'ici quand ? » ("by when?") after « Suivant »; or the habit to
set; or the text to search for. Changing your mind happens at the top,
without going back. The choice no longer goes into the address: each address
change brings the page back to the top, and the page has to slide to the
section.

Once created, the goal does not open: you return to Mon parcours, which
slides to it and makes it arrive before your eyes (`useParcoursArrival`). A
volume falls onto its shelf, bounces twice and raises a golden dust (the
bindings' border), then its line appears; a habit slips into its list, in
the theme tint which fades, and the boxes of its week settle one by one.
Only once: nothing replays on reload. Held by
`e2e/firebase/parcours.spec.ts` (« un volume se choisit sur une seule
page »).

- **Que voulez-vous accomplir ?** ("What do you want to accomplish?") The
  volumes standing on their shelf (Michna, Talmud, Tanakh, Tehilim); the
  cycles as pills (Tehilim every week, every month, Chnei mikra, one text
  every day); the habits as pills, and « Avec mes mots » ("In my own words")
  outlined, in ink. The habits offered are done every day without too
  precise a moment to keep: the three tefilot, the bedtime Chéma, tsédaka,
  guarding your tongue, a study period (the card opens the library). Tefilin
  and Birkat Hamazon are no longer there (the tefilot and the meal carry
  them); a habit already taken still reads.
- **A template is confirmed.** Touching a ready-made habit or a cycle adds
  nothing: a sheet rises (`PresetSheet.vue`), which says what it asks, its
  days and its moment as labels, then « Ajouter à mon parcours » ("Add to my
  parcours") in large type, « Régler les jours » ("Set the days") for a habit,
  and « Annuler » ("Cancel"). The button only accepts touch after 400 ms (the
  time for the sheet to rise): a double tap on the list does not reach it.
  « Ajouter à mon parcours », under a habit being set, waits likewise.
- **Only once.** A template already taken (a habit, a cycle, the Tehilim
  program) is no longer offered; removed from the parcours, it comes back.
  The sedarim, tractates and books that a current program studies stay
  dimmed on the shelf, « Déjà sur votre étagère » ("Already on your shelf").
  Adding anyway (a saved address, two touches) leads to the one you already
  have. Held by `e2e/firebase/parcours.spec.ts` (« un modèle se confirme »).
- **By when?** Four answers as a list: the eve of Roch Hachana, of Pessa'h
  (with the number of days), another date, or « à mon rythme » ("at my own
  pace": so much per day or per week, from which the end date is deduced).
  The rhythm in three segments; the answer in solid color, with its volume:
  what each study day requires, in units and in minutes, and the end. « Plus
  soutenu. » ("More intensive.") beyond half an hour a day. For weekly, the
  days on which the card comes to the home page, written out in full
  (Sunday, Wednesday and Friday by default). Then the moment, on the day
  thread of a habit (after Arvit by default), with what it does: the
  portion's card goes to the top of the home page at that moment, without
  waiting set back for all that; you open it whenever you like. It is saved
  (`anchor`) and changed in the program's settings, on the same thread.
- **A habit**: its name, its days as flat boxes (Chabbat paused for tefilin
  and tsédaka), and its moment. Only a study period and an « avec mes mots »
  habit choose it, by sliding the dot along the day thread: on waking, with
  Cha'harit, at midday, with Min'ha, with Arvit, at bedtime; that is where the
  question makes sense. The
  others have their own, by default, stated without a bar: the tefilot each
  service at its time, the Chéma at bedtime, tsédaka and guarding your
  tongue all day. The marker is saved (`anchor`), stated on the card (« Ce
  soir, après Arvit », "Tonight, after Arvit") along with when it opens: a
  line says so (« La carte vient à la nuit tombée ; avant, elle attend en
  retrait », "The card comes at nightfall; before that, it waits set back").
  The settings of a habit already taken reuse the same screen.
- **« Toute la journée » is a switch**, above the thread (`AnchorTrack`), for
  a program as for a habit: on, the thread goes dim and can no longer be
  touched; off, the dot returns to the last marker chosen. A link « ou toute
  la journée » ("or all day") written after the moment's name (« Toute la
  journée ») said the same thing twice, and did not show that you were
  leaving the thread.
- **A date is given in Hebrew and civil form**, wherever Mon parcours sets
  one (a program's end at its creation, on its page, in its settings, the
  catch-up that pushes back the end): « 29 Elul 5787 (1 octobre 2027) ». The
  Hebrew date alone cannot be placed at a glance in the year you are living.

### The daily reading, back again

The daily reading page from before Mon parcours is back
(`/bibliotheque/lecture-du-jour`, `LectureDuJourPage.vue`), fed by it,
without losing anything it knew how to do: you often have several texts on
the same day (several psalms), and you read them one after the other. It is
the page of the « Lecture du jour » volume and of the card of the same name.

- **The day's texts, nothing else**, in catalog order. The calendar readings
  (the month's or the week's Tehilim, the paracha) are no longer there: each
  has its volume, its card and its page. The previous daily reading mixed
  them, and the paracha had a « Cette semaine » ("This week") tab there, for
  lack of anywhere else. What is said before and after (the Yehi ratson of
  the Tehilim) is placed once for everything you read from the same corpus.
- **The list is composed on the page**: « Modifier ma liste » ("Edit my
  list") shows the day's texts, each removed with one touch (the cross and
  its name, « Retirer Tehilim 23 », "Remove Tehilim 23"), and the search adds
  several in a row. It opens by default when the list is empty. Held by
  `e2e/firebase/parcours.spec.ts` (« plusieurs textes d'affilée, lus à la
  suite dans la lecture du jour »).
- **Each text is checked off** (« Marquer comme lu », "Mark as read") and
  folds; a touched title folds or reopens it. A text's chapters are checked
  off one by one (« 3/8 »), and the last one checks the text. The day is
  stated at the top (« 1 sur 4 lus aujourd'hui », "1 of 4 read today", and
  its bar).
- The reading menu, the text size (next to « Modifier ma liste »),
  auto-scroll, the screen that stays on, the notice about texts to download
  and the evening reminder, as before.
- **On the home page, a single card**: the day's texts, one or several, make
  the « Lecture du jour » card (« 3 textes · Tehilim 1 et 2 autres », "3
  texts · Tehilim 1 and 2 others"), which opens the page; swiped, it checks
  them all. The profile counts the day the same way.
- **Several texts in a row**: at creation as on the page, a touch checks a
  text, the search can be redone as many times as you like, what you have
  checked waits above, and « Ajouter 3 textes » ("Add 3 texts"), stuck to the
  bottom of the screen, takes them all.

### The home page to your taste

The home page can be customized (P2-AccueilModifier), in place, on the
home page itself: no separate page, no list of titles. The day's deck stays
at the top, always (faded while the others move, it is not arranged); below,
the blocks themselves (the times, my volumes, the three doors, my dates, and
« Reprendre », to be restored) wobble a little, for the duration of the
setting: you can pick them up. Each carries a « Masquer » ("Hide") pill;
hidden blocks stay in view at the end, faded (40 % opacity) and still, with
an « Afficher » ("Show") pill in the brand color. A block that has nothing
to show right now keeps its place as a dashed outline under its name. You
get there by a long press on a block (with a finger), which also picks that
block up at once, or through « Modifier l'accueil » ("Edit the home page")
at the bottom of the page; « Terminé » ("Done"), above the blocks and at the
bottom, or Escape, leaves it. The old address `/accueil/modifier` opens the
home page in this mode.

In edit mode a finger holds a block a moment before it lifts (a quick swipe
still scrolls the page), a mouse picks it up at once, and the up and down
arrows move the focused block. The held block follows the pointer, lifted
(the pop shadow); the others slide aside as soon as it passes the middle of
one of them (`pickSlot`, held by `src/__tests__/homeLayout.test.ts`), and
the page scrolls on its own near the top or bottom edge. Released, it slides
into place (`useHomeArrange`). It is a device setting (`useHomeLayout`), and
outside edit mode a block with nothing to say disappears on its own.

One block holds the **pinned books** (« Livres épinglés », `useHomePinned`):
up to three volumes on one shelf, drawn like the library's (`LibraryShelf`),
each a whole section (the Sidour, the Tehilim, the Talmud...) or one text of
the catalog (Chaharit, Min'ha, Berakhot, a psalm), and each opening its page.
A long title goes over two or three lines on the cover, smaller when a word
alone is too long. In edit mode the block carries, under it
(`HomePinnedEditor`, still while one types and never picked up): the pinned
books as chips with their cross, « Les trois offices » ("The three
services", the book drawn and its name), which puts Chaharit, Min'ha and
Arvit in place of the others, and a search field over the whole catalog,
the Sidour's texts included, whose answers carry « Épingler » ("Pin"); with
three books on the shelf, a line says to remove one first. Pinning a book
shows the block if it was hidden. The block is hidden by default, the
Sidour and the Tehilim ready on its shelf; it is a device setting too
(`pj_home_pinned`), and a book this version does not know stays off the
shelf (held by `src/__tests__/homePinned.test.ts`). A pinned Sidour text
takes the Sidour's binding.

Another block, hidden by default, is **« Reprendre l'écoute »** ("Resume
listening", `HomeListeningResume`): the audio courses begun and not finished
on this device, in the same row of tiles as at the top of the Chiourim
catalog (`ResumeTile`), a touch resuming the course where it was left. It
spans both columns on a wide screen, and with nothing to resume it
disappears.

### Texts set aside, on the table

You rarely study a single book: you read a passage, go look at a
commentary, a michna, a psalm, then come back. The study table reproduces
that gesture: several books open on the table, each at its page.

- **Setting aside.** At the top of each library text, to the right of
  « Retour » ("Back"), a « Mettre de côté » ("Set aside") button (the three
  books laid down and its name); the same in the reading menu, under « Haut
  de page » ("Top of page"), because it is in the middle of a chapter that
  you need it. The text joins the table and the head of its page (the book
  in the theme ink, the name in Playfair) shrinks down to its book in the
  bottom bar; you are back in the library. Not in a reading chain: there you
  read your share, you do not take it away. Nor on a Sidour text (a tefila,
  a brakha, a holiday text): people come there to pray from start to finish,
  not to study by moving from one book to another, and the Sidour has its
  own page.
- **The table bar, books standing up.** It sits at the bottom of the screen
  like the audio player, above it and the app bar, and follows from one page
  to another. Each text set down is a small standing book there, drawn like
  the volumes on the library shelf: the cover in its section's binding, the
  page edge at the end, a double cream rule, the title in serif
  (`config/bindings.ts`). Set on the bar
  as on a shelf, a book never sticks out at the bottom, and its head sticks
  out by a quarter at the top; the text being read is pulled out of the
  row, taller than its neighbors. The last one set down goes at the end;
  when they no longer fit, the row scrolls sideways, the book being read
  staying in view. A title is never cut in the middle of a word: it shrinks
  instead, based on its longest word. Nothing in front of the books: a stack
  and its count used to precede them, but you can see them, you can count
  them. Two versions before this one: small
  labels with a colored border, a design found nowhere else on the site,
  then a set of tabs stuck to one another, where nothing separated one text
  from the next. The floating buttons at the bottom (reading menu, back to
  top, toasts) rise by as much, book heads included
  (`TABLE_BAR_REM`, `useBottomChromeHeight`).
- **One book, one gesture.** Touching a book opens that text, at the place
  where you left it: switching from one to another takes only one tap. The
  arrow at the end of the bar, a tap elsewhere on it, an upward swipe, or
  the book being read open the table. The text you were reading, if it was
  not yet on the table, is set down there in passing: going to look at a
  book set aside means leaving the other one open beside it. Only from a
  text being read, not from a book's chapter list
  (`readingTable.test.ts`, « passer d'un texte à l'autre »).
- **The open table shows the pages.** A panel rises from the bottom, at the
  height of what it holds and never more than three quarters of the screen:
  the page stays visible behind a light veil; the table sits on top of it,
  it does not replace it. Each text shows its open page there, in the design
  of the head of a reading page: its section and its book in small type, in
  the theme ink (« Tanakh · Berechit »), its name, then the first line of
  the page where it was left, in its language and its reading font, and the
  location (« 1re montée · verset 22 », "1st aliyah · verse 22", « Daf 2b »
  for a Guemara). One row per text, separated by a rule like the player's
  queue, in the bar's order; « Ouvert » ("Open") marks the one being read, a
  cross puts a text away, « Tout ranger » ("Put everything away") clears the
  table after confirmation, and « Retour à la bibliothèque » ("Back to the
  library") leads there to look for another text (except from the library
  itself). Opened from
  a text that is not on it yet, it offers to set it down too, with a command
  in the theme color carrying its name. Escape, the Android back button, a
  tap around it or the panel pulled down close it.
- **Each text reopens at its page.** The table remembers the verse at the
  top of the screen and its height in the window; reopened, the text comes
  back exactly there, to the pixel, whatever text size was chosen in the
  meantime. A text without identified verses (a Guemara) gets its scroll
  position back, counted from the top of the text. The text you leave, if it
  is on the table, first records its page, and keeps following it during
  reading: a closed app does not lose it. The buttons that bring the page
  back to the top before navigating (« Retour », next chapter, neighboring
  text) make it record before that jump, and the chapter list never erases
  the chapter where you were reading. In the app, the page you leave stays
  above the text for a moment during its transition: the text settles back
  at its starting point. Held by `readingTable.test.ts`.
- **On the device.** The table is that of a study session: it survives a
  reload or a closed app (localStorage), but does not follow the account
  from one device to another. The site open in two tabs shares the same
  table: what is set down in one appears in the other. Twenty-four texts at
  most, the oldest one set down leaving first.

## 2. Theme colors

Two colors, the orange and the blue of the logo's palette. The background
and the wall also come from the logo.

| Color           | Logo      | Solid fill | Ink       | Light     |
| --------------- | --------- | ---------- | --------- | --------- |
| Orange          | `#FEA547` | `#EB9F4F`  | `#D46D01` | `#FFD09E` |
| Blue            | `#539EE2` | `#328CDC`  | `#328CDC` | `#A9CCEB` |
| Page background | `#FFF9F3` |            |           |           |
| Bricks (wall)   | `#D6C4B8` |            |           |           |

The solid orange is a **pastel of the logo's family** (`#EB9F4F`), with
**white on top**. It cannot be written on the background, so orange text
takes **the same family, deepened just enough** to be readable: that is the
ink. The logo's blue, light too, is taken deepened once and for all
(`#328CDC`): it carries white and reads as ink.

White on the pastel orange is a **deliberate exception** to the readability
rule. It reaches 2.2:1 by WCAG 2, below even the 3:1 that WCAG asks of large
text; APCA, which weighs size and weight, gives it Lc 47, enough for large
bold headlines (Lc 45) and not for small labels (Lc 75). We accept it for
the look the owner chose, and the **higher contrast mode** (below) gives
whoever needs it a version at the WCAG AA level everywhere.

Rejected attempts for the orange, in order: the original vermilion
(`#DE4F17`), which leaned red; the logo's orange deepened to carry white
(`#D96507`), yellower than the vermilion but which leaned brown and made the
app dull; brighter oranges between the two (`#E65D00`), which did not
convince either; the logo's orange itself (`#FEA547`) with brown on top,
readable but dull, and white was wanted back. A vivid orange of the same
lightness (`#FB8900`, white at 2.4:1) was close behind the pastel. The
price of a light orange: two oranges on the same screen, the hue in solid
fills and the ink in text (the home page time, the active tab).

Three themes to choose from, in this order. The first is the original.

| Theme            | Ink       | Solid fill | Text on it | Secondary |
| ---------------- | --------- | ---------- | ---------- | --------- |
| sunset (default) | `#D46D01` | `#EB9F4F`  | white      | blue      |
| ocean            | `#328CDC` | `#328CDC`  | white      | orange    |
| emerald          | `#059C66` | `#059C66`  | white      | orange    |

Orange and blue are each other's secondary; green takes orange as
secondary. The readability rule is held by
`src/__tests__/themeColors.test.ts`:

- the ink at 3.1:1 at least on the background, 3.5:1 on a white card, 3.3:1
  on the dark background;
- what is written on the solid fill at 3.5:1 at least, except the
  documented exception of sunset (`ON_BRAND_EXCEPTIONS`), held instead to
  APCA Lc 45, the minimum for large headlines;
- in higher contrast, every theme, light and dark, at the WCAG AA level:
  4.5:1 for the text on the fill and for the inks;
- on hover, the solid button darkens, and its text still reads at this
  threshold (white better than at rest; dark text, in higher contrast,
  slightly less but still at 4.5:1);
- on the solid fill, you write `on-brand`, never `text-white` or the ink:
  the test rereads the classes and CSS rules in `src`.

Solid fills (the card of the moment, buttons, selected pills and segments,
the bar's central button, the profile banner, the next holiday's card, the
circles on the sharing timeline) take `--color-brand`, and what is written on
them `--color-on-brand`. Colored text, links, icons, the active tab, rules,
progress bars, switches and light tints (`bg-primary/10`) take
`--color-primary`, the ink: the pastel orange would show too little there. A
holiday theme provides only its two colors, deep enough to serve both ways
under white, and the rest is derived from them (`resolveThemeColors`).

They live in `src/composables/useTheme.ts`, which rewrites the variables on
the root. The accent of the native widgets and the watch follows the theme:
it is its ink, written as text and as a bar on the widget's background. Its
fallback value (`DEFAULT_ACCENT` in `widgetPayloads.ts`, the
`FALLBACK_ACCENT` constants on the native side) is that of the default
theme, `#D46D01`: all three change together. The background (`#FFF9F3`) is
reused in the browser color (`index.html`), the status bar
(`useNativeStatusBar`, `scripts/setup-android.mjs`) and the widgets'
background. The share thumbnail (`functions/src/ogCard.ts`) takes orange as
the solid fill, with brown on top (6.6:1): it is read small, in other apps,
by people who cannot switch to higher contrast.

### Higher contrast

An accessibility mode, offered in the introduction and in the appearance
settings, as a switch under the themes (`useContrast`). It brings every
theme to the WCAG AA level (4.5:1 for regular text), light and dark
(`strengthenThemeColors` in `useTheme.ts`):

- on the solid fill, the more readable of white and the dark text
  (`#3B2412`); if neither reaches 4.5:1, the fill deepens under white. The
  pastel orange thus keeps its color and takes the dark text (6.6:1); blue
  and green deepen a little under white;
- the inks deepen on the light background and lighten on the dark one until
  they reach 4.5:1 on both the background and a card;
- the neutrals follow (`:root.contrast-more` in `main.css`): darker
  secondary text, more visible rules.

Until someone chooses, it follows the device (`prefers-contrast: more`,
"Increase contrast" on iOS and macOS). A choice made in the switch then
holds, on the device or in the account like the theme. Held by
`src/__tests__/themeColors.test.ts`.

The secondary color holds the elements that are neither the main action nor
text: the Sidour tools, the line under the card of the moment, the library's
« Aujourd'hui » icons, the books' "on the phone" pill, the accent strokes of
illustrations, the bullets of a second category. It is not used to make a
gradient with the primary.

The background stone wall takes the brick tint: it is the light passing
through its joints (`--sw-glow-rgb`, `StoneWallBackground.vue`).

**No gradients.** Anywhere: not on a background, not on text
(`bg-clip-text`), not on a share thumbnail. A solid color stands out better
than a blend, and two blended colors produce a third that exists nowhere
else in the app. When the two colors of a pair must be shown (the theme
preview in settings), they are placed side by side, flat.

Two colors escape the theme, because they express a state and not a taste:
danger (red, `.btn-danger`) and an approaching deadline (amber). They do not
move when the theme changes.

The objects drawn on a highlighted card (the sidour, the moon, the
'hanoukkia, see "A highlighted card can carry its object") also escape the
theme: they have the colors of the real thing, the leather, the silver, the
wax, the flame, the moon. These colors live in their drawings
(`components/art`), and remain flat: no gradient to round out a moon.

### Selection takes the theme color

Selecting text used to put the browser's blue behind it, the only color in
the app that nobody had chosen, and it crossed all three themes unchanged.
`::selection` therefore takes `primary` with transparency (token
`--color-selection`, in `main.css`): the text keeps its ink, only the
background changes. The transparency is stronger in dark mode, where the
same tint, laid on night gray instead of beige, could barely be seen.

This holds everywhere, site and app, and the selected passage in a text
reuses exactly the same tint (`.reading-selected`): both ways of pointing at
text look the same.

### Readability

The ink (`primary`) and the solid fill (`brand`) are two tokens. For blue
and green, it is the same color, taken deep enough to work both ways; for
orange, the pastel stays light as a solid fill and the ink is its deepened
version. The three inks hold at the same level: 3.4:1 on the beige,
3.5:1 on white, 5:1 on the dark background. An ink brighter than these
would no longer work as text: a lighter color goes in a solid fill, with dark
text on it, not as ink.

This is a **deliberate exception** to the AA level: 4.5 is the threshold
for regular-size text, and none of the three inks reaches it on the beige.
We accept it because the ink only carries short labels, in semibold,
titles, and the day's additions in a tefila (see below). White on the
pastel orange is the second exception (see "Theme colors"); the higher
contrast mode lifts both.

### Holiday themes

During a holiday, the app changes its dress, then returns to the chosen
theme. A holiday theme is not chosen: the calendar puts it on and takes it
off (`src/services/holidayThemes.ts`, `useHolidayTheme.ts`), and a single
switch, in the appearance settings under the themes, allows it or not for
all holidays at once. It is on by default: it is a kind touch, not an option
to discover; whoever does not want it turns it off once. The settings do
not list the holidays that have a theme, nor show them in preview: the
theme arrives with the holiday; it is a surprise, not a catalog.

| Holiday     | Period                                                    | `primary`                | `secondary`          | Times button           | Ornaments                    |
| ----------- | --------------------------------------------------------- | ------------------------ | -------------------- | ---------------------- | ---------------------------- |
| Tichri      | from 16 Eloul (two weeks before Roch Hachana) to Kippour  | `#D8322F` apple red      | `#D9A21B` honey      | an apple               | a chofar, a honey pot        |
| Souccot     | from the day after Kippour to the day after Sim'hat Torah | `#4E8A2E` loulav green   | `#D9B324` etrog      | a soucca               | a loulav, an etrog           |
| 'Hanouka    | the eight days                                            | `#9F7A00` mustard yellow | `#FFD23F` flame      | a dreidel              | a doughnut, a 'hanoukkia     |
| Tou Bichvat | the day itself                                            | `#9A4FC0` fig purple     | `#79B043` leaf       | a fig                  | a bunch of grapes, a fig     |
| Pourim      | from the day before to the day after                      | `#CC2E70` raspberry      | `#F2B705` gold       | a meguila              | a gragger, a mask            |
| Pessah      | from a week before to the day after the holiday           | `#2A86A3` sea blue       | `#D8B570` matsa      | a matsa                | a glass of wine, a matsa     |
| Chavouot    | from a week before to the day after the holiday           | `#3F72B8` cornflower     | `#D4A017` wheat gold | the tablets of the law | an ear of wheat, the tablets |

Three things change, not one more:

- **the colors**: the holiday's pair takes the place of `primary` and
  `secondary`, wherever they are used, widgets and watch included. The same
  readability limits as the chosen themes apply (see "Readability"); the
  Souccot green is taken bolder and yellower than the emerald, so they are
  not confused;
- **the ornaments**: two drawings per holiday, in the style of the doors'
  illustrations (`src/components/holiday`). At the top of the home page, on
  either side of a greeting; next to the site name in the banner and at the
  top of the footer; in white on the profile banner; and, on all other
  pages, as a watermark in the top corners (`HolidayBackdrop`), where the
  stone wall shows, never on a reading page. Always directly on the
  background, never in a card: it is an adornment, not an answer. An
  ornament that settles on arrival is written in `OrnamentPose`, which
  carries the stroke, the second color (`.accent`) and the animation: it
  only puts its drawing there;
- **the round times button** of the native app, whose circle takes the
  shape of a holiday object (an apple, a soucca, `HolidayFabShape`), the
  clock staying in the middle: it is still the times button; it has only
  changed its dress. It is the button everyone touches every day, and that
  is where the holiday shows first.

What takes precedence over what: hovering a theme in settings, then the
current holiday, then the chosen theme. The choice remains the choice
during the holiday; you find it again afterward. A window is counted in
civil days, not at chkia: a theme that changes during the night fools
nobody; a theme that changed at 7:42 p.m. would do so before your eyes. The
day after Kippour belongs to Souccot, the day you start building the soucca.

At 'Hanouka, the home page 'hanoukkia is live (`HanoukkiaLive`): it carries
as many lights as the evening counts, chkia being authoritative as for the
counting of the 'Omer, and touching it opens the lighting text. The
'Hanouka yellow is taken as mustard: a bright yellow does not hold as ink on
white, so the flame, bright, is in the second color, where yellow shows.

Holidays are counted as in the diaspora when the theme must choose (the end
of Souccot, of Pessah, of Chavouot): the theme does not know where you are,
and one more day bothers nobody. Pourim is that of Adar II in leap years.

### What the day adds in a tefila

In the liturgy reader (`LiturgyText.vue`), `primary` serves as the ink for
what the day adds or changes within the flow of the text, like the red of a
printed siddour: Hamélekh hakadoch during the ten days of techouva,
Zokhrénou in the middle of Avot, Ya'alé véyavo on Roch Hodech, 'Al hanissim
at 'Hanouka, tonight's counting of the 'Omer. The passage reads in its
place, in the paragraph it completes, and it is only there on the day it is
said: the rest of the year, the ordinary text holds the place, in the text
color.

What is not colored: an entire conditional passage (the Hallel, Avinou
Malkénou, the psalm of the day, tahanoun), whose title is enough to state
the occasion and which a whole column of `primary` would make unreadable;
and the seasonal text (morid hatal, Barekh 'alénou), which is the ordinary
text for six months, except during the first three weeks after a switch,
which is when people make mistakes (`recentSeasonalChanges`). What the
application cannot decide (in the Land of Israel, with ten diners) stays in
gray: a possibility pointed out, not a reading imposed.

The background layer says something other than the color of the day. A
passage that is not said everywhere (the supplication « Chema' koli » before
Min'ha on a fast day, the léchem yihoud of Arvit, the second list of the
vidouy on the eve of Kippour, which Tunis did not say) reads in
`text-secondary`, under the note that explains it: the gray shows how far
the passage the note refers to extends, where the note alone would leave
you searching. The flow you read from start to finish keeps its full ink.
No rule therefore sets a color on `.reading-he`: it comes from the block or
the paragraph, and a color set there would override both.

This is the exception to "`primary` never carries reading text": a short
fragment, in a paragraph read in one go. The halakha for omission ("if one
concluded haEl hakadoch, one starts over") accompanies the passage, as a
stage direction, on the days it applies.

The day follows the location of the times. In Jerusalem, a city surrounded
by a wall since Joshua, Pourim is celebrated on 15 Adar (Chouchan Pourim):
'Al hanissim, the reading of Vayavo Amalek, Migdol and the Pourim psalm come
on the 15th there, and not the 14th. Jerusalem means the catalog city, or a
position less than 7 km from its center (its neighborhoods, not Maalé
Adoumim or Mevasseret; `isWalledCityPlace`). Held by
`src/__tests__/purimJerusalem.test.ts`.

### The parchment opens from the text

Two passages of the sidour have their own form on a parchment: the pitoum
haketoret, which many read from a klaf written by a sofer, and psalm 67
(Lamnatséa'h binguinot), which it is good to say while looking at the
menora in which it is written. The app does not redraw them in the flow: it
places, at the paragraph where they are said, a small round command
(`.reading-klaf`, in `LiturgyText.vue`), a pill in the theme color, at the
size of the stage directions, which opens a window (`KlafViewer.vue`). It is
the only door: unlike the compass and the mirror, the reading menu does not
offer the parchments; they are opened where they are read.

The window first shows the photo of the parchment, as is (`public/klaf/`),
which a touch enlarges to double size; a second tab gives its
transcription, letter by letter and without vowels, in the sofer's script
(the Stam Sefarad CLM font, see "The fonts") and at the reader's reading
size: the same rendering as the klaf, but as text. For the psalm, the transcription
reproduces the shape of the parchment: seven vertical branches, a bar, a
base, in solid strokes in the text color, without shadow or gradient. It is
writing, not an illustration.

### A prayer that goes through another book leads there with one gesture

The Hochanot are said in the middle of Cha'harit, after the Hallel, but
their text lives in the Moadim book: it weighs too much for the everyday
service. Where the prayer changes books, the block carries a cross-reference,
a pill in the theme color carrying its drawing and its name (« Lire les
Hochanot du jour », "Read today's Hochanot"), placed under the text it
continues (`.reading-link`, in `LiturgyText.vue`). It is an interface
command: its size is that of title commands; it does not follow that of the
text being read. The end of the Hochanot carries the reverse
cross-reference, which leads back to Cha'harit at the following passage (the
Kaddich Titkabal) and not to the top of the service. When you come from
Cha'harit, the cross-reference goes back there instead of stacking it a
second time: the "previous" button does not shuttle between the two texts.

### The 'hazara starts again from the beginning of the 'Amida

The passages the 'hazan says during the repetition (Kedoucha, Modim
dérabanan, Birkat kohanim, 'Anénou) stay collapsed in the 'Amida: it is first
prayed silently, and they would break the flow. When the 'hazan resumes, the
reader is at the bottom of the 'Amida and has to scroll back up to expand
them one by one. The end of each repeated 'Amida (Cha'harit, Min'ha,
Moussaf; not Arvit) therefore carries a « 'Hazara » pill, the same as a
cross-reference's (`.reading-link`, in `LiturgyText.vue`), placed under
« 'Ossé chalom »: it goes back up to the title of the 'Amida and expands
along the way the 'hazan's passages, and only those (the Kaddich that
follows stays collapsed). The marker comes from the recipe (`hazara`, in
`scripts/build-sidour.mjs`); one test holds its place
(`sidourContent.test.ts`), another what the button does
(`liturgyHazara.test.ts`).

### A text that changes with the day opens on the day

A book that carries one sequence per day (the Hochanot: six days, Hochana
Rabba, Chabbat) shows only one, that of the calendar day. Above the text, a
row of pills names the days (`TefilaDays.vue`): the one for the day being
read is solid, in the theme color; the one for the calendar day carries a
dot, so you can find it again after reading another day. Outside the
holiday, the book opens on the first. The choice is not remembered:
reopening the book means finding the day it is. An address can name the day
(`?jour=hoshana-rabba`): the link on the Hochaana Rabba page, the old
per-day pages, a shared passage.

### The library shelf: bound volumes, outside the theme

The library's home page sets out its large study sections like books on a
shelf (`LibraryShelf.vue`): Tehilim, Michna, Talmud, Tanakh, Moussar,
Halakha: two shelves of three. The liturgy is not there: it has its own
page, the Sidour.

Three volumes per shelf, then a new shelf: five side by side made each
cover too small on a phone. All volumes are the same size, a third of the
shelf, even alone or two on the last one, which centers them; from a
medium screen up they cap at 8 rem.

The bindings do not follow the chosen theme: they are objects, in warm,
matte tints of the same family (terracotta, bronze, brown), identical in
dark mode. A new volume takes a tint from this family that does not blend
with its neighbors:

| Section | Binding   |
| ------- | --------- |
| Tehilim | `#96604a` |
| Michna  | `#7d6a4c` |
| Talmud  | `#6d5743` |
| Tanakh  | `#84483f` |
| Moussar | `#86622f` |
| Halakha | `#5e4535` |
| Sidour  | `#a06a3c` |

Moussar ('Hovot Halévavot, Pélé Yoets) is a study section: it has its list
page and its volume on the shelf, its bookmarks and its reading resume. It
is not offered for reading sharing, like the liturgy (`isShareable` in
`content/etudeTexts.ts`). Its section numbers are those a class cites, and
therefore those of its addresses: a gate of 'Hovot Halévavot opens on its
introduction, section 0, and its chapters keep their number; a topic of the
Pélé Yoets keeps its number throughout the book (the letter Beth runs from
22 to 41). Held by `moussar.test.ts`.

Halakha (Choulhan Aroukh, Kitsour Choulhan Aroukh) follows Moussar: a study
section, without reading sharing. One entry per group of laws, the
"hilkhot" of the Choulhan Aroukh as Sefaria divides them (Hilkhot Tsitsit:
simanim 8 to 24), and groups of the same nature for the Kitsour (Chabbat:
simanim 72 to 96), whose addresses take the prefix `kitsour-` so as not to
compete with those of the hilkhot. Each section carries the number of its
siman in the book, the one a class cites
(`/bibliotheque/halakha/hilkhot-chabbat/242`), and each line is a séif. The
commentaries of the Choulhan Aroukh open séif by séif, in the commentary
pane: the Michna Broura, the Magen Avraham, the Taz, the Chaarei Techouva and
the Ba'er Hétev on Ora'h Hayim; the Chakh, the Taz, the Pit'hei Techouva and
the Ba'er Hétev on Yoré Déa; the Helkat Mehokek, the Beit Chmouel, the Taz,
the Pit'hei Techouva and the Ba'er Hétev on Even Haezer; the Sma, the Chakh,
the Ketsot Hahochen, the Pit'hei Techouva and the Ba'er Hétev on Hochen
Michpat. The Kitsour has none. Held by `halakha.test.ts`.

Its entries are too numerous for a single list (more than a hundred and
fifty laws): the section page first shows its books, in the same small
cards as a section's list of texts (the Hebrew and Latin name, the number of
simanim), and a book's list opens separately,
`/bibliotheque/halakha?livre=kitsour`, organized by parts like the others
(Ora'h Hayim, Yoré Déa...). A search covers the whole section, or the open
book. One more book gets its card (`HALAKHA_WORKS` in
`content/etudeTexts.ts`).

### No icon label above a card title

A card opens on its title. The small line of icon and colored word placed
above it (« Toujours ouverte » on the perpetual chain) said what the card
already says: the description and the round counter are enough. It goes.
What remains are the lines of text carrying information of their own (the
moment of a parcours card, the kind of an information notice), and a card
announcing a book carries the object in its corner rather than an icon (see
"A highlighted card can carry its object").

### The chapter list is a list

A text's chapters (the chapters of a tractate, the simanim of a law, the
topics of the Pélé Yoets) are presented as a bare list, laid on the page
background, without a card around it: one row each, a rule between them, a
chevron at the end; on hover, the name takes the theme color. It is no
longer a stack of cards, each with its number in a pill: the section's name
already states its number (« Chapitre 3 (ג) », « Siman 8 : ... »), and the
pill repeated it. Cards are avoided as much as possible; a section's books
keep theirs, small.

## 3. Radii

Two families, and they go in opposite directions. **Surfaces** are cut
sharp, like stone, barely softened at the corners; **controls** are clearly
round, to invite touch. It is the contrast between the two that makes a
button read as a button.

| Token                                  | Value                    | For                                                             |
| -------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| `--radius-card` (`rounded-card`)       | 6 px                     | cards, panels, lists, tiles, skeletons                          |
| `--radius-control` (`rounded-control`) | 10 px                    | small controls: icon button, field, button in a segmented group |
| `--radius-btn` (`rounded-btn`)         | 14 px                    | buttons, segmented group shells, menu rows                      |
| `--radius-pill` (`rounded-pill`)       | 999 px                   | chips, pills, sliders                                           |
| `--radius-xs` … `--radius-3xl`         | 2, 3, 4, 6, 8, 10, 14 px | the Tailwind scale, tuned to the surface family                 |

The numeric scale is only for surfaces: `rounded-lg` is 6 px, like `.card`
(it is a surface's default value), `rounded-xl` 8 px for windows and
floating panels, `rounded-xs` 2 px for a preview placed a few pixels from a
card's edge. Controls do not follow this scale: they take their aliases.

### Two nested roundings are never equal

An element placed inside another takes the parent's radius minus its
padding (a 14 px shell with 2 px of inner padding holds a 12 px button,
rounded here to `rounded-control`; a 6 px card with 4 px of padding holds a
2 px preview). Two concentric curves of the same radius are not parallel:
the inner one looks rounder, and the eye sees it without knowing why. The
rule applies to what **hugs** the parent's corners: the shell of a
segmented group and its buttons, a card's header and its hover background,
the rows of a list placed in a card, a preview in a card.

It does not apply to what does not share the corners: a button (14 px)
placed in the middle of a card (6 px) keeps its control radius; it is the
contrast of the two families that makes it read as a button; a pill or a
circle (999 px) is round everywhere, and two nested circles are always
concentric.

## 4. Fonts

Two families carry the whole interface, and they are not adjustable: they
are the site's identity.

| Token                             | Family                 | For                                                                     |
| --------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `--font-display` (`font-display`) | Playfair Display       | the page title (`h1`, by default) and the little that is truly featured |
| `--font-sans` (`font-sans`)       | Manrope                | everything else: text, buttons, labels, numbers                         |
| `--font-hebrew`                   | user's choice          | the Hebrew text of a reading                                            |
| `--font-reading`                  | user's choice          | the Latin text of a reading (translation, phonetics, stage directions)  |
| `--font-serif`                    | Lora, Georgia fallback | the spines of the library books and the dedication                      |

Two other families are allowed, each where the script is what you come
looking for, and nowhere else (no title, no label):

- **Stam Sefarad CLM** (Culmus project, GPL with embedding exception,
  `public/fonts/stam-sefarad-clm.LICENSE.txt`), the sofer's script, ktav
  Sefaradi with taguim. It writes the transcription of the parchments
  (`KlafViewer.vue`) and the paracha in the form of the Sefer Torah
  (`TorahScroll.vue`, see "A text also reads in the form of its page").
- **Noto Rashi Hebrew** (OFL, `public/fonts/noto-rashi-hebrew.LICENSE.txt`),
  the Rachi script. It writes only Rachi and Tossafot on the daf page
  (`TalmudPage.vue`), where they are printed in this script; the dibbour
  hamat'hil stays in bold square letters, in `--font-hebrew`.
  The study panel, for its part, keeps `--font-hebrew`: a commentary is read
  there in large type, not a page.

Playfair is a ceremonial font: placed everywhere, it no longer highlights
anything. It is automatic on `h1` and is applied by hand (class
`font-display`) elsewhere: the site name, the title of a page that is not an
`h1`, a hook, a large number. At large sizes, it is paired with
`tracking-tight`.

### Selectable fonts apply only to reading

Changing the font in settings means adjusting your reading comfort, just as
you adjust the text size. It no longer repaints the application: the Latin
choice applies to `--font-reading`, used by the classes of a reading's text
(`.reading-tl`, `.daily-tl`, `.daf-tl`, the stage directions, the `.tl` of
prerendered pages), and the Hebrew choice to `--font-hebrew`. Neither one
touches `--font-sans` or `--font-display`.

The Latin options are Manrope (the house font, the default), Lora and
Nunito. Only the identity fonts block the first render (`index.html`); the
others are injected on demand by `useFonts.ts`.

## 5. Text sizes

A page is first read from a distance: what matters must jump out before
anything has been read. The rule is therefore one of hierarchy, not
comfort: the size of a text states its rank, and two neighboring ranks can
be told apart at a glance.

| Rank            | Classes                  | Size       | For                                                                                     |
| --------------- | ------------------------ | ---------- | --------------------------------------------------------------------------------------- |
| Hook            | `text-4xl md:text-6xl`   | 36 / 60 px | the title of an entry page (home), Playfair                                             |
| Page title      | `text-3xl md:text-4xl`   | 30 / 36 px | the `h1` of an ordinary page, Playfair                                                  |
| Door            | `text-2xl md:text-3xl`   | 24 / 30 px | the home page's three destinations, Playfair, centered as soon as they are side by side |
| Number up front | `text-4xl md:text-5xl`   | 36 / 48 px | a time, a percentage, a counter; `tabular-nums`                                         |
| Section title   | `text-xl md:text-2xl`    | 20 / 24 px | an `h2` that divides a page                                                             |
| Card title      | `text-base` to `text-lg` | 16 / 18 px | the label of a dashboard card                                                           |
| Body            | `text-base`              | 16 px      | running text                                                                            |
| Secondary body  | `text-sm`                | 14 px      | an explanation, a line of context                                                       |
| Meta            | `text-xs`                | 12 px      | a date, a unit, a mention                                                               |

Three rules go with it:

- **A card carries only one thing in large type**: the one you come there
  for. The time on the times card, the percentage on the daily reading
  card. Everything else on the card serves it and therefore goes below.
- **The number up front always lands in the same place** (at the end of
  the line) from one card to another: the eye finds it without looking for
  it. It is centered on the text block that accompanies it, and that text is
  tight on the left, line under line: a large gap between the two would make
  them read as two cards instead of one.
- **Nothing gets cut off.** Text that carries meaning (the name of a text, a
  time, a section) wraps; it is never clipped with an ellipsis, which makes
  one thing pass for another (« Fin du Chéma… ») or hides precisely the
  number you were looking for. When a line does not fit, you shorten what is
  written or remove an icon; you do not cut. Truncation remains only where
  the box is physically fixed (the audio player's title in its one-line bar,
  the city name on the times location line).

## 6. System windows

No system window opens on top of the app: not the gray wheel of a
`<select>`, not the blue calendar of an `<input type="date">`, not
`alert()` or `confirm()`. Those windows have neither our colors, nor our
radii, nor our font, and they arrive in the middle of a form that does.

Instead:

| What the system did   | What we use                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `<select>`            | `AppSelect.vue`: the field, then a `shadow-pop` panel                    |
| `<input type="date">` | `AppDateField.vue`: the field, then the house calendar (`DayPicker.vue`) |
| `confirm()`           | `useConfirm` and `ConfirmDialog.vue`                                     |
| `alert()`             | a toast (`useToast`)                                                     |
| a selection's menu    | `ReadingSelectionMenu.vue` on a text (see below)                         |

They remain real controls: ARIA roles, keyboard (arrows, Enter, Escape),
closing on outside click and Android back (`useOverlayStack`).

The calendar follows the approach of Android's (Material 3), because it is
proven and people already know it: the selected date is written out in full
at the top, the displayed month is a button that opens the list of years
(to go far without wearing out the arrow), and nothing is chosen until
confirmed, so you can browse without breaking anything. The look, however,
is ours.

Two system windows remain, because they are not a matter of look but a
power only the system has: **file selection** (`<input type="file">`) and
the device's **share sheet**.

### On a text, the selection menu is ours

The menu that pops up from a selection (copy, search, translate, share) is a
system window like the others, except that it cannot be styled: on a phone,
it opens on top of anything you would put next to it. And in front of a
text, what it offers is not what we want to offer: machine translation of a
verse and a web search for a Hebrew word.

A text's passages therefore disable system selection (`.reading-pick`) and
are chosen with a tap; on a phone, a sheet rises at the bottom of the
screen (see "On a phone, what accompanies a text rises in a bottom sheet");
on a wide screen, a bubble comes to rest against the passage, as the menu it
replaces would. Both carry the gestures that make sense where you are:
**sharing** this passage (the link leads back to it, and not to the top of
the chapter), reading its **phonetics** without switching the
whole page, **reporting an error** (the support form opens with the
location, the first words and the link already filled in), and the
**bookmark** where the text takes one.

A long press opens the sheet, like a short tap. Disabling system selection
also disables the gesture that opened it: without this, long-pressing a
verse would no longer do anything at all, and the gesture everyone knows for
acting on text would be dead. The bubble sits above the passage, never
under the system area or under the site banner (it then goes below). The
row of commands follows the reading size, at half rate like the reading
menu, capped so that four columns fit across the width of a phone.

The choice is made per passage, never per word: it is the only unit these
commands can name. A link leads to a verse, not to three words, and a report
that says « Tehilim 23 · verset 4 » can be fixed, whereas three copied words
have to be searched for. Everywhere else (the rest of the site, a text
accompanied without having an address of its own), the ordinary selection
remains, in the theme color.

### A passage's commentaries open from its sheet, then follow the reading

A gemara has Rachi and Tossafot; a michna, the Bartenura and the Tossefot
Yom Tov (the two printed in a standard Michna); a verse of the Tanakh,
paracha, Neviim, Ketouvim or a psalm read alone, has Rachi. Each is attached
to a specific passage of the text (the gemara is divided into passages on
the order of a sentence, Sefaria's, invisible while reading: the text still
reads in one piece; only the chosen passage takes a background). The sheet
of a passage that has commentaries carries a **second row**, across its
full width, under the commands: « Commentaires » ("Commentaries"), with what
there is to read (« Rachi 2 · Tossafot 1 »). A fifth column would not fit on
a phone, and it is not a command like the others: it opens a study mode. The
row does not appear on a passage without commentary; it is grayed out, with
"…", while the commentaries arrive (they only load on the first passage
touched).

It opens the **study panel** (`CommentaryPanel.vue`). On a phone, a bottom
sheet at half height (55 %), which you pull by its handle up to 92 % of the
screen for a long Tossafot. As soon as the screen has room for two columns
(640 px wide: tablet, unfolded foldable, phone in landscape, computer, see
`useSideBySide`), a **column on the right**, under the banner and at full
height: the text on the left, the explanations on the right. The column
takes the room the text leaves free (`--study-width`: the screen minus 48
rem of text and 4 rem of margins, between 17 and 32 rem). The text, for its
part, **moves only if it must**: it keeps its ordinary width (48 rem) as long
as it fits to the left of the panel, and only shrinks below that; it stays
centered on the screen as long as it does not touch the panel there (a large
screen does not move), and otherwise slides to the left just enough to keep
2 rem of space from it. It slides into place, without jumping, on opening as
on closing. Unfolding a foldable moves the sheet to the right without
closing anything. On opening, the passage being studied is brought back into
view if it was going under the sheet or sliding below the bottom of the
screen as it narrowed. At the top, the location (« Chapitre 1 · Daf 2a ·
passage 3 ») and the cross; below, Rachi (the Rachbam in Bava Batra, where
it takes its place) then Tossafot, the dibbour hamat'hil in bold, at reading
size: it is a text being studied. The panel **follows the reading**: as long
as it is open, touching another passage shows that passage's commentaries
there, without reopening the commands; you study a daf with one gesture per
passage. In the text, the words quoted by the dibbourim of the studied
passage are underlined in the theme color (`MarkedText.vue`), without a
background, low enough to pass under the vowels. The reading menu button
fades out while the panel is open (it occupies its place); the cross, Escape,
the back button or the sheet pushed down close it, and give the passages
back their commands.

**The column is resized by dragging its left edge** (`useStudyWidth`): a
14 px strip straddling the edge, the resize arrow on hover, a vertical
stroke in the middle of its height (a sheet's handle, laid on its side), and
the whole edge in the theme color while dragging. The text follows without
delay: it narrows when the column widens, and takes back its ordinary width,
48 rem at most, when the column tightens (beyond that, the lines would become
too long to read). The column does not go below 17 rem and always leaves 20
rem for the text. With the keyboard, the edge is reached by Tab and adjusted
with the arrows; a double tap restores its original width. The chosen width
is kept on the device, like the text size.

### On a phone, what accompanies a text rises in a bottom sheet

On a phone, in the app as on the site, what accompanies a text without
leaving it rises from the bottom of the screen, in a **bottom sheet**
(`BottomSheet.vue`): a passage's commands (spread across the full width,
with the « Commentaires » row) and the study panel. That is the form a
phone gives to these things: the thumb reaches
them, they never hide the passage you just touched, and they close the way
they close everywhere else, by pushing them down.

The sheet has a handle (a 2.25 rem stroke, in the text color with
transparency); the handle and its header carry the gesture, the body
scrolls. It has detents (the study panel: half height and nearly full
screen) or takes the height of its content (the commands); a decisive
downward gesture closes it at once from its first detent (higher up, it
brings it down one detent: a Tossafot read in full screen can be lowered
without getting lost), a slow drag settles on the nearest detent. The
commands sheet, at the height of its content, can be dragged from anywhere,
buttons included (the gesture only starts beyond a few pixels; a tap stays a
tap); **pulled upward, it opens the passage's commentaries**, like tapping
their row, without having to aim at it. It grows under the finger during the
gesture: you can see it is about to open. It does not
veil the page: you read and touch the text above. In the app, it sits **on
the tab bar**, which stays visible: it is the app's menu, and you do not
lose it while reading a commentary (the sheet goes under the round times
button, which overflows the bar, and keeps 1.25 rem of margin from it). It
goes over the
tab bar and under modal windows (sharing a passage opens on top), top
corners rounded like a surface (`--radius-xl`), with the surface background
and the shadow of surfaces that settle on top (`--shadow-pop`). The reading
menu button fades out while a sheet is open. Beyond 640 px wide, room is no
longer lacking: the commands become a bubble against the passage again, and
the study panel a column on the right (`docked`: no handle, no gesture; in
the app, it stops above the tab bar).

What floats at the bottom of the screen (the auto-scroll pill, toasts, a
selection's bar) goes **above the open sheet**: the sheet announces its
height (`bottomSheetSlot`, `useBottomChrome.ts`) and these elements sit on
it, as they sit on the tab bar. Without this, the pill that stops the
scrolling would be hidden under the commentaries being read while
scrolling. A wide screen's column announces nothing: it does not cover the
bottom of the screen.

### A modal window fits within what is visible, keyboard included

The veil of a modal window (`.modal-overlay`) does not cover the page: it
covers what is **visible**. The difference only shows the day a software
keyboard opens, and that day it decides everything. A keyboard does not
shrink the window; it sits on top of it: a frame centered on the whole page
then places its input field under the keyboard, and you type without seeing
what you type. The veil therefore takes the height of the visual viewport
and sits at its top (`useModalKeyboard.ts` measures, the style follows),
the field that takes the keyboard is brought back inside it, and a window
with a list is capped at that height rather than at a fraction of the
screen.

The frame, for its part, is centered by automatic margins and the veil
scrolls. A frame centered by `align-items` that overflows in height gets cut
off **at the top**, out of reach: the « Envoyer » ("Send") button of a
slightly long form became impossible to find on a small phone. With margins,
it is centered as long as it fits and scrolls as soon as it overflows; this
holds for the support form, editing a chain and everything to come.

### A confirmation goes in front of the window that requests it

The `useConfirm` question (« Retirer ce nom de la liste ? », "Remove this
name from the list?") is often asked from a window that is already open. Its
box (`ConfirmDialog`) is mounted once and for all in `App.vue`, therefore
before all the others: at the same level (60), the window opened afterward
covered it, and the question remained invisible under it. It is therefore
placed one step above (65), under the first-launch welcome (90) and the
toasts (100). The end-to-end test of the perpetual chain
(`e2e/firebase/perpetualChain.spec.ts`, removing a name) holds it.

## 7. The navigation banner

On the **web**, the banner is transparent while you are at the top of the
page: it lets the beige show through and weighs nothing. From the first
scroll gesture, it takes a translucent, blurred background; otherwise the
content would show through the links. On **mobile**, it is compact: the
title goes to body size, the tagline disappears, the vertical margins are
halved. The banner publishes its real height in `--navbar-height`, on which
the pages' sticky bars depend.

The site banner has had seven entries since the Sidour arrived (Accueil,
Sidour, Partage de lectures, Bibliothèque, Chiourim, Horaires, Calendrier):
they only fit on one line, with the site name and sign-in, from 1280 px.
Below that, the menu (the three-line button) takes over; at 1024 px,
« Partage de lectures » ("Reading sharing") already wrapped onto three lines
and the site name got cut off.

The native app has no banner: navigation goes through the bottom bar
(`BottomTabBar`): Accueil, Sidour, the times circle, Étude, Profil. The
Sidour gathers what is said, Study what is learned (the library, the
chiourim, sharing, linked by their pages' tabs). As on iOS and Android, touching the tab of the page
you are on scrolls it back to the top (smoothly, unless the system asks for
fewer animations); from a sub-page, it returns to the tab's page. Held by
`src/__tests__/bottomTabBar.test.ts`.

### The top of the app has no edge

In the app, the page goes all the way up to the top of the screen, under the
time and the battery: nothing stops at the system area, and that is
intentional. A solid banner there would make a title bar; the app would have
a ceiling.

What was missing was readability: as soon as you scroll, a title or a line
of text passes behind the system icons, and you can read neither. Hence the
veil (`StatusBarScrim.vue`): a blur going from none at the bottom to strong
at the top, over the height of the system area plus a finger's width. You
can make out what passes beneath, the time stays readable, and the top still
has no edge.

The backdrop blur does not fade by itself: four layers of increasing
strength, each masked at the bottom, add up. On a small machine
(`perf-lite`), they are cut and only a veil in the background color remains,
which is enough.

## 8. What we do not use

- Decorative gradients, in all their forms. A gradient used to
  **disappear** is not one: the system bar veil fades out toward the bottom;
  it colors nothing.
- Borders to set a card apart from the background: that is the shadow's
  job.
- Block capitals and widened letter spacing on labels: a group label is
  written in lowercase, at the size of secondary text (« Mon compte », not
  « MON COMPTE »).
- Playfair on anything other than a title or a highlight.
- A hard-coded color where a token exists.
- The browser's double-tap zoom, on the site as in the app: pinching does
  that job and remains intact. Double tap, for its part, is a gesture of
  ours (it starts auto-scroll on a text); where the browser zoomed at the
  same time, the two fought over the page.

## 9. What remains to be done

These guidelines are being written as decisions are made.

- An ink token distinct from `--color-primary`, if we want brighter colors
  without losing links and verse numbers.
- The app icon still carries the old blue: it will be redone later. The
  store listing screenshots are regenerated at the next CI run.

## 10. The promotional videos

The short videos for the networks, and the app's "what's new" video
(`promo/`, how-to in `promo/README.md`), are the same house as the app, seen
from further away. They take its tokens and what is not used in it, starting
with gradients: the wipes that sweep the screen from one scene to the next,
the backgrounds, the confetti of the siyoum are flat colors.

- **What you see is the app.** Each screen is a screenshot of the native app
  on demo data, each gesture was really played. Nothing is redrawn, except
  what must grow to be read on a phone held in the hand (a chain's progress
  card, the daily reading tracker), which then takes the app's layout at the
  video's scale.
- **The stone wall** is the background of every scene: courses in flat
  colors barely lighter or darker than the background, sliding slowly. On a
  theme color (the opening), the stones hardly show.
- **The fonts**: Playfair Display for whatever reads as a title (the
  opening, the captions, « Mais aussi… », the app's name), with one word in
  italics and in the theme color for the punch line; Manrope for the pills,
  which are round like the app's controls.
- **One video, one look**: each video keeps the theme and the mode (light or
  dark) of its screenshots, and the closing montage mixes the others, to show
  in passing that the app can be set to one's taste.
- **The safe zone**: the networks place their buttons at the bottom and on
  the right. Captions stay at the top (below 210 px), nothing important goes
  below 1,500 px; the phone, for its part, may leave through the bottom.
- **The rhythm**: picture and music share a grid of 120 beats per minute. A
  cut, a line that strikes, a tap fall on a beat, and the music plays the
  gesture's sound at the same instant.

### Series 2 moves more, and reads as much

The stories (`promo/src/Story.tsx`) push the movement: phones that rush in,
followed by two paler echoes as motion blur, fans of three phones, a mosaic
of stones that lands then leaves between two chapters, a split-flap clock,
counters, scrolling bands. Three rules keep it readable:

- **one sentence per shot, held for the whole shot**: the subtitle
  (`Subtitle`) arrives word by word then stays, on a surface plate that
  sets it apart from what moves behind; its punch line fills with a flat
  of the theme (or holiday) color;
- **the closing montage goes to two beats per shot**: one second to read
  « Le calendrier des fêtes », the camera diving on the detail on the
  second beat;
- **lining figures**: Playfair's, old-style by default, turn zero into an
  « o », and « 0 € » read « o € ».

The Hebrew of the videos is written in Frank Ruhl Libre and Heebo, as in
the app, from right to left.

### Version 4.0: one presentation, in the first series' language

The 4.0 video (`promo/src/v4/`) is a presentation rather than an ad: one
video of about ninety seconds, which the app plays after the update in the
reader's language and which goes to the networks in French, only its ending
changing (the stores instead of where to watch it again). A first cut in
series 2's manner was set aside: what the owner liked is series 1, slowed
down.

- **Series 1's language.** The phone held calmly, turning a little from one
  moment to the next; two-line captions whose words rise one by one, the
  second line in italics and in the orange ink; real gestures; what must be
  read larger comes out of the screen (`PopOut`: the card of the moment, the
  streak and its light, the Vilna page, a passage's commentaries, the
  team's answer) rather than the phone zooming under the caption; color
  wipes for the two big cuts; the end card where the logo builds.
- **It follows the app.** When the app changes before the release, the
  video is filmed again on it: the cut is data and the shots replay
  themselves (`npm run captures`, then `npm run render`).
- **What it does not use.** Scrolling bands, phones with echo trails, the
  stone mosaic, captions on plates, a shaking camera beyond the opening's
  strikes, a music that stutters: series 2's vocabulary, which did not
  convince.
- **Slower.** Five to eight seconds per change (series 1 gave twelve to a
  single feature, one beat to each of the others), and two beats per shot
  in the closing montage. The phone never climbs under a caption.
- **What moved is shown before what is new.** The video opens on the 3.10
  tab bar above today's, filmed on both apps, with an arrow from each former
  tab to the one that holds it now and a « Nouveau » tag on the new one; then
  the 3.10 home page beside today's. The bars come from each language's
  screenshots, so the arrows follow the mirrored bar in Hebrew, where
  « before » also stands on the right.
- **White on the pastel orange, as in the app.** The opening, the montage's
  orange shots and the « 4.0 » pill write white on `#EB9F4F`, in large bold
  type only (the app's documented exception, section 2); a small label on
  the orange stays dark. A caption's accent takes the orange ink
  (`#D46D01`). The former vermilion stays with series 1 and 2, filmed on
  3.10.
- **One grid.** The cut is data (`promo/src/v4/plan.ts`): the gestures and
  the music's sounds fall on the same marked beats, and a section always
  holds whole bars, or the music would run into the next one.
- **The reader's language.** French, English and Hebrew, each filmed in its
  own interface; the Hebrew one has no translation chapter (the translations
  go into French and English).
