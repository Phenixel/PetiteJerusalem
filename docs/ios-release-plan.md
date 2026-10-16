# iOS release plan (App Store)

The complete path, from "no Apple account" to "app on sale", for the same
codebase as the site and the Android app (Capacitor, see
[app-native.md](app-native.md)). The CI/CD is described separately in
[ios-ci-cd.md](ios-ci-cd.md).

The code is **already ready**: Sign in with Apple
(`authService.signInWithApple`, button shown only on iOS), account deletion
in the app, push, offline reading, local geolocation. All that remains is
account and console paperwork, plus a first build.

## What drives the schedule

| Step | Duration |
|---|---|
| Apple Developer enrollment (individual) | 24 to 48 h |
| Apple + Firebase consoles | 1 h |
| First local build + TestFlight | half a day |
| App Store review | 24 h to 3 days (1st submission often longer) |

Since Phenixel is a **sole proprietorship**, there is no D-U-N-S number or
entity verification to wait for: everything can be wrapped up in a few days.

---

## Step 1. Apple Developer account (individual)

Apple reserves "organization" enrollment for **legal entities**:
[its documentation](https://developer.apple.com/help/account/membership/program-enrollment/)
is explicit, a sole proprietorship or a single-member company without a
distinct legal personality must enroll as an **individual**, and it is the
**person's legal name** that appears as the seller on the App Store
listing. Neither trade names, nor DBAs, nor shop names are accepted for an
organization enrollment.

Concrete consequences:

- The displayed seller will be **Yonathan Cardoso**, not "Phenixel".
- On European App Store listings, the DSA regulation requires in any case
  displaying the developer's address, phone number and email as soon as
  they are declared a "professional" (*trader*). A micro-enterprise that
  publishes as part of its business falls into this category; the
  declaration is made in App Store Connect (Business → DSA Compliance) and
  **is a condition for distribution in the EU**. The status to declare
  depends on the actual situation; when in doubt, legal advice is
  preferable, I am not a lawyer.
- If Phenixel becomes a company (SASU, EURL...), switching from individual
  to organization is possible later, without losing the app or its
  reviews.

**What needs to be done:**

1. A **dedicated Apple ID on `admin@phenixel.fr`**, with two-factor
   authentication. It is the permanent anchor of the account: an Apple ID
   can be attached to only one developer account, and it holds the Account
   Holder role, the signing keys, App Store Connect and billing. Migrating
   a developer account to another Apple ID does not exist, hence the choice
   of a durable address, on the company's domain (which Apple recommends
   anyway for an organization enrollment, the conversion targeted in the
   long run).

   - **First and last name = legal name**, not "Phenixel": individual
     enrollment verifies identity, and a trade name in these fields gets
     the application rejected or delayed. Only the address is
     "professional".
   - Do not make it the iPhone's iCloud account: it is used only to sign in
     (Xcode → Settings → Accounts, App Store Connect, Apple Developer app).
   - Recovery: 2FA on a long-lasting number, recovery contact or recovery
     key, and **keep the `phenixel.fr` domain renewed**, since it is the
     recovery mailbox of the account that holds the app.
2. **Enrollment** on
   [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)
   or from the **Apple Developer** app on iPhone (faster identity
   verification: it scans the ID document).
3. **$99/year** (≈ €99), automatic renewal.
4. Approval usually within 24 to 48 h.

> ⚠️ Do not create the app in App Store Connect before the account is
> approved: the bundle id is reserved within the account, not before.

### Changing the seller name later

