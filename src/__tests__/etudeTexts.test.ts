import { describe, it, expect } from "vitest";
import {
  corpusOf,
  slugOf,
  hubPath,
  sectionPath,
  isMultiSection,
  entryByCorpusSlug,
  buildSectionBody,
  buildHubBody,
  studyEntries,
} from "../content/etudeTexts";
import type { TextContent } from "../services/textService";

describe("etudeTexts URLs", () => {
  it("maps Tehilim to /etude/tehilim/{n}", () => {
    const e = entryByCorpusSlug("tehilim", "121");
    expect(e).toBeTruthy();
    expect(corpusOf(e!)).toBe("tehilim");
    expect(hubPath(e!)).toBe("/etude/tehilim/121");
    expect(isMultiSection(e!)).toBe(false);
    // single-section: section path collapses to the hub path
    expect(sectionPath(e!, 1)).toBe("/etude/tehilim/121");
  });

  it("maps Talmud tractates to a hub + per-chapter pages", () => {
    const e = entryByCorpusSlug("talmud", "berakhot");
    expect(e).toBeTruthy();
    expect(slugOf(e!)).toBe("berakhot");
    expect(isMultiSection(e!)).toBe(true);
    expect(hubPath(e!)).toBe("/etude/talmud/berakhot");
    expect(sectionPath(e!, 2)).toBe("/etude/talmud/berakhot/2");
  });

  it("maps Michna and Tanakh under their own corpus segments", () => {
    expect(hubPath(entryByCorpusSlug("michna", "berakhot")!)).toBe("/etude/michna/berakhot");
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
    expect(body).toContain('href="/etude/talmud/berakhot/1"');
    expect(body).toContain('href="/etude/talmud/berakhot/2"');
  });
});
