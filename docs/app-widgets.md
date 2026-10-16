# Home screen widgets (Android / iOS)

Eight widgets accompany the native app, the same on Android and on iOS.
Three large ones:

- **Times**: the Hebrew date, the next zman for the user's location (in the
  accent of their theme, like the « prochain horaire » ("next time") card on
  the page), the ones after it, the paracha of the coming Shabbat and
  ta'hanoun (in bold on days when it is not said), updated each time a zman
  passes. Tapping the widget opens the `/horaires` page.

  Around holidays, two things change:

  - **the holiday takes the paracha's line**, in large type (1.6 times the
    line's size), in bold and in the accent color: « Soukkot » on the day
    itself, « 'Hol haMoed Soukkot » during the intermediate days, « Soukkot
    ce samedi » ("Soukkot this Saturday") when it falls between now and
    Shabbat. A holiday week does not announce a paracha: its Shabbat has
    none, and the widget does not anticipate the following one the way the
    chnei mikra does;
  - **the start of Shabbat or of a holiday comes first**: the day before,
    from dawn (`featuredFrom`), it takes the place of the next time until
    its hour, labeled « Entrée de Chabbat » ("Start of Shabbat") or « Entrée
    de Chabbat et Soukkot ». It is the time people come looking for all day
    Friday.

  Both fields are optional (`festival`, `featuredFrom`, `v` stays 2): an
  older binary ignores them, keeps the paracha and files the start among the
  times, at its place in time.
- **Essential times**: the four times people come to check most often, and
  nothing else: end of Shema and end of the Amida (according to the Vilna
  Gaon, the latest opinion, the one that sets the limit), plag haMin'ha,
  tsét haKokhavim. It is a table of the day, not an announcement: its four
  lines only roll over at chkia, and the Shema limit stays displayed once
  past, since it is today's time for it that people come to read.
- **Daily reading**: one line, title, « 2 sur 3 lus aujourd'hui » ("2 of 3
  read today"), percentage and progress bar, reset at midnight. It shows the
  day's texts and the readings from the Mon parcours calendar, as the device
  holds them, with or without an account (`widgetService`, through
  `legacyProjection`). Tapping the widget opens
  `/bibliotheque/lecture-du-jour`, which leads to the home page and its
  daily stack: the address is baked into widgets already installed.

On top of these come five **shortcuts**, at the smallest size the home
screen offers, each of which opens a single page:

| Shortcut | Opens | What it shows |
|---|---|---|
| Library | `/bibliotheque` | a shelf of bound volumes; in medium size, the four books carry their titles |
| Sidour | `/bibliotheque/sidour` (redirected to `/sidour`) | the sidour book, title on the cover |
| Tehilim | `/bibliotheque/tehilim` | the Tehilim book, likewise |
| Next time | `/horaires` | the time of the next zman, in large type, and its name below |
| Reading progress | `/bibliotheque/lecture-du-jour` | a ring that fills up as checks are made, and its percentage |

The books reproduce the drawing of `src/components/LibraryShelf.vue`, stroke
for stroke: warm binding, spine fold, ivory page edges, embossed frame and
serif title. As in the app, they are **outside the user's theme** and
identical in dark mode: they are objects, not interface.

Everything else carries the accent of the theme chosen by the user: it
travels in the payload, the native side knows no theme color.

The watch apps (Wear OS and Apple Watch) follow the architecture described
below and reuse the same two payloads, `zmanim` and `daily`, as is: see
`docs/app-watch.md`.

## The sizes, and what they impose

On iOS, a home screen widget only has the system's sizes, and the medium
size is exactly as **tall** as the small one, only twice as wide: there is
no equivalent to Android's 4×1. What a medium size has in excess is width,
never height, and a layout that forgets this overflows its frame (the
following times were moved next to the highlighted time for this reason).

The three widgets also support the **lock screen** (and StandBy), since iOS
16, as `accessoryRectangular`. There, everything changes: 72 pt tall instead
of 164, no background of our own (the system sets its own), and the
"vibrant" rendering washes out colors, the theme accent included. Each
widget therefore has a separate, stripped-down layout there, which makes
color carry no meaning: the rule also applies to the green of "everything is
read", which does not survive there.

On Android, the launcher's sizes decide, and the user can change them at
any time. The provider therefore receives the dimensions of EACH instance
(`onUpdate`, then `onAppWidgetOptionsChanged` on resize) and picks its
layout the way iOS picks by family: from four columns (220 dp), it is the
medium-size layout, with the column of following times or the fourth book;
below that, the small one's. The "Horaires" ("Times") widget has two
templates for this, `widget_horaires.xml` and `widget_horaires_medium.xml`,
which carry **the same identifiers**: the provider fills them with the same
code.

The lock screen, for its part, remains specific to iOS: Android does not
open it to third-party apps.

