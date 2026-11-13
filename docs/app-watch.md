# Smartwatches (Wear OS / Apple Watch)

A watch app accompanies the phone app, on both platforms. Three screens, the
same on both sides:

- **Times**: the Hebrew date, the location, the next zman in large type (in
  the accent of the user's theme), the following ones, the paracha of the
  week and ta'hanoun. It is what the home screen widget shows, expanded.
- **Daily reading**: the day's progress (« 2 sur 3 lus aujourd'hui », "2 of
  3 read today", the bar in the accent color) and the readings that make it
  up, checked or not, plus the chnei mikra paracha, not counted. **Read
  only**, see below.
- **Texts**: the 150 Tehilim, the day's ones first. Bundled in the watch
  app, so readable without the phone nearby.

The watch's home screen already shows the next time, in large type: it is
what you raise your wrist for, it does not require opening one more screen.

On Wear OS there are also two **watch face complications**, which do not
even require opening the app: « Prochain horaire » ("Next time": the time,
and the zman's name as the title) and « Lecture du jour » ("Daily reading":
the progress, as a ring or as "2/3"). They do not have a watchOS counterpart
yet: a watchOS complication is one more WidgetKit extension in the Xcode
project, to be written into the pbxproj like the two existing targets.

## Architecture: the phone computes, the watch displays

It is that of the home screen widgets, to the letter, and for the same
reason: a watch app cannot run the webview's code (hebcal, i18n, Firestore).
The phone therefore precomputes **everything** that is displayed and pushes
it as JSON.

```
webview (Vue)                     native phone                 watch
─────────────                     ────────────                 ─────
widgetService.push()
  ├─ widgetPayloads.ts   ──►  plugin PjWidgets   ──► home screen widgets
  └─ watchPayloads.ts    ──►  plugin PjWatch     ──► Data Layer (Wear OS)
                                                 └─► WatchConnectivity (watchOS)
```

**One producer, two recipients.** `widgetService` computes the payloads once
and offers them to both; each remembers what it has already received and is
only handed what has changed (`src/services/payloadSink.ts`). A widget
reloaded for nothing costs WidgetKit budget; a byte sent to the watch for
nothing costs battery on both devices. A recipient's memory is only updated
after a successful send: a failure on one side (old binary, unreachable
watch) does not block the other and will be retried on the next pass.

Three keys travel to the watch:

| Key | Contract | What it carries |
|---|---|---|
| `zmanim` | `src/services/widgetPayloads.ts` | a week of times and Hebrew days, the same payload as the Times widget |
| `daily` | `src/services/widgetPayloads.ts` | the daily reading and its expiry, the same payload as the Reading widget |
| `watch` | `src/services/watchPayloads.ts` | the labels of the watch screens, and the day's psalms |

The first two are reused **as is**: they are already exactly what a watch
screen needs, already localized and already formatted, times included.
Computing them differently would only mean two contracts to maintain instead
of one. The native side translates nothing, formats nothing, and only
compares epochs; native date formatters would be subject to the device's
12 h/24 h setting and calendar (Hebrew for part of the audience), which
would skew the display.

The only exception, on both sides: the "nothing received" state (watch set
up before the app was first launched on the phone) and the names of the
complications in their picker, carried by native resources.

## The transport, and why this one

| | Wear OS | watchOS |
|---|---|---|
| Primitive | Data Layer, `DataClient.putDataItem` | WatchConnectivity, `updateApplicationContext` |
| Path / keys | `/pj/payloads` | the three keys of the contract |
| Persistence | the item stays, the watch finds it when it wakes up | the system keeps the last context |
| Watch absent | the put succeeds anyway | the send is simply skipped |

Both have the property that matters here: they only keep the **latest**
state, they do not queue, and the system delivers it to the watch as soon
as it is reachable, if it was off or out of range at the time of sending.
The phone therefore never has to wait for the watch.

An item (or a context) is replaced as a whole, never merged: each plugin
therefore keeps the payloads already sent so it can put them again along
with the one that changes. All three fit well within the limits (100 KB for
a DataItem, around 256 KB for a context): the times, the largest, weigh
about ten kilobytes for their week. A test checks this
(`src/__tests__/watchPayloads.test.ts`).

**The very first time.** The phone believes it has already given what the
watch has never received: its recipient remembers an identical payload and
does not resend it. Three things address this:

1. at launch, the watch rereads what the system has **already** synced for
   it (`getDataItems` on Wear OS, `receivedApplicationContext` on watchOS):
   available right away, without waiting for anything from the phone;
2. it still asks the phone for everything (`/pj/request`, or a `request`
   message); the plugin relays it to the webview (`watchRequest` event),
   which forgets what it thought it had sent and republishes. Best-effort:
   this only works if the phone app is running, since it alone knows how to
   compute;
3. on iOS, pairing a watch triggers `sessionWatchStateDidChange`, which
   republishes without the watch having to ask.

## The Tehilim are bundled, not sent

The 150 psalms travel in the Wear APK and in the watchOS app bundle, not in
the Data Layer: they never change, they weigh three hundred kilobytes, and
sending them on every language change would cost bandwidth and battery for
nothing. Bundled, they can be read from the very first second, without the
phone nearby, which is what one expects from a book.

The file is produced at setup from `public/texts/tehilim.json`, stripped of
the Sefaria source's formatting (tags, entities, paracha markers) by
`scripts/lib/watch-tehilim.mjs`. The native side therefore has no text rule
to maintain. This cleanup must stay in agreement with the one the app
applies on screen (`cleanText`, `src/services/textService.ts`), otherwise a
verse would read differently on the wrist than on the phone:
`src/__tests__/watchTehilim.test.ts` compares the two on the entire corpus.

The other corpora (Talmud, Michna, Tanakh, Sidour) stay on the phone: they
weigh about forty megabytes and are read by pages, which a wrist does not
render well. The Sidour, moreover, depends on calendar occasions and on the
location's times: that would be a second engine to port to the watch.

## Why you cannot check off from the watch

The daily reading is read only, and that is a choice. Checking off would
require a write path in the opposite direction, watch → phone → Firestore,
whose central link is the webview: it alone knows how to write the
preferences. Yet it only runs when the phone app is open. A check made on the
wrist, with the phone asleep, would therefore be silently swallowed, or
would require a queue and conflict resolution with whatever may have been
checked elsewhere in the meantime. A silently swallowed check is worth less
than a check that was never offered.

When it is done, it will be an end-to-end path: a queue on the watch side,
handoff to the webview at the first wake-up, and the progress merging that
already exists (`src/__tests__/mergeDailyProgress.test.ts`).

## Appearance: black, except the accent

A watch displays on a black background, and not only out of habit: the
screen is OLED, a black pixel consumes nothing, and the always-on display
spends most of its life there. The phone's theme therefore does not travel
here. Only its **accent** does, on the highlighted time and on the reading
progress, exactly as in the widgets, and it arrives in the payload: the
native side knows no theme color.

## Wear OS: automatic

The native code is versioned in `native/wear/` (a complete Gradle module)
and in `native/android/` (the `PjWatchPlugin` plugin), and copied into
`android/` (git-ignored, regenerated by the CI) by
`scripts/setup-android.mjs`, which also declares the module in
`settings.gradle`, adds `play-services-wearable` to the app's dependencies,
registers the plugin in `MainActivity`, reuses the app's icons and writes
the Tehilim into the watch's assets.

```bash
npx cap add android          # if android/ does not exist yet
node scripts/setup-android.mjs
cd android && ./gradlew :wear:installDebug
```

**Distribution.** The watch app is a **separate** artifact, with the same
`applicationId` as the phone: the Play Store delivers both from a single
listing and uses the manifest's `uses-feature android.hardware.type.watch`
to know which one to send to which device. The APK embedded in the phone's
(`wearApp`) now only concerns Wear OS 2, which the app does not target
(minimum API 30, Wear OS 3). The two `versionCode` values must differ: the
CI gives the watch the phone's plus 1 (`.github/workflows/deploy-android.yml`),
and both AABs go out in the same release, **once the Play listing is ready
to receive them**: see the `SHIP_WATCH_APPS` variable below.

It is `scripts/play-release-files.mjs` that decides the list and writes it
in the exact form that `r0adkll/upload-google-play` expects: **a single
line, commas and nothing else**. The action does
`getInput('releaseFiles').split(',')` before passing the result to
fast-glob; a multiline YAML block becomes a single pattern containing a line
break, which matches no file, and a space after the comma has the same
effect. The v3.9.3 tag died on this, eight minutes after it started, on
"Unable to find any release file matching", even though both AABs were
signed and ready. `src/__tests__/playReleaseFiles.test.ts` covers the form
and the content.

Testing: install on a watch (or Android Studio's Wear OS emulator, paired
with the phone), open the phone app once so it pushes the payloads, then
check that the next zman switches when a time passes, that a check on the
phone shows up on the wrist, and that a psalm opens with the phone off.

## watchOS: automatic too

Same story as the widgets, and same trap: the `ios/` project is generated
and not versioned, a target created by hand in Xcode would not survive any
`cap add ios`, and the builds would go to the App Store without a watch app,
without any warning. `scripts/setup-ios.mjs` therefore writes the target
itself, via `scripts/lib/xcode-watch.mjs` (a pure text transformation,
tested without macOS in `src/__tests__/xcodeWatch.test.ts`).

| File in `native/` | Destination | Role |
|---|---|---|
| `ios/App/PjWatchPlugin.swift` | App target | receives the payloads, holds the WatchConnectivity session |
| `ios/App/PjViewController.swift` | App target | registers both plugins (required since Capacitor 5) |
| `watchos/PjWatch/Payloads.swift` | PjWatch target | the contract, its storage, the colors |
| `watchos/PjWatch/PjWatchApp.swift` | PjWatch target | the entry point and the watch-side session |
| `watchos/PjWatch/Screens.swift` | PjWatch target | the three screens, and the bundled Tehilim |

The script also sets up the watch's `Info.plist`, its icon catalog and its
Tehilim file.

Three differences from a widget extension, which the target must carry:

1. it is an **application** (`com.apple.product-type.application`), not an
   appex: it has its own SDK (`SDKROOT = watchos`), its own device family
   (4) and its own deployment target (watchOS 10);
2. it is embedded in `App.app/Watch/`, not in `PlugIns/`: the copy phase
   targets `$(CONTENTS_FOLDER_PATH)/Watch`, `dstSubfolderSpec = 16`. That is
   where, and nowhere else, iOS looks for the app to install on the wrist;
3. it has an **icon catalog**, without which the App Store rejects the
   archive, and nothing earlier flags it. A single 1024-point image has been
   enough since Xcode 14; it is `assets/logo.png`, as is.

> **`WKApplication`, not `WKWatchKitApp`.** The single-target app that Apple
> has required since watchOS 9 is declared with the first key; the second
> describes the old app + extension pair. And without
> `WKCompanionAppBundleIdentifier`, the watch app does not install along
> with the phone's. Both are set by `watchInfoPlist`, and
> `src/__tests__/xcodeWatch.test.ts` checks it.

```bash
npx cap add ios              # if ios/ does not exist yet
node scripts/setup-ios.mjs
npm run cap:ios
```

**Signing.** The watch app has its own App ID
(`fr.petitejerusalem.app.watchkitapp`, the suffix is imposed by Apple), and
therefore its own profile. `scripts/ios-signing.mjs` creates both on the
first CI run and exposes `IOS_WATCH_PROVISIONING_PROFILE`; locally, Xcode
takes care of it at the first signing. Nothing to do by hand in the Apple
portal, unlike the widgets' App Group: the watch only talks to the phone,
through WatchConnectivity, which requires no capability.

Testing: run on a paired Apple Watch (or the watch simulator linked to the
iPhone simulator), then the same checks as on Wear OS.

## What remains to be done by hand, once

The code is scripted end to end; the store listings are not.

- **Play Console**: a Wear OS app is only distributed if the listing
  declares the "Wear OS" form factor and has its own screenshots (round
  screen). The phone's listing (`store-assets/metadata/android/`,
  `scripts/play-listing.mjs`) does not cover this part.
