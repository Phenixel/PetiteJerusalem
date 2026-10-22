# The help center

The help center (`/aide`) is where a reader comes to understand a part of
the app nobody explained to them. It holds three kinds of content:

- **the "what's new" video** of the current version, as a card at the top
  (the same video the app plays once after the update, see
  `docs/design.md`, "What's new plays once, after the update");
- **written guides**, one per thing to know, each with its drawn and
  animated screenshots;
- **tutorial videos**, filmed by the team and published on YouTube.

It is reached from the profile (the « Centre d'aide » row of the Help
group) and from the site's footer. In the app it also holds « Revoir
l'introduction » and « Revoir les astuces ». The design choices are in
`docs/design.md`, "The help center shows how, part by part".

| What                           | Where                                        |
| ------------------------------ | -------------------------------------------- |
| The guides and their topics    | `src/content/help/catalog.ts`                |
| The drawn screenshots          | `src/components/mock/`, named in `src/components/help/illustrations.ts` |
| The videos                     | `public/help/videos.json`                    |
| The pages                      | `src/views/Help/`                            |
| The words around them          | `help.*` in `src/locales/`                   |
| The checks                     | `src/__tests__/helpCenter.test.ts`, `helpCenterPages.test.ts` |

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
