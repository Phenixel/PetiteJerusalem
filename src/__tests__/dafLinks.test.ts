import { describe, it, expect } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import TalmudPage from "../components/TalmudPage.vue";
import {
  commentLinked,
  commentedPassages,
  linkLeads,
  linkedMeforshim,
  nextLink,
  type DafLink,
} from "../services/dafLinks";
import { flatMeforshim, parseDafMeforshim, type DafMeforshim } from "../services/textService";

/**
 * Sur la page du daf, un passage de la guemara et ses commentaires se
 * répondent : on touche l'un, les deux se surlignent (dafLinks.ts,
 * TalmudPage.vue).
 */

const comment = (lead: string, text = "…") => ({ lead, text });
/** Trois passages : le premier a deux Rachi et un Tossafot, le troisième un Rachi. */
const AMUD: DafMeforshim = {
  rashi: [[comment("עד סוף", "א"), comment("משעה", "ב")], [], [comment("הקטר חלבים", "ג")]],
  tosafot: [[comment("מאימתי קורין", "ד")], [], []],
  inner: "rashi",
};

describe("le lien d'un passage à ses commentaires", () => {
  const linked = linkedMeforshim(AMUD);

  it("garde à chaque commentaire son passage, dans l'ordre de la page", () => {
    expect(linked.rashi.map((c) => [c.lead, c.passage])).toEqual([
      ["עד סוף", 0],
      ["משעה", 0],
      ["הקטר חלבים", 2],
    ]);
    expect(linked.tosafot.map((c) => c.passage)).toEqual([0]);
    // Le même texte, dans le même ordre, que la page écrivait jusqu'ici.
    const flat = flatMeforshim(AMUD);
    expect(linked.rashi.map(({ lead, text }) => ({ lead, text }))).toEqual(flat.rashi);
    expect(linked.tosafot.map(({ lead, text }) => ({ lead, text }))).toEqual(flat.tosafot);
  });

  it("ne laisse toucher que les passages qu'un commentaire explique", () => {
    expect([...commentedPassages(linked)].sort()).toEqual([0, 2]);
    expect(commentedPassages(null).size).toBe(0);
  });

  it("surligne tous les commentaires d'un passage choisi", () => {
    const link: DafLink = { passage: 0 };
    expect(linked.rashi.map((c, i) => commentLinked(link, "rashi", i, c))).toEqual([
      true,
      true,
      false,
    ]);
    expect(commentLinked(link, "tosafot", 0, linked.tosafot[0])).toBe(true);
    expect(linkLeads(link, linked)).toEqual(["עד סוף", "משעה", "מאימתי קורין"]);
  });

  it("ne surligne qu'un commentaire quand c'est lui qu'on a touché", () => {
    const link: DafLink = { passage: 0, comment: { zone: "rashi", index: 1 } };
    expect(linked.rashi.map((c, i) => commentLinked(link, "rashi", i, c))).toEqual([
      false,
      true,
      false,
    ]);
    expect(commentLinked(link, "tosafot", 0, linked.tosafot[0])).toBe(false);
    // Dans le passage, seuls les mots que ce commentaire cite.
    expect(linkLeads(link, linked)).toEqual(["משעה"]);
    expect(linkLeads(null, linked)).toEqual([]);
  });

  it("relâche ce qu'on touche une seconde fois", () => {
    const passage: DafLink = { passage: 2 };
    const one: DafLink = { passage: 2, comment: { zone: "rashi", index: 2 } };
    expect(nextLink(null, passage)).toEqual(passage);
    expect(nextLink(passage, { passage: 2 })).toBeNull();
    expect(nextLink(passage, one)).toEqual(one);
    expect(nextLink(one, { passage: 2, comment: { zone: "rashi", index: 2 } })).toBeNull();
    // Un passage sans commentaire : plus rien de choisi.
    expect(nextLink(one, null)).toBeNull();
  });

  it("tient sur les commentaires livrés (Berakhot, première tranche)", () => {
    const TEXTS = resolve(__dirname, "../../public/texts");
    const read = (path: string) => JSON.parse(readFileSync(resolve(TEXTS, path), "utf8"));
    const gemara = (read("talmud/berakhot.json") as { he: string[][] }).he;
    const byAmud = parseDafMeforshim(read("talmud-meforshim/berakhot/0.json"));
    expect(byAmud.size).toBeGreaterThan(0);
    for (const [amud, m] of byAmud) {
      const both = linkedMeforshim(m);
      expect(both.rashi).toHaveLength(m.rashi.flat().length);
      expect(both.tosafot).toHaveLength(m.tosafot.flat().length);
      // Chaque commentaire désigne un passage de son amoud.
      for (const passage of commentedPassages(both)) {
        expect(passage, `amoud ${amud}`).toBeLessThan(gemara[amud].length);
      }
    }
  });
});

