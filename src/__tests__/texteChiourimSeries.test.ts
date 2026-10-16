import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import type { Chiour, TextStudyJsonEntry } from "../models/models";

/**
 * The audio lessons encart sits under every text of the library. It used to
 * read the whole `series` collection before knowing whether the text had a
 * single lesson: one collection read per reading page, for nothing on most
 * texts. The series names are only read when a lesson belongs to a series.
 */

const { getChiourimOfTexte, getAllSeries } = vi.hoisted(() => ({
  getChiourimOfTexte: vi.fn<(id: number) => Promise<Chiour[]>>(),
  getAllSeries: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../services/chiourService", () => ({ chiourService: { getChiourimOfTexte } }));
vi.mock("../services/serieService", () => ({
  serieService: { getAllSeries, peekSeries: () => null },
}));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

import TexteChiourim from "../components/chiourim/TexteChiourim.vue";

const entry = {
  id: 1,
  name: "Berakhot",
  type: "Talmud Bavli",
  link: "Berakhot",
} as unknown as TextStudyJsonEntry;

const lesson = (serieId: string | null): Chiour => ({
  slug: `cours-${serieId ?? "seul"}`,
  name: "Cours",
  description: "",
  auteur: null,
  categories: [],
  mediaUrl: "https://example.org/a.mp3",
  niveau: null,
  auteurId: null,
  serieId,
  episode: null,
  duration: null,
  addedAt: null,
  texteId: 1,
  texteChapitre: null,
});

async function mountFor(lessons: Chiour[]) {
  getChiourimOfTexte.mockResolvedValue(lessons);
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const app = createApp({ render: () => h(TexteChiourim, { entry, chapitre: null }) });
  app.use(i18n);
  app.mount(document.createElement("div"));
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  return app;
}

describe("the audio lessons of a text", () => {
  beforeEach(() => {
    getChiourimOfTexte.mockReset();
    getAllSeries.mockClear();
  });

  it("do not read the series when the text has no lesson", async () => {
    const app = await mountFor([]);
    expect(getChiourimOfTexte).toHaveBeenCalledWith(1);
    expect(getAllSeries).not.toHaveBeenCalled();
    app.unmount();
  });

  it("do not read them for lessons outside any series", async () => {
    const app = await mountFor([lesson(null)]);
    expect(getAllSeries).not.toHaveBeenCalled();
    app.unmount();
  });

  it("read them once a lesson belongs to a series", async () => {
    const app = await mountFor([lesson("serie-1")]);
    expect(getAllSeries).toHaveBeenCalledTimes(1);
    app.unmount();
  });
});