What RemoteViews cannot compose is drawn into a bitmap by `WidgetGraphics`
(the progress bar and ring, which it cannot tint with a color coming from
the payload, and the shelf, with its gradients, its rules and its title
written on the cover), then stretched by the ImageView. The books there
reuse the coordinates of the original SVG, in its 96 by 140 box, as
`ShelfBookView` does in SwiftUI: the same drawing, three times.

## Architecture: the app computes, the native side displays

A native widget cannot run the webview's code (hebcal, i18n, Firestore).
The app therefore precomputes **everything** the widgets display and pushes
it to them as JSON:

```
webview (Vue)                        native
─────────────                        ──────
widgetService.refresh()
  └─ widgetPayloads.ts        ──►    plugin PjWidgets
     (7 days of times,                ├─ Android: SharedPreferences "pj_widgets"
      daily reading,                  │  + broadcast to the providers
      library titles,                 └─ iOS: App Group + WidgetKit reload
      localized labels)
```

Three keys travel: `zmanim`, `daily` and `library`. The last one only
carries titles (« Bibliothèque », « Sidour », « Tehilim »…): they only change
with the language, but they still cannot be hard-coded on the native side,
since « Sidour » is "Siddur" in English and « סידור » in Hebrew. Both
platforms read the three keys, and each only redraws the widgets whose
payload has changed.

