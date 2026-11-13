# The help center

The help center (`/aide`) is where a reader comes to understand a part of
the app nobody explained to them. It holds three kinds of content:

- **the "what's new" video** of the current version, as a card at the top
  (the same video the app plays once after the update, see
  `docs/design.md`, "What's new plays once, after the update");
- **frequently asked questions**, by topic, each opening on its short
  answer (is it free, do I need an account, can I read offline, which
  city are the times for...);
- **the page of each version** (`/aide/nouveautes/4.0`): what it changed,
  passage by passage in the order of its video, each passage playing the
  video from its start and answering the questions it raises;
- **written guides**, one per thing to know, each with its drawn and
  animated screenshots;
- **tutorial videos**, filmed by the team and published on YouTube.

It is reached from the profile (the « Centre d'aide » row of the Help
group, and « Les nouveautés de la 4.0 » under it for the page of the
version), from the end of the video (« En savoir plus ») and from the
site's footer. In the app it also holds « Revoir
l'introduction » and « Revoir les astuces ». The design choices are in
`docs/design.md`, "The help center shows how, part by part".

| What                           | Where                                        |
| ------------------------------ | -------------------------------------------- |
| The guides and their topics    | `src/content/help/catalog.ts`                |
| The frequently asked questions | `src/content/help/faq.ts`                    |
| The versions, their questions  | `src/content/help/versions.ts`               |
| Where each passage starts      | `src/content/help/whatsNewChapters.json` (written by `promo/scripts/chapters.mjs`) |
| The drawn screenshots          | `src/components/mock/`, named in `src/components/help/illustrations.ts` |
| The videos                     | `public/help/videos.json`                    |
| The pages                      | `src/views/Help/`                            |
| The words around them          | `help.*` in `src/locales/`                   |
| The checks                     | `src/__tests__/helpCenter.test.ts`, `helpCenterPages.test.ts`, `whatsNew.test.ts` |

## Publishing a YouTube video

The list of videos is a file the site serves, so a video reaches the
installed apps as soon as the site is deployed (a merge to `main`), without
a new version of the app. Offline, an app shows the list it was built with.

Add an entry to `public/help/videos.json`:

```json
{
  "videos": [
    {
      "youtube": "AbCdEfGhIjK",
      "title": {
        "fr": "Prendre le Sidour en main",
        "en": "Getting started with the Siddur",
        "he": "היכרות עם הסידור"
      },
      "duration": "3:42",
      "topic": "home",
      "guide": "votre-journee"
    }
  ]
}
```

- `youtube`: the eleven characters after `v=` in the video's address.
- `title`: French, English and Hebrew. The French follows the house
  typography: a no-break space before `:` and inside « », a narrow one
  before `!`, `?` and `;` (in JSON, `\u00a0` and `\u202f`).
- `duration` (optional): as YouTube writes it, shown on the picture.
- `topic` (optional): one of the topics of `catalog.ts` (`start`, `home`,
  `prayer`, `reading`, `parcours`, `zmanim`, `sharing`).
- `guide` (optional): the slug of a guide; the video then also shows at the
  end of that guide.

The list shows in the order of the file. `npm run verify` checks it
(`helpCenter.test.ts`): a mistyped id, a missing language or a guide that
does not exist fails there rather than silently in the app. An installed
app reading a newer file leaves out what it cannot read and ignores the
fields it does not know: add fields, never rename one.

The video opens on YouTube (its app, on a phone): nothing of YouTube is
embedded, only its picture is loaded. A video in "unlisted" mode on YouTube
works as well as a public one.

## Writing a guide

A guide is an entry of `HELP_GUIDES` in `src/content/help/catalog.ts`:

```ts
{
  slug: "mettre-de-cote",          // its address, /aide/mettre-de-cote: never changed once published
  topic: "reading",
  title: { fr: "…", en: "…", he: "…" },
  summary: { fr: "…", en: "…", he: "…" },  // one line, shown under the title in the lists
  blocks: [
    { kind: "point", illustration: "card-swipe", title: { … }, text: { … } },
    { kind: "text", text: { … } },
    { kind: "link", to: "/bibliotheque", label: { key: "common.study" } },
  ],
}
```

- A **point** is the main block: a title, two sentences and, when it is a
  gesture, its drawn screenshot (`illustration`), which plays above them.
- A **text** is a paragraph, to set the scene.
- A **link** leads into the part of the app the guide explains; it must be
  a route of `src/router/routes.ts` (checked).
- Any text can borrow the app's own words with `{ key: "tips.reading.pinch.text" }`
  instead of the three languages: a tip and a guide that explain the same
  gesture must say it the same way.
- A new topic goes in `HELP_TOPICS`, in the order a newcomer meets them.

The guides are in the bundle: a new or corrected guide reaches the apps
with their next version (and the site at once).

## Answering a frequent question

A question is an entry of `HELP_FAQ` in `src/content/help/faq.ts`, under
its topic:

