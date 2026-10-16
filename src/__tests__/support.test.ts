import { describe, expect, it } from "vitest";
import {
  buildReplyNotification,
  FeedbackValidationError,
  isTeamReplyTransition,
  MESSAGES_MAX,
  newThread,
  ownsThread,
  parseFeedback,
  parseGuestKey,
  parseReply,
  publicThread,
  userReplyPatch,
  type SupportMessage,
} from "../../functions/src/support";
import {
  mailtoReply,
  parseAdminThread,
  replyEmail,
  sortForTeam,
  threadSubject,
  unreadCount,
} from "../services/support";

/**
 * Nous écrire (docs/feedback.md) : ce que le client envoie ouvre un fil dans
 * Firestore, la personne ne relit que les siens et sans la note de l'équipe,
 * et seule une réponse de l'équipe fait partir une notification. Les
 * versions de l'app d'avant les fils continuent d'envoyer sans clé.
 */

const valid = {
  kind: "bug",
  otherKind: "",
  details: "  Le bouton ne répond pas.  ",
  contact: "",
  support: "app",
  platform: "ios",
  version: "1.4.2 (37)",
};

const KEY = "a".repeat(43);
const NOW = new Date(Date.UTC(2026, 9, 16, 12, 0, 0));

describe("parseFeedback", () => {
  it("accepte l'envoi d'une version d'avant les fils (sans clé, ni langue, ni page)", () => {
    expect(parseFeedback(valid)).toEqual({
      kind: "bug",
      otherKind: "",
      details: "Le bouton ne répond pas.",
      contact: "",
      support: "app",
      platform: "ios",
      version: "1.4.2 (37)",
      locale: "fr",
      page: "",
      guestKey: "",
      pushToken: "",
    });
  });

  it("garde la clé de l'appareil, la langue, la page et le jeton", () => {
    const input = parseFeedback({
      ...valid,
      guestKey: KEY,
      locale: "he",
      page: "/lire/tehilim",
      pushToken: "jeton",
    });
    expect(input).toMatchObject({ guestKey: KEY, locale: "he", page: "/lire/tehilim" });
    expect(input.pushToken).toBe("jeton");
  });

  it("refuse une clé d'appareil mal formée", () => {
    expect(() => parseFeedback({ ...valid, guestKey: "courte" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, guestKey: `${KEY} ` })).toThrow(FeedbackValidationError);
    expect(() => parseGuestKey({ guestKey: 42 })).toThrow(FeedbackValidationError);
    expect(parseGuestKey({})).toBe("");
  });

  it("ne garde qu'un chemin de l'app comme page, et le français pour une langue inconnue", () => {
    expect(parseFeedback({ ...valid, page: "https://ailleurs.fr" }).page).toBe("");
    expect(parseFeedback({ ...valid, page: "//ailleurs.fr" }).page).toBe("");
    expect(parseFeedback({ ...valid, locale: "de" }).locale).toBe("fr");
  });

  it("exige des détails", () => {
    expect(() => parseFeedback({ ...valid, details: "   " })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, details: undefined })).toThrow(FeedbackValidationError);
  });

  it("refuse un type, un support ou une plateforme inconnus", () => {
    expect(() => parseFeedback({ ...valid, kind: "praise" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, kind: "toString" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, support: "tv" })).toThrow(FeedbackValidationError);
    expect(() => parseFeedback({ ...valid, platform: "windows" })).toThrow(FeedbackValidationError);
  });

  it("refuse un texte trop long", () => {
    expect(() => parseFeedback({ ...valid, details: "x".repeat(2001) })).toThrow(
      FeedbackValidationError,
    );
  });

  it("ne garde la précision « autre » que pour ce type", () => {
    expect(parseFeedback({ ...valid, kind: "bug", otherKind: "un mot" }).otherKind).toBe("");
    expect(parseFeedback({ ...valid, kind: "other", otherKind: " un mot " }).otherKind).toBe(
      "un mot",
    );
  });

  it("tolère un envoi qui n'est pas un objet", () => {
    expect(() => parseFeedback(null)).toThrow(FeedbackValidationError);
    expect(() => parseFeedback("bonjour")).toThrow(FeedbackValidationError);
  });
});

