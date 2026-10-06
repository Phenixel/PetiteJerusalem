/**
 * Les plans filmés par scripts/captures.mjs. Chacun a un nom (préfixe des
 * fichiers de public/captures), un habillage (`look` : thème, clair ou
 * sombre) et une mise en scène (`run`), qui ouvre une page, joue un geste
 * et se capture. `frames: true` numérote les images d'une séquence
 * (nom-00.jpg, nom-01.jpg…).
 */

/** Les habillages employés par les vidéos. */
export const LOOKS = {
  sunset: { theme: "sunset", scheme: "light" },
  ocean: { theme: "ocean", scheme: "light" },
  emerald: { theme: "emerald", scheme: "light" },
  night: { theme: "sunset", scheme: "dark" },
  oceanNight: { theme: "ocean", scheme: "dark" },
};

const SESSION = "/share-reading/session/tehilim-pour-la-communaute";

/**
 * La carte qui contient un texte : le premier parent qui a une ombre ou un
 * fond plein (une surface de la maison), là où un sélecteur de classe
 * dépendrait de la mise en forme du moment.
 */
const CARD = (text) => ({ card: text });

/** Un écran simple : la page, prête, telle qu'elle s'affiche. */
const screen = (look, name, path, readyText, extra = {}) => ({
  name: `${look}-${name}`,
  look: LOOKS[look],
  async run(t) {
    await t.open(path, readyText);
    if (extra.before) await extra.before(t);
    await t.snap();
    for (const [key, selector] of Object.entries(extra.marks ?? {})) {
      await t.mark(key, typeof selector === "string" ? t.page.locator(selector) : selector);
    }
    if (extra.full) await t.snapFull();
  },
});

/** Fait défiler la page jusqu'à un texte, posé à `offset` points du haut. */
async function scrollTo(t, text, offset = 90) {
  await t.page
    .locator(`text=${text} >> visible=true`)
    .first()
    .evaluate((el, off) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off), offset);
  await t.wait(600);
}

/** Envoie un cap à la boussole (useCompassHeading lit 360 - alpha). */
async function heading(t, degrees) {
  await t.page.evaluate((alpha) => {
    window.dispatchEvent(
      new DeviceOrientationEvent("deviceorientationabsolute", { alpha, beta: 0, gamma: 0, absolute: true }),
    );
  }, (360 - degrees + 360) % 360);
}

