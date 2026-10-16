import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The home page read up to a hundred announcements on every visit, a number
 * that grows with each release (every GitHub release becomes one). It now
 * reads only what homeHighlights can show: the last month, and the
 * incidents of any age that may still be ongoing.
 */

const { getDocs, where } = vi.hoisted(() => ({
  getDocs: vi.fn(),
  where: vi.fn((...args: unknown[]) => ({ where: args })),
}));

vi.mock("../composables/useNativeApp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../composables/useNativeApp")>()),
  isNativeApp: false,
}));
vi.mock("../firebase/firestoreLite", () => ({ liteDb: {} }));
vi.mock("firebase/firestore/lite", () => ({
  collection: () => ({}),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs,
  limit: (n: number) => ({ limit: n }),
  orderBy: vi.fn(() => ({ orderBy: true })),
  query: (...args: unknown[]) => ({ query: args.slice(1) }),
  where,
}));

const DAY = 24 * 60 * 60 * 1000;
const doc = (id: string, kind: string, daysAgo: number) => ({
  id,
  data: () => ({
    kind,
    title: { fr: id },
    body: { fr: "" },
    published: true,
    publishedAt: { toDate: () => new Date(Date.now() - daysAgo * DAY) },
  }),
});

describe("the announcements of the home page", () => {
  beforeEach(() => {
    vi.resetModules();
    getDocs.mockReset();
    where.mockClear();
  });

  it("read the last month and the incidents, never the whole list", async () => {
    getDocs.mockImplementation(async (q: { query: Array<{ where?: unknown[] }> }) => {
      const incidents = q.query.some((c) => c.where?.[0] === "kind");
      return {
        docs: incidents
          ? [doc("old-incident", "incident", 90), doc("new-incident", "incident", 2)]
          : [doc("news", "news", 5), doc("new-incident", "incident", 2)],
      };
    });
    const { announcementService } = await import("../services/announcementService");
    const home = await announcementService.getHome();

    expect(getDocs).toHaveBeenCalledTimes(2);
    for (const [q] of getDocs.mock.calls) {
      expect(q.query).not.toContainEqual(expect.objectContaining({ limit: expect.anything() }));
    }
    const since = where.mock.calls.find((c) => c[0] === "publishedAt");
    expect(since?.[1]).toBe(">=");
    expect(Date.now() - (since?.[2] as Date).getTime()).toBeGreaterThanOrEqual(30 * DAY - 1000);
    // Merged without duplicate, most recent first, the old incident kept.
    expect(home.map((a) => a.id)).toEqual(["new-incident", "news", "old-incident"]);
  });

  it("come from the full list when it is fresh", async () => {
    getDocs.mockResolvedValue({ docs: [doc("news", "news", 5)] });
    const { announcementService } = await import("../services/announcementService");
    await announcementService.getAll();
    getDocs.mockClear();

    expect((await announcementService.getHome()).map((a) => a.id)).toEqual(["news"]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});
