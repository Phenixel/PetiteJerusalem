import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  amudOf,
  azYashirLines,
  dafColumns,
  dafSides,
  findTorahSongs,
  gemaraPageText,
  haazinouLine,
  parashaMark,
  scrollVerseWords,
} from "../services/pageForm";
import {
  MEFORSHIM_CHUNK,
  parseContent,
  parseDafMeforshim,
  tractateFromLink,
  tractateSlug,
} from "../services/textService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";

/**
 * La forme de la page (pageForm.ts) : le Sefer Torah pour la Torah, la page
 * de Vilna pour la guemara. Ces tests tiennent ce qui se vérifie sans écran,
 * sur le corpus entier quand il le faut.
 */

const TEXTS = resolve(__dirname, "../../public/texts");
const entries = (textStudiesJson as TextStudiesJson).textStudies;
const read = (path: string): unknown => JSON.parse(readFileSync(resolve(TEXTS, path), "utf8"));
const NIQQUD = /[\u0591-\u05BD\u05BF-\u05C2\u05C4\u05C5\u05C7]/;

/** Les parachiot, lues comme le lecteur les lit, avec leurs versets bruts. */
function parachiot(): {
  entry: TextStudyJsonEntry;
  raw: string[];
  he: string[];
  marks: unknown[];
}[] {
  return entries
    .filter((e) => e.type === "Tanakh")
    .map((entry) => {
      const data = read(`tanakh/${entry.id}.json`) as { fromBook?: string; he: unknown[] };
      const section = parseContent(entry, data).sections[0];
      return {
        entry,
        fromBook: data.fromBook,
        raw: (data.he as unknown[]).flat(Infinity).map(String),
        he: section.he,
        marks: section.scrollMarks ?? [],
      };
    })
    .filter((p) => p.marks.length > 0);
}

describe("forme du Sefer Torah", () => {
  it("lit la marque qui suit un verset", () => {
    expect(parashaMark("וַֽיְהִי־בֹ֖קֶר י֥וֹם אֶחָֽד׃ {פ}")).toBe("petoukha");
    expect(parashaMark("וַיְהִי־כֵֽן׃ {ס}")).toBe("setouma");
    expect(parashaMark("וַיְהִי־כֵֽן׃")).toBeNull();
  });

  it("écrit un verset comme le sofer : les lettres seules, le maqaf en espace", () => {
    expect(
      scrollVerseWords("בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃").join(
        " ",
      ),
    ).toBe("בראשית ברא אלהים את השמים ואת הארץ");
    expect(scrollVerseWords("וַֽיְהִי־עֶ֥רֶב").join(" ")).toBe("ויהי ערב");
  });

  it("garde le ktiv, retire le qri et les notes d'édition", () => {
    expect(scrollVerseWords("עַל־שְׁנֵ֥י (קצוותו) [קְצוֹתָ֖יו] חֻבָּֽר׃").join(" ")).toBe(
      "על שני קצוותו חבר",
    );
    expect(scrollVerseWords("נֹצֵ֥ר*(בספרי תימן נֹצֵ֥ר בנו״ן רגילה) חֶ֙סֶד֙").join(" ")).toBe(
      "נצר חסד",
    );
  });

  it("donne ses marques à chaque parasha de la Torah, et à elles seules", () => {
    const torah = parachiot();
    expect(torah).toHaveLength(54);
    for (const p of torah) {
      expect(p.marks, `${p.entry.name} : une marque par verset`).toHaveLength(p.he.length);
      // Les marques lues sont celles du fichier, dans l'ordre des versets.
      const inFile = p.raw.filter((v) => /\{[פס]\}/.test(v)).length;
      expect(p.marks.filter(Boolean).length, `${p.entry.name} : marques`).toBe(inFile);
    }
    // Les Prophètes ont aussi des marques, mais pas la forme du Sefer Torah.
    const josue = entries.find((e) => e.type === "Tanakh" && e.id === 318)!;
    expect(parseContent(josue, read("tanakh/318.json")).sections[0].scrollMarks).toBeUndefined();
  });

  it("trouve Az yachir et Haazinou, avec leur longueur, et nulle part ailleurs", () => {
    const found = parachiot().flatMap((p) =>
      findTorahSongs(p.he).map((song) => ({ name: p.entry.name, ...song })),
    );
    expect(found.map((s) => [s.kind, s.end - s.start + 1])).toEqual([
      ["az-yashir", 19],
      ["haazinou", 43],
    ]);
  });

  it("écrit Haazinou en deux moitiés par verset", () => {
    const p = parachiot().find((x) => findTorahSongs(x.he).some((s) => s.kind === "haazinou"))!;
    const song = findTorahSongs(p.he)[0];
    for (const verse of p.he.slice(song.start, song.end + 1)) {
      const [right, left] = haazinouLine(verse);
      expect(right.length, `${verse}`).toBeGreaterThan(0);
      expect(left.length, `${verse}`).toBeGreaterThan(0);
      expect(NIQQUD.test(right + left)).toBe(false);
    }
    expect(haazinouLine(p.he[song.start])[0]).toBe("האזינו השמים ואדברה");
  });

  it("pose Az yachir en briques : une ligne pleine, puis deux et trois membres en alternance", () => {
    const p = parachiot().find((x) => findTorahSongs(x.he).some((s) => s.kind === "az-yashir"))!;
    const song = findTorahSongs(p.he)[0];
    const verses = p.he.slice(song.start, song.end + 1);
    const lines = azYashirLines(verses);
    expect(lines[0]).toHaveLength(1);
    expect(lines[0][0].startsWith("אז ישיר משה")).toBe(true);
    lines.slice(1, -1).forEach((line, i) => expect(line).toHaveLength(i % 2 === 0 ? 2 : 3));
    // Rien de perdu ni d'ajouté : les mots de la chira, dans l'ordre.
    expect(lines.flat().join(" ").split(" ")).toEqual(verses.flatMap(scrollVerseWords));
  });
});