export const SHOTS = [
  // --- Horaires (sunset) ------------------------------------------------------
  screen("sunset", "accueil", "/", "Ma lecture quotidienne", {
    marks: { fab: "nav [aria-label*='oraires']", occasion: CARD("Anniversaire de Noa"), daily: CARD("Ma lecture quotidienne") },
  }),
  screen("sunset", "horaires", "/horaires/paris", "Paris", {
    full: true,
    marks: { next: "[class*='bg-primary/5']", city: "button:has-text('Paris'):visible", position: "button:has-text('Ma position'):visible" },
  }),
  screen("sunset", "horaires-jerusalem", "/horaires/jerusalem", "Jérusalem"),
  screen("sunset", "horaires-new-york", "/horaires/new-york", "New York"),
  screen("sunset", "horaires-montreal", "/horaires/montreal", "Montréal"),
  {
    // Une ligne tirée vers la gauche jusqu'à sa cloche, puis lâchée : le
    // rappel se pose, le toast le dit.
    name: "sunset-horaires-swipe",
    look: LOOKS.sunset,
    frames: true,
    async run(t) {
      await t.open("/horaires/paris", "Paris");
      const row = t.page.locator("[data-zman-list] > li").nth(2);
      const box = await row.boundingBox();
      const y = box.y + box.height / 2;
      const x0 = box.x + box.width - 40;
      await t.snap();
      await t.touch("touchStart", x0, y);
      for (let d = 0; d <= 260; d += 26) {
        await t.touch("touchMove", x0 - d, y);
        await t.wait(60);
        await t.snap();
      }
      await t.touch("touchEnd", x0 - 260, y);
      for (let i = 0; i < 6; i++) {
        await t.wait(160);
        await t.snap();
      }
      await t.wait(400);
      await t.snap();
      await t.mark("row", row);
    },
  },
  screen("sunset", "lecture-du-jour", "/bibliotheque/lecture-du-jour", "Tehilim 1"),
  screen("sunset", "chiour", "/chiourim/la-force-de-la-priere", "Description"),

  // --- Partage de lecture (ocean) ----------------------------------------------
  screen("ocean", "session", SESSION, "Participe", {
    full: true,
    marks: { share: "button:has-text('Partager'):visible" },
  }),
  {
    // Un psaume libre, coché : il est réservé à son nom.
    name: "ocean-session-reserver",
    look: LOOKS.ocean,
    frames: true,
    async run(t) {
      await t.open(SESSION, "Participe");
      await scrollTo(t, "Tehilim 42", 220);
      await t.snap();
      // Trois psaumes cochés l'un après l'autre, puis la réservation confirmée.
      const box = (n) =>
        t.page
          .locator(`text=Tehilim ${n} >> visible=true`)
          .first()
          .locator("xpath=ancestor::*[.//input[@type='checkbox']][1]")
          .locator("input[type=checkbox]")
          .first();
      for (const n of [42, 43, 44]) await t.mark(`box${n}`, t.page.locator(`text=Tehilim ${n} >> visible=true`));
      for (const n of [42, 43, 44]) {
        await box(n).check({ force: true });
        await t.wait(250);
        await t.snap();
        await t.wait(250);
        await t.snap();
      }
      await t.mark("confirm", t.page.locator("button:has-text('Confirmer'):visible"));
      await t.page.locator("button:has-text('Confirmer'):visible").first().click();
      for (let i = 0; i < 5; i++) {
        await t.wait(300);
        await t.snap();
      }
    },
  },
  {
    name: "ocean-session-partager",
    look: LOOKS.ocean,
    async run(t) {
      await t.open(SESSION, "Participe");
      await t.page.locator("button:has-text('Partager'):visible").first().click();
      await t.wait(1200);
      await t.snap();
    },
  },

  // --- Bibliothèque et lecteur (emerald) ---------------------------------------
  screen("emerald", "bibliotheque", "/bibliotheque", "Bibliothèque", {
    marks: { download: "button:has-text('Tout télécharger'):visible", tehilim: "text=Tehilim >> visible=true" },
  }),
  screen("emerald", "tehilim", "/bibliotheque/tehilim", "Tehilim 1"),
  screen("emerald", "tehilim-23", "/bibliotheque/tehilim/23", "Phonétique", {
    full: true,
    marks: { phonetique: "button:has-text('Phonétique'):visible", plus: "button:has-text('A+'):visible" },
  }),
  // Un psaume long, pour le défilement automatique.
  screen("emerald", "tehilim-119", "/bibliotheque/tehilim/119", "Phonétique", { full: true }),
  {
    name: "emerald-tehilim-23-phonetique",
    look: LOOKS.emerald,
    async run(t) {
      await t.open("/bibliotheque/tehilim/23", "Phonétique");
      await t.page.locator("button:has-text('Phonétique'):visible").first().click();
      await t.wait(900);
      await t.snap();
    },
  },
  {
    name: "emerald-tehilim-23-grand",
    look: LOOKS.emerald,
    async run(t) {
      await t.open("/bibliotheque/tehilim/23", "Phonétique");
      for (let i = 0; i < 3; i++) {
        await t.page.locator("button:has-text('A+'):visible").first().click();
        await t.wait(250);
      }
      await t.wait(700);
      await t.snap();
    },
  },
  {
    // Double appui : le texte défile seul, la pastille de vitesse paraît.
    name: "emerald-tehilim-23-defilement",
    look: LOOKS.emerald,
    frames: true,
    async run(t) {
      await t.open("/bibliotheque/tehilim/23", "Phonétique");
      await t.page.mouse.dblclick(195, 560);
      for (let i = 0; i < 8; i++) {
        await t.wait(350);
        await t.snap();
        if (i === 0) await t.mark("pill", t.page.locator("text=Défilement >> visible=true").locator("xpath=.."));
      }
    },
  },
  screen("emerald", "talmud", "/bibliotheque/talmud/berakhot/1", "Daf"),
  screen("emerald", "lecture-du-jour", "/bibliotheque/lecture-du-jour", "Tehilim 1", {
    marks: { gerer: "button:has-text('Gérer ma liste'):visible", cloche: "main button:visible", suivi: CARD("lus aujourd'hui") },
  }),
  {
    name: "emerald-lecture-du-jour-liste",
    look: LOOKS.emerald,
    async run(t) {
      await t.open("/bibliotheque/lecture-du-jour", "Tehilim 1");
      await t.page.locator("button:has-text('Gérer ma liste'):visible").first().click();
      await t.wait(1200);
      await t.snap();
    },
  },
  {
    name: "emerald-lecture-du-jour-rappel",
    look: LOOKS.emerald,
    async run(t) {
      await t.open("/bibliotheque/lecture-du-jour", "Tehilim 1");
      await t.page.locator("main button:visible").first().click();
      await t.wait(1200);
      await t.snap();
    },
  },
  screen("emerald", "accueil", "/", "Ma lecture quotidienne"),

  // --- Sidour (night) ----------------------------------------------------------
  screen("night", "accueil", "/", "Ma lecture quotidienne"),
  screen("night", "chaharit", "/bibliotheque/sidour/chaharit", "Chaharit", {
    full: true,
    marks: { horaire: CARD("Horaire de Cha'harit"), menu: "button[aria-label='Menu de lecture']:visible" },
  }),
  screen("night", "sidour", "/bibliotheque/sidour", "Chaharit", { marks: { chaharit: CARD("(Chaharit)") } }),
  {
    name: "night-chaharit-amida",
    look: LOOKS.night,
    async run(t) {
      await t.open("/bibliotheque/sidour/chaharit", "Chaharit");
      await scrollTo(t, "Direction du Kotel", 160);
      await t.snap();
      await t.mark("kotel", t.page.locator("button:has-text('Direction du Kotel'):visible"));
    },
  },
  {
    name: "night-chaharit-menu",
    look: LOOKS.night,
    async run(t) {
      await t.open("/bibliotheque/sidour/chaharit", "Chaharit");
      await t.page.locator("button[aria-label='Menu de lecture']:visible").first().click();
      await t.wait(1000);
      await t.snap();
    },
  },
  {
    // La boussole du Kotel, le téléphone qui tourne dans la main.
    name: "night-kotel",
    look: LOOKS.night,
    frames: true,
    async run(t) {
      await t.open("/bibliotheque/sidour/chaharit", "Chaharit");
      await heading(t, 40);
      await t.page.locator("button:has-text('Direction du Kotel'):visible").first().click();
      await t.wait(1000);
      for (let i = 0; i <= 12; i++) {
        await heading(t, 40 + i * 7.5);
        await t.wait(140);
        await t.snap();
      }
    },
  },
  {
    name: "night-parchemin",
    look: LOOKS.night,
    async run(t) {
      await t.open("/bibliotheque/sidour/chaharit", "Chaharit");
      await t.page.locator("text=Voir le parchemin >> visible=false").first().scrollIntoViewIfNeeded().catch(() => {});
      await t.page.locator("button:has-text('Voir le parchemin')").first().click();
      await t.wait(2500);
      await t.snap();
    },
  },

  // --- Calendrier (oceanNight) -------------------------------------------------
  // Prêt quand les dates du compte sont arrivées, pas seulement les fêtes.
  screen("oceanNight", "calendrier", "/calendrier", "Anniversaire de Noa", {
    full: true,
    marks: { mesDates: "button:has-text('Mes dates'):visible", convertir: "button:has-text('Convertir une date'):visible" },
  }),
  {
    name: "oceanNight-calendrier-hanouka",
    look: LOOKS.oceanNight,
    async run(t) {
      await t.open("/calendrier", "Allumage");
      await t.page.evaluate(() => window.scrollTo(0, 420));
      await t.wait(600);
      await t.snap();
    },
  },
  {
    name: "oceanNight-mes-dates",
    look: LOOKS.oceanNight,
    async run(t) {
      await t.open("/calendrier", "Allumage");
      await t.page.locator("button:has-text('Mes dates'):visible").first().click();
      await t.wait(1200);
      await t.snap();
    },
  },
  {
    name: "oceanNight-ajout-date",
    look: LOOKS.oceanNight,
    async run(t) {
      await t.open("/calendrier", "Allumage");
      await t.page.locator("button:has-text('Mes dates'):visible").first().click();
      await t.wait(900);
      await t.page.locator("button:has-text('Ajouter une date'):visible").first().click();
      await t.wait(900);
      await t.page.locator("input[type=text]:visible").first().fill("Leilouy nichmat de Rahel bat Sim'ha");
      await t.wait(500);
      await t.snap();
    },
  },
  screen("oceanNight", "convertir", "/calendrier", "Allumage", {
    before: async (t) => {
      await t.page.locator("button:has-text('Convertir une date'):visible").first().click();
      await t.wait(1200);
    },
  }),
  screen("oceanNight", "accueil", "/", "Ma lecture quotidienne", { marks: { occasion: CARD("Anniversaire de Noa") } }),
];
