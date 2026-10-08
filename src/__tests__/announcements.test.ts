import { describe, expect, it } from "vitest";
import {
  appliesToInstalled,
  FIRST_VISIT_WINDOW_MS,
  fixedOnDevice,
  HOME_PREVIEW_MAX_AGE_MS,
  HOME_RECENT_WINDOW_MS,
  homeHighlights,
  isExternalLink,
  isOngoingIncident,
  isNew,
  localized,
  sortAnnouncements,
  unreadAnnouncements,
  type Announcement,
} from "../services/announcements";
import {
  announcementTopic,
  buildAnnouncementMessages,
  excerpt,
  isNotifyTransition,
  shouldNotify,
} from "../../functions/src/announcementPush";
import { topicFor } from "../services/announcementTopics";

/**
 * Les informations de l'équipe : ce que l'accueil met en avant, ce qui compte
 * comme nouveau, et la notification qui part à la publication.
 */

const NOW = Date.UTC(2026, 8, 29, 12);
const DAY = 24 * 60 * 60 * 1000;

function make(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "a",
    kind: "news",
    title: { fr: "Titre" },
    body: { fr: "Texte" },
    published: true,
    publishedAt: new Date(NOW - DAY),
    updatedAt: null,
    link: null,
    version: null,
    resolved: false,
    notify: false,
    notifiedAt: null,
    ...overrides,
  };
}

describe("localized", () => {
  it("prend la langue demandée, le français à défaut", () => {
    const text = { fr: "Bonjour", en: "Hello", he: "  " };
    expect(localized(text, "en")).toBe("Hello");
    expect(localized(text, "he")).toBe("Bonjour");
    expect(localized(null, "fr")).toBe("");
  });
});

describe("isNew", () => {
  it("compte depuis la dernière visite de la liste", () => {
    const a = make({ publishedAt: new Date(NOW - DAY) });
    expect(isNew(a, NOW - 2 * DAY, NOW)).toBe(true);
    expect(isNew(a, NOW, NOW)).toBe(false);
  });

  it("sans visite, ne remonte que les derniers jours", () => {
    expect(isNew(make({ publishedAt: new Date(NOW - DAY) }), null, NOW)).toBe(true);
    const old = make({ publishedAt: new Date(NOW - FIRST_VISIT_WINDOW_MS - DAY) });
    expect(isNew(old, null, NOW)).toBe(false);
  });

  it("un brouillon sans date n'est jamais nouveau", () => {
    expect(isNew(make({ publishedAt: null }), null, NOW)).toBe(false);
  });
});

describe("appliesToInstalled", () => {
  const release = make({ kind: "release", version: "3.11.0" });

  it("attend que la version soit installée", () => {
    expect(appliesToInstalled(release, "3.10.4")).toBe(false);
    expect(appliesToInstalled(release, "3.11.0")).toBe(true);
    expect(appliesToInstalled(release, "3.12.0")).toBe(true);
  });

  it("vaut toujours sur le site et pour les autres natures", () => {
    expect(appliesToInstalled(release, null)).toBe(true);
    expect(appliesToInstalled(make({ version: "9.0.0" }), "3.10.0")).toBe(true);
  });
});

describe("une note de version vue avant son installation", () => {
  // Publiée pendant la revue des stores, la note est vue (liste visitée) en
  // 3.11 : la date de visite la dépasse. Installée la 3.12, elle ne revenait
  // jamais comme nouvelle.
  const note = make({ id: "release-v3.12.0", kind: "release", version: "3.12.0" });
  const seenAt = NOW - DAY / 2;

  it("revient comme nouvelle une fois la version installée", () => {
    expect(unreadAnnouncements([note], seenAt, "3.12.0", NOW, "3.11.0")).toEqual([note]);
    expect(homeHighlights([note], seenAt, "3.12.0", NOW, "3.11.0")[0]?.announcement).toBe(note);
  });

  it("ne revient pas une fois vue avec sa version installée", () => {
    expect(unreadAnnouncements([note], seenAt, "3.12.0", NOW, "3.12.0")).toEqual([]);
  });

  it("n'est pas nouvelle tant que la version n'est pas là", () => {
    expect(unreadAnnouncements([note], null, "3.11.0", NOW, "3.11.0")).toEqual([]);
  });

  it("sans version retenue (avant ce correctif), la date seule décide", () => {
    expect(unreadAnnouncements([note], seenAt, "3.12.0", NOW, null)).toEqual([]);
  });
});

