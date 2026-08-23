import { describe, expect, it } from "vitest";
import { buildZmanimSeoPages, seoCities, upcomingRestPeriods } from "../content/zmanimSeoPages";
import { COUNTRIES, FEATURED_CITY_NAMES, citySlug, findCityBySlug } from "../content/zmanimCities";
import { SEO_FESTIVALS, findFestivalBySlug } from "../content/zmanimFestivals";
import { SEO_LOCALES } from "../content/seoLocales";
import { ZMANIM_STRINGS } from "../content/zmanimSeoStrings";
import { buildAppShell, guidePages, staticFooterHtml } from "../content/seoPages";
import {
  DEFAULT_PLACE,
  candleLightingMinutes,
  placeFromCity,
  type City,
} from "../services/zmanimService";
import citiesJson from "../datas/cities.json";

/**
 * Les pages /horaires et /calendrier sont générées au build avec des heures
 * calculées (hebcal) : on fige la date pour des assertions stables. Un
 * vendredi d'été ordinaire, loin des fêtes de Tichri.
 */
const NOW = new Date("2026-08-21T10:00:00Z");

const { pages, sitemapEntries } = buildZmanimSeoPages(NOW);
const horaires = pages.find((p) => p.path === "/horaires")!;
const calendrier = pages.find((p) => p.path === "/calendrier")!;