describe("parseReply", () => {
  it("exige un fil et un texte", () => {
    expect(parseReply({ threadId: "abc123", text: " Merci ", guestKey: KEY })).toEqual({
      threadId: "abc123",
      text: "Merci",
      guestKey: KEY,
      pushToken: "",
    });
    expect(() => parseReply({ threadId: "abc", text: "" })).toThrow(FeedbackValidationError);
    expect(() => parseReply({ threadId: "../autre", text: "x" })).toThrow(FeedbackValidationError);
  });
});

const identity = { uid: null, accountEmail: null, accountName: null, guestKeyHash: "h1" };

describe("un fil", () => {
  it("s'ouvre à traiter, sur le premier message", () => {
    const thread = newThread(parseFeedback({ ...valid, pushToken: "t1" }), identity, NOW);
    expect(thread).toMatchObject({
      status: "new",
      note: "",
      lastFrom: "user",
      unreadByUser: false,
      pushTokens: ["t1"],
      guestKeyHash: "h1",
      messages: [{ from: "user", text: "Le bouton ne répond pas.", at: NOW }],
    });
  });

  it("ne se relit que par son compte ou par la clé de son appareil", () => {
    expect(ownsThread({ uid: "u1", guestKeyHash: null }, "u1", null)).toBe(true);
    expect(ownsThread({ uid: "u1", guestKeyHash: null }, "u2", null)).toBe(false);
    expect(ownsThread({ uid: null, guestKeyHash: "h1" }, null, "h1")).toBe(true);
    expect(ownsThread({ uid: null, guestKeyHash: "h1" }, null, "h2")).toBe(false);
    // Un fil sans clé (version d'avant les fils) ne s'ouvre pas avec « rien ».
    expect(ownsThread({ uid: null, guestKeyHash: null }, null, null)).toBe(false);
  });

  it("se montre à la personne sans la note de l'équipe ni les identifiants", () => {
    const doc = {
      ...newThread(parseFeedback(valid), { ...identity, uid: "u1" }, NOW),
      note: "piste interne",
      unreadByUser: true,
    };
    const view = publicThread("f1", doc as unknown as Record<string, unknown>);
    expect(view).toEqual({
      id: "f1",
      kind: "bug",
      otherKind: "",
      status: "new",
      unread: true,
      createdAt: NOW.getTime(),
      updatedAt: NOW.getTime(),
      messages: [{ from: "user", text: "Le bouton ne répond pas.", at: NOW.getTime() }],
    });
    expect(JSON.stringify(view)).not.toContain("piste interne");
    expect(JSON.stringify(view)).not.toContain("u1");
  });

  it("revient à traiter sur une relance, sauf s'il est en cours", () => {
    const messages: SupportMessage[] = [{ from: "user", text: "a", at: NOW }];
    expect(userReplyPatch({ status: "answered", messages }, "b", NOW).status).toBe("new");
    expect(userReplyPatch({ status: "done", messages }, "b", NOW).status).toBe("new");
    expect(userReplyPatch({ status: "in_progress", messages }, "b", NOW).status).toBe(
      "in_progress",
    );
  });

  it("ajoute le jeton d'un nouvel appareil, sans doublon", () => {
    const messages: SupportMessage[] = [{ from: "user", text: "a", at: NOW }];
    expect(userReplyPatch({ status: "new", messages }, "b", NOW, "t2", ["t1"]).pushTokens).toEqual([
      "t2",
      "t1",
    ]);
    expect(userReplyPatch({ status: "new", messages }, "b", NOW, "t1", ["t1"])).not.toHaveProperty(
      "pushTokens",
    );
  });

  it("refuse une relance sur un fil plein", () => {
    const messages: SupportMessage[] = Array.from({ length: MESSAGES_MAX }, () => ({
      from: "user",
      text: "a",
      at: NOW,
    }));
    expect(() => userReplyPatch({ status: "new", messages }, "b", NOW)).toThrow(
      FeedbackValidationError,
    );
  });
});

