# Staging environment

A second environment, complete and separate from production, to try out
"for real" what will ship in the next release: on the phone, with a real
backend, without anyone else seeing it.

|                    | Production                                     | Staging                                          |
| ------------------ | ---------------------------------------------- | ------------------------------------------------ |
| Firebase project   | `petite-jerusalem-dev` (yes, this is prod)     | `petite-jerusalem-staging`                       |
| Site               | https://petite-jerusalem.fr                    | https://petite-jerusalem-staging.web.app         |
| App                | « Petite Jérusalem », `fr.petitejerusalem.app` | « PJ Staging », `fr.petitejerusalem.app.staging` |
| iOS                | App Store                                      | TestFlight only (internal testers)               |
| Android            | Play Store, production track                   | Play Store, internal testing track               |
| Update             | `vX.Y.Z` tag                                   | each merge into `main`                           |
| Audience analytics | PostHog                                        | turned off                                       |

The two apps have different identifiers: they install side by side on the
same phone, and the staging icon carries an orange « STAGING » banner
(`assets/staging/`). Each has its own accounts, sessions and data: an
account created in staging does not exist in production.

## How it gets updated

[deploy-staging.yml](../.github/workflows/deploy-staging.yml) runs on each
merge into `main` (unless only documentation changes):

1. the site and the whole staging backend: hosting, Firestore rules and
   indexes, Storage rules, functions;
2. the Android app, built by `deploy-android.yml` with
   `environment: staging`, uploaded to the internal testing track;
3. the iOS app, built by `deploy-ios.yml` with `environment: staging`,
   uploaded to TestFlight, with no listing and no submission for review.

The production workflows are the ones that build the staging apps: what is
tested in staging is what will ship at the next tag. The displayed version
is that of the next patch (3.10.12 when 3.10.11 is the latest release),
and the build number grows with each merge.

To try a branch **before** merging it: Actions, "Deploy Staging", "Run
workflow", choose the branch. With the « Construire aussi les apps » ("Also
build the apps") box unchecked, only the site and the backend are
deployed.

Production is not affected: it always ships, and only, on `vX.Y.Z` and
`web-vX.Y.Z` tags.

## Installing the staging app on your phone

- **iPhone**: install TestFlight from the App Store, accept the invitation
  received by email (internal tester group of « PJ Staging »). In
  TestFlight, enable automatic updates: each merge arrives on its own,
  about ten minutes after the run finishes.
- **Android**: open the internal testers sign-up link (Play Console,
  « PJ Staging », Internal testing, Testers, "Copy link"), accept, then
  install from the Play Store. Updates follow as for any other app.

## Setup, once and for all

### Already done (October 14, 2026)

- Firebase project `petite-jerusalem-staging` created, attached to the
  « Firebase Payment » billing account (Blaze, required for functions).
- Firebase apps registered: web, Android and iOS
  (`fr.petitejerusalem.app.staging`).
- APIs enabled, Firestore `(default)` database in `nam5` like production,
  default Storage bucket.
- Authentication: email and password, anonymous, Apple. Authorized
  domains: `localhost` and the project's two Firebase domains.
- Firestore rules, indexes and Storage rules deployed.
- `NOTION_API_KEY` secret created with a dummy value, from the time when
  the feedback form wrote to Notion; it is no longer used (messages go to
  the project's `support` collection, see `docs/feedback.md`).
- Public content copied over from production (see below).
- Google sign-in enabled (public name « PJ Staging »), APNs key
  `JP8UH7DW9U` (the same as production) imported for the iOS app.
- Apple: App Group `group.fr.petitejerusalem.app.staging`, App IDs
  `fr.petitejerusalem.app.staging` and
  `fr.petitejerusalem.app.staging.PjWidgets` attached to the group, App
  Store Connect listing « PJ Staging » (SKU `pj-staging`), internal
  TestFlight group « Staging » with automatic distribution.
- Google Play: app « PJ Staging » created, internal testers list
  « PJ Staging » (separate from the beta testers list), `play-ci@` account
  authorized to deploy to this app's testing tracks only (never to
  production). SHA-1 fingerprints of the debug key, the upload key and the
  production Play key added to the Firebase Android app.
- Secrets `GOOGLE_SERVICE_INFO_PLIST_STAGING` and
  `GOOGLE_SERVICES_JSON_STAGING`, variable `STAGING_PLAY_STATUS=draft`.

### To be done by the owner

1. **IAM permissions.** `bash scripts/setup-staging-iam.sh`: the CI service
   account and its roles, service agent roles (without them the functions
   build fails), GitHub identity federation (the organization forbids
   service account keys: the CI does not need one). Then
   `firebase deploy --only functions --project petite-jerusalem-staging`.

   Done on October 14, 2026. The script still stops at its step 3 (it
   tries a key, which the organization refuses): identity federation was
   set up by hand, with `gcloud iam workload-identity-pools create github`,
   `providers create-oidc github` (condition
   `assertion.repository == 'Phenixel/PetiteJerusalem'`) and the
   `roles/iam.workloadIdentityUser` role of the `github-staging@` account
   for this repository. The HTTP and callable functions also received
   `roles/run.invoker` for `allUsers` (a first failed deployment had
   created them without it): to be replayed if they are ever recreated,
   like `socialPreview` in production.

2. **Google sign-in.** Firebase console, `petite-jerusalem-staging`,
   Authentication, Sign-in method, Google, Enable. The OAuth client this
   creates cannot be obtained through the API.
3. **iOS notifications.** Firebase console, Project settings, Cloud
   Messaging, iOS app: upload the APNs key (`.p8`), the same one as
   production.
