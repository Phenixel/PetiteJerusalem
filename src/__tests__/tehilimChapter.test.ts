import { describe, it, expect } from "vitest";
import {
  TEHILIM_CHAPTER_COUNT,
  chapterPath,
  chapterTitle,
  chapterDescription,
  isValidChapter,
  buildChapterBody,
  chapterJsonLd,
} from "../content/tehilimChapter";

describe("tehilimChapter", () => {
  it("valide les bornes de chapitre 1..150", () => {
    expect(TEHILIM_CHAPTER_COUNT).toBe(150);
    expect(isValidChapter(1)).toBe(true);
    expect(isValidChapter(150)).toBe(true);
    expect(isValidChapter(0)).toBe(false);
    expect(isValidChapter(151)).toBe(false);
    expect(isValidChapter(1.5)).toBe(false);
  });

  it("construit des URLs et métadonnées contenant le numéro", () => {
    expect(chapterPath(121)).toBe("/etude/tehilim/121");
    expect(chapterTitle(121)).toContain("Tehilim 121");
    expect(chapterTitle(121).toLowerCase()).toContain("phonétique");
    expect(chapterDescription(121)).toContain("121");
  });

  it("rend l'hébreu, la phonétique, la navigation et le CTA", () => {
    const body = buildChapterBody(121, ["שִׁיר לַמַּעֲלוֹת אֶשָּׂא עֵינַי"]);
    expect(body).toContain('class="he"');
    expect(body).toContain('class="tl"');
    expect(body).toContain('href="/share-reading/new-session"');
    expect(body).toContain('href="/etude/tehilim/120"'); // prev
    expect(body).toContain('href="/etude/tehilim/122"'); // next
  });

  it("n'affiche pas de lien précédent au chapitre 1 ni suivant au 150", () => {
    expect(buildChapterBody(1, ["x"])).not.toContain("/etude/tehilim/0");
    expect(buildChapterBody(150, ["x"])).not.toContain("/etude/tehilim/151");
  });

  it("échappe le HTML et nettoie les marqueurs éditoriaux", () => {
    const body = buildChapterBody(1, ["שָׁלוֹם {פ}", "a &thinsp; b <x>"]);
    expect(body).not.toContain("{פ}");
    expect(body).not.toContain("<x>");
    expect(body).toContain("&lt;x&gt;");
  });

  it("émet un BreadcrumbList et un CreativeWork", () => {
    const types = chapterJsonLd(121).map((o) => o["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("CreativeWork");
  });
});