- **Contract**: `src/services/widgetPayloads.ts` (`v` field for
  incompatible changes). Everything displayed comes from the payload,
  already localized AND already formatted, times included
  (`time: "17:42"`, Hebrew date, ta'hanoun label, `expiresAt` for the
  midnight expiry): the native side translates nothing, formats nothing, and
  only compares epochs. The markers that change at chkia (Hebrew date,
  paracha, ta'hanoun) are delivered day by day in `days`, each bounded by
  the chkiot that open and close it: the widget picks the one covering the
  displayed instant, and stays correct for a week without the app being
  reopened. Native DateFormatters would be subject to the device's 12 h/24 h
  setting and calendar (Hebrew for part of the audience), which would skew
  the display. The only exception: the launcher's widget picker and the "no
  payload" state (before the first launch), carried by native resources.
  Two values escape the "already formatted" rule, since they cannot be
  computed in advance: the numbers in the progress line, which depend on
  what time it will be (`progressTemplate` is sent with its
  `{done}`/`{total}` intact, like the times' `then`), and the theme accent
  (`accent`), a color and not a text.
- **Refreshed** at launch, on return to the foreground, on sign-in/sign-out,
  on a change of location for the times, of followed opinion or of
  candle-lighting offset, on a language change, on a theme change, and at
  every progress of the daily reading (`src/services/widgetService.ts`).
  The times are only recomputed if their key changes: it therefore carries
  everything they depend on, opinion and candle-lighting offset included
  (test: `widgetZmanimSettings.test.ts`). An unchanged payload is not
  resent, and the native side only reloads the widget whose payload has
  changed (the WidgetKit refresh budget is not extensible); the Daily
  reading page supplies its preferences from memory to avoid a Firestore
  reread.
- **Between two openings of the app**, the native side lives on its
  reserves: a week of times is embedded (the widget reschedules itself for
  the next zman), and the reading payload carries its expiry (past
  `expiresAt`, the checks no longer count). Window exhausted → the widget
  invites the user to reopen the app and stops rescheduling itself until
  the next payload.
- **Deep links**: the widgets open the app with a site URL; the
  `appUrlOpen` listener in `src/main.ts` ONLY routes URLs from
  `petite-jerusalem.fr` (a native OAuth callback or a third-party intent
  must not navigate) and waits for `router.isReady()` to survive a cold
  start.
- **Special case**: a user whose only reading is the paracha (weekly chnei
  mikra) is indeed "configured"; the paracha then becomes the reading, and
  it is its weekly progress that fills the bar.

## Android: automatic

The native code is versioned in `native/android/` (Java providers, layouts,
day/night colors) and copied into `android/` (git-ignored, regenerated by
the CI) by `scripts/setup-android.mjs`, which also declares one receiver per
widget in the manifest (`WIDGET_RECEIVERS` list) and registers the plugin
in MainActivity. Nothing more to do:

```bash
npx cap add android          # if android/ does not exist yet
node scripts/setup-android.mjs
npm run cap:android
```

Testing: build on a device, add the widgets from the launcher's picker,
open the app once (it pushes the payloads), check that the Times widget
switches when a zman passes and that « marquer comme lu » ("mark as read")
updates the Reading widget. Widening a widget to four columns must switch
it to the medium-size layout, without re-adding it.

## iOS: automatic too, except three clicks at Apple

The `ios/` project is generated (`npx cap add ios`) and not versioned. For a
long time the extension target was created there **by hand in Xcode**: it
therefore did not survive any `cap add ios`, and the CI builds went to the
App Store without a single widget, without any warning. That is the reason,
and the only one, why the widgets did not exist on iPhone.

`scripts/setup-ios.mjs` now writes the target itself, via
`scripts/lib/xcode-widgets.mjs` (a pure text transformation, tested without
macOS in `src/__tests__/xcodeWidgets.test.ts`):

| File in `native/ios/` | Destination | Role |
|---|---|---|
| `App/PjWidgetsPlugin.swift` | App target | receives the payloads, writes the App Group, reloads WidgetKit |
| `App/PjViewController.swift` | App target | registers the plugin (required since Capacitor 5) |
| `PjWidgets/PjWidgets.swift` | PjWidgets target | the eight SwiftUI widgets and their timelines |

The script also sets up the extension's `Info.plist` (WidgetKit extension
point, versions aligned with the app's), its entitlements (the App Group),
the App Group on the App target, the `PjViewController` class in
`Main.storyboard`, and the `petitejerusalem` URL scheme for deep links,
alongside Google's `REVERSED_CLIENT_ID` (in the **same**
`CFBundleURLTypes` array, the key being unique).

> **The storyboard's `customModule` is not decorative.** A Swift class has
> no bare name in the Objective-C runtime: writing
> `customClass="PjViewController"` without `customModule="App"` or
> `customModuleProvider="target"` makes UIKit look for a class it cannot
> find. It then instantiates an empty `UIViewController`, and the app
> launches on a **black screen**, without a webview, without a bridge, and
> therefore without plugins and without a single payload for the widgets.
> Nothing fails: not the build, not the archive, not the logs.
> `registerViewController` (in `scripts/lib/xcode-widgets.mjs`) sets all
> three attributes, and `src/__tests__/xcodeWidgets.test.ts` checks it.

```bash
npx cap add ios              # if ios/ does not exist yet
node scripts/setup-ios.mjs
npm run cap:ios
```

**The only thing left to do by hand**, once and for all: the App Group on
Apple's side. The App Store Connect API can enable the `APP_GROUPS`
capability, but can neither create a group nor attach it to an App ID. On
developer.apple.com → Certificates, Identifiers & Profiles:

1. Identifiers → **App Groups** → + → identifier `group.fr.petitejerusalem.app`;
2. Identifiers → `fr.petitejerusalem.app` → App Groups → Configure → check the group;
3. Identifiers → `fr.petitejerusalem.app.PjWidgets` → App Groups → Configure → same.

The extension's App ID is created by `scripts/ios-signing.mjs` on the first
CI run; locally, Xcode takes care of it at the first signing. The script
then rereads the profiles and refuses to continue if the App Group is not
in them (`docs/ios-ci-cd.md`).

Testing: run the app on a device, add the widgets, then check the next zman
and the progress as on Android.

### Reviewing the rendering on the simulator

The simulator is perfectly suited for a visual pass, under two conditions
that cannot be guessed:

1. **The entitlements.** A command-line `xcodebuild -sdk iphonesimulator`
   embeds no entitlements: the App Group therefore does not exist, and the
   widgets stay on "open the app" whatever is pushed. You must re-sign the
   app AND its `.appex` by hand before installing:

   ```bash
   codesign --force --sign - --entitlements ios/App/PjWidgets/PjWidgets.entitlements \
     Build/Products/Debug-iphonesimulator/App.app/PlugIns/PjWidgets.appex
   codesign --force --sign - --entitlements ios/App/App/App.entitlements \
     Build/Products/Debug-iphonesimulator/App.app
   ```

   `xcrun simctl get_app_container booted fr.petitejerusalem.app groups`
   must then return a path; as long as it returns nothing, nothing will
   work.

2. **The reload.** Writing a payload into the App Group's plist is not
   enough: the entry already archived by WidgetKit carries its copy of the
   payload, and killing `chronod` only redraws it. Only reinstalling the app
   (`xcrun simctl install`) invalidates the timelines. Write the payload
   **then** reinstall, in that order.

The rest is driven from the command line: `xcrun simctl io booted screenshot`
to look, `xcrun simctl ui booted appearance dark|light` for the other mode.
Adding a widget, on the other hand, cannot be automated: it is the only
gesture left to do by hand.

## Evolution

- Any new data displayed by a widget goes through the payload
  (`widgetPayloads.ts`), never any business logic on the native side.
- Field removed or renamed: increment `v` and have the native side read both
  versions for one release (payloads persist on the device).
- The contract tests live in `src/__tests__/widgetPayloads.test.ts`.
- A widget added on only one side breaks nothing: it is simply missing for
  half the audience, and nobody sees it before installing the app. Two tests
  guard parity, `src/__tests__/widgetParity.test.ts` (both platforms offer
  the same widgets, under the same names, wired end to end) and
  `src/__tests__/widgetDeepLinks.test.ts` (they lead to the same pages). One
  more widget therefore means: the SwiftUI and its entry in the
  `WidgetBundle`, the Java provider, its template, its `appwidget-provider`
  file, its two strings, and its line in `WIDGET_RECEIVERS`.