describe("la notification de réponse", () => {
  const before = { messages: [{ from: "user", text: "Bonjour" }] };
  const after = {
    locale: "en",
    pushTokens: ["t1"],
    messages: [...before.messages, { from: "team", text: "Merci, c'est corrigé dans la 1.5." }],
  };

  it("ne part qu'à l'ajout d'une réponse de l'équipe", () => {
    expect(isTeamReplyTransition(before, after)).toBe(true);
    expect(isTeamReplyTransition(after, { ...after, status: "done" })).toBe(false);
    expect(
      isTeamReplyTransition(after, {
        ...after,
        messages: [...after.messages, { from: "user", text: "Super" }],
      }),
    ).toBe(false);
    expect(isTeamReplyTransition(before, undefined)).toBe(false);
  });

  it("vise les appareils du fil et du compte, dans la langue du fil, vers /contact", () => {
    const message = buildReplyNotification(after, ["t2", "t1"]);
    expect(message).toEqual({
      tokens: ["t1", "t2"],
      notification: {
        title: "Petite Jérusalem replied to you",
        body: "Merci, c'est corrigé dans la 1.5.",
      },
      data: { url: "/contact" },
      apns: { payload: { aps: { sound: "default" } } },
    });
  });

  it("ne part pas sans appareil connu", () => {
    expect(buildReplyNotification({ ...after, pushTokens: [] }, [])).toBeNull();
  });
});

describe("le backoffice", () => {
  const doc = {
    kind: "idea",
    contact: "06 12 34 56 78",
    accountEmail: "vous@exemple.fr",
    status: "answered",
    messages: [{ from: "user", text: "Une idée\nsur deux lignes", at: { toMillis: () => 1000 } }],
    updatedAt: { toMillis: () => 2000 },
    guestKeyHash: "h1",
    pushTokens: [],
  };

  it("lit un document, même incomplet", () => {
    const th = parseAdminThread("f1", doc);
    expect(th).toMatchObject({
      id: "f1",
      kind: "idea",
      status: "answered",
      updatedAt: 2000,
      fromDevice: true,
      canNotify: false,
      messages: [{ from: "user", text: "Une idée\nsur deux lignes", at: 1000 }],
    });
    expect(parseAdminThread("f2", {})).toMatchObject({
      kind: "other",
      status: "new",
      messages: [],
    });
  });

  it("répond par email au contact laissé, sinon à l'email du compte", () => {
    expect(replyEmail({ contact: "a@b.fr", accountEmail: "c@d.fr" })).toBe("a@b.fr");
    expect(replyEmail({ contact: "06 12 34 56 78", accountEmail: "c@d.fr" })).toBe("c@d.fr");
    expect(replyEmail({ contact: "", accountEmail: null })).toBeNull();
  });

  it("prépare l'email avec la réponse et le message cité", () => {
    const link = mailtoReply("a@b.fr", "Objet", "Merci", "Ligne 1\nLigne 2");
    expect(link.startsWith("mailto:a%40b.fr?subject=Objet&body=")).toBe(true);
    expect(decodeURIComponent(link.split("body=")[1])).toBe("Merci\n\n> Ligne 1\n> Ligne 2");
  });

  it("range ce qui attend l'équipe en tête", () => {
    const sorted = sortForTeam([
      { id: "a", status: "done", updatedAt: 9 },
      { id: "b", status: "answered", updatedAt: 8 },
      { id: "c", status: "new", updatedAt: 1 },
      { id: "d", status: "in_progress", updatedAt: 5 },
      { id: "e", status: "new", updatedAt: 3 },
    ] as const);
    expect(sorted.map((t) => t.id)).toEqual(["e", "c", "d", "b", "a"]);
  });

  it("résume le premier message sur une ligne, et compte les réponses non lues", () => {
    expect(threadSubject({ messages: [{ from: "user", text: "Une  idée\nici", at: 0 }] })).toBe(
      "Une idée ici",
    );
    expect(unreadCount([{ unread: true }, { unread: false }, { unread: true }])).toBe(2);
  });
});
