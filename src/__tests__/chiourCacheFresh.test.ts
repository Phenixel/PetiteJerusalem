import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chiour } from "../models/models";

/**
 * Les catalogues des chiourim et des séries se gardent une heure. Un chiour
 * publié (ou une série créée) après leur chargement était dit
 * « introuvable » jusqu'à la fin de l'heure : le lien qu'on venait de
 * recevoir ne s'ouvrait pas, dans l'onglet déjà ouvert ou dans l'app restée
 * en arrière-plan.
 */

const { fetchAll, fetchBySlug, getDocs } = vi.hoisted(() => ({
  fetchAll: vi.fn(),
  fetchBySlug: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs,
  updateDoc: vi.fn(),
  increment: vi.fn(),
}));
vi.mock("../repositories/chiourFirestoreRepository", () => ({
  chiourFirestoreRepository: { fetchAll, fetchBySlug },
}));

const { chiourService } = await import("../services/chiourService");
const { serieService } = await import("../services/serieService");

const chiour = (slug: string): Chiour => ({
  slug,
  name: slug,
  description: "",
  auteur: null,
  categories: [],
  mediaUrl: "",
  niveau: null,
  auteurId: null,
  serieId: null,
  episode: null,
});

const seriesSnapshot = (ids: string[]) => ({
  docs: ids.map((id) => ({ id, data: () => ({ name: id }) })),
});

beforeEach(() => {
  fetchAll.mockReset();
  fetchBySlug.mockReset();
  getDocs.mockReset();
  chiourService.invalidateCache();
  serieService.invalidateCache();
});

describe("un chiour publié après le chargement du catalogue", () => {
  it("se trouve quand même", async () => {
    fetchAll.mockResolvedValue([chiour("ancien")]);
    fetchBySlug.mockResolvedValue(chiour("nouveau"));
    await chiourService.getAllChiourim();

    expect((await chiourService.getChiourBySlug("nouveau"))?.slug).toBe("nouveau");
    // Le catalogue, périmé, se recharge à la demande suivante.
    expect(chiourService.getCachedChiourim()).toBeNull();
  });

  it("un chiour connu du catalogue ne coûte aucune lecture", async () => {
    fetchAll.mockResolvedValue([chiour("ancien")]);
    await chiourService.getAllChiourim();

    expect((await chiourService.getChiourBySlug("ancien"))?.slug).toBe("ancien");
    expect(fetchBySlug).not.toHaveBeenCalled();
  });

  it("un slug qui n'existe pas reste introuvable, catalogue gardé", async () => {
    fetchAll.mockResolvedValue([chiour("ancien")]);
    fetchBySlug.mockResolvedValue(null);
    await chiourService.getAllChiourim();

    expect(await chiourService.getChiourBySlug("inconnu")).toBeNull();
    expect(chiourService.getCachedChiourim()).not.toBeNull();
  });
});

describe("une série créée après le chargement de la liste", () => {
  it("se trouve quand même", async () => {
    getDocs.mockResolvedValueOnce(seriesSnapshot(["ancienne"]));
    await serieService.getAllSeries();
    getDocs.mockResolvedValueOnce(seriesSnapshot(["ancienne", "nouvelle"]));

    expect((await serieService.getSerie("nouvelle"))?.id).toBe("nouvelle");
  });
});