- **App Store Connect**: likewise, the watch app requires its own set of
  screenshots. `scripts/asc-screenshots.mjs` only produces those for iPhone
  and iPad.

### The SHIP_WATCH_APPS repo variable

These two listings are not a cosmetic detail: **as long as they are missing,
both stores reject the entire release**, not just the watch part.

- Google accepts both AABs, then refuses to validate the edit with an
  "Internal error encountered" that does not say which of the two bothers
  it. The v3.9.4 tag died there, both AABs signed, uploaded and accepted;
- Apple accepts the binary on TestFlight, then refuses to add the version to
  the submission: it now targets a device whose listing has no screenshots.
  The v3.9.4 tag died there too, in the `submit` job.

Hence the **`SHIP_WATCH_APPS`** repo variable, which controls both stores at
once. Absent, or different from `true`:

- on the Play side, `scripts/play-release-files.mjs` only puts the phone's
  AAB in the release. The watch's is still built, archived in the Actions
  tab and attached to the GitHub release;
- on the App Store side, `scripts/setup-ios.mjs` does not write the watch
  target into the pbxproj and `scripts/ios-signing.mjs` creates neither its
  App ID nor its profile: the uploaded binary contains no watch app, so
  Apple does not ask for its screenshots.

Locally, the watch is always built: nothing there goes to review.

Once both listings are ready, set `SHIP_WATCH_APPS=true` in the repository
variables (Settings → Secrets and variables → Actions → Variables) and tag:
both watch apps go out with the next release, with no other change.

## Evolution

- Any new data displayed by the watch goes through a payload, never any
  business logic on the native side: `watchPayloads.ts` for what is specific
  to it, `widgetPayloads.ts` for what it shares with the widgets.
- Field removed or renamed: increment `v` and have the native side read both
  versions for one release (payloads persist on the device).
- The contract tests live in `src/__tests__/watchPayloads.test.ts`, those
  for the delivery in `src/__tests__/payloadSink.test.ts`.
- Still to do: the watchOS complications, a Wear OS tile, and the write path
  for checks described above.
