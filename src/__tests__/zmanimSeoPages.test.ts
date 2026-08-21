import { describe, expect, it } from "vitest";
import { buildZmanimSeoPages, upcomingRestPeriods } from "../content/zmanimSeoPages";
import { SEO_CITY_NAMES, citySlug, findCityBySlug } from "../content/zmanimCities";
import { buildAppShell, staticFooterHtml } from "../content/seoPages";
import { DEFAULT_PLACE, type City } from "../services/zmanimService";
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

  it("génère une page par ville de la liste, au bon chemin", () => {
    for (const name of SEO_CITY_NAMES) {
      const slug = citySlug(name);
      const page = pages.find((p) => p.path === `/horaires/${slug}`);
      expect(page).toBeDefined();
      expect(page!.file).toBe(`horaires/${slug}.html`);
      expect(page!.title).toContain(`à ${name}`);
    }
  });

  it("chaque ville de la liste existe dans le catalogue, avec un slug unique", () => {
    const slugs = new Set<string>();
    for (const name of SEO_CITY_NAMES) {
      const slug = citySlug(name);
      expect(findCityBySlug(citiesJson as City[], slug)).not.toBeNull();
      slugs.add(slug);
    }
    expect(slugs.size).toBe(SEO_CITY_NAMES.length);
  });

  it("la page de Marseille porte de vraies heures et le nom de la ville", () => {
    expect(marseille.bodyHtml).toContain("Chabbat à Marseille");
    const times = marseille.bodyHtml.match(/\d{2}:\d{2}/g) ?? [];
    expect(times.length).toBeGreaterThanOrEqual(20);
    // Marseille est à l'est et au sud de Paris : ses horaires diffèrent.
    expect(marseille.bodyHtml).not.toBe(horaires.bodyHtml);
  });

  it("chaque page ville lie le hub, le calendrier et des villes voisines", () => {
    for (const name of SEO_CITY_NAMES) {
      const page = pages.find((p) => p.path === `/horaires/${citySlug(name)}`)!;
      expect(page.bodyHtml).toContain('href="/horaires"');
      expect(page.bodyHtml).toContain('href="/calendrier"');
      expect(page.bodyHtml.match(/href="\/horaires\/[a-z-]+"/g)?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("le hub lie chaque page ville", () => {
    for (const name of SEO_CITY_NAMES) {
      expect(horaires.bodyHtml).toContain(`href="/horaires/${citySlug(name)}"`);
    }
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
