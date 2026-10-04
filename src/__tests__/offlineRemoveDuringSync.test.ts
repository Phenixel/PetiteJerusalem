import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La mise à jour de fond parcourt la liste des livres périmés, établie à son
 * départ. « Tout supprimer » pendant qu'elle reprend le premier : celui-là
 * restait supprimé (voir offlineRemoveDuringDownload.test.ts), mais la boucle
 * passait au suivant, que l'on venait de retirer aussi, le téléchargeait et
 * le réinscrivait.
 */

const { state } = vi.hoisted(() => ({
  state: {
    /** Les livres gardés sur l'appareil. */
    kept: new Set<string>(),
    /** Les téléchargements lancés par la synchronisation, dans l'ordre. */
    started: [] as string[],
    /** Le téléchargement en cours, tenu jusqu'à ce que le test le laisse finir. */
    finish: () => {},
  },
}));

const L1 = "/texts/tanakh/bereshit.json";
const L2 = "/texts/tanakh/chemot.json";

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
vi.mock("../services/offlineTextStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/offlineTextStore")>()),
  ensureManifestLoaded: () => Promise.resolve(),
  outdatedDownloads: () => Promise.resolve([L1, L2]),
  isDownloaded: (path: string) => state.kept.has(path),
  downloadFile: (path: string) => {
    state.started.push(path);
    return new Promise<void>((resolve) => {
      state.finish = () => {
        state.kept.add(path);
        resolve();
      };
    });
  },
}));

const { refreshStaleDownloads } = await import("../services/offlineLibraryService");

/** Laisse passer les promesses en attente. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  state.kept = new Set([L1, L2]);
  state.started = [];
});

describe("la mise à jour de fond, pendant qu'on supprime", () => {
  it("ne reprend pas un livre retiré avant son tour", async () => {
    const sync = refreshStaleDownloads();
    await settle();
    expect(state.started).toEqual([L1]);

    // « Tout supprimer » pendant la reprise du premier.
    state.kept.clear();
    state.finish();
    await sync;

    expect(state.started).toEqual([L1]);
  });

  it("reprend chaque livre périmé quand rien n'est retiré", async () => {
    const sync = refreshStaleDownloads();
    await settle();
    state.finish();
    await settle();
    state.finish();
    await sync;

    expect(state.started).toEqual([L1, L2]);
  });
});
