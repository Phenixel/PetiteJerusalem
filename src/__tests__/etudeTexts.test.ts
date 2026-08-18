import { describe, it, expect } from "vitest";
import {
  corpusOf,
  slugOf,
  hubPath,
  sectionPath,
  isMultiSection,
  isShareable,
  entryByCorpusSlug,
  buildSectionBody,
  buildHubBody,
  sectionHeading,
  studyEntries,
} from "../content/etudeTexts";
import { resolveFilePath } from "../services/textService";
import type { TextContent } from "../services/textService";

describe("etudeTexts URLs", () => {
  it("maps Tehilim to /bibliotheque/tehilim/{n}", () => {
    const e = entryByCorpusSlug("tehilim", "121");
    expect(e).toBeTruthy();
    expect(corpusOf(e!)).toBe("tehilim");
    expect(hubPath(e!)).toBe("/bibliotheque/tehilim/121");
    expect(isMultiSection(e!)).toBe(false);
    // single-section: section path collapses to the hub path
    expect(sectionPath(e!, 1)).toBe("/bibliotheque/tehilim/121");
  });

  it("maps Talmud tractates to a hub + per-chapter pages", () => {
    const e = entryByCorpusSlug("talmud", "berakhot");
    expect(e).toBeTruthy();
    expect(slugOf(e!)).toBe("berakhot");
    expect(isMultiSection(e!)).toBe(true);
    expect(hubPath(e!)).toBe("/bibliotheque/talmud/berakhot");
    expect(sectionPath(e!, 2)).toBe("/bibliotheque/talmud/berakhot/2");
  });

  it("maps Michna and Tanakh under their own corpus segments", () => {
    expect(hubPath(entryByCorpusSlug("michna", "berakhot")!)).toBe("/bibliotheque/michna/berakhot");
    expect(entryByCorpusSlug("tanakh", "berechit")).toBeTruthy();
  });

  it("gives every study entry a unique corpus/slug", () => {
    const keys = new Set(studyEntries.map((e) => `${corpusOf(e)}/${slugOf(e)}`));
    expect(keys.size).toBe(studyEntries.length);
  });

  it("builds a section body with Hebrew, phonetic and a share CTA", () => {
    const e = entryByCorpusSlug("tehilim", "121")!;
    const content: TextContent = {
      title: "Tehilim 121",
      type: "Tehilim",
      sections: [{ index: 1, label: "Tehilim 121", he: ["שִׁיר לַמַּעֲלוֹת"] }],
    };
    const body = buildSectionBody(e, content, content.sections[0]);
    expect(body).toContain('class="he"');
    expect(body).toContain('class="tl"'); // vocalized → phonetic present
    expect(body).toContain('href="/share-reading/new-session"');
  });

  it("maps la liturgie (Sli'hot, Brahot) sous ses propres corpus", () => {
    const slihot = entryByCorpusSlug("slihot", "slihot");
    expect(slihot).toBeTruthy();
    expect(corpusOf(slihot!)).toBe("slihot");
    expect(hubPath(slihot!)).toBe("/bibliotheque/slihot/slihot");
    expect(resolveFilePath(slihot!)).toBe(`/texts/tefila/${slihot!.id}.json`);

    for (const slug of ["meein-cheva", "birkat-hamazon", "cheva-brahot", "birkat-halevana"]) {
      const e = entryByCorpusSlug("brahot", slug);
      expect(e).toBeTruthy();
      expect(hubPath(e!)).toBe(`/bibliotheque/brahot/${slug}`);
    }
  });

  it("ne propose jamais la liturgie au partage (pas de CTA, intro sans partage)", () => {
    const e = entryByCorpusSlug("slihot", "slihot")!;
    expect(isShareable(e)).toBe(false);
    expect(isShareable(entryByCorpusSlug("brahot", "cheva-brahot")!)).toBe(false);
    expect(isShareable(entryByCorpusSlug("tehilim", "121")!)).toBe(true);

    const content: TextContent = {
      title: "Sli'hot",
      type: "Slihot",
      sections: [{ index: 1, label: "Sli'hot", he: ["בֶּן אָדָם מַה לְּךָ נִרְדָּם"] }],
    };
    const body = buildSectionBody(e, content, content.sections[0]);
    expect(body).not.toContain('href="/share-reading/new-session"');
    expect(body).not.toContain("partagez-en la lecture");
    expect(sectionHeading(e, content.sections[0])).toBe("Sli'hot");
  });

  it("ne met pas de précédent/suivant sur les brahot (elles ne se suivent pas)", () => {
    const e = entryByCorpusSlug("brahot", "birkat-hamazon")!;
    const content: TextContent = {
      title: "Birkat Hamazon",
      type: "Brahot",
      sections: [{ index: 1, label: "Birkat Hamazon", he: ["בָּרוּךְ אַתָּה"] }],
    };
    const body = buildSectionBody(e, content, content.sections[0]);
    expect(body).not.toContain('class="prev"');
    expect(body).not.toContain('class="next"');
  });

  it("builds a hub body listing chapter links", () => {
    const e = entryByCorpusSlug("talmud", "berakhot")!;
    const content: TextContent = {
      title: "Berakhot",
      type: "Talmud Bavli",
      sections: [
        { index: 1, label: "Chapitre 1", he: ["x"] },
        { index: 2, label: "Chapitre 2", he: ["y"] },
      ],
    };
    const body = buildHubBody(e, content);
    expect(body).toContain('href="/bibliotheque/talmud/berakhot/1"');
    expect(body).toContain('href="/bibliotheque/talmud/berakhot/2"');
  });
});