describe("la page du daf", () => {
  const LINES = [
    "מאימתי קורין את שמע בערבין עד סוף האשמורה",
    "דברי רבי אליעזר",
    "הקטר חלבים ואברים",
  ];

  function monter(initial: DafLink | null = null) {
    const linked = ref<DafLink | null>(initial);
    const touched: (DafLink | null)[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({
      render: () =>
        h(TalmudPage, {
          daf: "2a",
          lines: LINES,
          meforshim: linkedMeforshim(AMUD),
          passages: [0, 1, 2],
          linked: linked.value,
          scale: 1,
          onLink: (link: DafLink | null) => {
            touched.push(link);
            linked.value = nextLink(linked.value, link);
          },
        }),
    });
    app.mount(host);
    const texts = (selector: string): string[] =>
      [...host.querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? "");
    return { host, touched, texts, fermer: () => (app.unmount(), host.remove()) };
  }

  it("surligne un passage touché avec ses Rachi et ses Tossafot", async () => {
    const { host, touched, texts, fermer } = monter();
    expect(host.querySelectorAll(".daf-linked")).toHaveLength(0);
    // Deux des trois passages ont un commentaire : eux seuls se touchent.
    expect(host.querySelectorAll(".daf-passage.daf-linkable")).toHaveLength(2);

    host.querySelector<HTMLElement>('.daf-passage[data-passage="0"]')!.click();
    await nextTick();
    expect(touched).toEqual([{ passage: 0 }]);
    expect(texts(".daf-passage.daf-linked")).toEqual([LINES[0]]);
    expect(texts(".daf-comment.daf-linked")).toEqual(["עד סוף א", "משעה ב", "מאימתי קורין ד"]);
    // Les mots que citent ses commentaires sont soulignés dans le passage.
    expect(texts(".daf-passage .lead-mark")).toEqual(["מאימתי קורין", "עד סוף"]);

    // Le toucher à nouveau le relâche.
    host.querySelector<HTMLElement>('.daf-passage[data-passage="0"]')!.click();
    await nextTick();
    expect(host.querySelectorAll(".daf-linked")).toHaveLength(0);
    fermer();
  });

  it("surligne un commentaire touché avec son passage, et lui seul", async () => {
    const { host, touched, texts, fermer } = monter();
    const rashi = host.querySelectorAll<HTMLElement>(".daf-layer")[1];
    rashi.querySelectorAll<HTMLElement>(".daf-comment")[0].click();
    await nextTick();
    expect(touched).toEqual([{ passage: 0, comment: { zone: "rashi", index: 0 } }]);
    expect(texts(".daf-passage.daf-linked")).toEqual([LINES[0]]);
    expect(texts(".daf-comment.daf-linked")).toEqual(["עד סוף א"]);
    expect(texts(".daf-passage .lead-mark")).toEqual(["עד סוף"]);
    fermer();
  });

  it("relâche tout quand on touche un passage sans commentaire", async () => {
    const { host, touched, fermer } = monter({ passage: 2 });
    expect(host.querySelectorAll(".daf-linked")).toHaveLength(2);
    host.querySelector<HTMLElement>('.daf-passage[data-passage="1"]')!.click();
    await nextTick();
    expect(touched).toEqual([null]);
    expect(host.querySelectorAll(".daf-linked")).toHaveLength(0);
    fermer();
  });

  it("écrit le même texte, surligné ou non", async () => {
    const { host, fermer } = monter();
    const before = host.textContent;
    host.querySelector<HTMLElement>('.daf-passage[data-passage="0"]')!.click();
    await nextTick();
    expect(host.textContent).toBe(before);
    fermer();
  });
});