describe("homeHighlights", () => {
  it("une annonce non lue se montre en aperçu, avec le nombre de nouveautés", () => {
    const recent = make({ id: "r", publishedAt: new Date(NOW - DAY) });
    const older = make({ id: "o", publishedAt: new Date(NOW - 2 * DAY) });
    expect(homeHighlights([recent, older], NOW - 3 * DAY, null, NOW)).toEqual([
      { announcement: recent, mode: "preview", unreadCount: 2 },
    ]);
  });

  it("une fois lue, reste une semaine en une ligne, puis disparaît", () => {
    const read = make({ publishedAt: new Date(NOW - 2 * DAY) });
    expect(homeHighlights([read], NOW, null, NOW).map((h) => h.mode)).toEqual(["compact"]);
    const old = make({ publishedAt: new Date(NOW - HOME_RECENT_WINDOW_MS - DAY) });
    expect(homeHighlights([old], NOW, null, NOW)).toEqual([]);
  });

  it("une annonce trop ancienne n'est plus proposée en aperçu, même non lue", () => {
    const stale = make({ publishedAt: new Date(NOW - HOME_PREVIEW_MAX_AGE_MS - DAY) });
    expect(homeHighlights([stale], 0, null, NOW)).toEqual([]);
  });

  it("un incident non lu passe en aperçu, seul", () => {
    const incident = make({ id: "i", kind: "incident", publishedAt: new Date(NOW - 3 * DAY) });
    const news = make({ id: "n", publishedAt: new Date(NOW - DAY) });
    const h = homeHighlights([news, incident], NOW - 5 * DAY, null, NOW);
    expect(h.map((x) => [x.announcement.id, x.mode])).toEqual([["i", "preview"]]);
    expect(h[0].unreadCount).toBe(2);
  });

  it("un incident lu reste en une ligne, la nouveauté non lue en aperçu dessous", () => {
    const incident = make({ id: "i", kind: "incident", publishedAt: new Date(NOW - 3 * DAY) });
    const news = make({ id: "n", publishedAt: new Date(NOW - DAY) });
    const h = homeHighlights([news, incident], NOW - 2 * DAY, null, NOW);
    expect(h.map((x) => [x.announcement.id, x.mode])).toEqual([
      ["i", "compact"],
      ["n", "preview"],
    ]);
    const allSeen = homeHighlights([news, incident], NOW, null, NOW);
    expect(allSeen.map((x) => [x.announcement.id, x.mode])).toEqual([["i", "compact"]]);
  });

  it("un incident réglé laisse la place aux nouveautés", () => {
    const incident = make({ id: "i", kind: "incident", resolved: true });
    const news = make({ id: "n" });
    const h = homeHighlights([news, incident], NOW - 2 * DAY, null, NOW);
    expect(h[0].announcement.id).toBe("n");
    expect(h[0].unreadCount).toBe(2);
  });

  it("ignore des notes de version pas encore installées", () => {
    const release = make({ kind: "release", version: "3.11.0" });
    expect(unreadAnnouncements([release], null, "3.10.0", NOW)).toEqual([]);
    expect(homeHighlights([release], null, "3.10.0", NOW)).toEqual([]);
  });
});

describe("un incident corrigé par une version", () => {
  const incident = make({ id: "i", kind: "incident", version: "3.10.11" });

  it("reste en cours tant que la version du correctif n'est pas installée", () => {
    expect(fixedOnDevice(incident, "3.10.10")).toBe(false);
    expect(isOngoingIncident(incident, "3.10.10")).toBe(true);
    const [first] = homeHighlights([incident], null, "3.10.10", NOW);
    expect(first).toMatchObject({ announcement: incident, mode: "preview" });
    // Lu, il reste en une ligne : l'appareil est toujours concerné.
    const read = homeHighlights([incident], NOW, "3.10.10", NOW);
    expect(read).toMatchObject([{ announcement: incident, mode: "compact" }]);
  });

  it("quitte l'accueil une fois le correctif installé, lu ou non", () => {
    for (const installed of ["3.10.11", "3.11.0"]) {
      expect(isOngoingIncident(incident, installed)).toBe(false);
      expect(homeHighlights([incident], null, installed, NOW)).toEqual([]);
      expect(homeHighlights([incident], NOW, installed, NOW)).toEqual([]);
      expect(unreadAnnouncements([incident], null, installed, NOW)).toEqual([]);
    }
  });

  it("ne s'affiche pas sur le site, toujours à la dernière version", () => {
    expect(fixedOnDevice(incident, null)).toBe(true);
    expect(homeHighlights([incident], null, null, NOW)).toEqual([]);
  });

  it("laisse la place aux nouveautés là où il est corrigé", () => {
    const news = make({ id: "n", publishedAt: new Date(NOW - 2 * DAY) });
    const [first, second] = homeHighlights([incident, news], null, "3.10.11", NOW);
    expect(first).toMatchObject({ announcement: news, mode: "preview", unreadCount: 1 });
    expect(second).toBeUndefined();
  });

  it("sans version, un incident ne dépend que de « résolu »", () => {
    const plain = make({ id: "p", kind: "incident" });
    expect(fixedOnDevice(plain, null)).toBe(false);
    expect(isOngoingIncident(plain, "9.9.9")).toBe(true);
    expect(isOngoingIncident({ ...plain, resolved: true }, "9.9.9")).toBe(false);
    // Une note de version n'est jamais « corrigée » : la règle ne vaut que pour un incident.
    expect(fixedOnDevice(make({ kind: "release", version: "3.10.11" }), "3.10.11")).toBe(false);
  });
});

