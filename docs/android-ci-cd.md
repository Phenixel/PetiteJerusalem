# Android CI/CD: automatic Play Store publishing

The workflow [.github/workflows/deploy-android.yml](../.github/workflows/deploy-android.yml)
publishes the Android app to the Play Store **on every `vX.Y.Z` tag**, in
parallel with the web deployment (deploy.yml). A single action therefore
puts both the site and the app into production:

```bash
git tag v3.0.2 && git push origin v3.0.2
```

To put **only the site** into production (front-end fix, content, SEO), push
a `web-vX.Y.Z` tag: only deploy.yml is triggered, no mobile release goes
out.

Since the `android/` folder is git-ignored, the CI regenerates it from
scratch (`npx cap add android` + `scripts/setup-android.mjs`), aligns
`versionName`/`versionCode` with the tag (v3.0.1 → versionCode 3000100),
builds the signed AAB and uploads it to the Play Store. The AAB is also
archived as a run artifact (90 days).

Two AABs, in fact: the phone's and the Wear OS app's, which go out in the
same Play Store release. They share the applicationId, are signed with the
same key, and their `versionCode` values differ by one; it is the Play Store
that chooses which one to send to which device, based on the manifest's
`uses-feature`. See `docs/app-watch.md`.

## GitHub secrets to create (once)

From the root of the repo, on the machine that holds the keystore and
`google-services.json`:

```bash
# 1. Release keystore (binary file → base64)
gh secret set ANDROID_KEYSTORE_BASE64 --body "$(base64 -i ~/petite-jerusalem-release.keystore)"

# 2-4. Values from android/keystore.properties (git-ignored, present locally)
gh secret set ANDROID_KEYSTORE_PASSWORD --body "$(grep '^storePassword=' android/keystore.properties | cut -d= -f2-)"
gh secret set ANDROID_KEY_ALIAS        --body "$(grep '^keyAlias='      android/keystore.properties | cut -d= -f2-)"
gh secret set ANDROID_KEY_PASSWORD     --body "$(grep '^keyPassword='   android/keystore.properties | cut -d= -f2-)"

# 5. Firebase config of the Android app (repo root, git-ignored)
gh secret set GOOGLE_SERVICES_JSON < google-services.json

# 6. Play service account (see next section)
gh secret set PLAY_SERVICE_ACCOUNT_JSON < ~/Downloads/petite-jerusalem-play-ci.json

# 7. SHA-256 fingerprint of the signing certificate, so that the site's links
#    open the app (Play Console → App integrity → App signing; also add the
#    upload certificate's fingerprint, separated by a comma).
#    This secret is read by the site deployment, not by the app's,
#    see docs/app-links.md.
gh secret set ANDROID_APP_LINK_SHA256 --body "AB:CD:…:EF"
```

## Play Console service account (once, clicks)

