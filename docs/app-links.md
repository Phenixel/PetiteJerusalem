# App links: a site link opens the installed app

A link to `https://petite-jerusalem.fr/...`, received in a message or found
on a page, opens the app directly when it is installed on the device;
otherwise it opens in the browser, as before. Nothing to do on the user's
side, no banner, no extra click: the system decides, based on a proof that
the site publishes.

Two mechanisms, one per platform, but the same principle:

| Platform | Mechanism | File served by the site |
| --- | --- | --- |
| Android | App Links | `/.well-known/assetlinks.json` |
| iOS | Universal Links | `/.well-known/apple-app-site-association` |

At installation (Android) or at first launch (iOS), the system reads this
file on the domain and checks that it does designate the installed app. The
domain thus proves it belongs to the app, and the app that it belongs to
the domain: nobody can hijack the site's links by publishing an app that
claims them.

## What the repository keeps

A single source, `scripts/lib/app-links.mjs`: the domain, the app
identifier, and **the list of paths** that open the app. Three consumers:

- `scripts/well-known.mjs` writes the two proof files into `dist/` at the
  end of `npm run build`; `firebase.json` serves them with the right content
  type;
- `scripts/setup-android.mjs` sets the manifest's `autoVerify`
  intent-filter;
- `scripts/setup-ios.mjs` declares `applinks:petite-jerusalem.fr` in the
  entitlements, and `scripts/ios-signing.mjs` enables the Associated Domains
  capability on the App ID before creating the signing profile.

Once the app is open, the `appUrlOpen` listener in `src/main.ts` navigates
to the requested page, the same one the widgets use.

Translated pages live under a language prefix (`/en`, `/he`; French stays
at the root) and their routes are not hard-coded in the router, they are
derived from `SECTION_SLUGS`. The test rebuilds them from this table rather
than reading `routes.ts`: otherwise a translated section added later would
open in the browser without anything flagging it.

The list of paths is **positive**: whatever is not in it stays in the
browser. This is not a matter of form. `/__/auth/` is the Firebase Auth
redirect (`authDomain` is the site's domain): captured by the app, it would
cut a Google sign-in short mid-flight on the mobile web. The same goes for
`/og/`, `/texts/`, `/assets/` and `/fonts/`, which are not pages. A test
keeps the list up to date in both directions
(`src/__tests__/appLinks.test.ts`): any route added to the router without
its prefix fails the check.

## The two values to provide

They describe signing keys, which are not in the repository. They are
public once served (anyone can read the site's `.well-known` files), but
they must be exact: with a wrong fingerprint, the system silently refuses
to open the app.

| Value | Where it comes from |
| --- | --- |
| `ANDROID_APP_LINK_SHA256` | Play Console → Test and release → App integrity → App signing: the **SHA-256** fingerprint of the app signing certificate. Add to it, separated by a comma, the one from the upload certificate, otherwise builds installed outside the Play Store (test APKs) do not verify. |
| `IOS_DEVELOPMENT_TEAM` | Apple Team ID (10 characters), already used by `scripts/setup-ios.mjs` and already present as a GitHub secret. |

Two ways to provide them, your choice:

- **through the environment** (what the CI does): the `deploy.yml` workflow
  passes them to the build from the repository secrets. So the
  `ANDROID_APP_LINK_SHA256` secret still has to be created;
- **hard-coded** in `scripts/lib/app-links.mjs` (`ANDROID_SHA256_DEFAULT`
  and `APPLE_TEAM_ID_DEFAULT`), if you prefer the repository to be
  self-sufficient.

Without them, the build still passes: the script prints a warning and does
not write the file concerned. A missing file leaves the links in the
browser; a file that is present but wrong would make the system believe
verification took place.

```bash
# Check what the build produces, without deploying anything
ANDROID_APP_LINK_SHA256="AB:CD:…:EF" IOS_DEVELOPMENT_TEAM=XXXXXXXXXX npm run build
cat dist/.well-known/assetlinks.json
```

## Checking for real

Once the site is deployed and the app installed:

```bash
# What the site serves (both must respond with JSON, without a redirect)
curl -sI https://petite-jerusalem.fr/.well-known/assetlinks.json
curl -s  https://petite-jerusalem.fr/.well-known/apple-app-site-association

# What Android verified on the connected device
adb shell pm get-app-links fr.petitejerusalem.app
# "verified" expected for petite-jerusalem.fr; otherwise, force a new
# verification: adb shell pm verify-app-links --re-verify fr.petitejerusalem.app

# Open a link the way a message would
adb shell am start -a android.intent.action.VIEW -d "https://petite-jerusalem.fr/tehilim"
```

On iOS, the file is fetched by Apple's CDN, not by the device: propagation
after a change takes hours. To test without waiting, install a development
profile and enable Settings → Developer → Associated Domains Development.

## Known pitfalls

- **The file must be served without a redirect or authentication**, over
  HTTPS, with `Content-Type: application/json`. That is why `firebase.json`
  declares an explicit header for `apple-app-site-association`, which has no
  extension, and why the hosting `ignore` list no longer hides files
  starting with a dot: `.well-known/` is one of them.
- **Changing the signing key changes the fingerprint.** Moving to a new
  Play signing key (or enabling Play App Signing) breaks the links until
  `assetlinks.json` is updated; both fingerprints can coexist in the file.
- **Android only verifies at installation** and during app updates: a file
  fixed after the fact only takes effect on reinstallation or after
  `pm verify-app-links --re-verify`.
- **A single declared host** (`petite-jerusalem.fr`): any host added to the
  intent-filter must serve its own proof, otherwise verification fails for
  all of them.
- **The iOS file applies to all installed versions.** Served by the site,
  `apple-app-site-association` takes effect as soon as the web is deployed,
  including for app versions that do not yet know a new page: they would
  open it on a page-not-found. A new page therefore stays in the browser on
  iPhone (`IOS_DEFERRED_PATHS`) as long as versions predating it are in
  circulation; it leaves the list when the oldest version still in
  circulation knows it. Currently: `/sidour`, which arrived with the Sidour
  page, `/parcours`, which arrived with Mon parcours ("My journey"),
  `/accueil` (the home setting, `/accueil/modifier`), `/contact`
  (« Nous écrire » ("Write to us"), which arrived with the team's replies)
  and `/aide`, the help center, which arrived with 4.0.
  Android does not have this issue, since its intent-filter is frozen in
  each version. Enforced by `src/__tests__/appLinks.test.ts`.