describe("une note de version lue", () => {
  const note = make({ id: "r", kind: "release", version: "3.10.11" });

  it("ne revient pas sur l'accueil, même dans la semaine", () => {
    expect(homeHighlights([note], NOW, "3.10.11", NOW)).toEqual([]);
    expect(homeHighlights([note], NOW, null, NOW)).toEqual([]);
  });

  it("non lue, elle s'annonce toujours en aperçu", () => {
    const [first] = homeHighlights([note], null, "3.10.11", NOW);
    expect(first).toMatchObject({ announcement: note, mode: "preview" });
  });

  it("laisse la ligne de la semaine à la dernière annonce d'une autre nature", () => {
    const news = make({ id: "n", publishedAt: new Date(NOW - 3 * DAY) });
    const [first] = homeHighlights([note, news], NOW, "3.10.11", NOW);
    expect(first).toMatchObject({ announcement: news, mode: "compact" });
  });
});

describe("sortAnnouncements", () => {
  it("range du plus récent au plus ancien, brouillons en tête", () => {
    const old = make({ id: "old", publishedAt: new Date(NOW - 5 * DAY) });
    const recent = make({ id: "recent", publishedAt: new Date(NOW - DAY) });
    const draft = make({ id: "draft", publishedAt: null, published: false });
    expect(sortAnnouncements([old, draft, recent]).map((a) => a.id)).toEqual([
      "draft",
      "recent",
      "old",
    ]);
  });
});

describe("isExternalLink", () => {
  it("distingue une page de l'app d'une adresse externe", () => {
    expect(isExternalLink("/bibliotheque/sidour")).toBe(false);
    expect(isExternalLink("https://petite-jerusalem.fr")).toBe(true);
  });
});

describe("notification d'une annonce", () => {
  it("ne part qu'une fois, publiée et demandée", () => {
    expect(shouldNotify({ published: true, notify: true, notifiedAt: null })).toBe(true);
    expect(shouldNotify({ published: true, notify: true })).toBe(true);
    expect(shouldNotify({ published: false, notify: true })).toBe(false);
    expect(shouldNotify({ published: true, notify: false })).toBe(false);
    expect(shouldNotify({ published: true, notify: true, notifiedAt: new Date() })).toBe(false);
    expect(shouldNotify(undefined)).toBe(false);
  });

  it("ne part qu'au moment où l'annonce devient publiée avec la case cochée", () => {
    const ready = { published: true, notify: true, notifiedAt: null };
    expect(isNotifyTransition(undefined, ready)).toBe(true);
    expect(isNotifyTransition({ published: false, notify: true }, ready)).toBe(true);
    expect(isNotifyTransition({ published: true, notify: false }, ready)).toBe(true);
    // Déjà publiée et cochée : « Marquer résolu » ou une correction n'envoie rien.
    expect(isNotifyTransition(ready, { ...ready, resolved: true } as never)).toBe(false);
    expect(isNotifyTransition(undefined, { ...ready, notifiedAt: new Date() })).toBe(false);
  });

  it("un message par langue, le français à défaut de traduction", () => {
    const messages = buildAnnouncementMessages("abc", {
      title: { fr: "Nouveau sidour", en: "New siddur" },
      body: { fr: "Le sidour est là." },
    });
    expect(messages.map((m) => m.topic)).toEqual([
      "announcements-fr",
      "announcements-en",
      "announcements-he",
    ]);
    expect(messages[1].notification).toEqual({ title: "New siddur", body: "Le sidour est là." });
    expect(messages[2].notification.title).toBe("Nouveau sidour");
    expect(messages[0].data.url).toBe("/informations/abc");
  });

  it("rien sans titre", () => {
    expect(buildAnnouncementMessages("abc", { title: { fr: " " }, body: {} })).toEqual([]);
  });

  it("coupe un long texte au dernier mot entier", () => {
    const long = "mot ".repeat(100);
    const cut = excerpt(long, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("mot…")).toBe(true);
    expect(excerpt("court\n\ntexte")).toBe("court texte");
  });

  it("l'app s'abonne aux canaux où la fonction publie", () => {
    for (const locale of ["fr", "en", "he"] as const) {
      expect(topicFor(locale)).toBe(announcementTopic(locale));
    }
    expect(topicFor("de")).toBe("announcements-fr");
  });
});
