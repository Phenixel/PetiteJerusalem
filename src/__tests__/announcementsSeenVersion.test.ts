import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Announcement } from "../services/announcements";

/**
 * Une note de version ouverte seule (« Lire la suite » sur l'accueil, une
 * notification) : la date ne suffit plus à l'éteindre depuis que l'appareil
 * retient la version de sa dernière visite de la liste. Lue avec sa version
 * installée, elle avance ce repère ; sinon elle restait « Nouveau » sur
 * l'accueil jusqu'à la prochaine visite de la liste.
 */

const SEEN_KEY = "pj_announcements_seen";
const SEEN_VERSION_KEY = "pj_announcements_seen_version";
const DAY = 24 * 60 * 60 * 1000;

const native = { installed: "3.12.0" };
let published: Announcement[] = [];

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));
vi.mock("@capacitor/app", () => ({
  App: { getInfo: async () => ({ version: native.installed }) },
}));
vi.mock("../services/announcementService", () => ({
  announcementService: { getAll: async () => published, invalidate: () => {} },
}));

function release(version: string, publishedAt: Date): Announcement {
  return {
    id: `release-v${version}`,
    kind: "release",
    title: { fr: `Version ${version}` },
    body: { fr: "Texte" },
    published: true,
    publishedAt,
    updatedAt: null,
    link: null,
    version,
    resolved: false,
    notify: false,
    notifiedAt: null,
  };
}

/** Le composable lit l'appareil à l'import : un module neuf par cas. */
async function freshComposable() {
  vi.resetModules();
  const { useAnnouncements } = await import("../composables/useAnnouncements");
  return useAnnouncements();
}

beforeEach(() => {
  localStorage.clear();
  native.installed = "3.12.0";
  published = [];
});

describe("une note de version ouverte seule", () => {
  it("lue avec sa version installée, elle n'est plus nouvelle sur l'accueil", async () => {
    // La liste a été visitée en 3.11, après la publication de la note.
    const note = release("3.12.0", new Date(Date.now() - 2 * DAY));
    published = [note];
    localStorage.setItem(SEEN_KEY, String(Date.now() - DAY));
    localStorage.setItem(SEEN_VERSION_KEY, "3.11.0");

    const { highlights, load, markSeenUpTo, seenVersion } = await freshComposable();
    await load();
    expect(highlights.value[0]).toMatchObject({ mode: "preview", unreadCount: 1 });

    await markSeenUpTo(note);

    expect(seenVersion.value).toBe("3.12.0");
    expect(localStorage.getItem(SEEN_VERSION_KEY)).toBe("3.12.0");
    // Lue, une note de version quitte l'accueil : pas de ligne d'une semaine.
    expect(highlights.value).toEqual([]);
  });

  it("ouverte depuis une notification, avant la liste : la version installée est lue", async () => {
    const note = release("3.12.0", new Date(Date.now() - 2 * DAY));
    localStorage.setItem(SEEN_KEY, String(Date.now() - DAY));
    localStorage.setItem(SEEN_VERSION_KEY, "3.11.0");

    const { installed, markSeenUpTo, seenVersion } = await freshComposable();
    expect(installed.value).toBeNull();

    await markSeenUpTo(note);

    expect(installed.value).toBe("3.12.0");
    expect(seenVersion.value).toBe("3.12.0");
  });

  it("lue avant l'installation de sa version, elle reviendra", async () => {
    native.installed = "3.11.0";
    const note = release("3.12.0", new Date(Date.now() - 2 * DAY));
    localStorage.setItem(SEEN_VERSION_KEY, "3.11.0");

    const { markSeenUpTo, seenVersion } = await freshComposable();
    await markSeenUpTo(note);

    expect(seenVersion.value).toBe("3.11.0");
  });

  it("une note plus ancienne ne fait pas reculer le repère", async () => {
    const note = release("3.11.0", new Date(Date.now() - 20 * DAY));
    localStorage.setItem(SEEN_VERSION_KEY, "3.12.0");

    const { markSeenUpTo, seenVersion } = await freshComposable();
    await markSeenUpTo(note);

    expect(seenVersion.value).toBe("3.12.0");
  });

  it("la date avance toujours, pour toute annonce", async () => {
    const news: Announcement = {
      ...release("3.12.0", new Date(Date.now() - DAY)),
      id: "nouveaute",
      kind: "news",
      version: null,
    };

    const { markSeenUpTo, seenAt, seenVersion } = await freshComposable();
    await markSeenUpTo(news);

    expect(seenAt.value).toBe(news.publishedAt!.getTime());
    expect(seenVersion.value).toBeNull();
  });
});