describe("forme de la page du daf", () => {
  it("imprime la guemara sans voyelles ni ponctuation moderne", () => {
    const text = gemaraPageText([
      "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בָּעֲרָבִין? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים,",
      "וּמַאי ״וְטָהֵר״ \u2014 טְהַר גַּבְרָא?!",
    ]);
    expect(text).toBe("מאימתי קורין את שמע בערבין משעה שהכהנים נכנסים ומאי וטהר טהר גברא");
    expect(gemaraPageText(["עַד חֲצוֹת."])).toBe("עד חצות.");
  });

  it("met Rachi du côté de la reliure", () => {
    expect(amudOf("2a")).toBe("a");
    expect(amudOf("13b")).toBe("b");
    expect(dafSides("a")).toEqual({ rashi: "right", tosafot: "left" });
    expect(dafSides("b")).toEqual({ rashi: "left", tosafot: "right" });
  });

  it("fait passer sous la guemara le commentaire plus long qu'elle, et lui seul", () => {
    const m = { head: 40, mainEnd: 300, gap: 10, sideLine: 10 };
    // Rachi plus long : sa colonne s'arrête sous la guemara, à une ligne près.
    // Tossafot plus court : il finit dans sa colonne, pas de reprise.
    expect(dafColumns({ ...m, rashiEnd: 500, tosafotEnd: 200 })).toEqual({
      rashi: 270,
      tosafot: null,
    });
    expect(dafColumns({ ...m, mainEnd: 303, rashiEnd: 500, tosafotEnd: 600 })).toEqual({
      rashi: 280,
      tosafot: 280,
    });
    expect(dafColumns({ ...m, rashiEnd: 0, tosafotEnd: 0 })).toEqual({
      rashi: null,
      tosafot: null,
    });
  });

  it("aligne Rachi et Tossafot amoud par amoud sur la guemara de chaque traité", () => {
    const tractates = entries.filter((e) => e.type === "Talmud Bavli");
    let withPages = 0;
    for (const entry of tractates) {
      const slug = tractateSlug(tractateFromLink(entry.link));
      const dir = resolve(TEXTS, "talmud-meforshim", slug);
      if (!existsSync(dir)) continue;
      withPages++;
      const gemara = read(`talmud/${slug}.json`) as { he: unknown[] };
      const chunks = readdirSync(dir).filter((f) => f.endsWith(".json"));
      expect(chunks.length, `${slug} : tranches`).toBe(
        Math.ceil(gemara.he.length / MEFORSHIM_CHUNK),
      );
      let amudim = 0;
      let commented = 0;
      for (const file of chunks) {
        const data = read(`talmud-meforshim/${slug}/${file}`) as { from: number };
        expect(data.from, `${slug}/${file}`).toBe(
          Number(file.replace(".json", "")) * MEFORSHIM_CHUNK,
        );
        const parsed = parseDafMeforshim(data);
        amudim += parsed.size;
        for (const m of parsed.values()) if (m.rashi.length + m.tosafot.length) commented++;
      }
      expect(amudim, `${slug} : amoudim`).toBe(gemara.he.length);
      expect(commented / amudim, `${slug} : amoudim commentés`).toBeGreaterThan(0.6);
    }
    // Tous les traités de guemara, sauf ceux que Vilna imprime sans Rachi
    // ni Tossafot (Tamid) ou qui ne sont pas du Bavli (Chekalim).
    expect(withPages).toBe(36);
  });

  it("garde le dibbour hamat'hil en avant, comme sur la page", () => {
    const parsed = parseDafMeforshim(read("talmud-meforshim/berakhot/0.json") as never);
    const first = parsed.get(0)!.rashi[0];
    expect(first.lead).toBe("מאימתי קורין את שמע בערבין. משעה שהכהנים נכנסים לאכול בתרומתן");
    expect(first.text.startsWith("כהנים שנטמאו")).toBe(true);
    expect(parsed.get(0)!.tosafot[0].lead).toBe("מאימתי קורין וכו'");
  });
});
