import { describe, expect, it } from "vitest";
import { buildParashaSeoPages, parashaNotes } from "../content/parashaSeoPages";
import {
  PARASHA_PATH,
  parashaLabel,
  parashaWeeks,
  readingDatesByEntry,
} from "../content/parashaCalendar";
import { buildSectionBody } from "../content/etudeTexts";
import { staticFooterHtml } from "../content/seoPages";
import type { TextStudyJsonEntry } from "../models/models";

/**
 * Le calendrier des parachiot est calculé au build : on fige la date pour des
 * assertions stables. Un vendredi d'été ordinaire, la veille du Chabbat de
 * Ki Tétsé 2026.
 */
const NOW = new Date("2026-08-21T10:00:00Z");

const { pages, sitemapEntries } = buildParashaSeoPages(NOW);
const hub = pages.find((p) => p.path === PARASHA_PATH)!;

describe("parashaCalendar", () => {
  const weeks = parashaWeeks(NOW, 56);

  it("ne retient que des Chabbats, dans l'ordre", () => {
    expect(weeks.length).toBeGreaterThanOrEqual(45);
    for (const week of weeks) expect(week.shabbat.getDay()).toBe(6);
    const times = weeks.map((w) => w.shabbat.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("commence par la paracha du Chabbat qui vient", () => {
    // Le 21 août 2026 est le vendredi de Ki Tétsé.
    expect(parashaLabel(weeks[0].parasha)).toBe("Ki Tetze");
    expect(weeks[0].shabbat.getDate()).toBe(22);
  });

  it("date chaque paracha du cycle, une paracha double comptant ses deux textes", () => {
    const dates = readingDatesByEntry(parashaWeeks(NOW, 110));
    // 53 des 54 parachiot passent en deux cycles : Vezot Haberakha ne se lit
    // jamais un Chabbat ordinaire, elle achève la Torah à Simhat Torah.
    expect(dates.size).toBe(53);
    for (const days of dates.values()) expect(days.length).toBeGreaterThanOrEqual(1);
  });
});

describe("parashaNotes", () => {
  const notes = parashaNotes(NOW);

  it("donne à chaque paracha sa phrase datée, sans bégayer sur le jour", () => {
    // Les 54, Vezot Haberakha comprise : elle est datée de Simhat Torah.
    expect(notes.size).toBe(54);
    const dated = [...notes.values()].filter((note) =>
      note.includes("Cette paracha se lit le Chabbat "),
    );
    expect(dated).toHaveLength(53);
    for (const note of notes.values()) {
      expect(note).not.toMatch(/Chabbat (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/);
      expect(note).toContain(`href="${PARASHA_PATH}"`);
    }
  });

  it("date Vezot Haberakha de Simhat Torah, faute de Chabbat", () => {
    const simhat = [...notes.values()].filter((note) => note.includes("Simhat Torah"));
    expect(simhat).toHaveLength(1);
    expect(simhat[0]).toMatch(/Simhat Torah, le \d+ \w+ \d{4}/);
  });

  it("s'insère dans le corps d'une page de texte", () => {
    const entry = {
      id: 1,
      name: "Vayera",
      livre: "Berechit",
      link: "",
      totalSections: 1,
      type: "Tanakh",
    } as TextStudyJsonEntry;
    const section = { index: 1, label: "", he: [] };
    const content = { sections: [section] } as never;
    const body = buildSectionBody(entry, content, section, "<p class='seo-note'>daté</p>");
    expect(body).toContain("daté");
    // Sans encart, la page reste ce qu'elle était.
    expect(buildSectionBody(entry, content, section)).not.toContain("seo-note");
  });
});

describe("hub /paracha", () => {
  it("déclare la page avec ses champs requis", () => {
    expect(hub.file).toBe("paracha.html");
    expect(hub.title).toContain("Paracha de la semaine");
    expect(hub.description.length).toBeGreaterThan(50);
    expect(sitemapEntries.map((e) => e.path)).toContain(PARASHA_PATH);
  });

  it("répond pour la semaine en cours, et déroule le cycle", () => {
    expect(hub.bodyHtml).toContain("Parachat Ki Tetze");
    expect(hub.bodyHtml).toContain("Quelle est la paracha de cette semaine");
    // Un cycle complet de lignes, chacune liée à son texte.
    expect(hub.bodyHtml.match(/<tr>/g)?.length).toBeGreaterThanOrEqual(45);
    expect(hub.bodyHtml).toContain('href="/bibliotheque/tanakh/');
  });

  it("lie le chnei mikra, les horaires et le calendrier", () => {
    expect(hub.bodyHtml).toContain('href="/bibliotheque/chnei-mikra"');
    expect(hub.bodyHtml).toContain('href="/horaires"');
    expect(hub.bodyHtml).toContain('href="/calendrier"');
  });

  it("émet BreadcrumbList + FAQPage", () => {
    const types = (hub.jsonLd ?? []).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
  });

  it("est liée depuis le pied de page statique", () => {
    expect(staticFooterHtml).toContain(`href="${PARASHA_PATH}"`);
  });
});