4. **Apple** (developer.apple.com then App Store Connect):
   - Identifiers, App Groups: create `group.fr.petitejerusalem.app.staging`;
   - Identifiers, App IDs: create `fr.petitejerusalem.app.staging`
     (capabilities Push Notifications, Sign in with Apple, Associated
     Domains, App Groups, with the group above) and
     `fr.petitejerusalem.app.staging.PjWidgets` (App Groups, same group).
     The first run creates the watch App ID;
   - App Store Connect, Apps, "+", New App: name « PJ Staging », bundle id
     `fr.petitejerusalem.app.staging`, SKU `pj-staging`. It will never be
     submitted for review;
   - TestFlight, Internal Testing: create a group, add yourself to it,
     check automatic distribution.
5. **Google Play** (Play Console):
   - Create an app « PJ Staging », package `fr.petitejerusalem.app.staging`
     (the package is fixed by the first AAB uploaded);
   - Users and permissions: give the CI service account (the one in
     `PLAY_SERVICE_ACCOUNT_JSON`) release permissions on this app;
   - Internal testing: create the testers list, sign up for it;
   - As long as the app has never been published, Google only accepts
     drafts: set the repo variable `STAGING_PLAY_STATUS=draft`, run the
     workflow, publish the first internal version by hand in the Play
     Console, then delete the variable;
   - App integrity: note the SHA-1 and SHA-256 fingerprints of the app
     signing key (and of the upload key), add the SHA-1s to the Android app
     in Firebase
     (`firebase apps:android:sha:create <appId> <sha1> --project petite-jerusalem-staging`),
     otherwise Google sign-in fails on Android.
6. **GitHub secrets**, once steps 2 and 5 are done (the files then contain
   the OAuth clients):

   ```bash
   firebase apps:sdkconfig IOS 1:388713166885:ios:212434ccb7ae259b8967cc --project petite-jerusalem-staging -o GoogleService-Info.staging.plist
   gh secret set GOOGLE_SERVICE_INFO_PLIST_STAGING < GoogleService-Info.staging.plist
   firebase apps:sdkconfig ANDROID 1:388713166885:android:925b74bbec5396e48967cc --project petite-jerusalem-staging -o google-services.staging.json
   gh secret set GOOGLE_SERVICES_JSON_STAGING < google-services.staging.json
   rm GoogleService-Info.staging.plist google-services.staging.json
   ```

   Optional: `ANDROID_APP_LINK_SHA256_STAGING` (SHA-256 fingerprints from
   step 5, separated by commas), so that links on the staging site open the
   staging app on Android.

The other secrets (App Store Connect key, Android signing, Play account)
are the production ones: same developer account, same upload key.

## Content

The staging database starts with production's **public** content:
chiourim, authors, series and information items. Never sessions, reports,
studio tokens or account preferences: those are personal data (GDPR). To
copy:

```bash
node scripts/staging-sync.mjs --compte admin@phenixel.fr              # essai
node scripts/staging-sync.mjs --compte admin@phenixel.fr --confirmer  # copie
```

Without `--compte`, the script uses the workstation's ADC. Audio files are
not copied: staging chiourim play the production ones.

## Building for staging on your workstation

Everything that depends on the environment is read from
[scripts/lib/environments.mjs](../scripts/lib/environments.mjs), based on
the `PJ_ENV` variable (`staging`, or nothing for production):

```bash
PJ_ENV=staging npm run build
PJ_ENV=staging npx cap add ios && cp -R assets/staging/. assets/ && PJ_ENV=staging node scripts/setup-ios.mjs
```

`npm run dev` stays wired to the local emulators, whatever `PJ_ENV` is.
The `ios/` and `android/` folders keep the identity of the environment
that generated them: regenerate them to switch from one to the other (and
restore the icons with `git checkout assets/`).

## Staging stands on its own

The staging app reads the texts it does not bundle (corpus, commentaries,
Vilna lines) from the staging site, and its share links (a passage, a
session, a chiour, a poll) lead to the staging site, which the staging app
claims: a new feature merged into main shows up in the app before it exists
in production. The address comes from `PJ_ENV` through
`src/config/environment.ts` (`APP_SITE_URL`); in production, it is
`petite-jerusalem.fr`, as before. A production address hard-coded in the
app's code fails `src/__tests__/environments.test.ts`.

## What still differs from production

- Canonical addresses and structured data point to `petite-jerusalem.fr`,
  on purpose: staging copies the site, it must not become a second address
  for it in a search engine.
- The chiourim audio files are the production ones (see "Content").
- Messages from « Nous écrire » ("Write to us") arrive in the staging
  backoffice, not in the production one.
- The staging site is closed to crawlers (`robots.txt`).
- The iOS widgets open the app through the `petitejerusalem://` scheme,
  shared by both apps: with both installed, iOS picks one or the other.
- App Store Connect caps the account at three distribution certificates: a
  staging iOS run creates its own and keeps it while Apple processes the
  uploaded build (marker « PetiteJerusalem CI staging build 141 »), then
  the next signing run revokes it. Revoking it right after upload caused
  the build to be rejected during processing ("ITMS-90721: Certificate
  Revoked", build 141 on October 16, 2026). Signing runs (production and
  staging) go one after the other (`apple-signing` concurrency group, see
  `scripts/ios-signing.mjs` and
  [ios-ci-cd.md](ios-ci-cd.md#the-quota-of-three-distribution-certificates)).

## Cost

The project is on the Blaze plan, like production. At the volume of one
tester, everything fits within the free quotas (Firestore, Storage,
functions, Hosting, Identity Platform up to 50,000 monthly active users).
The macOS runners for iOS builds are free as long as the repository is
public.
