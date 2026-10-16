# Native app (Capacitor): generating, building, testing

The iOS/Android app is the Vue website wrapped in a native
[Capacitor](https://capacitorjs.com/) shell, a decision made after the
July 2026 POC (smoothness validated on device, zero rewrite, vs Flutter).
Two architecture choices follow from it:

1. **Large corpora are not bundled** in the binary: the app stays light while
   the library grows, and texts are downloaded on demand (see below).
2. **The native projects (`android/`, `ios/`) are generated locally and
   git-ignored** (generated code, heavy, machine-dependent). Every native
   adjustment must be scripted in `scripts/setup-android.mjs` or
   `scripts/setup-ios.mjs` to stay reproducible; CI regenerates both from
   scratch on every release (see `docs/android-ci-cd.md` and
   `docs/ios-ci-cd.md`).

## Prerequisites

- Node 22 (already required by the project)
- **Android**: Android Studio + an installed Android SDK + JDK 21
- **iOS**: macOS + **Xcode 26** (required by Capacitor 8 and by the App Store
  since April 28, 2026). The build goes through Swift Package Manager, but the
  Capacitor CLI still requires CocoaPods to be installed for `cap add ios`
  (`sudo gem install cocoapods`).

## Getting started

```bash
# 1. Install the deps (Capacitor is already in package.json)
npm install

# 2. Generate the native projects (once)
npx cap add android
node scripts/setup-android.mjs   # reapplies the native adjustments (permissions, signing…)

npx cap add ios                  # macOS only
IOS_DEVELOPMENT_TEAM=XXXXXXXXXX node scripts/setup-ios.mjs

# 3. Build the web + sync to native, then open the IDE
npm run cap:android      # opens Android Studio
npm run cap:ios          # opens Xcode (macOS)
```

In Android Studio / Xcode: pick an emulator or your plugged-in phone, then
**Run**. The app starts on the Vue bundle (the same as the website).

> After every `git pull`: `npm install && npm run app:build` before
> rebuilding in the IDE; it is the included `cap sync` that pushes plugins
> and the web bundle into `android/`.

## Fast iteration (without rebuilding every time)

Rather than rebuilding + `cap copy` on every change, point the app at the dev
server. `capacitor.config.ts` builds its `server` block from the
`CAP_SERVER_URL` environment variable: nothing to edit in the file.

1. `npm run dev -- --host` (exposes Vite on the local network; the project
   uses port **5473**, not Vite's default 5173)
2. `CAP_SERVER_URL=http://<your-local-ip>:5473 npx cap sync`, then relaunch
   from the IDE. Web hot reload works.

Without the variable, `cap sync` falls back to the bundled build: there is
nothing to remove before a build meant for a store, `npm run app:build`
without `CAP_SERVER_URL` is enough.

## Scripts

| Script | Role |
|---|---|
| `npm run app:build` | web build + removal of the large corpora (`app:prune`) + removal of unused OAuth SDKs (`app:prune-spm`) + `cap sync` |
| `npm run cap:sync` | syncs web + plugins to the native projects |
| `npm run cap:android` | build + opens Android Studio |
| `npm run cap:ios` | build + opens Xcode |
| `npm run store:screenshots` | regenerates the screenshots for the Play Store and App Store listings, the same for both (see `store-assets/screenshots/README.md`) |

## A plugin never goes through a promise

A Capacitor plugin is not an object, it is a `Proxy`: **every** property
asked of it becomes a native call, including those not asked on purpose.
`then` is one of them, and that is what makes the rule necessary.

Passing it through a promise (returning it from an `async` function,
resolving it in a `.then`) is enough: the JavaScript engine reads `.then` on
the value to find out whether it holds a promise, the proxy returns a
function as for any property, and the engine calls
`Plugin.then(resolve, reject)`. Capacitor then looks for a native `then`
method, doesn't find it, and returns a rejected promise that nobody catches.
Since neither `resolve` nor `reject` has been called, **the await never
settles**: the surrounding `try` catches nothing, and everything that follows
is left hanging.

This is what killed the zmanim reminders in 3.10.0
(« `"LocalNotifications.then()"` is not implemented on android », reported as
an unhandled error).

So the rule is: **destructure the plugin on the spot**, in the function that
uses it.

```ts
// Yes: what goes through the promise is the module namespace.
const { LocalNotifications } = await import("@capacitor/local-notifications");
await LocalNotifications.checkPermissions();

// No: the promise resolves with the proxy.
async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}
```

So no shared helper to fetch a plugin, however tempting it is when three
functions in the same file need one. A safeguard enforces the rule for local
notifications (`src/__tests__/notificationPermission.test.ts`), with a decoy
that behaves like the real proxy, `then` included.

## Offline reading: on-demand download

- `npm run app:build` removes `dist/texts/{talmud,mishna,tanakh,rashi,tefila}`
  (~38 MB) and `dist/texts/manifest.json` (the app fetches it online, never
  from its bundle) from the native bundle via
  `scripts/prune-native-bundle.mjs`. The files listed in
  `src/datas/bundledTexts.json` remain bundled, to be readable without a
  network right from installation:
  - `authoritative`: `tehilim.json` (~370 KB) and `talmud-chapters.json`
    (~40 KB), read from the binary, which is authoritative for them;
  - `revalidated`: the Sidour, the three services and the four texts that
    go with them, and since the Sidour page, the thirteen brahot, Birkat
    Hamazon first (`tefila/`, ~1.1 MB): everything the Sidour page lists
    outside of holidays opens without a network. The holiday texts (Moadim)
    download on their own when their holiday rises to the top of the Sidour.
    The binary's copy opens right away, without waiting for anything from the
    network; in the background, the app asks the website whether it serves
    another version (a tefila fix doesn't wait for an app release) and
    downloads it, verified by its hash: that is the one that opens the next
    time, and sync keeps it up to date.

  A bundled book has neither a « Télécharger » ("Download") button nor a
  place in « Tout télécharger » ("Download all"). Tests:
  `src/__tests__/bundledTexts.test.ts` (reading order),
  `pruneNativeBundle.test.ts` (what the binary keeps).
- Books are downloaded from the library (a button on each card, « Tout
  télécharger » per corpus) or when offered by the daily reading (see below).
  Storage: `Directory.Data` on native (`@capacitor/file-transfer` +
  `@capacitor/filesystem`), Cache Storage on the web; index in
  `@capacitor/preferences` (`src/services/offlineTextStore.ts` and
  `offlineLibraryService.ts`).
- Android: the manifest declares `READ_EXTERNAL_STORAGE` and
  `WRITE_EXTERNAL_STORAGE`, capped at `maxSdkVersion="29"`. The files go into
  the app's private storage, which requires no permission, but
  `@capacitor/file-transfer` checks them before any transfer below Android 11
  and ships an empty manifest: if they are not declared, Capacitor throws
  « Missing the following permissions in AndroidManifest.xml » and not a
  single book downloads on Android 10. Beyond Android 10, the plugin no longer
  checks them, and the cap avoids asking for broad storage access on a recent
  device. Added by `scripts/setup-android.mjs` (the `android/` folder is
  regenerated on every release); test:
  `src/__tests__/androidStoragePermissions.test.ts`.
- Android 10 and below, the permission itself: the plugin **requests** it
  (system dialog) before every transfer, whatever the folder. Two
  consequences, enforced by
  `src/__tests__/androidStoragePermissionDenied.test.ts`:
  - a background update (checking the bundled Sidour, refreshing stale books
    at launch) only starts if the permission is already granted
    (`backgroundDownloadAllowed`, which reads it through `checkPermissions`
    without requesting anything); otherwise it waits, and the copy in place
    stays what is read. The dialog therefore only shows up after a download
    action. The Android version is read from the client hints
    (`userAgentData`), then from the webview's user agent: when reduced, the
    latter reports « Android 10; K » on every device, where the permission is
    never granted beyond SDK 29, and relying on it would cut off background
    updates on recent phones (`deviceAndroidMajor`). Beyond Android 10, or
    with an unknown version, nothing is checked;
  - a refusal (`OS-PLUG-FLTR-0006`) has its own message
    (`downloads.permissionDenied`, which says where to allow it) instead of
    « Vérifiez votre connexion » ("Check your connection").

  A permission-free path (native HTTP, then writing to `Directory.Data`) was
  ruled out: `CapacitorHttp` re-parses any `application/json` response on the
  native side, the bytes written would no longer be the website's, and the
  hash would never match (re-download on every sync). That would require a
  native download that asks for nothing, hence a native change.
- `textService.loadText` goes through `fetchTextResponse`: up-to-date
  downloaded copy first, then bundled copy (and for the Sidour, the background
  check described above), then network (`https://petite-jerusalem.fr`), then,
  if the network fails, the stale downloaded copy.

Check: download a book, turn on airplane mode, open it.

## Mon parcours offline

The **/parcours** pages are `offlineOk` in the native app, and work without
an account, like the daily reading, **/bibliotheque/lecture-du-jour**, back
on its own page (the day's texts one after the other). The details are in
`docs/parcours.md`.

- **Progress tracking** lives on the device (`localStorage`, key
  `pj-parcours`, mirrored in Capacitor's Preferences, which the system does
  not clear along with the webview storage): it is available from the first
  render, without network or account. With an account, every change goes to
  the `parcours/{uid}` document, entry by entry; a failed write stays pending
  and is retried when the network comes back, after reading the account
  again.
- **The texts**: those the user agreed to download. When texts of the day
  (a program's portion, a daily text, the psalms of the day, the week's
  paracha) are not on the device, Ma journée ("My day") says so and offers to
  download them (`components/parcours/OfflineTextsNotice.vue`). Nothing is
  downloaded without that consent: `refreshStaleDownloads` only brings files
  that are **already** downloaded up to the current format.
  A book deleted while this update is refreshing it stays deleted:
  `downloadFile` counts the deletions requested for its path, and one that
  happens along the way wins (copy removed, nothing recorded). The pass's
  next books, also removed in the meantime, are not refreshed: the loop
  checks that a book is still on the device before its turn. Tests:
  `offlineRemoveDuringDownload.test.ts`,
  `offlineRemoveDuringSync.test.ts`.

**Syncing readings.**

- **Bookmarks and reading positions are written after reading the
  account.** `readingProgressService` merges them with the account's on
  sign-in, and writes nothing to the account until it has read it: a read
  failure is not an empty account, and pushing the device's state alone
  would erase bookmarks set elsewhere. The local copy from the last visit is
  not the account either: the merge requires a real answer from the server
  (`userPreferencesService.getPreferencesFromServer`), neither our copy nor
  the Firestore cache. The next write retries the merge.
  Tests: `readingProgressSyncFailure.test.ts`,
  `preferencesFromServer.test.ts`.

Check: build a list, airplane mode, reopen the daily reading (the downloaded
texts show up, the others say they are not downloaded), check off a reading
(kept), try to add a text (refused), go back online (the list resyncs, the
check mark goes up).

## Native authentication (Google / Apple)

The Firebase JS SDK's popup/redirect OAuth flows don't work in a webview: the
app goes through `@capacitor-firebase/authentication`
(`src/services/authService.ts`), with the native Google account picker (with
a fallback if the Android Credential Manager is broken) and the system
« Sign in with Apple » sheet on iOS, then bridges the credential to the JS SDK
so that `onAuthStateChanged` keeps working as on the web.

Apple **requires** « Sign in with Apple » in the iOS app as soon as another
third-party login (here Google) is offered (App Store rule 4.8). The button
is **shown only on iOS**, invisible on the website and on Android.

The plugin's Package.swift bundles by default the SDKs of **all** its
providers, the full Facebook SDK included, about 15 MB of frameworks for a
button that doesn't exist in the app. `scripts/prune-spm-providers.mjs`
(rerun on every `app:build`, since npm install restores the original file)
removes Facebook from the iOS build; on Android the plugin only bundles it on
opt-in, which `setup-android.mjs` does not give. If a provider is ever added
to the app, update this script along with `capacitor.config.ts`.

**Non-code** steps to do once for iOS (detailed in
`docs/ios-release-plan.md`): enable the **Apple** provider in the Firebase
console, and check the **Sign in with Apple** capability on the Apple
Developer App ID. The *Service ID* and the *Sign in with Apple Key* are only
used by the web flow. On the Xcode project side, `scripts/setup-ios.mjs`
writes the entitlement.

## Push notifications

Implemented client-side (`src/services/pushService.ts`,
`@capacitor-firebase/messaging`: FCM token stored in
`userPreferences/{uid}.fcmTokens`, deep links on tap) and server-side
(scheduled Cloud Function `dailyReadingReminder`). On iOS, the APNs key must
be uploaded to the Firebase console and the Push Notifications capability
added in Xcode.

The function rereads the subscribed profiles every five minutes; it only
requests the fields it reads (`REMINDER_FIELDS`, `select` projection), not
the bookmarks or reading positions. A field that is read must be listed
there, otherwise it would be `undefined`: `dailyReminderFields.test.ts`
watches for this.

On iOS, `scripts/setup-ios.mjs` sets the `aps-environment` entitlement
(sandbox in Debug, production in Release), the `remote-notification`
background mode and the three APNs hooks in `AppDelegate.swift`; the APNs key
must be imported into the Firebase console (see `docs/ios-release-plan.md`).

Two reminders, set from the bell on the **Lecture du jour** ("Daily
reading") page and sent as long as the daily reading isn't finished: at the
chosen fixed time, and 20 minutes before chkia
(`pushSunsetReminderEnabled`). The second needs a location, since the Cloud
Function cannot query a sleeping phone: `pushReminderPlace` receives the
position rounded to a tenth of a degree (see `coarsePlace`) and the time
zone, both erased as soon as the reminder is turned off. Chkia is recomputed
server-side in `functions/src/sunsetReminder.ts`: `@hebcal/core`, which
provides it in the app, is published as ESM only, while `functions/`
compiles to CommonJS.

On sign-out, the device detaches from the departing account
(`pushService.detachDevice`): its token is removed from `fcmTokens`, without
touching `pushReminderEnabled` (the account's other devices keep their
reminders). Without this, the phone kept receiving the departed account's
reminders once someone else signed in. The write waits no more than three
seconds.

- Once removed from the account, the token stays on the device: it no longer
  leads to that account, and the team announcements are subscribed to it.
- If it remained in the document (offline, server silent), it is erased from
  the device, so that it no longer leads anywhere; the Cloud Function purges
  it on the first send. Erasing requires the network: without it, it is
  replayed when the network comes back and on the next launch
  (`dropStaleToken`), then the team announcements resubscribe with the new
  token.
- The device remembers the departed account (`pj_fcm_detached_from`). If it
  comes back, its reminders resume here, if they are still active and the
  system allows notifications (`reattachDevice`, on every sign-in and every
  launch until it is done); without this they stayed displayed as active
  without arriving on this phone anymore. Another account clears the marker:
  the device only registers for it if it turns on its reminders.

Enforced by `src/__tests__/pushDetachOnLogout.test.ts`.

## Zmanim reminders (local notifications)

Set from the **Horaires** ("Times") page, by tapping the desired time, or by
swiping its row to the left: a decisive swipe sets or removes the reminder
with the last delay used, a hesitant swipe opens the row on its bell (see
`docs/design.md`). They are counted and turned off from the
**Notifications** tab of the profile, which also hosts the reminder for the
start of **Chabbat and holidays**, on by default, one hour before candle
lighting.

Nothing goes through a server, unlike the reading reminder: a time is
computed on the device, so the notification is scheduled on the device too
(`@capacitor/local-notifications`). No location is entrusted to anyone, and
the phone rings at the stated time even without a network.

A zman has no fixed time: a notification "every day at 6:13" would be wrong
by the next day. `src/services/zmanReminderService.ts` therefore schedules a
series of exact instants, each computed for its own day, and redoes the
scheduling every time the app returns to the foreground, when the location
changes and when the language changes. The window is shared among the set
reminders, since iOS only keeps 64 pending notifications per app: from two
to fourteen days depending on their number. The identifiers live in a
reserved range, so that only ours are cancelled and the app's other
notifications stay in place.

The settings stay on the device (`localStorage`, see
`src/composables/useZmanReminders.ts`) and are not uploaded to the account:
it is the phone that will ring the reminder, based on the location chosen on
that very phone.

- **Android**: `scripts/setup-android.mjs` adds `SCHEDULE_EXACT_ALARM`.
  Without it, the system holds the notification until its next maintenance
  window, and a ten-minutes-before reminder can arrive after the time it
  announces; the settings page then offers to open the system setting
  (`changeExactNotificationSetting`). The reminders have their own channel
  (`pj-zmanim`), so they can be turned off separately from the reading
  reminders.
- **iOS**: nothing more to declare, it is the notification permission
  already requested for push.

The permission is requested on the first action that needs it, never at
launch: setting a reminder, turning on the Chabbat one, or opening the times
page while the Chabbat one is on by default.

## Personal calendar dates

A birthday, a leilouy nichmat: dates in the **Hebrew** calendar, which come
back every year on their day. They are set from the **Calendrier**
("Calendar") page (the « Mes dates », "My dates", button), are shown there
among the year's holidays, and carry their own reminder, scheduled like the
zmanim reminders (`zmanReminderService`).

Two calendar particularities are settled in
`src/services/hebrewOccasions.ts`, rather than in each screen:

- an **Adar** date comes back in **Adar II** in thirteen-month years, the
  Sephardic custom followed by the rest of the site;
- the **30th** of a month that only has 29 days ('Hechvan, Kislev depending
  on the year) comes back on the 29th, the last day of the month.

Three reminder times, because the Hebrew day starts the evening before: at
the start of the day (at sunset at the location, the time to light a
candle), the morning of the civil day, or one week before. The last two go
off at 9 am in the **device's** time zone, where the person receiving them
lives, and not in that of the zmanim location.

The start of the day yields to Chabbat and holidays (`occasionEntryAt`): a
date that falls on a Saturday is reminded at Friday's candle lighting (at
sunset, Chabbat has already begun); a date that follows a Chabbat, at its
end; a date in the middle of a holiday, at that day's candle lighting. The
day before is taken from the location's calendar, whatever the device's
time zone. Enforced by `src/__tests__/occasionEntry.test.ts`.

A date coming up within seven days also appears on the **home page**
(`OccasionsBanner.vue`, loaded on demand like the other "right now" cards:
it pulls in the Hebrew calendar, which has no business in the first render).

The dates live in `localStorage` (`src/composables/useHebrewOccasions.ts`)
AND in the account (`userPreferences.hebrewOccasions`), and these are two
distinct roles: the device is the foundation, read synchronously, which
works without an account and without a network and which
`zmanReminderService` follows; the account carries them from one device to
another and all the way to the website. A date entered on a phone therefore
shows up in a browser, as the screen that holds them states.

Adoption happens only once per account and per device: on the first
sign-in, what was entered without an account joins the account (union of
both lists, `mergeOccasions`); after that the account is authoritative and
replaces the local copy, otherwise a date deleted elsewhere would be revived
on every sign-in. A write refused by the network is held and retried when
the connection comes back. The website therefore carries the dates like the
app; only the **reminder** remains the phone's business, and its setting
doesn't appear in a browser.

## Settings kept on the device

A webview's `localStorage` is not durable: the system can clear it under
memory pressure, and the user when clearing the app's cache. A comfort
setting lost on the next launch is a small thing, but it is annoying.

So these settings all go through `services/devicePreference`: it writes to
both storages, `localStorage` for the synchronous read of the first render
and the native preferences for durability, and reads the native one again
when the former has nothing to say.

The **text size** of the reading pages (A− / A+ and pinch, `useReadingSize`)
is therefore written twice: in `localStorage`, the only one readable
synchronously, hence from the first render; and in the native preferences
(`@capacitor/preferences`: SharedPreferences on Android, UserDefaults on
iOS), which survive and serve as a safety net, read again on the setting's
first use. It is not uploaded to the account: a phone held at arm's length
and a computer don't call for the same size.

The **opinion followed for zmanim** (`useZmanimOpinion`) is written the same
way, for the same reason: the zmanim are computed at first render, and a
setting that only arrived afterward would make every time on the page jump
before the user's eyes. The difference is that it IS uploaded to the
account: the opinion one follows doesn't depend on the device in hand. The
account wins when it carries one; otherwise the device decides.

Changing the opinion reschedules the zmanim reminders: they are set on
computed instants, and those instants have just moved (see
`zmanReminderService`). Changing the candle-lighting offset does too: the
start of Chabbat and holidays, and its reminder one hour before, are based on
it (test: `zmanReminderCandleLighting.test.ts`).

The **tips already seen** (`useFeatureTips`, key `pj_tips_seen`) as well: a
tip that came back after every cache clear would end up being annoying, and
« Revoir les astuces » ("See the tips again", app profile, Help group) is
there for whoever wants it. They are not uploaded to the account: it is on
that particular screen that the gesture was seen.

The **auto-scroll switch** (`useAutoScroll`) follows the same rule, for an
even stronger reason: it is turned off precisely so as not to be surprised
anymore by a gesture triggered unintentionally. If it came back on at the
next launch because the system cleared `localStorage`, the setting would
have been useless. It is not uploaded to the account: it is the touchscreen
that causes the problem, not the person.

## Geolocation (daily zmanim)

The **Horaires** page computes the zmanim for the device's position when the
user shares it (falling back to Paris otherwise). Nothing leaves the device:
the computation is local, the coordinates stay in `localStorage`.

- **Android**: `scripts/setup-android.mjs` adds `ACCESS_COARSE_LOCATION` and
  `ACCESS_FINE_LOCATION` to the manifest. This is essential: the manifest
  shipped by `@capacitor/geolocation` is **empty**, so without these lines
  `requestPermissions()` is refused outright and the page stays on Paris.
- **iOS**: `scripts/setup-ios.mjs` adds `NSLocationWhenInUseUsageDescription`
  to `ios/App/App/Info.plist`. This is essential: without this key, iOS
  **closes the app** on the first location request.

## Haptic feedback

The phone responds to the finger when a task is done, undone, or when a
gesture crosses its threshold (`src/services/haptics.ts`, vocabulary in
`docs/design.md`, "Touch answers"). The `@capacitor/haptics` plugin
itself declares the `VIBRATE` permission on Android (a normal permission,
nothing to request); on iOS, it goes through the system's feedback
generators, which follow the device's « Retours haptiques » ("Haptic
feedback") setting. The plugin is loaded on demand and destructured on the
spot (see above). On the website, `navigator.vibrate` takes over where it
exists.

## Back navigation

Each platform has its own gesture, and the app must wire both.

- **Android**: the system back button (or gesture). Without the
  `backButton` listener in `src/main.ts`, it **exits the app** instead of
  going back in the navigation; on the home page, it sends the app to the
  background, like any Android app.
- **iOS**: the swipe from the left edge of the screen. It is handled by the
  WebView, on its own history, the one the router feeds. Two settings
  condition it, and nothing happens if either is missing:
  - `allowsBackForwardNavigationGestures` on the WKWebView, which
    `scripts/setup-ios.mjs` sets in the `AppDelegate` (WKWebView disables it
    by default, and Capacitor exposes no configuration option);
  - `overscroll-behavior` left free on the horizontal axis
    (`src/assets/main.css`). The rule that neutralizes Android's vertical
    stretch applies to both axes if it isn't suffixed, and WebKit reads the
    horizontal one as an order to disable swipe navigation.

A test enforces all three points
(`src/__tests__/nativeBackNavigation.test.ts`).

## Home screen widgets

Two widgets (Times, Daily reading) come with the app: the app precomputes
their content and pushes it to native through the in-house PjWidgets plugin.
Both platforms are scripted, `native/android/` + `setup-android.mjs` on one
side, `native/ios/` + `setup-ios.mjs` on the other, which writes all the way
to the extension target in the Xcode project. Only the App Group requires
three clicks in the Apple portal, once and for all; see
`docs/app-widgets.md`.

## Smartwatches

A watch app comes with the app on both platforms (Wear OS and Apple Watch):
the zmanim, the daily reading, and the Tehilim, which it bundles so they can
be read without a phone within reach. Same architecture as the widgets, and
the same payloads: the phone computes, the watch displays. Only the
transport changes (Data Layer on one side, WatchConnectivity on the other),
behind the in-house PjWatch plugin. Both platforms are scripted end to end,
signing and publishing included; see `docs/app-watch.md`.

## Kotel compass accuracy

Chrome gives the page the heading, never its accuracy, and neither does the
Android webview. The in-house PjCompass plugin
(`native/android/app/src/main/java/fr/petitejerusalem/app/PjCompassPlugin.java`)
listens to the magnetometer while the compass is open and reports its
calibration status (`SensorManager`: 3 high, 2 medium, 1 low, 0 unreliable),
the same one that makes Google Maps say it needs calibrating. It turns off
when the app goes to the background and resumes when it returns.
`scripts/setup-android.mjs` copies it along with the widgets and registers it
in `MainActivity`. On the page side, `src/services/nativeCompassAccuracy.ts`:
nothing outside the Android app, and nothing either on a binary older than
the plugin (the accuracy then stays "unknown", the compass still works). iOS
doesn't need it: Safari gives the accuracy with the heading
(`webkitCompassAccuracy`). See `docs/design.md`, « La boussole se demande en
l'ouvrant, dit sa précision, et se tient à plat ».

## Icons that follow the device theme

Both systems can adapt an app's icon to the phone's theme, provided they are
given the variants; otherwise they leave the color icon as is.

| Variant | Where it is used |
|---|---|
| light | the original icon, the stores, the launch screen |
| dark | iOS 18 dark mode |
| tinted | iOS 18, tinted by the color chosen for the home screen |
| monochrome | Android 13+ themed icons, tinted by the wallpaper |
| notification | small icon of every Android notification, tinted by the system |

That is why black and white is necessary: the tinted and monochrome variants
are read as intensities, not as images. The system applies the color; the
app only provides the shape.

Everything comes from a single source, `scripts/lib/app-icon.mjs`, where the
drawing is written as vectors: the variants only change its palette and
framing. The light variant's framing reproduces pixel for pixel the icon
already published on the stores, and a test enforces it.

The PNGs in `assets/themed/` are versioned, and they are what goes into the
native projects: `setup-android.mjs` and `setup-ios.mjs` simply copy them, so
a CI runner never needs a browser to build the app. Rasterization, however,
does not live in the repository: the day the drawing changes, the files must
be produced separately, with the names and sizes the setup scripts expect,
then replaced in `assets/`.

Two constraints are worth knowing before touching up the drawing:

- Android masks the icon. The canvas is 108 dp but the launcher may eat
  everything outside the central 66 dp, and its mask is round as often as
  square. The drawing is therefore inscribed in its circle, not in its
  rectangle.
- A silhouette has lost its colors, and therefore its separations. The wall
  and the book would touch and the icon would be nothing but a blob: it is
  the hollows of the mask (stone joints, page lines, top edge of the book)
  that keep it legible.

### Small notification icon

Android only displays the opacity of a notification's small icon. With no
declared icon, each source fell back on its own: the launcher icon reduced
to a dot for push notifications received while the app is closed, the
system's generic "i" for local notifications (zmanim reminders, Chabbat
reminder, push notifications replayed in the foreground).

All of them now use `ic_stat_pj`, the icon's silhouette framed for 24 dp.
Its PNGs are versioned in `native/android/app/src/main/res/drawable-*`
(copied by `setup-android.mjs` with the widgets) and are rasterized like the
others, from the `notification` variant of `scripts/lib/app-icon.mjs`, at
sizes 24, 36, 48, 72 and 96 px (from mdpi to xxxhdpi). Two declarations wire
it up:

- `capacitor.config.ts`, `LocalNotifications.smallIcon`: all local
  notifications;
- the manifest, Firebase's `default_notification_icon` meta-data (set by
  `setup-android.mjs`): push notifications displayed by the system while the
  app is closed.

The shade's tint is the gold of the icon's stones (`#C79A3B`), declared in
both places.

The class playback notification (below) uses the same silhouette, through a
resource that replaces the plugin's.

## Listening to classes in the background

A class plays like music: it keeps going with the screen off or the app
closed, shows up in Android's notification (and the quick settings media
player card, the lock screen) as on iOS's lock screen and Control Center,
and can be controlled there without reopening the app (play, pause, back 15
seconds, forward 30, previous and next class in the queue, position). The
player (`useAudioPlayer`) publishes what is playing to
`src/services/mediaSession.ts`, which passes it on to the system:

- **website**: the browser's Media Session API, as before;
- **Android**: the webview does nothing with it.
  `@capgo/capacitor-media-session` holds a real native media session, in a
  `mediaPlayback` foreground service that also keeps playback alive. It is
  the playback state that opens and closes the notification: « playing » or
  « paused » shows it, « none » (the player closed, or « Arrêter », "Stop", in
  the notification) removes it;
- **iOS**: the plugin deliberately goes back through the WKWebView's Media
  Session API, which the system relays to the lock screen. This requires the
  `audio` background mode, without which iOS cuts the sound as soon as the
  app goes to the background.

What native requires, and what the scripts set:

- `setup-android.mjs` declares `FOREGROUND_SERVICE_MEDIA_PLAYBACK`: the
  plugin only declares `FOREGROUND_SERVICE`, and since Android 14 starting
  its service without the other throws a `SecurityException`; the app would
  close on the first playback;
- `native/android/` replaces two of the plugin's icons with resources of the
  same name: `ic_baseline_volume_up_24` (the small icon: `ic_stat_pj` instead
  of a generic speaker) and `ic_baseline_replay_30_24` (the "back" button,
  without the "30" that would be a lie);
- `setup-ios.mjs` adds `audio` to `UIBackgroundModes`, including in an
  Info.plist that already had the key.

`src/__tests__/mediaSessionAndroid.test.ts` enforces these three points;
`src/__tests__/mediaSessionNative.test.ts` enforces the dialogue with the
plugin (what is sent, the commands received, the notification removed on
close and not reopened by the pause that follows).

The artwork displayed by the system is the app's, drawn as an image
(`components/chiourim/coverArtwork.ts`): the app's covers are CSS, the
system wants an image.

Two limitations, specific to the plugin: the notification channel is called
« Playback » in Android's settings, and the notification text is
« artiste - album » ("artist - album", here « le rav · la série - Petite
Jérusalem », "the rav · the series - Petite Jérusalem").

To check on a device before every release that touches the player: start a
class, lock the screen, control it from the notification (or the lock
screen), skip to the next one, close the player and watch the notification
go away.

## Website links that open the app

A link to `petite-jerusalem.fr` (a shared session received by message, for
example) opens the app when it is installed, and the browser otherwise. The
domain and the app recognize each other through a file served by the website
(`/.well-known/`); the paths concerned fit in a single list
(`scripts/lib/app-links.mjs`) shared by both platforms and a test. See
`docs/app-links.md`, in particular the two signing values to provide.

## « Mise à jour disponible » ("Update available") banner

An installed app can stay months behind (automatic updates turned off): the
fixes never reach it. At launch, then every time the app returns to the
foreground, at most once every 6 hours, `src/services/appUpdateService.ts`
asks the platform's store whether an update is available, and shows a
dismissable banner at the top of the app, with a link to the store listing
(`components/AppUpdateBanner.vue`). A dismissal holds until the next
version.

The source, on both platforms, is the store itself, never the release tag: a
release can wait days for Apple's or Google's review, and announcing the
update during that window would send people to a listing that doesn't offer
it yet.

- **Android**: the Play Store In-App Updates API
  (`@capawesome/capacitor-app-update`), the store's answer for the device
  itself: Google review passed, propagation done, staged rollout included.
- **iOS**: `itunes.apple.com/lookup?bundleId=…`, the App Store's public API,
  which is authoritative. As long as the app isn't published there, the
  lookup returns no result and the banner never appears on iOS.

`app-version.json`, the former Android source (the `appVersionManifest`
plugin in `vite.config.ts`), announced the version as soon as the website
went live, hence during the whole Google review: the banner redirected to a
Play listing that didn't offer the update yet. The website keeps publishing
the file for already-installed versions that still read it.

Any failure (offline, store unreachable, build not coming from the store)
simply leaves the banner hidden, never a false positive.

## Publishing

A `vX.Y.Z` tag publishes everything at once:

| Workflow | Target | Result |
|---|---|---|
| `deploy.yml` | website | `petite-jerusalem.fr` goes live |
| `deploy-android.yml` | Play Store | signed AAB + listing + release notes, published (`docs/android-ci-cd.md`) |
| `deploy-ios.yml` | App Store | signed IPA sent to **TestFlight** + listing (`docs/ios-ci-cd.md`) |

On iOS, the tag uploads the binary, submits the version for review and
releases it as soon as Apple approves, without a click in App Store Connect.
The only remaining delay is the review, from a few hours to a few days. The
full path (Apple Developer account, consoles, first build, submission) is
described in `docs/ios-release-plan.md`.
