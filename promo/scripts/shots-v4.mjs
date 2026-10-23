/**
 * The shots of version 4.0, filmed by scripts/captures.mjs (`--set v4`, the
 * default). Each one is filmed in the three languages of the interface: the
 * "what's new" video plays in the app in the reader's language
 * (src/videos.ts, `nouveautes-*`), and the social video takes the French
 * ones.
 *
 * Names: `<locale>-<shot>`, plus `-NN` for the frames of a sequence. The
 * areas a scene needs (a tab, a button) are recorded as marks.
 *
 * All of today's shots are filmed on a Thursday morning (a weekday, the
 * deck on Cha'harit and the morning's texts), on the demo account and its
 * Mon parcours (scripts/demo-parcours.mjs). The "before" shots film the
 * 3.10 app: its tab bar, the one the update replaces.
 */

export const LOCALES = ["fr", "en", "he"];

/** A Thursday, 8:40 in Paris: in the past, so the demo account's token stays valid. */
const CLOCK = "2026-10-15T08:40:00+02:00";

const SESSION = "/share-reading/session/tehilim-pour-la-communaute";
const NICHMAT = "/share-reading/session/nichmat-40-pour-rivka";
const CHAHARIT = "/bibliotheque/sidour/chaharit";
const BERAKHOT = "/bibliotheque/talmud/berakhot/1";

/** A tab of the bottom bar, by its address (the same in every language, before and after). */
const TAB = (path) => `nav a[href="${path}"]`;

/** Removes the card that says some of the day's texts are not downloaded: a demo device's state. */
async function hideOfflineNotice(t) {
  const message = await t.L("parcours.offline.missing");
  const words = message
    .split("|")
    .pop()
    .split(/\{count\}/)
    .map((s) => s.trim())
    .sort((a, b) => b.length - a.length)[0]
    .slice(0, 24);
  await t.page.evaluate((words) => {
    for (const card of document.querySelectorAll(".card")) {
      if (card.textContent.includes(words)) card.remove();
    }
  }, words);
  await t.wait(300);
}

/** Puts the reader back on the plain text form (the page form choice is remembered). */
async function plainForm(t) {
  await t.page.evaluate(async () => {
    const { usePageForm } = await import("/src/composables/usePageForm.ts");
    usePageForm().set(false);
  });
}

/** Turns the translation off again (the choice is remembered). */
async function translationOff(t) {
  const toggle = t.page.locator(`button:has-text("${await t.L("textReading.translation.toggle")}") >> visible=true`).first();
  if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
}

