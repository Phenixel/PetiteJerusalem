# Store listing screenshots

A single set of screenshots for both stores: same screens, same demo data,
same app rendering, produced in one pass by `scripts/store-screenshots.mjs`
(`npm run store:screenshots`).

## Where they are used

| Files | Dimensions | Listing | Uploaded by |
|---|---|---|---|
| `<locale>/phone-*.jpg` | 1080 × 1920 (360 × 640 CSS @3x) | Play Store, phone | `scripts/play-listing.mjs` |
| `<locale>/iphone-*.jpg` | 1320 × 2868 (440 × 956 CSS @3x) | App Store, iPhone 6.9" (`APP_IPHONE_67`) | `scripts/asc-screenshots.mjs` |
| `<locale>/ipad-*.jpg` | 2064 × 2752 (1032 × 1376 CSS @2x) | App Store, iPad 13" (`APP_IPAD_PRO_3GEN_129`) | `scripts/asc-screenshots.mjs` |

Three formats rather than one, because the two stores do not accept the
same aspect ratios: the Play Store rejects an image where one side is more
than twice the other (Apple's 6.9" is at 2.17), and Apple requires its
dimensions to the exact pixel. The content, however, is the same
everywhere.

sRGB JPEG **without an alpha channel**: Apple rejects alpha, Google accepts
JPEG. Uploaded sorted by name; a family's set entirely replaces the one in
the store. A locale without a folder leaves its listing untouched (the
folder uses the name common to both stores, `fr-FR`).

## Screens

In listing order (`SCREENS` in the script):

1. signed-in home (dashboard)
2. today's times (Paris)
3. reading-sharing session
4. text reader (Tehilim 1)
5. library
6. daily reading
7. chiour detail
8. holiday calendar

The Play Store takes at most eight per format, the App Store ten: the count
is set for the Play Store, so one more screen would require removing one.
Together, they cover what the listing description promises: the library
(and its « Tout télécharger » ("Download all") for offline reading),
reading sharing, daily reading and its reminder, chiourim, times and the
calendar.

## Rendering

Headless Chrome, on the Firebase emulators with fixed demo data (account
« Sarah Levy », a Tehilim session, chiourim). The page loads with a
"homemade" Capacitor platform (`window.CapacitorCustomPlatform`): the app
believes it is native and shows its app interface (bottom tab bar, no site
header or footer), its plugins falling back to their web implementation. No
system bar: neither Android's in the App Store listing, nor the reverse.

The demo account has holiday themes turned off: otherwise a listing
generated during a holiday would keep its decoration until the next tag.

## In CI

On each tag, `.github/workflows/store-screenshots.yml` generates the set
once and publishes it as the `store-screenshots` artifact.
`deploy-android.yml` (`listing` job) and `deploy-ios.yml` (`screenshots`
job) fetch it through the `.github/actions/fetch-store-screenshots` action,
which waits for the run to finish if it is still in progress. If generation
fails or takes more than 20 minutes, both listings go out with the
screenshots committed here: the release never waits for the screenshots.

To regenerate without publishing anything: run "Store screenshots" manually
(Actions tab), then download the run's artifact, and commit it here if
needed to refresh the fallback set.