Choosing the individual account is not a dead end. Two official paths, both
documented on
[Updating your account information](https://developer.apple.com/help/account/membership/updating-your-account-information/):

| Need | Procedure | What Apple asks for |
|---|---|---|
| New **legal name** (change of civil status) | Developer account → *Membership details* → submit a request | Proof of the name change |
| Switch to **"Phenixel"** (company created since) | [Individual → organization migration form](https://developer.apple.com/contact/request/migrate-individual-account) | Being the founder, D-U-N-S, company documents |

Changing your name on `account.apple.com` is **not** enough: it changes the
name displayed on Apple's sites, not the App Store seller name. You have to
go through the request above.

In both cases, the app keeps its identifier, its reviews, its ratings and
its downloads: it is the **same account** that changes its name.

> ⚠️ Not to be confused with an **app transfer** to another account. That
> one is much riskier here: "Sign in with Apple" identifiers and relay email
> addresses are tied to the team. Without an explicit migration
> ([TN3159](https://developer.apple.com/documentation/technotes/tn3159-migrating-sign-in-with-apple-users-for-an-app-transfer)),
> all accounts created through Apple would be lost. Always prefer
> **converting the account** to transferring the app.
>
> Another documented effect of changing the seller name: the
> `identifierForVendor` (IDFV) is reset at the next update. No consequence
> here, since the app identifies its users by their Firebase UID.

## Step 2. Apple identifiers (after approval)

On [developer.apple.com/account](https://developer.apple.com/account) →
**Certificates, Identifiers & Profiles**.

1. **App ID**: Identifiers → `+` → App IDs → App → **explicit** Bundle ID
   `fr.petitejerusalem.app` (the same as on the Play Store).
   Check the capabilities:
   - **Push Notifications**
   - **Sign in with Apple**
2. **APNs key**: Keys → `+` → name without special characters (hyphens are
   refused), check **Apple Push Notifications service**, then
   **Configure**: environment **Sandbox & Production** and restriction
   **Team Scoped (All Topics)**; a single key then covers dev, TestFlight,
   App Store and all the account's apps. These two settings are
   **permanent**.
   The `.p8` can be downloaded **only once**: store it in the password
   manager along with its **Key ID** and the **Team ID**.
3. **Sign in with Apple**: the capability on the App ID is enough for the
   native iOS flow. The *Service ID* and the *Sign in with Apple Key* are
   only used by the web flow; create them only if Sign in with Apple must
   also work on `petite-jerusalem.fr` (Return URL provided by Firebase).
4. Note the **Team ID** (10 characters, top right of the Membership page):
   it will be asked for everywhere.

## Step 3. Firebase

Firebase console, project `petite-jerusalem-dev` (the same as the Android
app).

1. **Add an iOS app**: bundle ID `fr.petitejerusalem.app` → download
   **GoogleService-Info.plist** → put it **at the root of the repo** (it is
   git-ignored; `scripts/setup-ios.mjs` copies it into the Xcode project and
   extracts the `REVERSED_CLIENT_ID` from it for the Google URL scheme).
2. **Cloud Messaging** → Apple tab → **upload the APNs key** (`.p8`, Key ID,
   Team ID). Without it, `pushService` gets an FCM token but no
   notification arrives.
3. **Authentication → Sign-in method** → enable the **Apple** provider.
4. **Authentication → Settings → Authorized domains**: nothing to add, the
   native flow does not go through a domain.

## Step 4. First local build

Prerequisites: macOS + **Xcode 26** (required both by Capacitor 8 and by
the App Store since April 28, 2026). Capacitor 8 builds with Swift Package
Manager, but the CLI still checks for CocoaPods before `cap add ios`:
`sudo gem install cocoapods` once if `pod --version` fails.

```bash
npm install
npx cap add ios
IOS_DEVELOPMENT_TEAM=XXXXXXXXXX node scripts/setup-ios.mjs
npm run cap:ios          # web build + sync + opens Xcode
```

`scripts/setup-ios.mjs` applies everything that must be reproducible (the
`ios/` folder is git-ignored): location usage description,
`remote-notification`, encryption declaration, Google URL scheme, Sign in
with Apple + APNs entitlements, `PrivacyInfo.xcprivacy`, APNs hooks in
`AppDelegate.swift`, icons, shared Xcode scheme, bundle id, team and
versions.

In Xcode: select a connected iPhone → **Run**. To check on the device:

- [ ] Google sign-in and Apple sign-in (the Apple button only appears on iOS)
- [ ] account deletion (Profil → Sécurité, i.e. Profile → Security)
- [ ] Horaires (Times) page: the location request shows up and the app does not close
- [ ] downloading a book then reading it in airplane mode
- [ ] reading reminder: a notification is received
- [ ] display of the status bar and safe areas (notch, Dynamic Island)

## Step 5. App Store Connect

On [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps
→ `+` → New App.

- Platform **iOS**, name **Petite Jérusalem** (without "- Torah", unlike
  the Play Store; confirmed choice, do not "harmonize"), primary language
  **French**, bundle ID `fr.petitejerusalem.app`, SKU `petite-jerusalem`.
- **Price**: free. **Availability**: all countries.
- **DSA compliance** (Business tab): without a declaration, European
  distribution is blocked, that is, the app's main market.
  **Done (08/14/2026)**: status declared **non-trader** at the account
  level (the app is free, with no revenue; no contact details published on
  the listing). The day a monetized app comes out, the account will have to
  switch to trader, and trader status will then be turned off app by app
  for Petite Jérusalem (*App Information → Regulations and Permits →
  Digital Services Act*).
- **Category**: Reference (primary); Lifestyle (secondary).
- **Age rating**: answer the questionnaire; the app contains no public
  user-generated content, no violence, no purchases; expected **4+**.
- **App privacy** ("nutrition labels"), to be declared, consistent with
  the `PrivacyInfo.xcprivacy` generated by the script:

  | Data | Linked to the user | Ad tracking | Use |
  |---|---|---|---|
  | Email address, name, identifier | yes | no | app functionality |
  | Approximate location | yes | no | reminder before chkia (rounded to a tenth of a degree, erased as soon as the reminder is turned off) |
  | App interactions | yes | no | analytics (PostHog) |
  | Crash data | no | no | app functionality |

  Privacy policy URL:
  `https://petite-jerusalem.fr/confidentialite`.
- **Listing texts**: they live in the repo
  (`store-assets/metadata/ios/<locale>/`) and are pushed by
  `node scripts/appstore-listing.mjs`; no need to retype them.
  Check beforehand: `node scripts/appstore-listing.mjs --check` (character
  limits **and** characters refused by App Store Connect; emojis, accepted
  by the Play Store, are forbidden here). The « Nouveautés » ("What's New")
  come from the body of the tag's GitHub release, one section per language,
  otherwise from a default sentence (see `docs/ios-ci-cd.md`).
  **Done (08/14/2026)**: the 3.7.0 listing (fr-FR) was filled in by hand in
  App Store Connect, copyright "© 2026 Phenixel" included; subsequent CI
  pushes will keep it aligned with the repo.
- **Screenshots**: two series, since the app is universal (iPhone + iPad).
  - **iPhone 6.9 inches**: 1320 × 2868, 1290 × 2796 or 1260 × 2736.
  - **iPad 13 inches**: 2064 × 2752 or 2048 × 2732.

  sRGB PNG or JPEG **without transparency**. Apple resizes for the smaller
  devices of each family. Now regenerated (the same set as the Play
  listing) and sent automatically on every tag
  (`scripts/asc-screenshots.mjs`), see
  [ios-ci-cd.md](ios-ci-cd.md#screenshots).

## Step 6. CI/CD

Create the five GitHub secrets and check the workflow: everything is in
[ios-ci-cd.md](ios-ci-cd.md). Once in place, a `vX.Y.Z` tag publishes the
site and the Android app **and** sends the iOS build to TestFlight.

## Step 7. TestFlight

1. Push a tag (`git tag v3.7.0 && git push origin v3.7.0`) or run
   "Deploy iOS" by hand from the Actions tab.
2. The build appears in TestFlight after 5 to 30 min of processing.
3. **Internal testing**: add yourself as an internal tester, install
   TestFlight on the iPhone, go through the checklist of step 4 again on
   the build signed for distribution (that is where entitlement errors
   show up: production push, Sign in with Apple).
4. Optional: external testing (up to 10,000 testers, requires a light Apple
   review, ~24 h).

## Step 8. Submission

Automatic since the `submit` job of deploy-ios.yml exists: it waits for the
build to be processed, attaches it to the tag's version and submits it for
review (`scripts/asc-submit.mjs`, can be switched off with the repo variable
`IOS_AUTO_SUBMIT=false`). By hand if needed: in App Store Connect, on the
version, select the TestFlight build then **Add for Review**.

**Release to sale** requires nothing either: `scripts/appstore-listing.mjs`
sets the version to `releaseType AFTER_APPROVAL` on every run, so Apple
publishes it as soon as review is passed. The mode is reapplied even on a
version that already existed, so a choice made by hand in App Store Connect
does not hold from one tag to the next: the repo decides. To take back
control, repo variable `IOS_AUTO_RELEASE=false`, and the version goes back
to release on click.

**Status (08/14/2026)**: the notes below are pasted into version 3.7.0, the
demo account is filled in, the release mode is set by the CI
(**automatic as soon as Apple approves**), the screenshots (6 × iPhone
6.9", 1 × iPad 13") are uploaded and the content rights are declared. All
that is missing is the build (set by the tag) and the "Add for Review"
click.

**Review notes** (« Notes » field), to copy as is (they stay in French, as
submitted to Apple):

> L'app est gratuite, sans publicité ni achat intégré. La lecture des textes
> ne demande pas de compte : vous pouvez tester la bibliothèque, les horaires
> et les chiourim sans vous connecter.
>
> Pour les fonctions liées à un compte (session de lecture partagée,
> progression, rappels), un compte de test est fourni ci-dessous. La
> connexion « Sign in with Apple » est proposée à côté de la connexion
> Google, et le compte peut être supprimé depuis Profil → Sécurité →
> Supprimer mon compte.
>
> Deux fonctions **n'existent que dans l'application** et sont absentes du
> site web :
>
> 1. **Lecture hors ligne**, les textes (Talmud, Michna, Tanakh) se
>    téléchargent sur l'appareil depuis l'onglet Téléchargements et se lisent
>    sans aucune connexion. Pour le vérifier : télécharger un livre, activer
>    le mode avion, l'ouvrir.
> 2. **Notifications de rappel de lecture** (APNs), réglables depuis la
>    cloche de la page « Lecture du jour » : un rappel à l'heure choisie, et
>    un second 20 minutes avant le coucher du soleil, calculé pour la
>    position de l'appareil.
>
> S'y ajoutent la connexion « Sign in with Apple » native et le calcul des
> horaires (zmanim) à partir de la position de l'appareil, effectué localement.

(In short: the app is free, with no ads or in-app purchases, and reading
requires no account; a test account is provided for account features; Sign
in with Apple sits next to Google sign-in, and the account can be deleted in
the app. Two features exist only in the app: offline reading of downloaded
texts, and reading reminder notifications; plus native Sign in with Apple
and zmanim computed locally from the device's location.)

Also fill in a **demo account** (username + password) in the dedicated
section: without it, review is rejected on the first round.

### Likely rejection reasons, and what has already been done about them

| Guideline | Risk | Status |
|---|---|---|
| **4.2 Minimum Functionality** ("wrapped website") | the most likely for a Capacitor app, but the app does much more than the site | offline reading and reminder notifications **exist only in the app**; native geolocation and Sign in with Apple come on top. The first two are detailed in the review notes, with the steps to check them |
| **4.8 Sign in with Apple** (mandatory as soon as another third-party login exists) | high if forgotten | implemented, button visible only on iOS |
| **5.1.1(v) Account deletion** in the app | high if forgotten | Profil → Sécurité → Supprimer mon compte (Profile → Security → Delete my account) |
| **2.1** missing demo account | almost systematic | to fill in in the submission form |
| **5.1.2** inconsistent privacy labels | medium | step 5 table aligned with `PrivacyInfo.xcprivacy` |
| **2.3** unrepresentative screenshots | low | same screens as the Play Store listing |

In case of rejection, Apple replies in the **Resolution Center**: fix, push a
new tag (patch +1) and resubmit; no need to redo the listing.

## Summary

Status as of 08/14/2026:

- [x] Apple ID with 2FA, name identical to the ID document
- [x] Apple Developer Program (individual) approved, $99/year
- [x] DSA status declared in App Store Connect (**non-trader**, at the
      account level, see step 5 for the future switch to trader)
- [x] App ID `fr.petitejerusalem.app` + Push and Sign in with Apple capabilities
- [x] APNs `.p8` key created and saved, uploaded to Firebase (dev and
      prod), Apple provider enabled
- [x] Firebase iOS app created, `GoogleService-Info.plist` at the repo root
- [x] `npx cap add ios` + `node scripts/setup-ios.mjs` + simulator build OK
      (WebView fix: PR #145)
- [x] App created in App Store Connect (version 3.7.0), privacy, 4+ rating,
      content rights, fr-FR listing and screenshots filled in
- [x] GitHub secrets created
- [x] Demo account + review notes filled in, automatic release as soon as
      Apple approves (set by the CI)
- [ ] Tag `v3.7.0` pushed → "Deploy iOS" workflow green (first real run)
- [ ] TestFlight build checked on a real iPhone (Apple sign-in, push,
      location, which cannot be checked in the simulator)
- [ ] Build selected on the version, "Add for Review"