function shotsFor(locale) {
  const now = { locale, clock: CLOCK, parcours: true, mocks: true };
  const before = { locale, app: "before" };
  const name = (shot) => `${locale}-${shot}`;
  const translated = locale !== "he";
  return [
    {
      // The 3.10 home page: its tab bar, Bibliothèque and Chiourim.
      name: name("avant"),
      look: before,
      async run(t) {
        await t.open("/", { css: "nav a[href='/chiourim']" });
        await t.snap();
        await t.mark("bar", t.page.locator("nav").last());
        await t.mark("home", t.page.locator(TAB("/")));
        await t.mark("library", t.page.locator(TAB("/bibliotheque")));
        await t.mark("chiourim", t.page.locator(TAB("/chiourim")));
        await t.mark("profile", t.page.locator(TAB("/profile")));
      },
    },
    {
      // Today's home page: the deck, the shelf, the new tab bar.
      name: name("accueil"),
      look: now,
      async run(t) {
        await t.open("/", { css: TAB("/sidour") });
        await hideOfflineNotice(t);
        await t.snap();
        await t.mark("bar", t.page.locator("nav").last());
        await t.mark("home", t.page.locator(TAB("/")));
        await t.mark("sidour", t.page.locator(TAB("/sidour")));
        await t.mark("study", t.page.locator(TAB("/bibliotheque")));
        await t.mark("profile", t.page.locator(TAB("/profile")));
        await t.mark("lamp", t.page.locator('a[href="/parcours"]'));
      },
    },
    {
      name: name("sidour"),
      look: now,
      async run(t) {
        await t.open("/sidour", { css: "main" });
        await t.snap();
        await t.mark("moment", t.page.locator("a.sidour-hero"));
      },
    },
    {
      // The streak light turns (the galaxy's arms): a few frames, then the whole page for the wall.
      name: name("parcours"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/parcours", { css: "main" });
        await hideOfflineNotice(t);
        await t.film(12, 110);
        await t.mark("streak", t.page.locator("main section").first());
        await t.snapFull();
      },
    },
    {
      name: name("objectif"),
      look: now,
      async run(t) {
        await t.open("/parcours/nouveau", { css: "main" });
        await t.snap();
      },
    },
    {
      // Étude: Bibliothèque, then Chiourim, then Partage; the pill slides from one tab to the next.
      name: name("etude"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/bibliotheque", { css: "[role=group] button" });
        const tabs = t.page.locator("[role=group] button");
        await t.mark("tab0", tabs.nth(0));
        await t.mark("tab1", tabs.nth(1));
        await t.mark("tab2", tabs.nth(2));
        await t.snap();
        await t.slow(0.2);
        await t.tapOn(tabs.nth(1));
        await t.film(6, 70);
        await t.slow(1);
        await t.wait(2200);
        await t.snap();
        await t.slow(0.2);
        await t.tapOn(t.page.locator("[role=group] button").nth(2));
        await t.film(6, 70);
        await t.slow(1);
        await t.wait(2200);
        await t.snap();
      },
    },
    {
      // The Talmud text, then « Page »: the Vilna page.
      name: name("daf"),
      look: now,
      frames: true,
      async run(t) {
        await plainForm(t);
        await t.open(BERAKHOT, { css: "main" });
        const page = t.page.locator(`button:has-text("${await t.L("textReading.pageForm.daf")}") >> visible=true`).first();
        await t.mark("page", page);
        await t.snap();
        await t.slow(0.2);
        await page.click();
        await t.film(5, 120);
        await t.slow(1);
        await t.wait(3500);
        await t.snap();
        await plainForm(t);
      },
    },
    ...(translated
      ? [
          {
            // The translation under the Hebrew (the AI French Talmud, the English one).
            name: name("traduction"),
            look: now,
            async run(t) {
              await t.open(BERAKHOT, { css: "main" });
              const toggle = t.page.locator(`button:has-text("${await t.L("textReading.translation.toggle")}") >> visible=true`).first();
              await t.mark("toggle", toggle);
              await toggle.click();
              await t.wait(4000);
              await t.snap();
              // The AI notice shows above a French translation only (the English one is Steinsaltz's).
              const notice = t.page.locator(`p:has-text("${(await t.L("textReading.translation.aiNotice")).slice(0, 20)}")`);
              if (await notice.count()) await t.mark("notice", notice);
              await translationOff(t);
            },
          },
        ]
      : []),
    {
      // A passage touched: its sheet, then its commentaries.
      name: name("commentaires"),
      look: now,
      frames: true,
      async run(t) {
        await t.open(BERAKHOT, { css: "main" });
        await t.snap();
        await t.slow(0.25);
        await t.tap(200, 480);
        await t.film(4, 90);
        await t.slow(1);
        await t.wait(1500);
        await t.snap();
        const open = t.page.locator(`button:has-text("${await t.L("textReading.commentaries.open")}") >> visible=true`).last();
        await t.mark("open", open);
        await t.slow(0.25);
        await open.click();
        await t.film(4, 90);
        await t.slow(1);
        await t.wait(2500);
        await t.snap();
      },
    },
    {
      name: name("halakha"),
      look: now,
      async run(t) {
        await t.open("/bibliotheque/halakha", { css: "main" });
        await t.snap();
      },
    },
    {
      // Haazinou in the form of the scroll.
      name: name("tikoun"),
      look: now,
      async run(t) {
        await t.open("/bibliotheque/tanakh/haazinu", { css: "main" });
        await t.page.locator(`button:has-text("${await t.L("textReading.pageForm.scroll")}") >> visible=true`).first().click();
        await t.wait(3500);
        await t.snap();
        await plainForm(t);
      },
    },
    {
      // Psalm 23 gets the red ribbon of its bookmark.
      name: name("signet"),
      look: now,
      async run(t) {
        await t.open("/bibliotheque/tehilim/23", { css: "main" });
        await t.tap(200, 470);
        await t.wait(1200);
        await t.page.locator(`button:has-text("${await t.L("textReading.selection.bookmark")}") >> visible=true`).first().click();
        await t.wait(1500);
        await t.page.mouse.click(5, 5);
        await t.wait(800);
        await t.snap();
      },
    },
    {
      // The presentation of the app (`presentation`): Étude's Partage tab,
      // the chain's card touched, its page; the reader's psalms follow
      // (`tehilim`).
      name: name("chaine"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/bibliotheque", { css: "[role=group] button" });
        await t.tapOn(t.page.locator("[role=group] button").nth(2));
        await t.wait(2600);
        await t.mark("card", { card: "Tehilim pour la communauté" });
        await t.snap();
        await t.page.locator("text=Tehilim pour la communauté >> visible=true").first().click();
        await t.page.locator("main >> visible=true").first().waitFor();
        await t.wait(2600);
        await t.snap();
      },
    },
    {
      // The presentation of the app: the day's times in Paris, the next one
      // in large, then the whole list (for a scroll in the edit).
      name: name("horaires"),
      look: now,
      async run(t) {
        await t.open("/horaires/paris", { css: "[data-zman-list]" });
        await t.mark("next", t.page.locator(".card.bg-primary\\/5"));
        await t.mark("list", t.page.locator("[data-zman-list]"));
        await t.snap();
        await t.snapFull();
      },
    },
    {
      // Every psalm taken in the chain, read one after the other.
      name: name("tehilim"),
      look: now,
      async run(t) {
        await t.open(`${SESSION}/lecture`, { css: "main" });
        await t.snap();
      },
    },
    {
      // The week's aliyot: « Montées lues » at the top, from the demo Mon parcours.
      name: name("chnei"),
      look: now,
      async run(t) {
        await t.open("/bibliotheque/chnei-mikra", { css: "main" });
        await t.snap();
      },
    },
    {
      // « Nous écrire »: the badge on the profile tab, then the team's reply.
      name: name("contact"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/profile", { css: "main" });
        await t.snap();
        await t.mark("profile", t.page.locator(TAB("/profile")));
        await t.mark("row", t.page.locator('main a[href="/contact"]'));
        await t.open("/contact/demo-fil", { css: "textarea" });
        await t.snap();
      },
    },
    {
      // Editing the home page: the blocks wobble, « Masquer » on each.
      name: name("modifier"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/?modifier=1", { css: "main" });
        await hideOfflineNotice(t);
        await t.film(6, 90);
      },
    },
    {
      // Searching the Sidour: a word, the prayers that answer it.
      name: name("recherche"),
      look: now,
      async run(t) {
        await t.open("/sidour", { css: "a.sidour-hero" });
        const field = t.page.locator(`input[placeholder="${await t.L("sidour.search.placeholder")}"]`);
        await field.click();
        await field.type({ fr: "chema", en: "shema", he: "שמע" }[locale], { delay: 90 });
        await t.wait(1500);
        await t.page.evaluate(() => document.activeElement?.blur());
        await t.wait(600);
        await t.snap();
      },
    },
    {
      // Cha'harit's long text: the progress line slid with a finger, the
      // titles riding on it, the page following.
      name: name("progress"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/bibliotheque/sidour/chaharit", { css: "main" });
        await t.page.mouse.wheel(0, 1500);
        await t.wait(1500);
        const strip = t.page.locator(".scrub-strip").first();
        await t.mark("strip", strip);
        await t.snap();
        const box = await strip.boundingBox();
        const y = box.y + box.height / 2;
        const [from, to] = locale === "he" ? [350, 50] : [40, 340];
        await t.page.mouse.move(from, y);
        await t.page.mouse.down();
        for (let i = 1; i <= 12; i++) {
          await t.page.mouse.move(from + ((to - from) * i) / 12, y, { steps: 3 });
          await t.wait(120);
          await t.snap();
        }
        await t.page.mouse.up();
        await t.film(4, 150);
        await t.wait(1200);
        await t.snap();
      },
    },
    {
      // The top card of the deck, swiped right: « C'est fait », the next one steps up.
      name: name("deck"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/", { css: TAB("/sidour") });
        await hideOfflineNotice(t);
        const card = t.page.locator(".deck a.dk:not([aria-hidden])").first();
        const box = await card.boundingBox();
        await t.mark("card", card);
        await t.snap();
        const dir = locale === "he" ? -1 : 1;
        const x0 = box.x + box.width * (dir > 0 ? 0.3 : 0.7);
        const y = box.y + box.height / 2;
        await t.touch("touchStart", x0, y);
        for (let d = 0; d <= 200; d += 25) {
          await t.touch("touchMove", x0 + d * dir, y);
          await t.wait(40);
          if (d % 50 === 0) await t.snap();
        }
        await t.touch("touchEnd", x0 + 200 * dir, y);
        await t.film(6, 110);
        await t.wait(1200);
        await t.snap();
      },
    },
    {
      // « Mettre de côté »: the page flies into its book in the bar; a second
      // text joins it, then the table opens.
      name: name("table"),
      look: now,
      frames: true,
      async run(t) {
        await t.page.evaluate(() => localStorage.removeItem("pj-reading-table"));
        await t.open(BERAKHOT, { css: "main" });
        const label = await t.L("readingTable.setAside");
        const aside = t.page.locator(`button:has-text("${label}") >> visible=true`).first();
        await t.mark("aside", aside);
        await t.snap();
        await t.slow(0.12);
        await aside.click();
        await t.film(10, 110);
        await t.slow(1);
        await t.wait(2500);
        await t.snap();
        await t.open("/bibliotheque/tehilim/23", { css: "main" });
        await t.page.locator(`button:has-text("${label}") >> visible=true`).first().click();
        await t.wait(2500);
        await t.snap();
        const bar = t.page.locator(`[role=region][aria-label="${await t.L("readingTable.title")}"]`);
        await t.mark("bar", bar);
        const barBox = await bar.boundingBox();
        await t.tap(locale === "he" ? barBox.x + 18 : barBox.x + barBox.width - 18, barBox.y + barBox.height / 2);
        await t.wait(1800);
        await t.snap();
        await t.page.evaluate(() => localStorage.removeItem("pj-reading-table"));
      },
    },
    {
      // A class plays: the bar at the bottom, then the full-screen player.
      name: name("audio"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/chiourim/la-force-de-la-priere", { css: "main" });
        const play = t.page.locator("main button.rounded-full").last();
        await t.mark("play", play);
        await t.snap();
        await play.click();
        await t.wait(2500);
        await t.snap();
        const bar = t.page.locator(`[role=region][aria-label="${await t.L("audioPlayer.nowPlaying")}"] > div`).first();
        await t.mark("bar", bar);
        await t.slow(0.2);
        await bar.click();
        await t.film(6, 100);
        await t.slow(1);
        await t.wait(2500);
        await t.snap();
      },
    },
    {
      // Three books pinned on the home page, the block shown.
      name: name("epingles"),
      look: now,
      async run(t) {
        await t.page.evaluate(() => {
          localStorage.setItem("pj_home_layout", JSON.stringify({ order: ["livres", "horaires", "volumes", "portes", "dates"], hidden: ["reprendre", "ecoute"] }));
          localStorage.setItem("pj_home_pinned", JSON.stringify({ items: ["book:sidour", "book:tehilim", "book:talmud"] }));
        });
        await t.open("/", { css: '[data-block="livres"]' });
        await hideOfflineNotice(t);
        await t.snap();
        await t.page.evaluate(() => {
          localStorage.removeItem("pj_home_layout");
          localStorage.removeItem("pj_home_pinned");
        });
      },
    },
    {
      // The higher contrast mode, switched on as in the appearance settings,
      // then back to following the device for the shots that come after.
      name: name("contraste"),
      look: now,
      async run(t) {
        const setContrast = (on) =>
          t.page.evaluate(async (on) => {
            const { useContrast } = await import("/src/composables/useContrast.ts");
            const { auth } = await import("/src/firebase/core.ts");
            await useContrast().setContrastMore(auth.currentUser?.uid ?? null, on);
          }, on);
        await t.open("/", { css: TAB("/sidour") });
        await setContrast(true);
        await hideOfflineNotice(t);
        await t.wait(1500);
        await t.snap();
        await setContrast(false);
      },
    },
    {
      // The time of the moment, a pill with its sky at the head of
      // Cha'harit; touched, the sheet and the cycle of the day.
      name: name("moment"),
      look: now,
      frames: true,
      async run(t) {
        await t.open(CHAHARIT, { css: ".zman-pill" });
        const pill = t.page.locator(".zman-pill").first();
        await t.mark("pill", pill);
        await t.snap();
        await t.slow(0.3);
        await t.tapOn(pill);
        await t.film(6, 90);
        await t.slow(1);
        await t.wait(2000);
        await t.snap();
        await t.mark("sheet", t.page.locator("[role=dialog] >> visible=true").last());
      },
    },
    {
      // At the end of Cha'harit, the page pushed up past its end: the line
      // grows into « Fin de l'office ».
      name: name("fin"),
      look: now,
      frames: true,
      async run(t) {
        await t.page.evaluate(() => localStorage.removeItem("pj_parcours_occasions"));
        await t.open(CHAHARIT, { css: "main" });
        for (let i = 0; i < 6; i++) {
          await t.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await t.wait(700);
        }
        await t.mark("end", t.page.locator(".reader-end").first());
        await t.snap();
        const [x, y0] = [195, 560];
        await t.touch("touchStart", x, y0);
        for (let i = 1; i <= 12; i++) {
          await t.touch("touchMove", x, y0 - i * 16);
          await t.wait(70);
          await t.snap();
        }
        await t.touch("touchEnd", x, y0 - 192);
        await t.film(4, 150);
        await t.wait(1500);
        await t.snap();
        await t.page.evaluate(() => localStorage.removeItem("pj_parcours_occasions"));
      },
    },
    {
      // A tefila opens on the phone's quiet modes (the Android app): the
      // panel comes down, pushes the app down, then offers its choices;
      // « Ne pas déranger » touched.
      name: name("calme"),
      look: { ...now, android: true },
      frames: true,
      async run(t) {
        await t.open("/sidour", { css: "main" });
        await t.page.goto(`${new URL(t.page.url()).origin}${CHAHARIT}`, { waitUntil: "load" });
        await t.page.locator(".zman-pill >> visible=true").first().waitFor({ timeout: 20000 });
        await t.slow(0.3);
        await t.film(14, 90);
        await t.slow(1);
        await t.wait(3000);
        await t.snap();
        const tile = t.page.locator(".quiet-tile").first();
        await t.mark("panel", t.page.locator(".prayer-quiet"));
        await t.mark("dnd", tile);
        await t.tapOn(tile);
        await t.wait(1200);
        await t.snap();
      },
    },
    {
      // The compass of the Kotel: the phone turns, the dial fills, then locks.
      name: name("boussole"),
      look: now,
      frames: true,
      async run(t) {
        await t.open("/sidour", { css: "main" });
        await t.page.evaluate(async () => {
          const { openKotelCompass } = await import("/src/composables/useKotelCompass.ts");
          openKotelCompass("sidour");
        });
        await t.wait(1500);
        const turn = (heading) =>
          t.page.evaluate((heading) => {
            for (const type of ["deviceorientationabsolute", "deviceorientation"]) {
              const event = new Event(type);
              Object.defineProperties(event, {
                alpha: { value: (360 - heading) % 360 },
                beta: { value: 1 },
                gamma: { value: 0 },
                absolute: { value: true },
                webkitCompassHeading: { value: heading },
                webkitCompassAccuracy: { value: 6 },
              });
              window.dispatchEvent(event);
            }
          }, heading);
        for (const heading of [20, 30, 40, 50, 60, 68, 76, 84, 92, 100, 106, 110, 112, 112, 112]) {
          await turn(heading);
          await t.wait(260);
          await t.snap();
        }
        await t.film(4, 200);
        await t.mark("dial", t.page.locator("[role=dialog] >> visible=true").last());
      },
    },
    {
      // « Les heures de ma journée »: the reminders of Mon parcours.
      name: name("rappels"),
      look: now,
      async run(t) {
        await t.open("/parcours", { css: "main" });
        await t.page.locator(`button[aria-label="${await t.L("parcours.reminders.title")}"]`).first().click();
        await t.wait(1800);
        await t.snap();
      },
    },
    {
      // A Nichmat 40 chain on its tenth day: where the forty days stand, my place.
      name: name("nichmat40"),
      look: now,
      async run(t) {
        await t.open(NICHMAT, { css: "main" });
        await t.wait(1000);
        await t.snap();
      },
    },
    {
      // Nichmat kol 'hai among the services of the Sidour, the Tikoun haklali with the occasions.
      name: name("sidour-ajouts"),
      look: now,
      async run(t) {
        await t.open("/sidour", { css: 'a[href$="/sidour/nichmat-kol-hai"]' });
        const row = t.page.locator('a[href$="/sidour/nichmat-kol-hai"]').first();
        await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await t.wait(800);
        await t.mark("nichmat", row);
        await t.snap();
      },
    },
  ];
}

export const SHOTS = LOCALES.flatMap(shotsFor);