```ts
{
  id: "compte",                         // its anchor, /aide#compte: never changed once published
  question: { fr: "Faut-il un compte ?", en: "…", he: "…" },
  answer: { fr: "…", en: "…", he: "…" }, // two sentences at most
  guide: "lire-a-plusieurs",            // optional: the guide that explains more
  link: { to: "/horaires", label: { … } }, // optional: where it is done
}
```

- **Written the way it is asked**, and answered in the app's words: a
  button is named as the app names it, in each language, and an answer a
  tip already gives borrows it (`{ key: "tips.zmanim.place.text" }`).
- **Short.** What takes more than two sentences is a guide; the answer
  then leads to it.
- **The messages tell what to add.** A question the team answers twice in
  « Nous écrire » belongs here; `/aide#<id>` opens on it, to send as a link.
- `npm run verify` holds it (`helpCenter.test.ts`, « the frequently asked
  questions »): three languages, French typography, unique anchors, guides
  and routes that exist.

## Answering for a version

The page of a version follows its "what's new" video passage by passage,
and answers, under each one, the questions it raises: a FAQ in the order
of the video. A version is an entry of `HELP_VERSIONS` in
`src/content/help/versions.ts`:

```ts
{
  version: "4.0",                       // its address, /aide/nouveautes/4.0
  intro: { fr: "…", en: "…", he: "…" }, // what it changes, in two sentences
  passages: [
    {
      chapter: "calme",                 // the chapter of the video it goes with
      title: { fr: "…", en: "…", he: "…" },
      questions: [{ question: { … }, answer: { … } }],
      guides: ["avant-la-tefila"],      // optional: guides that explain it further
      link: { to: "/sidour", label: { key: "common.sidour" } }, // optional
    },
  ],
}
```

- **One passage per chapter of the video, in its order.** Where each
  chapter starts, in each language's video, is not written by hand: the
  promo project writes it (`src/content/help/whatsNewChapters.json`) when
  it renders the videos (`npm run render`, or `node scripts/chapters.mjs`
  alone), from the cut the videos are made of (`promo/src/v4/plan.ts`).
  The montage of the end (« Et aussi ») is one passage, `montage`: a shot of
  one second is too short to aim at.
- **A question is what someone would type**, in their words (« Pourquoi
  n'apparaît-il pas sur iPhone ? »); its answer, two sentences at most,
  names the buttons as the app names them, in each language.
- An answer can borrow the app's own words (`{ key: "tips.parcours.wall.text" }`),
  like a guide.
- `npm run verify` holds it (`helpCenter.test.ts`, « the pages of the
  versions »): a chapter of the video without its passage, a passage the
  video does not have, a missing language, a guide or a route that does
  not exist fail there.

A new version adds its entry; the previous ones stay, their questions
still true for whoever updates late. Only the current version's video is
served (`WHATS_NEW_VERSION`, `useWhatsNew.ts`): an older page keeps its
questions without « Revoir ce passage ».

## Drawing a screenshot

A drawn screenshot is a small component of `src/components/mock/`, inside a
`MockScreen` (the frame) with `MockTouch` (the finger, the same everywhere).
It is drawn with the app's tokens and words, not photographed: it follows
the theme, dark mode and the language. Take an existing one as a model
(`MockCardSwipe.vue`, `MockZmanReminder.vue`):

- one loop of 5 to 8 seconds, in CSS (`@keyframes`), the finger appearing
  for each touch;
- the app's words through `t(...)`, never written in the drawing;
- under `prefers-reduced-motion`, no animation: the drawing stands still on
  its key moment;
- no gradient, no hard-coded color where a token exists (the bound volumes
  of a shelf aside, which are outside the theme in the app too).

Then name it in `HELP_ILLUSTRATIONS` (`catalog.ts`) and in
`HELP_ILLUSTRATION_COMPONENTS` (`illustrations.ts`).

## What to write next

The first guides cover what 4.0 moved and the gestures nobody guesses:
where the tabs went, the day card by card, the home page to your taste,
the prayer (the quiet modes, the time under its sky, marking a service
said, the compass of the Kotel), the reading gestures and the reading bar,
Mon parcours and the hours of the day, the times and their reminders,
reading chains and Nichmat 40. What the help center could hold next, by
part of the app:

- **The Sidour**: the search, the tefilin mirror, the 'hazara, the texts
  that change with the day.
- **Étude**: the library and its shelves, downloading for offline reading,
  « Mettre de côté » and the study table, one bookmark per book.
- **Reading**: the form of the page of the Talmud, the commentaries of a
  passage and their translation, the translation under the Hebrew, chnei
  mikra aliyah by aliyah.
- **Mon parcours**: a new goal step by step, catching up, the wall and the
  lights.
- **Times and calendar**: your own dates (a birthday, a leilouy nichmat),
  the date converter, Chabbat and the fasts.
- **Chiourim**: the player, a playlist, resuming a class.
- **Reading together**: creating a chain, the perpetual chain, entrusting a
  name.
- **Your settings**: why an account, themes and fonts, the higher contrast
  mode.
- **Versions**: each version that moves things gets its video
  (`WHATS_NEW_VERSION`, see `promo/README.md`), which takes the card at the
  top.

A video and a guide can go together: the guide explains in writing, the
video shows it in the app, and the video's `guide` field links them.
