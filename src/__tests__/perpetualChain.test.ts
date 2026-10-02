import { describe, expect, it, vi } from "vitest";
import { HDate, months } from "@hebcal/core";
import type { PrayerName, Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import {
  ANNIVERSARY_WINDOW_DAYS,
  findPerpetualSession,
  formatPrayerName,
  isDated,
  isPrayerNameListed,
  normalizeNamePart,
  perpetualStats,
  prayerNameExpiry,
  PRAYER_NAME_TTL_DAYS,
  sortPrayerNames,
  spokenDuration,
} from "../services/perpetualChain";
import { daysUntilNext } from "../services/hebrewOccasions";
import {
  PERPETUAL_HOLD_MS,
  isRoundComplete,
  nextRound,
  roundParticipants,
  withHoldExpiry,
} from "../../functions/src/perpetualRound";
import {
  PERPETUAL_DATE_LIMIT,
  PERPETUAL_SESSION_ID,
  describePrayerName,
  perpetualChainSession,
} from "../../scripts/lib/backoffice.mjs";
import textStudiesJson from "../datas/textStudies.json";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

vi.mock("../services/firestoreService");
import { sessionService } from "../services/sessionService";

/**
 * La chaîne perpétuelle de Tehilim (docs/chaine-perpetuelle.md) : les noms
 * pour lesquels on lit, quand ils le sont, le compteur des tours, et la règle
 * qui remet la chaîne à zéro (functions/src/perpetualRound.ts).
 */

const DAY = 24 * 3600 * 1000;
const NOW = new Date("2026-10-01T10:00:00Z");

const prayerName = (over: Partial<PrayerName> = {}): PrayerName => ({
  id: "n1",
  ownerId: "u1",
  gender: "male",
  firstName: "David",
  motherName: "Sarah",
  kind: "refoua",
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  expiresAt: new Date(NOW.getTime() + 10 * DAY),
  ...over,
});

const chain = (over: Partial<Session> = {}): Session => ({
  id: PERPETUAL_SESSION_ID,
  name: "Chaîne perpétuelle de Tehilim",
  type: EnumTypeTextStudy.Tehilim,
  description: "",
  dateLimit: PERPETUAL_DATE_LIMIT,
  createdAt: new Date("2026-07-01T00:00:00Z"),
  personId: "petite-jerusalem",
  creatorName: "Petite Jérusalem",
  reservations: [],
  perpetual: true,
  slotCount: 150,
  ...over,
});

describe("le nom tel qu'on le dit", () => {
  it("met ben devant la mère d'un homme, bat devant celle d'une femme", () => {
    expect(formatPrayerName(prayerName())).toBe("David ben Sarah");
    expect(
      formatPrayerName(prayerName({ gender: "female", firstName: "Rivka", motherName: "Léa" })),
    ).toBe("Rivka bat Léa");
  });

  it("nettoie les espaces de la saisie", () => {
    expect(normalizeNamePart("  Yossef   Haïm ")).toBe("Yossef Haïm");
  });
});

describe("quand un nom est lu", () => {
  it("un nom sans date l'est jusqu'à son échéance, trente jours après qu'on l'a posé", () => {
    expect(prayerNameExpiry(NOW).getTime() - NOW.getTime()).toBe(PRAYER_NAME_TTL_DAYS * DAY);
    expect(isPrayerNameListed(prayerName(), NOW, null)).toBe(true);
    const expired = prayerName({ expiresAt: new Date(NOW.getTime() - DAY) });
    expect(isPrayerNameListed(expired, NOW, null)).toBe(false);
  });

  it("seul un leilouy nichmat porte une date de décès", () => {
    const dated = { kind: "leilouy" as const, deathDay: 12, deathMonth: months.NISAN };
    expect(isDated(prayerName(dated))).toBe(true);
    expect(isDated(prayerName({ ...dated, kind: "refoua" }))).toBe(false);
    expect(isDated(prayerName({ kind: "leilouy" }))).toBe(false);
  });

  it("un défunt daté l'est la semaine qui précède l'anniversaire, jour même compris", () => {
    const dated = prayerName({
      kind: "leilouy",
      deathDay: 12,
      deathMonth: months.NISAN,
      expiresAt: null,
    });
    expect(isPrayerNameListed(dated, NOW, 0)).toBe(true);
    expect(isPrayerNameListed(dated, NOW, ANNIVERSARY_WINDOW_DAYS)).toBe(true);
    expect(isPrayerNameListed(dated, NOW, ANNIVERSARY_WINDOW_DAYS + 1)).toBe(false);
    // Sans calendrier (pas encore calculé), on ne le montre pas.
    expect(isPrayerNameListed(dated, NOW, null)).toBe(false);
  });

  it("compte les jours jusqu'à l'anniversaire hébraïque, d'une année sur l'autre", () => {
    const today = new Date(2026, 9, 1);
    const inFour = new HDate(new Date(2026, 9, 5));
    const target = { day: inFour.getDate(), month: inFour.getMonth() };
    expect(daysUntilNext(target, today)).toBe(4);
    expect(daysUntilNext(target, new Date(2026, 9, 5))).toBe(0);
    // Le lendemain, l'anniversaire est passé : il revient l'an prochain.
    expect(daysUntilNext(target, new Date(2026, 9, 6))).toBeGreaterThan(300);
  });

  it("range les noms du lecteur en tête, puis du plus ancien au plus récent", () => {
    const old = prayerName({ id: "old", ownerId: "u2", createdAt: new Date("2026-08-01") });
    const recent = prayerName({ id: "recent", ownerId: "u2", createdAt: new Date("2026-09-20") });
    const mine = prayerName({ id: "mine", ownerId: "me", createdAt: new Date("2026-09-25") });
    expect(sortPrayerNames([recent, mine, old], "me").map((n) => n.id)).toEqual([
      "mine",
      "old",
      "recent",
    ]);
  });
});

describe("le compteur de la chaîne", () => {
  it("au premier tour, rien à compter que les lectures en cours", () => {
    const stats = perpetualStats(chain(), 42);
    expect(stats).toMatchObject({
      cycle: 1,
      completedCycles: 0,
      totalRead: 42,
      averageCycle: null,
      lastCycle: null,
    });
  });

  it("additionne les tours finis, et dit la durée du dernier et la moyenne", () => {
    const stats = perpetualStats(
      chain({
        cycle: 3,
        completedCycles: 2,
        lastCycleStartedAt: new Date("2026-07-05T00:00:00Z"),
        lastCycleEndedAt: new Date("2026-07-09T00:00:00Z"),
        lastCycleParticipants: 41,
      }),
      10,
    );
    expect(stats.totalRead).toBe(2 * 150 + 10);
    expect(stats.lastCycle).toEqual({ unit: "days", value: 4 });
    // Ouverte le 1er juillet, deux tours finis le 9 : quatre jours chacun.
    expect(stats.averageCycle).toEqual({ unit: "days", value: 4 });
    expect(stats.lastCycleParticipants).toBe(41);
  });

  it("dit en heures un tour fini dans la journée", () => {
    expect(spokenDuration(5 * 3600 * 1000)).toEqual({ unit: "hours", value: 5 });
    expect(spokenDuration(10 * 60 * 1000)).toEqual({ unit: "hours", value: 1 });
  });

  it("la chaîne ne se termine jamais, ni ne se clôt", () => {
    const perpetual = chain({ dateLimit: new Date("2020-01-01") });
    expect(sessionService.isSessionFinished(perpetual)).toBe(false);
    expect(sessionService.canEndSession(perpetual)).toBe(false);
  });

  it("se trouve parmi les sessions, sauf masquée", () => {
    const ordinary = chain({ id: "autre", perpetual: undefined });
    expect(findPerpetualSession([ordinary, chain()])?.id).toBe(PERPETUAL_SESSION_ID);
    expect(findPerpetualSession([ordinary, chain({ hidden: true })])).toBeNull();
  });
});

describe("la fin d'un tour (Cloud Function)", () => {
  const read = (id: number, over: Record<string, unknown> = {}) => ({
    id: `r${id}`,
    textStudyId: String(id),
    section: 1,
    isCompleted: true,
    chosenById: `u${id % 3}`,
    ...over,
  });
  const all = Array.from({ length: 150 }, (_, i) => read(i + 1));

  it("finit quand chaque place a une réservation lue", () => {
    expect(isRoundComplete(all, 150)).toBe(true);
  });

  it("ne finit pas tant qu'une place n'est que réservée, ou libre", () => {
    expect(isRoundComplete([...all.slice(1), read(1, { isCompleted: false })], 150)).toBe(false);
    expect(isRoundComplete(all.slice(1), 150)).toBe(false);
    // Deux lectures du même texte ne valent qu'une place.
    expect(isRoundComplete([...all.slice(1), read(2)], 150)).toBe(false);
  });

  it("ne vide jamais une chaîne dont le nombre de places est inconnu", () => {
    expect(isRoundComplete(all, undefined)).toBe(false);
    expect(isRoundComplete(all, 0)).toBe(false);
    expect(isRoundComplete(undefined, 150)).toBe(false);
  });

  it("compte les lecteurs distincts, comptes et invités", () => {
    const guests = [read(1, { chosenById: undefined, chosenByGuestId: "g1" }), read(2)];
    expect(roundParticipants([...all, ...guests])).toBe(4);
  });

  it("vide les réservations et avance d'un tour", () => {
    const startedAt = new Date("2026-09-25T00:00:00Z");
    const now = new Date("2026-09-28T00:00:00Z");
    const next = nextRound(
      { cycle: 34, completedCycles: 33, cycleStartedAt: startedAt, reservations: all },
      now,
    );
    expect(next).toEqual({
      reservations: [],
      cycle: 35,
      completedCycles: 34,
      cycleStartedAt: now,
      lastCycleStartedAt: startedAt,
      lastCycleEndedAt: now,
      lastCycleParticipants: 3,
      updatedAt: now,
    });
  });
});

describe("une place réservée ne tient pas sans fin (Cloud Function)", () => {
  const now = new Date("2026-10-02T10:00:00.000Z");
  const reserved = (id: number, over: Record<string, unknown> = {}) => ({
    id: `r${id}`,
    textStudyId: String(id),
    isCompleted: false,
    createdAt: "2026-10-02T09:59:00.000Z",
    chosenByGuestId: `g${id}`,
    ...over,
  });

  it("donne un jour à une place réservée à la main, et ne touche pas aux autres", () => {
    const draw = reserved(2, { expiresAt: "2026-10-02T11:00:00.000Z" });
    const done = reserved(3, { isCompleted: true });
    const held = withHoldExpiry([reserved(1), draw, done], now);

    expect(held).toEqual([
      { ...reserved(1), expiresAt: "2026-10-03T10:00:00.000Z" },
      // Le tirage garde son heure, que l'app repousse tant qu'on lit.
      draw,
      // Une place lue n'a plus d'échéance à tenir.
      done,
    ]);
    expect(PERPETUAL_HOLD_MS).toBe(24 * 3600 * 1000);
  });

  it("n'écrit rien quand chaque place a déjà son échéance", () => {
    const held = withHoldExpiry([reserved(1), reserved(2)], now);

    // La fonction se déclenche sur sa propre écriture : elle ne doit plus rien
    // y trouver à poser, sans quoi elle tournerait sans fin.
    expect(withHoldExpiry(held, new Date(now.getTime() + 1000))).toBeNull();
    expect(withHoldExpiry([], now)).toBeNull();
    expect(withHoldExpiry(undefined, now)).toBeNull();
    expect(withHoldExpiry([reserved(1, { isCompleted: true })], now)).toBeNull();
  });

  it("pose l'échéance que l'app sait lire : passé le jour, la place est reprise", () => {
    const [held] = withHoldExpiry([reserved(1)], now) as {
      expiresAt: string;
      isCompleted: boolean;
    }[];

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(now.getTime() + PERPETUAL_HOLD_MS - 60_000));
      expect(sessionService.isReservationExpired(held)).toBe(false);
      vi.setSystemTime(new Date(now.getTime() + PERPETUAL_HOLD_MS + 60_000));
      expect(sessionService.isReservationExpired(held)).toBe(true);
      // Lue entre-temps, elle ne tombe plus.
      expect(sessionService.isReservationExpired({ ...held, isCompleted: true })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("la création de la chaîne (scripts/admin.mjs chaine:creer)", () => {
  it("écrit une session de Tehilim que les anciennes versions savent lire", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const doc = perpetualChainSession(textStudiesJson.textStudies, now);
    expect(doc).toMatchObject({
      type: "Tehilim",
      slug: PERPETUAL_SESSION_ID,
      perpetual: true,
      slotCount: 150,
      cycle: 1,
      completedCycles: 0,
      reservations: [],
    });
    // Une date limite lointaine : les anciennes versions ne la ferment jamais.
    expect(doc.dateLimit.getUTCFullYear()).toBe(2100);
  });

  it("refuse un catalogue où un Tehilim aurait plusieurs sections", () => {
    const catalog = [{ type: "Tehilim", totalSections: 2 }];
    expect(() => perpetualChainSession(catalog, new Date())).toThrow(/plusieurs sections/);
  });

  it("décrit un nom de quoi le reconnaître et le retirer", () => {
    const line = describePrayerName("abc", {
      ownerId: "u1",
      gender: "female",
      firstName: "Rivka",
      motherName: "Léa",
      kind: "refoua",
      expiresAt: new Date("2026-10-31T00:00:00Z"),
    });
    expect(line).toBe("abc  Rivka bat Léa  refoua chelema, jusqu'au 2026-10-31  (compte u1)");
  });
});

describe("les textes de la chaîne perpétuelle", () => {
  type Messages = { [key: string]: string | Messages };
  const keys = (messages: Messages, prefix = ""): string[] =>
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
    );

  it("existent dans les trois langues", () => {
    const expected = keys((fr as unknown as Messages).perpetual as Messages).sort();
    expect(keys((en as unknown as Messages).perpetual as Messages).sort()).toEqual(expected);
    expect(keys((he as unknown as Messages).perpetual as Messages).sort()).toEqual(expected);
  });
});