describe("zmanimSeoPages /horaires", () => {
  it("déclare la page avec ses champs requis", () => {
    expect(horaires).toBeDefined();
    expect(horaires.file).toBe("horaires.html");
    expect(horaires.title).toContain("Horaires de Chabbat");
    expect(horaires.description.length).toBeGreaterThan(50);
  });

  it("prérend un tableau d'horaires avec de vraies heures", () => {
    // Au moins dix blocs de repos sur douze semaines, chacun avec entrée et
    // sortie au format HH:MM.
    const times = horaires.bodyHtml.match(/\d{2}:\d{2}/g) ?? [];
    expect(times.length).toBeGreaterThanOrEqual(20);
    expect(horaires.bodyHtml).toContain("allumage");
    expect(horaires.bodyHtml).toContain("Chabbat");
  });

  it("nomme la paracha du Chabbat ordinaire", () => {
    // Le 21 août 2026 est le vendredi de Ki Tétzé.
    expect(horaires.bodyHtml).toContain("Chabbat Ki Tétzé");
  });

  it("lie vers le calendrier des fêtes", () => {
    expect(horaires.bodyHtml).toContain('href="/calendrier"');
  });

  it("émet BreadcrumbList + FAQPage", () => {
    const types = (horaires.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
  });

  it("date ses réponses de FAQ : elles restent justes entre deux déploiements", () => {
    const faq = (horaires.jsonLd ?? []).find((o) => o["@type"] === "FAQPage");
    expect(JSON.stringify(faq)).toContain("2026");
  });
});

describe("zmanimSeoPages /calendrier", () => {
  it("déclare la page avec ses champs requis", () => {
    expect(calendrier).toBeDefined();
    expect(calendrier.file).toBe("calendrier.html");
    expect(calendrier.title).toContain("Calendrier des fêtes juives");
    expect(calendrier.description).toContain("2026");
  });

  it("liste les grandes fêtes de l'année qui vient, avec leurs dates", () => {
    for (const name of ["Roch Hachanah", "Yom Kippour", "Soukkot", "Pessah", "Pourim"]) {
      expect(calendrier.bodyHtml).toContain(name);
    }
    expect(calendrier.bodyHtml).toContain("2026");
    expect(calendrier.bodyHtml).toContain("2027");
    // Les noms hebcal-fr sont nettoyés de leur trait souscrit (« H̲anoukah »).
    expect(calendrier.bodyHtml).not.toMatch(/[\u0331\u0332]/);
  });

  it("répond aux questions « Quand tombe… ? » des fêtes recherchées", () => {
    for (const label of ["Roch Hachana", "Yom Kippour", "Hanouka", "Pessah", "Chavouot"]) {
      expect(calendrier.bodyHtml).toContain(`Quand tombe ${label}`);
    }
  });

  it("lie vers les horaires de Chabbat", () => {
    expect(calendrier.bodyHtml).toContain('href="/horaires"');
  });

  it("émet BreadcrumbList + FAQPage", () => {
    const types = (calendrier.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
  });
});

describe("zmanimSeoPages sitemap + maillage", () => {
  it("fournit les entrées de sitemap des deux pages", () => {
    const paths = sitemapEntries.map((e) => e.path);
    expect(paths).toContain("/horaires");
    expect(paths).toContain("/calendrier");
  });

  it("le pied de page statique lie vers les deux pages", () => {
    expect(staticFooterHtml).toContain('href="/horaires"');
    expect(staticFooterHtml).toContain('href="/calendrier"');
  });
});

describe("zmanimSeoPages pages par ville", () => {
  const marseille = pages.find((p) => p.path === "/horaires/marseille")!;
  const cityNames = seoCities().map((city) => city.name);

  it("génère une page par ville du catalogue, au bon chemin", () => {
    for (const name of cityNames) {
      const slug = citySlug(name);
      const page = pages.find((p) => p.path === `/horaires/${slug}`);
      expect(page).toBeDefined();
      expect(page!.file).toBe(`horaires/${slug}.html`);
      expect(page!.title).toContain(`à ${name}`);
    }
  });

  it("couvre tout le catalogue sauf Paris, dont /horaires est déjà la page", () => {
    expect(cityNames).toHaveLength((citiesJson as City[]).length - 1);
    expect(cityNames).not.toContain("Paris");
    expect(pages.find((p) => p.path === "/horaires/paris")).toBeUndefined();
  });

  it("chaque ville a un slug unique, résolu par le routeur", () => {
    const slugs = new Set<string>();
    for (const name of cityNames) {
      const slug = citySlug(name);
      expect(findCityBySlug(citiesJson as City[], slug)).not.toBeNull();
      slugs.add(slug);
    }
    expect(slugs.size).toBe(cityNames.length);
  });

  it("nomme chaque pays du catalogue, préposition comprise", () => {
    for (const city of citiesJson as City[]) {
      const country = COUNTRIES[city.country];
      expect(country).toBeDefined();
      expect(country.fr.where).toMatch(/^(en|au|aux|à) /);
      expect(country.en.where).toMatch(/^in /);
      expect(country.he.where.startsWith("ב")).toBe(true);
    }
    // L'annuaire du hub titre avec la locution, pas avec un « en » plaqué.
    expect(horaires.bodyHtml).toContain("Horaires de Chabbat au Maroc");
    expect(horaires.bodyHtml).toContain("Horaires de Chabbat en France");
    expect(horaires.bodyHtml).toContain("Horaires de Chabbat aux États-Unis");
  });

  it("chaque ville mise en avant existe dans le catalogue", () => {
    for (const name of FEATURED_CITY_NAMES) {
      expect(findCityBySlug(citiesJson as City[], citySlug(name))).not.toBeNull();
    }
  });

  it("la page de Marseille porte de vraies heures et le nom de la ville", () => {
    expect(marseille.bodyHtml).toContain("Chabbat à Marseille");
    const times = marseille.bodyHtml.match(/\d{2}:\d{2}/g) ?? [];
    expect(times.length).toBeGreaterThanOrEqual(20);
    // Marseille est à l'est et au sud de Paris : ses horaires diffèrent.
    expect(marseille.bodyHtml).not.toBe(horaires.bodyHtml);
  });

  it("chaque page ville lie le hub, le calendrier et des villes voisines", () => {
    for (const name of cityNames) {
      const page = pages.find((p) => p.path === `/horaires/${citySlug(name)}`)!;
      expect(page.bodyHtml).toContain('href="/horaires"');
      expect(page.bodyHtml).toContain('href="/calendrier"');
      expect(page.bodyHtml.match(/href="\/horaires\/[a-z-]+"/g)?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("le hub lie chaque page ville", () => {
    for (const name of cityNames) {
      expect(horaires.bodyHtml).toContain(`href="/horaires/${citySlug(name)}"`);
    }
  });

  it("prérend les zmanim du jour, nommés et chiffrés", () => {
    for (const label of [
      "Alot haCha'har",
      "Netz haHama",
      "Fin du Chéma (Gaon de Vilna)",
      "Plag haMin'ha",
      "Tsét haKokhavim",
    ]) {
      expect(marseille.bodyHtml).toContain(label);
      expect(horaires.bodyHtml).toContain(label);
    }
    // « à quelle heure est le netz à … » : la question, et une heure.
    expect(marseille.bodyHtml).toContain("netz haHama (lever du soleil) à Marseille");
  });

  it("colle la lettre de service hébraïque au nom, avec un maqaf devant le latin", () => {
    // Une ville qui a son nom hébreu : la lettre se colle, comme en hébreu.
    const lyon = pages.find((p) => p.path === "/he/zmanei-shabbat/lyon")!;
    expect(lyon.bodyHtml).toContain("בליון");
    expect(lyon.bodyHtml).not.toContain("ב־ליון");
    // Une ville encore en graphie latine : le maqaf, sans quoi la lettre est
    // avalée par le mot étranger (« זמני שבת בCharleroi »).
    const charleroi = pages.find((p) => p.path === "/he/zmanei-shabbat/charleroi")!;
    expect(charleroi.bodyHtml).toContain("ב\u05beCharleroi");
    expect(charleroi.bodyHtml).not.toMatch(/ב[A-Za-z]/);
    expect(charleroi.title).toContain("ב\u05beCharleroi");
  });

  it("Jérusalem allume 40 minutes avant la chkia, et le dit", () => {
    const jerusalem = pages.find((p) => p.path === "/horaires/jerusalem")!;
    expect(jerusalem.bodyHtml).toContain("40 minutes avant le coucher du soleil");
    expect(jerusalem.bodyHtml).not.toContain("18 minutes avant le coucher du soleil");
    const city = findCityBySlug(citiesJson as City[], "jerusalem")!;
    expect(candleLightingMinutes(placeFromCity(city))).toBe(40);
    expect(candleLightingMinutes(DEFAULT_PLACE)).toBe(18);
  });

  it("lie les villes les plus proches, distance à l'appui", () => {
    // Villeurbanne est à quelques kilomètres de Lyon : elle ouvre la liste.
    const lyon = pages.find((p) => p.path === "/horaires/lyon")!;
    expect(lyon.bodyHtml).toContain('href="/horaires/villeurbanne"');
    expect(lyon.bodyHtml).toMatch(/\(à \d+ km\)/);
  });

  it("émet un fil d'Ariane à trois niveaux + FAQPage", () => {
    const types = (marseille.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    const breadcrumb = (marseille.jsonLd ?? []).find((o) => o["@type"] === "BreadcrumbList") as {
      itemListElement: { name: string }[];
    };
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[2].name).toBe("Marseille");
  });

  it("les slugs gomment accents et espaces", () => {
    expect(citySlug("Genève")).toBe("geneve");
    expect(citySlug("Tel Aviv")).toBe("tel-aviv");
    expect(citySlug("Boulogne-Billancourt")).toBe("boulogne-billancourt");
    expect(citySlug("Créteil")).toBe("creteil");
  });
});

describe("zmanimSeoPages pages par fête", () => {
  const pessah = pages.find((p) => p.path === "/calendrier/pessah")!;
  const tichaBeav = pages.find((p) => p.path === "/calendrier/ticha-beav")!;

  it("génère une page par fête déclarée, au bon chemin", () => {
    for (const festival of SEO_FESTIVALS) {
      const page = pages.find((p) => p.path === `/calendrier/${festival.slugs.fr}`);
      expect(page).toBeDefined();
      expect(page!.file).toBe(`calendrier/${festival.slugs.fr}.html`);
      expect(page!.title).toContain(festival.labels.fr);
    }
  });

  it("chaque fête a son texte de présentation, dans les trois langues", () => {
    for (const locale of SEO_LOCALES) {
      const intros = ZMANIM_STRINGS[locale].festivalIntro;
      for (const festival of SEO_FESTIVALS) {
        expect(intros[festival.slugs.fr]?.length ?? 0).toBeGreaterThan(80);
      }
    }
  });

  it("le routeur et le prérendu partagent les mêmes slugs", () => {
    for (const festival of SEO_FESTIVALS) {
      for (const locale of SEO_LOCALES) {
        expect(findFestivalBySlug(festival.slugs[locale])).toEqual(festival);
      }
    }
    expect(findFestivalBySlug("fete-inconnue")).toBeNull();
  });

  it("donne les dates sur plusieurs années, sans occurrence passée", () => {
    // Six lignes à partir de 2027 : Pessah 2026 est passé au 21 août 2026.
    for (const year of ["2027", "2028", "2029", "2030", "2031", "2032"]) {
      expect(pessah.bodyHtml).toContain(year);
    }
    expect(pessah.bodyHtml).not.toContain("Quand tombe Pessah 2026");
  });

  it("date la fête de ses propres jours, pas du bloc de repos qui l'englobe", () => {
    // Chavouot 5789 tombe les 6 et 7 Sivan (dimanche 20 et lundi 21 mai 2029) ;
    // le samedi 19 est le Chabbat, réuni à la fête dans le même bloc de repos.
    // La page date la fête, pas le bloc : sinon elle commencerait un jour trop tôt.
    const chavouot = pages.find((p) => p.path === "/calendrier/chavouot")!;
    expect(chavouot.bodyHtml).toContain("du dimanche 20 au lundi 21 mai 2029");
    expect(chavouot.bodyHtml).toContain("Chavouot 2029 commence le samedi 19 mai 2029 au soir");
    expect(chavouot.bodyHtml).not.toContain("vendredi 18 mai 2029");

    // Sens inverse : Roch Hachana 5789 (jeudi 21 et vendredi 22 septembre 2028)
    // est suivi du Chabbat, que ses dates ne doivent pas absorber.
    const rochHachana = pages.find((p) => p.path === "/calendrier/roch-hachana")!;
    expect(rochHachana.bodyHtml).toContain("du jeudi 21 au vendredi 22 septembre 2028");
    expect(rochHachana.bodyHtml).not.toContain("au samedi 23 septembre 2028");
  });

  it("ne prête pas à Yom Kippour des jours de fête doublés en diaspora", () => {
    const kippour = pages.find((p) => p.path === "/calendrier/yom-kippour")!;
    expect(kippour.bodyHtml).toContain("le travail y est interdit comme à Chabbat");
    expect(kippour.bodyHtml).not.toContain("doublés");
  });

  it("porte les heures d'entrée et de sortie d'un Yom Tov", () => {
    expect(pessah.bodyHtml).toContain("Entrée");
    expect(pessah.bodyHtml).toContain("Sortie");
    expect(pessah.bodyHtml.match(/\d{2}:\d{2}/g)?.length).toBeGreaterThanOrEqual(10);
    // Pessah compte deux blocs séparés par le 'Hol haMoed : la page le dit.
    expect(pessah.bodyHtml).toContain("'Hol haMoed");
  });

  it("ne promet ni entrée ni sortie à un jour de jeûne", () => {
    expect(tichaBeav.bodyHtml).not.toContain("<th>Entrée</th>");
    expect(tichaBeav.bodyHtml).toContain("le travail y reste permis");
    expect(tichaBeav.bodyHtml).toContain("Quand tombe 9 Av");
  });

  it("émet un fil d'Ariane à trois niveaux + FAQPage", () => {
    const types = (pessah.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    const crumb = (pessah.jsonLd ?? []).find((o) => o["@type"] === "BreadcrumbList") as {
      itemListElement: { name: string }[];
    };
    expect(crumb.itemListElement).toHaveLength(3);
    expect(crumb.itemListElement[2].name).toBe("Pessah");
  });

  it("le calendrier lie chaque page de fête", () => {
    for (const festival of SEO_FESTIVALS) {
      expect(calendrier.bodyHtml).toContain(`href="/calendrier/${festival.slugs.fr}"`);
    }
  });
});

describe("guidePages /zmanim", () => {
  const zmanim = guidePages.find((p) => p.path === "/zmanim")!;

  it("explique chaque horaire de la journée", () => {
    for (const term of [
      "Alot haCha'har",
      "Misheyakir",
      "Netz haHama",
      "Fin du Chéma",
      "'Hatsot",
      "Min'ha guedola",
      "Plag hamin'ha",
      "Chkia",
      "Tsét haKokhavim",
      "heures zmaniot",
    ]) {
      expect(zmanim.bodyHtml).toContain(term);
    }
  });

  it("émet BreadcrumbList + FAQPage + Article", () => {
    const types = (zmanim.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    expect(types).toContain("Article");
  });

  it("est liée depuis le pied de page et depuis les horaires", () => {
    expect(staticFooterHtml).toContain('href="/zmanim"');
    expect(horaires.bodyHtml).toContain('href="/zmanim"');
  });
});

describe("upcomingRestPeriods", () => {
  const periods = upcomingRestPeriods(DEFAULT_PLACE, NOW, 12 * 7);

  it("couvre chaque semaine de l'horizon", () => {
    // Douze semaines contiennent au moins douze Chabbatot (les fêtes peuvent
    // ajouter des blocs).
    expect(periods.length).toBeGreaterThanOrEqual(12);
  });

  it("ne renvoie que des blocs à venir, en ordre chronologique", () => {
    for (const p of periods) expect(p.end.getTime()).toBeGreaterThan(NOW.getTime());
    const starts = periods.map((p) => p.start.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe("buildAppShell", () => {
  it("retire le canonique et og:url du shell attrape-tout", () => {
    const template = [
      "<head>",
      '<link rel="canonical" href="https://petite-jerusalem.fr/" />',
      '<meta property="og:url" content="https://petite-jerusalem.fr/" />',
      '<meta property="og:title" content="t" />',
      "</head>",
    ].join("\n");
    const shell = buildAppShell(template);
    expect(shell).not.toContain('rel="canonical"');
    expect(shell).not.toContain('property="og:url"');
    // Le reste du head est intact.
    expect(shell).toContain('property="og:title"');
  });
});
