import { describe, expect, it } from "vitest";
import { buildZmanimSeoPages, upcomingRestPeriods } from "../content/zmanimSeoPages";
import { buildAppShell, staticFooterHtml } from "../content/seoPages";

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

describe("upcomingRestPeriods", () => {
  const periods = upcomingRestPeriods(NOW, 12 * 7);

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
