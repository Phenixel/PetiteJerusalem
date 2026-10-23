# iOS CI/CD: automatic upload to TestFlight

The workflow [.github/workflows/deploy-ios.yml](../.github/workflows/deploy-ios.yml)
builds the iOS app and uploads it to TestFlight **on every `vX.Y.Z` tag**, in
parallel with `deploy.yml` (site) and `deploy-android.yml` (Play Store). A
single action therefore puts all three into production:

```bash
git tag v3.7.0 && git push origin v3.7.0
```

Since the `ios/` folder is git-ignored, the CI regenerates it from scratch
(`npx cap add ios` + `scripts/setup-ios.mjs`), aligns
`CFBundleShortVersionString`/`CFBundleVersion` with the tag (v3.7.0 → build
3070000), archives, exports the signed IPA and sends it to Apple. The IPA is
also kept as a run artifact (90 days).

**Submission for review is automatic**: after the macOS job, the `submit` job
(Linux) waits for Apple to finish processing the build (15 to 40 min),
attaches it to the tag's version and submits it through the API
(`scripts/asc-submit.mjs`). It stops cleanly if a previous submission is
still in review, and can be switched off with the repo variable
`IOS_AUTO_SUBMIT=false`.

**Release to sale is automatic too**: `scripts/appstore-listing.mjs` sets the
version to `releaseType AFTER_APPROVAL` (on every run, not only when it is
created), so Apple publishes it on its own once review is over. A tag is thus
enough to publish, with no click in App Store Connect, just like the Play
Store. Repo variable `IOS_AUTO_RELEASE=false` to go back to releasing on
click (see
[ios-release-plan.md](ios-release-plan.md#step-8-submission)).

## The widgets, and the only manual step

This workflow regenerates `ios/` from scratch on every tag: a target created
by hand in Xcode would not survive it, and that is exactly why the iOS
widgets reached no iPhone for a long time, even though their SwiftUI code has
been versioned in `native/ios/` from the start.

The `PjWidgets` extension target is therefore written into `project.pbxproj`
by `scripts/lib/xcode-widgets.mjs`, which `scripts/setup-ios.mjs` calls:
target, build phases, configurations, embedding in the app and dependency.
The module only transforms text, so it can be tested without macOS
(`src/__tests__/xcodeWidgets.test.ts`, against the real Capacitor template:
an update that moved an anchor breaks these tests rather than the release
build).

**One manual step remains, to be done only once**: the App Store Connect API
can neither create an App Group nor attach it to an App ID (it can only
enable the `APP_GROUPS` capability). On
[developer.apple.com](https://developer.apple.com/account/resources/identifiers/list)
→ Certificates, Identifiers & Profiles:

1. Identifiers → **App Groups** → + → identifier `group.fr.petitejerusalem.app`;
2. Identifiers → `fr.petitejerusalem.app` → App Groups → Configure → check the group;
3. Identifiers → `fr.petitejerusalem.app.PjWidgets` → App Groups → Configure → same.

The extension's App ID, on the other hand, is created by
`scripts/ios-signing.mjs` on the first run: so you have to run the workflow
once for it to exist, make the three clicks, then run it again.

The script re-reads the two profiles it has just created and checks that the
App Group is in them: without it, the run stops with a one-sentence message
within its first two minutes, instead of failing a quarter of an hour later
on an `xcodebuild` "doesn't match the entitlements file".

### Testing signing without pushing a tag

Actions → **Deploy iOS** → Run workflow → check **debug_signing**. This mode
creates the certificate and the two profiles, syncs the Capacitor minimum,
attempts an archive with verbose provisioning logs, then stops. It uses up
no build number on the App Store Connect side (nothing is sent, and the
cleanup revokes the run's certificate), which makes it the dress rehearsal
to do before a tag when signing has changed.

It skips the web build, but **not** `cap sync`: that step declares the
plugins' SPM packages, and without it the archive failed at compile time
("Unable to find module dependency: 'FirebaseAuth'") before even reaching
signing, that is, before what this mode exists to show. A `dist/` reduced to
an empty shell is enough for `cap sync`.

## Signing "in the cloud"

No certificate or provisioning profile is stored in the repo, unlike the
Android keystore. `scripts/ios-signing.mjs` creates a set at the start of
each run from the App Store Connect API key: distribution certificate, "App
Store" profiles (the app and its widgets extension), temporary keychain. The
final cleanup (`--cleanup`, run even when the build fails) destroys the
keychain and the profiles; the certificate, however, is only removed if the
run sent nothing to Apple, see the quota below. The same key is used to
upload the IPA and to sync the listing: it is the workflow's only sensitive
secret.

### Why manual rather than automatic

`xcodebuild -allowProvisioningUpdates` (automatic signing) looked simpler,
but it is unusable here: to **archive**, Xcode asks for a *development*
profile, and Apple issues none to a team that has no registered device; this
individual account has none. The error first surfaced in the misleading form
"Authentication failed: bearer token", then, once Xcode was pinned to 26.2,
plainly: "No profiles for 'fr.petitejerusalem.app' were found".

Forcing `CODE_SIGN_IDENTITY="Apple Distribution"` on top of automatic mode
does not work either: Xcode refuses the mix ("has conflicting provisioning
settings"), on the App target **and** on each of the SPM packages.

An "App Store" profile, however, requires no device. Hence manual mode, with
two consequences visible in `scripts/setup-ios.mjs`:

- the signing settings are written into the **App target of the pbxproj**,
  never passed as `xcodebuild` arguments (an argument would also apply to the
  SPM packages, which reject it);
- the `aps-environment` entitlement is `production`: it must match the
  signing profile.

Two profiles are created on each run, since the app and its widgets
extension each have their own App ID. The app's profile carries the build
number in its name and survives the upload (it is what tells which
certificate signed which binary); the extension's is disposable.

The App ID capabilities required by the profiles, push notifications, Sign
in with Apple, associated domains and App Groups, are enabled by the script
itself, which Xcode used to do on its own in automatic mode.

### When Apple answers 500

Apple's provisioning occasionally returns a `500 UNEXPECTED_ERROR` to a
perfectly valid request, then accepts the same one a few seconds later. The
v3.9.3 tag died on this: creating the widgets profile failed 180 ms after
creating the app profile, with the same certificate, the same App ID and the
same code as the previous day's green run. There was nothing to fix in the
request; it just had to be sent again.

`scripts/lib/asc-retry.mjs` carries the rule, and
`src/__tests__/ascRetry.test.ts` holds it:

- a transient failure (5xx, 429, or no response at all) gets up to three
  retries, after three seconds, six, then twelve;
- a 4xx gets none: it says something true about the request;
- only GETs and DELETEs are replayed automatically. A POST is not: replaying
  a certificate creation would eat a slot of the quota of three. Profile
  creation is the exception, but it first re-reads the profile by name,
  since Apple sometimes creates it before failing to return it.

The same rule applies to the client shared by the listing, the screenshots
and the submission (`scripts/lib/asc-api.mjs`, held by
`src/__tests__/ascApi.test.ts`), since tag v3.10.8: a 500 on a simple read
had cut `appstore-listing.mjs` off right after creating the version, before
it wrote its « Nouveautés » ("What's New"). The step, being non-blocking,
only left a warning, and the submission then failed on a 409 "not in valid
state": Apple refuses a version with an empty required field. This client
now also shows the detailed reasons Apple puts in `meta.associatedErrors`,
where the log only said "please check associated errors to see why".

A run that still fails on this message has nothing to fix in the repo: just
rerun it. When the failing step is « Mettre à jour la fiche App Store »
("Update the App Store listing"), rerunning only the `submit` job is not
enough, since it does not rewrite the listing. Two ways to pick up the
version left hanging:

- fill in what is missing in App Store Connect (the « Nouveautés » for each
  language), then rerun the `submit` job ("Re-run failed jobs");
- or push a new tag (patch + 1): `appstore-listing.mjs` renames the editable
  version left hanging and takes it over from the start. The tag also
  republishes the site and the Android app.

### The quota of three distribution certificates

Apple accepts only **three distribution certificates** per account, and a
run's certificate cannot always leave with it: contrary to what was first
believed, Apple does not re-sign everything that goes through TestFlight, it
re-validates the **original** signature when the build is queued for review.
Build 3.7.3, accepted by TestFlight on August 17, 2026, was rejected at
review with an "ITMS-90035: Invalid Signature" for that reason: its
certificate had been revoked a few minutes after the upload.

A certificate must therefore live as long as a binary signed with it is in
review or on sale, but no longer, otherwise the quota fills up and the next
tag fails on "You already have a current Distribution certificate" (which is
what happened to tag v3.7.8). Two safeguards take care of this, with no
manual step needed:

- at the end of the run, `--cleanup` revokes the certificate **if nothing
  was sent to Apple**: a run that fails before the upload, or a debug run,
  therefore leaves nothing behind. The `IOS_BUILD_UPLOADED` variable, set by
  the workflow right after the TestFlight upload, tells the two cases apart;
- if the binary was sent, `--cleanup` **keeps the profile** instead of
  deleting it. Its name carries the build number (`PetiteJerusalem CI build
  3070800`) and it references the signing certificate: it is the only place
  where the link between a certificate and what it signed exists, since the
  App Store Connect API provides it nowhere;
- on each run, `--setup` revokes, before creating its own, the certificates
  that no binary depends on anymore, based on the marker. Protected are the
  binaries attached to a version that Apple still has in hand (review,
  processing, pending release), that of the most recent version of the
  listing whatever its state, the last binary sent and those Apple is still
  processing. The previous run's certificate is kept as a matter of course,
  unless it signed a staging build that Apple has finished processing.

A certificate **without a marker** (predating the mechanism, or left by a
run killed before its cleanup) is judged by dates: the API dates
certificates and uploads, a binary is signed by the last certificate created
before its upload, and the window is widened by two hours to absorb the
imprecision. This is cautious, and therefore sometimes too cautious: that is
how three certificates ended up protected at the same time on August 23,
2026, and had to be revoked by hand.

A **staging** build ("PJ Staging", internal testers only) follows the same
mechanics, with a separate marker (`PetiteJerusalem CI staging build 141`)
so that its number is never confused with that of a production binary. It
never goes to review, but Apple checks the signature during the processing
that follows the upload: its certificate is therefore kept as long as the
build is in `PROCESSING`, then revoked at the next `--setup`, even when it
is the most recent one. Keeping it as "the previous run's certificate"
blocked staging run 16 on October 16, 2026: Apple refused a new certificate
while only two were listed. Rule held by the test « libère le certificat du
run précédent quand il a signé un build de staging traité ». Revoking it
right at the end of the run, as was done for a while, got staging build 141
(3.10.12) rejected on October 16, 2026: "ITMS-90721: Certificate Revoked".
Rule held by `src/__tests__/certificateQuota.test.ts`
(« garde le certificat d'un build de staging pendant son traitement »).

A version **already distributed** holds nothing back, and that is
intentional: as Apple says when you revoke a certificate, the apps
*submitted for review* signed with it are invalidated, while those already
on the App Store are not affected. Protecting the versions on sale froze one
quota slot per past release, permanently: as of August 23, 2026, 3.7.5 and
3.7.6, both distributed, occupied two out of three.

If nothing more can be freed, the run fails and displays the list of
certificates and what holds each one; the decision then falls to a human,
on developer.apple.com.

Consequence: the API key must have the **Admin** role. This is
counterintuitive for a CI key, but Apple reserves the creation of
**distribution** certificates to that role; an "App Manager" key is enough
for TestFlight and the listing, not for signing the archive. And a key's
role **cannot be changed after creation**: getting it wrong forces you to
generate a new one.

## App Store Connect API key (once, clicks)

1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and
   Access** → **Integrations** tab → **App Store Connect API** → **Team
   Keys** → `+`. The very first time, Apple first asks you to enable API
   access (checkbox + Submit, immediate approval).
2. Name `github ci` (no hyphen: Apple refuses special characters), access
   **Admin** → Generate.
3. Download the `AuthKey_XXXXXXXXXX.p8` file, **downloadable only once**,
   and store it in the password manager.
4. On the same page, note the **Key ID** (10 characters) and the **Issuer
   ID** (a UUID, shared by all the account's keys).

## GitHub secrets to create (once)

From the repo root, on the machine that has the `.p8` key and
`GoogleService-Info.plist`:

```bash
# 1-2. API key identifiers (API Keys page of App Store Connect)
gh secret set ASC_KEY_ID    --body "XXXXXXXXXX"
gh secret set ASC_ISSUER_ID --body "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 3. Contents of the private key (downloaded .p8 file)
gh secret set ASC_PRIVATE_KEY < ~/Downloads/AuthKey_XXXXXXXXXX.p8

# 4. Apple Team ID (10 characters, Membership page of developer.apple.com)
gh secret set IOS_DEVELOPMENT_TEAM --body "XXXXXXXXXX"

# 5. Firebase config of the iOS app (repo root, git-ignored)
gh secret set GOOGLE_SERVICE_INFO_PLIST < GoogleService-Info.plist
```

## App Store listing

The listing lives in the repo, in a fastlane-inspired format, and is synced
on every release by `node scripts/appstore-listing.mjs` (App Store Connect
API, same key):

```
store-assets/metadata/ios/<locale>/   # fr-FR, en-US, he
├── name.txt                 # ≤ 30 characters
├── subtitle.txt             # ≤ 30
├── keywords.txt             # ≤ 100, commas WITHOUT spaces
├── promotional_text.txt     # ≤ 170, editable without a new version
├── description.txt          # ≤ 4000
├── support_url.txt          # required
├── marketing_url.txt        # optional
└── privacy_url.txt          # required
```

- The « Nouveautés » ("What's New") do not come from a file in the repo: the
  CI passes the script the body of the tag's GitHub release
  (`--release-notes`), and failing that, the default sentence from
  `scripts/release-notes.mjs` (« Correction de bugs mineurs. », translated
  per language) is sent, same logic as the Play Store. Written in three
  sections (`## Français`, `## English`, `## עברית`), each language gets its
  own; without these headings, the body only goes to fr-FR, and a language
  without text gets the default sentence. The format is described in
  [android-ci-cd.md](android-ci-cd.md#release-notes-in-three-languages).
- `node scripts/appstore-listing.mjs --check` checks locally, without
  network, the character limits **and** the absence of characters refused by
  the App Store Connect API (emojis, non-BMP symbols...): the CI does it at
  the start of the run and fails before the 40 minutes of macOS build,
  pointing out the file, line and offending character. The Play Store, for
  its part, accepts emojis; the Android listings do not have this
  constraint.
- The script writes to the **editable** App Store version (state
  `PREPARE_FOR_SUBMISSION` and similar), and aligns it with the tag: it uses
  the version carrying the right number, otherwise renames the existing
  editable version, otherwise creates one. Versions in review or already
  published are never touched. If it fails anyway, the binary has already
  gone to TestFlight: the step does not fail the run, it displays a warning.
- Apple refuses the « Nouveautés » field on the very first version: the
  script automatically retries without it.

### Screenshots

Automatic: on every tag, the `store-screenshots.yml` workflow generates the
screenshots for both listings ONCE with `npm run store:screenshots`
(Firebase emulators + fixed demo data, then headless Chrome rendering the
app's interface, tab bar included, at Apple's exact dimensions). The
`screenshots` job of deploy-ios.yml fetches them (action
`.github/actions/fetch-store-screenshots`) then sends them to App Store
Connect via `scripts/asc-screenshots.mjs`, which performs the API's upload
ceremony (reservation, chunks, MD5 checksum) and replaces the whole set of
each family on the tag's version. Non-blocking: if generation fails, the
committed screenshots are sent; if the upload fails, the screenshots already
in place in App Store Connect stay as they are and the submission goes
ahead anyway.

The app is universal (iPhone + iPad), hence **two series** per language,
stored in `store-assets/screenshots/<locale>/` next to the Play Store series
(`phone-*`, which is not read here):

| Family | Files | Dimensions | displayType |
|---|---|---|---|
| iPhone 6.9" | `iphone-*.jpg` | 1320 × 2868 (440 × 956 CSS @3x) | APP_IPHONE_67 |
| iPad 13" | `ipad-*.jpg` | 2064 × 2752 (1032 × 1376 CSS @2x) | APP_IPAD_PRO_3GEN_129 |

sRGB JPEG **without an alpha channel** (Apple refuses alpha, hence JPEG),
sent sorted by name. Apple itself resizes for the smaller devices of each
family; a locale without a folder leaves its listing untouched (it falls
back to the primary language).

The screenshots are those of the Play listing, screen for screen: the app's
interface, with no system bar from any platform (rendering details are in
[store-assets/screenshots/README.md](../store-assets/screenshots/README.md)).
To take back control with a set made in the iOS simulator (`⌘S`), drop the
files in the folder above respecting the prefixes, then
`node scripts/asc-screenshots.mjs --version X.Y.Z`; the CI, for its part,
will send the generated set again on the next tag.

### Redoing the listing and the submission of a tag

When the binary went up but the listing, the screenshots or the submission
failed, rerunning `deploy-ios.yml` would build again, and Apple refuses a
build number it already has. The manual workflow
[`appstore-resubmit.yml`](../.github/workflows/appstore-resubmit.yml) redoes
only those three steps, with the code of the branch it is run from:

```sh
gh workflow run appstore-resubmit.yml -f version=4.0.0 -f build_number=4000000
```

It reads the release notes of the tag's GitHub release and the screenshots of
the tag's `store-screenshots.yml` run. Android and the site are not touched.

The App Store Connect scripts look the app up by its exact bundle id
(`findApp`, `scripts/lib/asc-api.mjs`): Apple's `filter[bundleId]` also
returns the staging app, whose bundle id extends the production one, and
tag v4.0.0 sent its listing there.

## Notes

- **The App Store Connect version number must be identical to the tag**,
  otherwise the build does arrive in TestFlight but is not offered when
  choosing the version's build. This is now automatic:
  `appstore-listing.mjs` renames the editable version (or creates one) so
  that it carries the tag's number. When the app is created, Apple opens a
  "1.0" version, and the first tag renames it. The manual step only remains
  if the listing sync fails (warning in the run log).
- The `CFBundleVersion` is derived from the tag's semver: republishing
  requires a new tag (patch +1). App Store Connect refuses any build number
  already used for the same marketing version.
- Manual launch possible (Actions tab → Deploy iOS → Run workflow): it uses
  the latest tag reachable from the chosen branch.
- The `macos-26` runner provides Xcode 26, required by Capacitor 8 and by
  the App Store since April 28, 2026. The workflow fails explicitly if the
  Xcode version is older.
- macOS runners consume GitHub Actions minutes **10× faster** than Linux
  (free on a public repo). A full build takes 10 to 20 min.
- `xcrun altool --upload-app` is marked deprecated in favor of
  `--upload-package` but still works; if Apple removes it, replace the
  « Envoyer sur TestFlight » ("Upload to TestFlight") step with
  `xcrun altool --upload-package` or with `fastlane pilot upload`.