1. [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
   → project `petite-jerusalem-dev` (signed in as `admin@phenixel.fr`) →
   "Create service account", name `play-ci`, no project role.
2. On the created account → "Keys" → "Add key" → JSON → download (this is
   the file for secret no. 6).
3. [Play Console](https://play.google.com/console) → Users and permissions
   → Invite new user → the service account's email address
   (`play-ci@….iam.gserviceaccount.com`) → permissions on the Petite
   Jérusalem app: "Release to production" (and testing tracks) + "Edit
   store listing" (for the CI's syncing of descriptions and screenshots).

## Play Store listing and release notes

The listing (title, descriptions, screenshots) and the release notes live
in the repo, in fastlane format, and are synced on every publication:

```
store-assets/metadata/android/<locale>/   # fr-FR, en-US, iw-IL (Hebrew)
├── title.txt                 # ≤ 30 characters
├── short_description.txt     # ≤ 80
├── full_description.txt      # ≤ 4000
└── images/
    └── featureGraphic.png    # 1024×500 banner (optional)
```

The screenshots, for their part, are shared by the Play and App Store
listings and live separately, in `store-assets/screenshots/<locale>/` (the
`phone-*` ones for the Play Store, at least 2 or they are not uploaded):
see [store-assets/screenshots/README.md](../store-assets/screenshots/README.md).

- The release notes are attached to the Play release by
  `upload-google-play` (`whatsNewDirectory` parameter), prepared by
  `scripts/prepare-whatsnew.mjs`:
  1. **if a GitHub release exists for the tag** (created from the GitHub
     interface with its text), that text goes to the Play Store (light
     markdown, truncated to 500 characters per language). Written in three
     sections, each language of the listing receives its own (see
     "Release notes in three languages" below); without these headings, it
     only goes to French, and a language without text falls back to the
     default language in the console;
  2. **otherwise**, the default sentence from `scripts/release-notes.mjs`
     (« Correction de bugs mineurs. », "Minor bug fixes.", translated per
     language); there is no longer a `changelogs/default.txt` in the repo.

  The GitHub release is created/completed by the CI with the signed AAB in
  any case; if it already exists, its text is not touched.

### Release notes in three languages

The GitHub release text can carry one section per language, each under a
heading named after the language. The Play Store (fr-FR, en-US, iw-IL) and
the App Store (fr-FR, en-US, he) then receive, in each language, the text
written for it:

```markdown
## Français
Nouveautés
- …

Corrections
- …

## English
What's new
- …

Fixes
- …

## עברית
חדש
- …

תיקונים
- …
```

- Language headings are recognized regardless of case or accents, and also
  under their French name or their code (`## Anglais`, `## Hébreu`,
  `## en`…). Any other heading (`## Nouveautés`) remains part of the
  section's text.
- What precedes the first language heading is ignored.
- Without any language heading, the entire text is French: releases
  written before keep working.
- A language without a section receives, on the App Store side, the default
  sentence; on the Play side, the console's default language.

`splitReleaseNotes` in `scripts/release-notes.mjs` carries the rule,
`src/__tests__/releaseNotes.test.ts` enforces it.

A note is checked before pasting it, with
`node scripts/check-release-notes.mjs note.md`: three languages present,
500 characters at most each (beyond that, the Play Store truncates), no long
dash and no emoji (App Store Connect rejects them). To have Claude write it,
« rédige la note de patch » ("write the patch note") is enough: the
procedure is in [notes-de-version.md](notes-de-version.md).
- The listing is uploaded by `node scripts/play-listing.mjs` (Android
  Publisher API, same service account). `node scripts/play-listing.mjs --check`
  checks the character limits locally, without network.
- A language's screenshots replace **the entire** existing set in the
  console; a language without screenshots in the repo leaves the console
  untouched (languages without images fall back to the default language).
- The screenshots are regenerated with `npm run store:screenshots`
  (scripts/store-screenshots.mjs), in a single pass for both stores:
  ephemeral Firebase emulators + fixed demo data (« Sarah Levy » account,
  Tehilim session, chiourim), then headless Chrome rendering the **app**
  interface (bottom tab bar, no site header) thanks to a "homemade"
  Capacitor platform, in the three listing formats: Play phone (1080×1920),
  iPhone 6.9" and iPad 13". No Android emulator, no Gradle, no system bar:
  the rendering is the same as the App Store listing, and a pass takes a
  few minutes on a Linux runner. Details and choices in
  [store-assets/screenshots/README.md](../store-assets/screenshots/README.md).
- The CI does not wait for a commit: on every tag, the
  `store-screenshots.yml` workflow generates the set once and publishes it
  as an artifact; the `listing` job of deploy-android.yml fetches it
  (action `.github/actions/fetch-store-screenshots`, which waits for the
  run to finish if it is still running) and uploads the `phone-*` ones with
  the listing. If the generation fails, the listing goes out with the
  screenshots committed in the repo; in any case the release itself does
  not wait for the screenshots.
- To check the screenshots without publishing anything: Actions tab → Store
  screenshots → Run workflow. Its artifact contains the three formats.
  (The old **screenshots_only** option of Deploy Android no longer exists.)

## Release track

The workflow publishes to the **production** track, with "completed"
status: as soon as Google's review has passed, the version goes out to
everyone, without any action in the Play Console. The track has been
hard-coded since the app had its first production release; the old repo
variable `ANDROID_PLAY_TRACK` (which allowed targeting `internal` while the
app was in closed testing and the API refused the production track) is no
longer read; delete it if it is still lying around (Settings → Secrets and
variables → Actions → Variables).

## Minification (R8)

The release build goes through R8: dead code removed, remaining code
optimized and renamed. It is `scripts/setup-android.mjs` that sets
`minifyEnabled true` on android/app/, and `native/wear/build.gradle` that
does the same for the watch; both point to `proguard-android-optimize.txt`
(the variant without `-dontoptimize`) plus their own rules, versioned in
`native/android/app/proguard-rules.pro` and `native/wear/proguard-rules.pro`.

Why: the Play Console rates each bundle on the share of obfuscated,
minified and optimized code, with a threshold at 25%. The 3.9.5 AAB was at
3%, and the console announced a penalty on the listing's visibility. With
R8, the phone bundle has 48% of its classes renamed (59% of methods) and
its DEX goes from 14 MB to 3.8 MB; the watch's is at 88%.

Two things to know before touching the native code:

- Capacitor plugins are loaded by name, and their `@CapacitorPlugin` is
  read at runtime. The rules shipped by Capacitor keep the classes, not the
  annotation types: our rules take care of that. Without them, the app
  starts, then dies at the first permission call.
- A new plugin that references an optional SDK missing from the bundle
  makes R8 fail on "Missing class". The report
  `android/app/build/outputs/mapping/release/missing_rules.txt` then gives
  the `-dontwarn` line to add (this is the case for the Facebook SDK, which
  the authentication plugin references without us bundling it).

Any native change is checked on a release build, not a debug one (R8 does
not run in debug):

```bash
npm run app:build && cd android && ./gradlew :app:assembleRelease
```

then install the APK on the emulator and go through at least one page that
requests a permission (Horaires, « Utiliser ma position », "Use my
location").

## Notes

- The `versionCode` is derived from the tag's semver: republishing requires
  a new tag (patch +1). The Play Store rejects any `versionCode` already
  used.
- Manual run possible (Actions tab → Deploy Android → Run workflow): it
  takes the latest tag reachable from the chosen branch.
- JDK 21 and the Android SDK are provided by the `ubuntu-latest` runner.
