import { seedPerpetualChain } from "../support/firebase";
import {
  test,
  expect,
  readDoc,
  seedDoc,
  uniqueId,
  account,
  admin,
  unverifiedAdmin,
  create,
  update,
  remove,
  get,
  list,
  query,
  ALLOWED,
  DENIED,
  GUEST,
  type Caller,
  type Fields,
  type WriteOptions,
} from "../support/rules";

/**
 * The Firestore security rules (firestore.rules), block by block: what each
 * one allows and what it refuses, asked of the emulator over REST as a client
 * without the app would (e2e/support/rules.ts). No page: these tests hold the
 * rules, not the interface.
 *
 * The rules of the perpetual chain also have their tests next to its pages,
 * in perpetualChain.spec.ts.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const without = (fields: Fields, ...keys: string[]): Fields =>
  Object.fromEntries(Object.entries(fields).filter(([key]) => !keys.includes(key)));

/** The refusals of a block, each under the name that says what was tried. */
async function expectAll(
  expected: number,
  attempts: Record<string, () => Promise<number>>,
): Promise<void> {
  for (const [what, attempt] of Object.entries(attempts)) {
    expect(await attempt(), what).toBe(expected);
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** A session as the app writes it (sessionService.createSession). */
function sessionFields(personId: string, extra: Fields = {}): Fields {
  const id = uniqueId();
  return {
    name: `Rules session ${id}`,
    description: "Set by the security rules suite.",
    type: "Tehilim",
    dateLimit: new Date(Date.now() + 7 * DAY),
    createdAt: new Date(),
    personId,
    creatorName: "Someone",
    slug: `rules-session-${id}`,
    guestEmailRequired: false,
    reservations: [],
    ...extra,
  };
}

const newSessionPath = (): string => `sessions/rules-session-${uniqueId()}`;

/** A session already there, set past the rules; returns its path. */
async function seedSession(personId: string, extra: Fields = {}): Promise<string> {
  const id = `rules-session-${uniqueId()}`;
  await seedDoc("sessions", id, sessionFields(personId, extra));
  return `sessions/${id}`;
}

/** `count` bookings, as a guest named `name` makes them. */
const bookings = (count: number, name = "Guest"): Fields[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r-${i}`,
    textStudyId: String(103 + i),
    section: 1,
    chosenByName: name,
    chosenByGuestId: `device-of-${name}`,
    isCompleted: false,
  }));

/** `count` bookings reduced to an id, for the tests on the size of the list. */
const slots = (count: number): Fields[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r-${i}` }));

const docId = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

test.describe("rules: sessions", () => {
  test("sessions are public to read", async () => {
    const path = await seedSession(account());
    expect(await get(GUEST, path)).toBe(ALLOWED);
    expect(await list(GUEST, "sessions")).toBe(ALLOWED);
  });

  test("an account creates a session for itself, and only for itself", async () => {
    const uid = account();
    expect(await create(uid, newSessionPath(), sessionFields(uid))).toBe(ALLOWED);
    await expectAll(DENIED, {
      "in the name of another account": () =>
        create(uid, newSessionPath(), sessionFields(account("other"))),
      "without an account": () => create(GUEST, newSessionPath(), sessionFields(uid)),
      "without an account and without an owner": () =>
        create(GUEST, newSessionPath(), without(sessionFields(uid), "personId")),
    });
  });

  test("a creation carries no moderation field and no perpetual field", async () => {
    const uid = account();
    const forbidden: Fields = {
      // Even set to their harmless value: the function and the admin own them.
      hidden: false,
      hiddenAt: new Date(),
      hiddenReason: "",
      reportsCount: 0,
      perpetual: true,
      slotCount: 150,
      cycle: 1,
      completedCycles: 0,
      cycleStartedAt: new Date(),
      lastCycleStartedAt: new Date(),
      lastCycleEndedAt: new Date(),
      lastCycleParticipants: 12,
    };
    for (const [field, value] of Object.entries(forbidden)) {
      expect(
        await create(uid, newSessionPath(), sessionFields(uid, { [field]: value })),
        field,
      ).toBe(DENIED);
    }
  });

  test("a creation keeps its fields within their types and sizes", async () => {
    const uid = account();
    const attempt = (extra: Fields) => () =>
      create(uid, newSessionPath(), sessionFields(uid, extra));
    await expectAll(ALLOWED, {
      "a name of 300 characters": attempt({ name: "n".repeat(300) }),
      "a description of 5000 characters": attempt({ description: "d".repeat(5000) }),
      "a start day": attempt({ startDay: "2026-11-20", startsWhenFull: false }),
    });
    await expectAll(DENIED, {
      "a name of 301 characters": attempt({ name: "n".repeat(301) }),
      "an empty name": attempt({ name: "" }),
      "a name that is not a string": attempt({ name: 12 }),
      "no name": () => create(uid, newSessionPath(), without(sessionFields(uid), "name")),
      "a description of 5001 characters": attempt({ description: "d".repeat(5001) }),
      "no description": () =>
        create(uid, newSessionPath(), without(sessionFields(uid), "description")),
      "an empty slug": attempt({ slug: "" }),
      "a slug of 201 characters": attempt({ slug: "s".repeat(201) }),
      "a creator name of 101 characters": attempt({ creatorName: "c".repeat(101) }),
      "reservations that are not a list": attempt({ reservations: "none" }),
      "a start day without its zeros": attempt({ startDay: "2026-1-5" }),
      "a start day with a time": attempt({ startDay: "2026-11-20T10:00:00Z" }),
      "a start day that is a date": attempt({ startDay: new Date() }),
      "a start flag that is not a boolean": attempt({ startsWhenFull: "yes" }),
    });
  });

  test("a creation is dated by the server or by the device clock, never backdated", async () => {
    const uid = account();
    const dated = (createdAt: unknown) => () =>
      create(uid, newSessionPath(), sessionFields(uid, { createdAt }));
    await expectAll(ALLOWED, {
      // What the app writes now: serverTimestamp().
      "the time of the server": () =>
        create(uid, newSessionPath(), without(sessionFields(uid), "createdAt"), {
          serverTime: ["createdAt"],
        }),
      // What released apps write: the clock of the device.
      "the device clock, now": dated(new Date()),
      "a device clock half an hour late": dated(new Date(Date.now() - HOUR / 2)),
      // A clock running ahead gains nothing: the slug goes to the oldest.
      "a device clock a day ahead": dated(new Date(Date.now() + DAY)),
    });
    await expectAll(DENIED, {
      "no date": () => create(uid, newSessionPath(), without(sessionFields(uid), "createdAt")),
      "a null date": dated(null),
      "a date written as a string": dated(new Date().toISOString()),
      "a date written in milliseconds": dated(Date.now()),
      "a date two hours back": dated(new Date(Date.now() - 2 * HOUR)),
      // The attack the rule was written for: older than any session shared.
      "a date in the year 2000": dated(new Date("2000-01-01T00:00:00Z")),
    });
  });

  test("the owner's update leaves the creation date as it was stored", async () => {
    const uid = account();
    const path = await seedSession(uid);
    await expectAll(DENIED, {
      "backdated after the fact": () =>
        update(uid, path, { createdAt: new Date("2000-01-01T00:00:00Z") }, ["createdAt"]),
      "moved to now": () => update(uid, path, { createdAt: new Date() }, ["createdAt"]),
      "moved to the time of the server": () =>
        update(uid, path, {}, [], { serverTime: ["createdAt"] }),
      removed: () => update(uid, path, {}, ["createdAt"]),
      "moved along with a legitimate change": () =>
        update(uid, path, { name: "Renamed", createdAt: new Date(0) }, ["name", "createdAt"]),
    });
    expect(await update(uid, path, { name: "Renamed" }, ["name"])).toBe(ALLOWED);

    // Legacy data: a date that is not a timestamp, or no date at all. The
    // owner still edits the session, and still cannot give it an older date.
    const asString = await seedSession(uid, { createdAt: "2024-03-01T10:00:00.000Z" });
    expect(await update(uid, asString, { name: "Renamed" }, ["name"])).toBe(ALLOWED);
    expect(
      await update(uid, asString, { createdAt: new Date("2000-01-01T00:00:00Z") }, ["createdAt"]),
    ).toBe(DENIED);
    const undated = `sessions/rules-session-${uniqueId()}`;
    await seedDoc("sessions", docId(undated), without(sessionFields(uid), "createdAt"));
    expect(await update(uid, undated, { name: "Renamed" }, ["name"])).toBe(ALLOWED);
    expect(
      await update(uid, undated, { createdAt: new Date("2000-01-01T00:00:00Z") }, ["createdAt"]),
    ).toBe(DENIED);
  });

  // The slug goes to the oldest session that carries it: without this rule,
  // an account whose session is older than the victim's gave it the victim's
  // slug and took its links, with no backdating at all. The app itself never
  // changes a slug once set (sessionService.updateSession).
  test("a slug is set once: an older session does not take the slug of a newer one", async () => {
    const attacker = account("attacker");
    const ownSlug = `old-chain-${uniqueId()}`;
    const old = await seedSession(attacker, {
      slug: ownSlug,
      createdAt: new Date(Date.now() - 300 * DAY),
    });
    const victimSlug = `shared-chain-${uniqueId()}`;
    await seedSession(account("victim"), {
      slug: victimSlug,
      createdAt: new Date(Date.now() - 30 * DAY),
    });
    await expectAll(DENIED, {
      "the slug of another session": () => update(attacker, old, { slug: victimSlug }, ["slug"]),
      "a new slug, even a free one": () =>
        update(attacker, old, { slug: `free-${uniqueId()}` }, ["slug"]),
      "no slug at all": () => update(attacker, old, {}, ["slug"]),
    });
    // The app sends the slug back with every edit: the same value passes.
    expect(await update(attacker, old, { name: "Renamed", slug: ownSlug }, ["name", "slug"])).toBe(
      ALLOWED,
    );
  });

  test("a legacy session without a slug may still receive one", async () => {
    const uid = account();
    const path = `sessions/legacy-${uniqueId()}`;
    await seedDoc("sessions", docId(path), {
      name: "Legacy chain",
      description: "",
      personId: uid,
      createdAt: new Date(Date.now() - 400 * DAY),
    });
    expect(await update(uid, path, { slug: `legacy-${uniqueId()}` }, ["slug"])).toBe(ALLOWED);
  });

  test("the owner edits the session, not its moderation, its chain fields or its owner", async () => {
    const uid = account();
    const path = await seedSession(uid);
    await expectAll(ALLOWED, {
      "a new name": () => update(uid, path, { name: "Renamed" }, ["name"]),
      "a new description": () => update(uid, path, { description: "Rewritten" }, ["description"]),
    });
    await expectAll(DENIED, {
      "hiding it": () => update(uid, path, { hidden: true }, ["hidden"]),
      "counting its reports": () => update(uid, path, { reportsCount: 0 }, ["reportsCount"]),
      "making it the perpetual chain": () => update(uid, path, { perpetual: true }, ["perpetual"]),
      "counting its rounds": () => update(uid, path, { completedCycles: 40 }, ["completedCycles"]),
      "giving it to another account": () =>
        update(uid, path, { personId: account("other") }, ["personId"]),
      "dropping its owner": () => update(uid, path, {}, ["personId"]),
      "a name of 301 characters": () => update(uid, path, { name: "n".repeat(301) }, ["name"]),
      "dropping its description": () => update(uid, path, {}, ["description"]),
    });

    // A session hidden by moderation: its owner does not bring it back.
    const hidden = await seedSession(uid, {
      hidden: true,
      hiddenAt: new Date(),
      hiddenReason: "reports",
      reportsCount: 3,
    });
    await expectAll(DENIED, {
      "unhiding it": () => update(uid, hidden, { hidden: false }, ["hidden"]),
      "dropping the flag": () => update(uid, hidden, {}, ["hidden"]),
      "resetting the count": () => update(uid, hidden, { reportsCount: 0 }, ["reportsCount"]),
      "dropping the reason": () => update(uid, hidden, {}, ["hiddenAt", "hiddenReason"]),
    });
    expect((await readDoc("sessions", docId(hidden)))?.hidden).toBe(true);
  });

  test("another account does not edit a session that is not its own", async () => {
    const path = await seedSession(account("owner"));
    const other = account("other");
    for (const caller of [other, GUEST]) {
      await expectAll(DENIED, {
        "its name": () => update(caller, path, { name: "Defaced" }, ["name"]),
        "its description": () => update(caller, path, { description: "Defaced" }, ["description"]),
        "its deadline": () => update(caller, path, { dateLimit: new Date(0) }, ["dateLimit"]),
        "its owner": () => update(caller, path, { personId: other }, ["personId"]),
        "its slug": () => update(caller, path, { slug: "taken" }, ["slug"]),
      });
    }
  });

  test("a guest books, marks read and cancels, on the reservations alone", async () => {
    const path = await seedSession(account("owner"));
    const book = (reservations: unknown, mask = ["reservations"], extra: Fields = {}) =>
      update(GUEST, path, { reservations, ...extra }, mask);

    expect(await book(bookings(3)), "booking").toBe(ALLOWED);
    const read = bookings(3).map((r, i) => (i === 0 ? { ...r, isCompleted: true } : r));
    expect(await book(read), "marking read, at constant size").toBe(ALLOWED);
    expect(await book(read.slice(0, 2)), "cancelling one").toBe(ALLOWED);

    await expectAll(DENIED, {
      "cancelling two at once": () => book([]),
      "a booking that renames the session": () =>
        book(bookings(3), ["reservations", "name"], { name: "Defaced" }),
      "a booking that adds a field": () =>
        book(bookings(3), ["reservations", "junk"], { junk: "x".repeat(1000) }),
      "a booking that hides the session": () =>
        book(bookings(3), ["reservations", "hidden"], { hidden: true }),
      "a booking that takes the session": () =>
        book(bookings(3), ["reservations", "personId"], { personId: account("attacker") }),
      "reservations that are not a list": () => book("none"),
      "reservations that are a map": () => book({ 0: bookings(1)[0] }),
      "dropping the reservations": () => update(GUEST, path, {}, ["reservations"]),
    });
    expect((await readDoc("sessions", docId(path)))?.reservations).toHaveLength(2);
  });

  // KNOWN LIMIT, not a guarantee. The reservations live in an array on the
  // session: the rules see its size, not who owns each entry. A guest can
  // therefore rewrite someone else's booking at constant size (or swap every
  // entry while cancelling one). It is documented in firestore.rules
  // (isRemoveOneReservationOnly) and goes away with the move to a
  // subcollection. This test states today's behaviour so that the day the
  // model changes, it is updated on purpose.
  test("known limit: a guest rewrites a booking that is not theirs", async () => {
    const path = await seedSession(account("owner"), { reservations: bookings(2, "Rivka") });
    const stolen = bookings(2, "Rivka").map((r, i) =>
      i === 0 ? { ...r, chosenByName: "Someone else", chosenByGuestId: "another-device" } : r,
    );
    expect(await update(GUEST, path, { reservations: stolen }, ["reservations"])).toBe(ALLOWED);
    const after = (await readDoc("sessions", docId(path)))?.reservations as Fields[];
    expect(after[0].chosenByName).toBe("Someone else");
  });

  test("a hidden session takes no booking, no change and no cancellation", async () => {
    const path = await seedSession(account("owner"), {
      hidden: true,
      reservations: bookings(2),
    });
    for (const caller of [GUEST, account("other")]) {
      await expectAll(DENIED, {
        booking: () => update(caller, path, { reservations: bookings(3) }, ["reservations"]),
        "marking read": () =>
          update(
            caller,
            path,
            { reservations: bookings(2).map((r) => ({ ...r, isCompleted: true })) },
            ["reservations"],
          ),
        cancelling: () => update(caller, path, { reservations: bookings(1) }, ["reservations"]),
      });
    }
  });

  test("a booking adds 100 entries at most, up to 5000 in all", async () => {
    const empty = await seedSession(account("owner"));
    const book = (path: string, count: number) =>
      update(GUEST, path, { reservations: slots(count) }, ["reservations"]);
    expect(await book(empty, 101), "101 at once").toBe(DENIED);
    expect(await book(empty, 100), "100 at once").toBe(ALLOWED);

    const nearlyFull = await seedSession(account("owner"), { reservations: slots(4950) });
    expect(await book(nearlyFull, 5001), "the 5001st").toBe(DENIED);
    expect(await book(nearlyFull, 5000), "the 5000th").toBe(ALLOWED);
    expect(await book(nearlyFull, 5001), "one more on a full session").toBe(DENIED);
  });

  test("only its owner or the admin deletes a session", async () => {
    const owner = account("owner");
    const path = await seedSession(owner);
    await expectAll(DENIED, {
      "a guest": () => remove(GUEST, path),
      "another account": () => remove(account("other"), path),
      "the admin's address, not verified": () => remove(unverifiedAdmin(), path),
    });
    expect(await remove(owner, path), "its owner").toBe(ALLOWED);
    expect(await remove(admin(), await seedSession(owner)), "the admin").toBe(ALLOWED);
  });
});

// ---------------------------------------------------------------------------
// Names of the perpetual chain
// ---------------------------------------------------------------------------

/** A name as the app writes it, minus the two dates the server sets. */
const nameFields = (ownerId: string, extra: Fields = {}): Fields => ({
  ownerId,
  gender: "male",
  firstName: "David",
  motherName: "Sarah",
  kind: "refoua",
  expiresAt: new Date(Date.now() + 30 * DAY),
  ...extra,
});

const SERVER_DATED = { serverTime: ["createdAt", "updatedAt"] };

const newNamePath = (chainId: string): string =>
  `sessions/${chainId}/names/rules-name-${uniqueId()}`;

/** A name already on the chain, set past the rules; returns its path. */
async function seedName(chainId: string, ownerId: string): Promise<string> {
  const id = `rules-name-${uniqueId()}`;
  await seedDoc(`sessions/${chainId}/names`, id, {
    ...nameFields(ownerId),
    createdAt: new Date(Date.now() - DAY),
    updatedAt: new Date(Date.now() - DAY),
  });
  return `sessions/${chainId}/names/${id}`;
}

test.describe("rules: names of the perpetual chain", () => {
  test("names are public to read", async () => {
    const chain = await seedPerpetualChain();
    const path = await seedName(chain.id, account());
    expect(await get(GUEST, path)).toBe(ALLOWED);
    expect(await list(GUEST, `sessions/${chain.id}/names`)).toBe(ALLOWED);
  });

  test("an account adds a name of its own, on the perpetual chain only", async () => {
    const chain = await seedPerpetualChain();
    const ordinary = docId(await seedSession(account("owner")));
    const uid = account();
    expect(await create(uid, newNamePath(chain.id), nameFields(uid), SERVER_DATED)).toBe(ALLOWED);
    await expectAll(DENIED, {
      "without an account": () =>
        create(GUEST, newNamePath(chain.id), nameFields(uid), SERVER_DATED),
      "in the name of another account": () =>
        create(uid, newNamePath(chain.id), nameFields(account("other")), SERVER_DATED),
      "on an ordinary session": () =>
        create(uid, newNamePath(ordinary), nameFields(uid), SERVER_DATED),
      "on a session that does not exist": () =>
        create(uid, newNamePath(`missing-${uniqueId()}`), nameFields(uid), SERVER_DATED),
    });
  });

  test("a name is dated by the server, at its creation and at each change", async () => {
    const chain = await seedPerpetualChain();
    const uid = account();
    await expectAll(DENIED, {
      "a creation date from the device": () =>
        create(uid, newNamePath(chain.id), nameFields(uid, { createdAt: new Date() }), {
          serverTime: ["updatedAt"],
        }),
      "a creation date in the past": () =>
        create(
          uid,
          newNamePath(chain.id),
          nameFields(uid, { createdAt: new Date(Date.now() - 365 * DAY) }),
          { serverTime: ["updatedAt"] },
        ),
      "an update date from the device": () =>
        create(uid, newNamePath(chain.id), nameFields(uid, { updatedAt: new Date() }), {
          serverTime: ["createdAt"],
        }),
      "no date": () => create(uid, newNamePath(chain.id), nameFields(uid)),
    });
  });

  test("a name carries its own fields only, within their bounds", async () => {
    const chain = await seedPerpetualChain();
    const uid = account();
    const attempt = (extra: Fields) => () =>
      create(uid, newNamePath(chain.id), nameFields(uid, extra), SERVER_DATED);
    const leilouy = { kind: "leilouy", expiresAt: null, deathDay: 12, deathMonth: 1 };
    await expectAll(ALLOWED, {
      "31 days, less a minute": attempt({ expiresAt: new Date(Date.now() + 31 * DAY - 60_000) }),
      "a dated leilouy nichmat, without expiry": attempt(leilouy),
    });
    await expectAll(DENIED, {
      "a field of its own": attempt({ note: "x".repeat(1000) }),
      "an unknown gender": attempt({ gender: "other" }),
      "an unknown kind": attempt({ kind: "blessing" }),
      "an empty first name": attempt({ firstName: "" }),
      "a first name of 41 characters": attempt({ firstName: "f".repeat(41) }),
      "a mother's name of 41 characters": attempt({ motherName: "m".repeat(41) }),
      "an expiry in 32 days": attempt({ expiresAt: new Date(Date.now() + 32 * DAY) }),
      "no expiry and no date of death": attempt({ expiresAt: null }),
      "a date of death on a refoua chelema": attempt({ ...leilouy, kind: "refoua" }),
      "a 31st day of the month": attempt({ ...leilouy, deathDay: 31 }),
      "a 14th month": attempt({ ...leilouy, deathMonth: 14 }),
      "a dated leilouy that also expires": attempt({
        ...leilouy,
        expiresAt: new Date(Date.now() + DAY),
      }),
    });
  });

  test("only its owner changes a name, without moving its owner or its creation date", async () => {
    const chain = await seedPerpetualChain();
    const uid = account();
    const path = await seedName(chain.id, uid);
    const later = { expiresAt: new Date(Date.now() + 31 * DAY - 60_000) };
    const touched = { serverTime: ["updatedAt"] };
    await expectAll(DENIED, {
      "another account": () => update(account("other"), path, later, ["expiresAt"], touched),
      "a guest": () => update(GUEST, path, later, ["expiresAt"], touched),
      // The admin removes a reported name; it does not rewrite it.
      "the admin": () => update(admin(), path, later, ["expiresAt"], touched),
      "its owner, giving it away": () =>
        update(uid, path, { ownerId: account("other") }, ["ownerId"], touched),
      "its owner, moving its creation date": () =>
        update(uid, path, { createdAt: new Date() }, ["createdAt"], touched),
      "its owner, without the time of the server": () => update(uid, path, later, ["expiresAt"]),
      "its owner, past 31 days": () =>
        update(uid, path, { expiresAt: new Date(Date.now() + 60 * DAY) }, ["expiresAt"], touched),
    });
    expect(await update(uid, path, later, ["expiresAt"], touched), "its owner").toBe(ALLOWED);
  });

  test("only its owner or the admin removes a name", async () => {
    const chain = await seedPerpetualChain();
    const uid = account();
    const path = await seedName(chain.id, uid);
    await expectAll(DENIED, {
      "a guest": () => remove(GUEST, path),
      "another account": () => remove(account("other"), path),
      "the admin's address, not verified": () => remove(unverifiedAdmin(), path),
    });
    expect(await remove(uid, path), "its owner").toBe(ALLOWED);
    expect(await remove(admin(), await seedName(chain.id, uid)), "the admin").toBe(ALLOWED);
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** A report as a guest sends it (reportService). */
const reportFields = (sessionId: string, extra: Fields = {}): Fields => ({
  sessionId,
  sessionName: "Reported session",
  reason: "spam",
  details: "",
  reporterId: null,
  reporterGuestId: `device-${uniqueId()}`,
  status: "open",
  createdAt: new Date(),
  ...extra,
});

const newReportPath = (): string => `reports/rules-report-${uniqueId()}`;

async function seedReport(sessionId: string, extra: Fields = {}): Promise<string> {
  const id = `rules-report-${uniqueId()}`;
  await seedDoc("reports", id, reportFields(sessionId, extra));
  return `reports/${id}`;
}

test.describe("rules: reports", () => {
  test("anyone reports an existing session, guest or account", async () => {
    const sessionId = docId(await seedSession(account("owner")));
    expect(await create(GUEST, newReportPath(), reportFields(sessionId)), "a guest").toBe(ALLOWED);
    const uid = account();
    expect(
      await create(
        uid,
        newReportPath(),
        reportFields(sessionId, { reporterId: uid, reporterGuestId: null }),
      ),
      "an account",
    ).toBe(ALLOWED);
  });

  test("a report out of shape is refused", async () => {
    const sessionId = docId(await seedSession(account("owner")));
    const attempt = (extra: Fields) => () =>
      create(GUEST, newReportPath(), reportFields(sessionId, extra));
    await expectAll(DENIED, {
      "a field of its own": attempt({ note: "x".repeat(1000) }),
      "an unknown reason": attempt({ reason: "revenge" }),
      "a status already handled": attempt({ status: "resolved" }),
      "details of 1001 characters": attempt({ details: "d".repeat(1001) }),
      "details that are not a string": attempt({ details: ["a", "b"] }),
      "a session name of 301 characters": attempt({ sessionName: "n".repeat(301) }),
      "a session that does not exist": () =>
        create(GUEST, newReportPath(), reportFields(`missing-${uniqueId()}`)),
      "an empty session": () => create(GUEST, newReportPath(), reportFields("")),
      "no reason": () => create(GUEST, newReportPath(), without(reportFields(sessionId), "reason")),
      "no status": () => create(GUEST, newReportPath(), without(reportFields(sessionId), "status")),
    });
  });

  // The block promises a report "strictly bounded", open to guests: without
  // a check on its type, `createdAt` took close to 1 MiB per report, a string
  // or a map. The app writes a timestamp (moderationService.reportSession).
  test("a report is dated with a timestamp, not with a payload", async () => {
    const sessionId = docId(await seedSession(account("owner")));
    const attempt = (createdAt: unknown) => () =>
      create(GUEST, newReportPath(), reportFields(sessionId, { createdAt }));
    await expectAll(DENIED, {
      "a string of 500 000 characters": attempt("x".repeat(500_000)),
      "a map of 900 000 characters": attempt({ blob: "x".repeat(900_000) }),
      "a list": attempt(["x".repeat(1000)]),
    });
    expect(await attempt(new Date())()).toBe(ALLOWED);
  });

  test("the reporter of a report is the one who sends it", async () => {
    const sessionId = docId(await seedSession(account("owner")));
    const uid = account();
    const signed = { reporterId: uid, reporterGuestId: null };
    await expectAll(DENIED, {
      "an account, in the name of another": () =>
        create(uid, newReportPath(), reportFields(sessionId, { ...signed, reporterId: "other" })),
      "an account, as a guest": () => create(uid, newReportPath(), reportFields(sessionId)),
      "an account, with a device identifier too": () =>
        create(
          uid,
          newReportPath(),
          reportFields(sessionId, { ...signed, reporterGuestId: "device" }),
        ),
      "a guest, in the name of an account": () =>
        create(GUEST, newReportPath(), reportFields(sessionId, signed)),
      "a guest, with no device identifier": () =>
        create(GUEST, newReportPath(), reportFields(sessionId, { reporterGuestId: "" })),
      "a guest, with a device identifier of 101 characters": () =>
        create(
          GUEST,
          newReportPath(),
          reportFields(sessionId, { reporterGuestId: "g".repeat(101) }),
        ),
    });
  });

  test("only the admin reads and handles reports", async () => {
    const sessionId = docId(await seedSession(account("owner")));
    const reporter = account("reporter");
    const path = await seedReport(sessionId, { reporterId: reporter, reporterGuestId: null });
    for (const caller of [GUEST, reporter, unverifiedAdmin()]) {
      await expectAll(DENIED, {
        reading: () => get(caller, path),
        listing: () => list(caller, "reports"),
        "listing those of a session": () =>
          query(caller, "reports", { where: { field: "sessionId", value: sessionId } }),
        handling: () => update(caller, path, { status: "resolved" }, ["status"]),
        deleting: () => remove(caller, path),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      reading: () => get(boss, path),
      listing: () => list(boss, "reports"),
      handling: () => update(boss, path, { status: "resolved" }, ["status"]),
      deleting: () => remove(boss, path),
    });
  });
});

// ---------------------------------------------------------------------------
// Support threads
// ---------------------------------------------------------------------------

test.describe("rules: support", () => {
  const thread = (uid: string): Fields => ({
    uid,
    message: "A message to the team.",
    status: "open",
    teamNote: "Seen with the owner.",
    createdAt: new Date(),
  });

  test("nobody writes a thread directly: it goes through the Cloud Functions", async () => {
    const uid = account();
    for (const caller of [GUEST, uid, admin()]) {
      expect(await create(caller, `support/rules-thread-${uniqueId()}`, thread(uid))).toBe(DENIED);
    }
  });

  test("only the admin reads, answers and deletes a thread, not even its author", async () => {
    const author = account("author");
    const id = `rules-thread-${uniqueId()}`;
    await seedDoc("support", id, thread(author));
    const path = `support/${id}`;
    for (const caller of [GUEST, author, unverifiedAdmin()]) {
      await expectAll(DENIED, {
        reading: () => get(caller, path),
        listing: () => list(caller, "support"),
        "listing one's own": () =>
          query(caller, "support", { where: { field: "uid", value: author } }),
        answering: () => update(caller, path, { status: "answered" }, ["status"]),
        deleting: () => remove(caller, path),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      reading: () => get(boss, path),
      listing: () => list(boss, "support"),
      answering: () => update(boss, path, { status: "answered" }, ["status"]),
      deleting: () => remove(boss, path),
    });
  });
});

// ---------------------------------------------------------------------------
// Chiourim, authors, series
// ---------------------------------------------------------------------------

function chiourFields(extra: Fields = {}): Fields {
  const id = uniqueId();
  return {
    slug: `rules-chiour-${id}`,
    name: `Rules chiour ${id}`,
    description: "Set by the security rules suite.",
    auteur: "Rav Test",
    categories: ["Emouna"],
    duration: 1800,
    audioPath: `chiourim/demo/${id}.mp3`,
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

async function seedChiour(extra: Fields = {}): Promise<string> {
  const fields = chiourFields(extra);
  await seedDoc("chiourim", fields.slug as string, fields);
  return `chiourim/${fields.slug}`;
}

test.describe("rules: chiourim", () => {
  test("the catalogue is public to read, and only the admin writes it", async () => {
    const path = await seedChiour();
    expect(await get(GUEST, path)).toBe(ALLOWED);
    expect(await list(GUEST, "chiourim")).toBe(ALLOWED);

    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      await expectAll(DENIED, {
        creating: () => create(caller, `chiourim/rules-chiour-${uniqueId()}`, chiourFields()),
        renaming: () => update(caller, path, { name: "Defaced" }, ["name"]),
        "pointing its audio elsewhere": () =>
          update(caller, path, { mediaUrl: "https://example.com/other.mp3" }, ["mediaUrl"]),
        unpublishing: () => update(caller, path, { published: false }, ["published"]),
        deleting: () => remove(caller, path),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      creating: () => create(boss, `chiourim/rules-chiour-${uniqueId()}`, chiourFields()),
      renaming: () => update(boss, path, { name: "Renamed" }, ["name"]),
      deleting: () => remove(boss, path),
    });
  });

  test("a visitor counts one view at a time, on a published chiour, and nothing else", async () => {
    const path = await seedChiour({ views: 7 });
    const view = (views: unknown, mask = ["views"], extra: Fields = {}) =>
      update(GUEST, path, { views, ...extra }, mask);
    await expectAll(DENIED, {
      "two views at once": () => view(9),
      "a thousand views at once": () => view(1007),
      "a view taken back": () => view(6),
      "the count reset": () => view(0),
      "the same count": () => view(7),
      "a count that is not an integer": () => view("8"),
      "a fractional count": () => view(8.5),
      "the count removed": () => update(GUEST, path, {}, ["views"]),
      "a view that renames the chiour": () => view(8, ["views", "name"], { name: "Defaced" }),
      "a view that adds a field": () => view(8, ["views", "junk"], { junk: "x" }),
    });
    expect(await view(8), "one view").toBe(ALLOWED);
    expect(await view(9), "one more").toBe(ALLOWED);
    expect((await readDoc("chiourim", docId(path)))?.views).toBe(9);

    // The very first view adds the field: it starts at 1, nowhere else.
    const fresh = await seedChiour();
    expect(await update(GUEST, fresh, { views: 5 }, ["views"]), "a first view of 5").toBe(DENIED);
    expect(await update(GUEST, fresh, { views: 1 }, ["views"]), "a first view").toBe(ALLOWED);

    const draft = await seedChiour({ published: false, views: 0 });
    expect(await update(GUEST, draft, { views: 1 }, ["views"]), "a view on a draft").toBe(DENIED);
  });
});

for (const collection of ["auteurs", "series"]) {
  test.describe(`rules: ${collection}`, () => {
    test("public to read, written by the admin only", async () => {
      const id = `rules-${collection}-${uniqueId()}`;
      await seedDoc(collection, id, { name: "Rav Test", slug: id });
      const path = `${collection}/${id}`;
      expect(await get(GUEST, path)).toBe(ALLOWED);
      expect(await list(GUEST, collection)).toBe(ALLOWED);

      for (const caller of [GUEST, account(), unverifiedAdmin()]) {
        await expectAll(DENIED, {
          creating: () => create(caller, `${collection}/rules-${uniqueId()}`, { name: "Forged" }),
          renaming: () => update(caller, path, { name: "Defaced" }, ["name"]),
          deleting: () => remove(caller, path),
        });
      }
      const boss = admin();
      await expectAll(ALLOWED, {
        creating: () => create(boss, `${collection}/rules-${uniqueId()}`, { name: "New" }),
        renaming: () => update(boss, path, { name: "Renamed" }, ["name"]),
        deleting: () => remove(boss, path),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Studio tokens
// ---------------------------------------------------------------------------

test.describe("rules: studioTokens", () => {
  const tokenFields = (extra: Fields = {}): Fields => ({
    auteurId: "rav-test",
    auteurName: "Rav Test",
    active: true,
    createdAt: new Date(),
    ...extra,
  });

  test("a token is read by whoever knows it, and never listed", async () => {
    const token = `rules-token-${uniqueId()}`;
    await seedDoc("studioTokens", token, tokenFields());
    // The document id is the secret: knowing it is being the author.
    expect(await get(GUEST, `studioTokens/${token}`)).toBe(ALLOWED);
    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      await expectAll(DENIED, {
        listing: () => list(caller, "studioTokens"),
        "listing the active ones": () =>
          query(caller, "studioTokens", { where: { field: "active", value: true } }),
        "listing those of an author": () =>
          query(caller, "studioTokens", { where: { field: "auteurId", value: "rav-test" } }),
      });
    }
    expect(await list(admin(), "studioTokens")).toBe(ALLOWED);
  });

  test("only the admin issues, revokes or revives a token", async () => {
    const revoked = `rules-token-${uniqueId()}`;
    await seedDoc("studioTokens", revoked, tokenFields({ active: false }));
    const path = `studioTokens/${revoked}`;
    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      await expectAll(DENIED, {
        "issuing one": () => create(caller, `studioTokens/forged-${uniqueId()}`, tokenFields()),
        "reviving a revoked one": () => update(caller, path, { active: true }, ["active"]),
        "moving it to another author": () =>
          update(caller, path, { auteurId: "another-rav" }, ["auteurId"]),
        "deleting it": () => remove(caller, path),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      "issuing one": () => create(boss, `studioTokens/rules-token-${uniqueId()}`, tokenFields()),
      "reviving a revoked one": () => update(boss, path, { active: true }, ["active"]),
      "deleting it": () => remove(boss, path),
    });
  });
});

// ---------------------------------------------------------------------------
// Announcements and poll votes
// ---------------------------------------------------------------------------

/** A poll as it is stored (pollToStore in src/services/announcements.ts). */
const poll = (extra: Fields = {}): Fields => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  return {
    options: ids.map((id) => ({ id, label: { fr: `Choix ${id}` }, image: null })),
    optionIds: ids,
    multiple: false,
    closed: false,
    ...extra,
  };
};

const announcementFields = (extra: Fields = {}): Fields => ({
  kind: "news",
  title: { fr: "Une information" },
  body: { fr: "Son texte." },
  published: true,
  publishedAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

async function seedAnnouncement(extra: Fields = {}): Promise<string> {
  const id = `rules-announcement-${uniqueId()}`;
  await seedDoc("announcements", id, announcementFields(extra));
  return id;
}

test.describe("rules: announcements", () => {
  test("a published announcement is public, a draft is read by the admin only", async () => {
    const published = await seedAnnouncement();
    const draft = await seedAnnouncement({ published: false, publishedAt: null });
    expect(await get(GUEST, `announcements/${published}`)).toBe(ALLOWED);
    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      expect(await get(caller, `announcements/${draft}`), "a draft").toBe(DENIED);
    }
    expect(await get(admin(), `announcements/${draft}`), "a draft, by the admin").toBe(ALLOWED);
  });

  test("a public list has to ask for the published ones", async () => {
    await seedAnnouncement();
    await seedAnnouncement({ published: false, publishedAt: null });
    const published = { where: { field: "published", value: true } };
    const drafts = { where: { field: "published", value: false } };
    for (const caller of [GUEST, account()]) {
      expect(await query(caller, "announcements", published), "the published ones").toBe(ALLOWED);
      expect(await list(caller, "announcements"), "everything").toBe(DENIED);
      expect(await query(caller, "announcements", drafts), "the drafts").toBe(DENIED);
    }
    const boss = admin();
    expect(await list(boss, "announcements"), "everything, by the admin").toBe(ALLOWED);
    expect(await query(boss, "announcements", drafts), "the drafts, by the admin").toBe(ALLOWED);
  });

  test("only the admin writes an announcement", async () => {
    const draft = await seedAnnouncement({ published: false, publishedAt: null });
    const path = `announcements/${draft}`;
    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      await expectAll(DENIED, {
        "publishing one's own": () =>
          create(caller, `announcements/forged-${uniqueId()}`, announcementFields()),
        "publishing a draft": () => update(caller, path, { published: true }, ["published"]),
        "rewriting it": () => update(caller, path, { title: { fr: "Faux" } }, ["title"]),
        "deleting it": () => remove(caller, path),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      "writing one": () =>
        create(boss, `announcements/rules-announcement-${uniqueId()}`, announcementFields()),
      "publishing a draft": () => update(boss, path, { published: true }, ["published"]),
      "deleting it": () => remove(boss, path),
    });
  });
});

test.describe("rules: poll votes", () => {
  const VOTED = { serverTime: ["votedAt"] };
  const voter = (): string => `device-${uniqueId()}`;
  const votePath = (announcementId: string, voterId = voter()): string =>
    `announcements/${announcementId}/votes/${voterId}`;
  const vote = (
    path: string,
    choices: unknown,
    extra: Fields = {},
    options: WriteOptions = VOTED,
  ) => create(GUEST, path, { choices, ...extra }, options);

  test("a device votes once on an open poll, among its choices, and may change its mind", async () => {
    const id = await seedAnnouncement({ kind: "question", poll: poll() });
    const mine = votePath(id);
    expect(await vote(mine, ["a"]), "a vote").toBe(ALLOWED);
    expect(
      await update(GUEST, mine, { choices: ["b"] }, ["choices"], VOTED),
      "the same device, changing its mind",
    ).toBe(ALLOWED);

    await expectAll(DENIED, {
      "a choice the poll does not have": () => vote(votePath(id), ["z"]),
      "two choices on a single-choice poll": () => vote(votePath(id), ["a", "b"]),
      "no choice": () => vote(votePath(id), []),
      "choices that are not a list": () => vote(votePath(id), "a"),
      "a field of its own": () => vote(votePath(id), ["a"], { note: "x".repeat(1000) }),
      "a date from the device": () => vote(votePath(id), ["a"], { votedAt: new Date() }, {}),
      "no date": () => vote(votePath(id), ["a"], {}, {}),
      "an identifier of 7 characters": () => vote(votePath(id, "abcdefg"), ["a"]),
      "an identifier of 65 characters": () => vote(votePath(id, "v".repeat(65)), ["a"]),
      "a change of mind without the time of the server": () =>
        update(GUEST, mine, { choices: ["c"] }, ["choices"]),
    });
  });

  test("a multiple-choice poll takes several choices, eight at most", async () => {
    const id = await seedAnnouncement({ kind: "question", poll: poll({ multiple: true }) });
    expect(await vote(votePath(id), ["a", "b", "c"]), "three choices").toBe(ALLOWED);
    expect(
      await vote(votePath(id), ["a", "b", "c", "d", "e", "f", "g", "h", "i"]),
      "nine choices",
    ).toBe(DENIED);
    expect(await vote(votePath(id), ["a", "z"]), "one of them unknown").toBe(DENIED);
  });

  test("no vote on a closed poll, a draft, or an announcement without a poll", async () => {
    const closed = await seedAnnouncement({ kind: "question", poll: poll({ closed: true }) });
    const draft = await seedAnnouncement({ kind: "question", published: false, poll: poll() });
    const plain = await seedAnnouncement();
    await expectAll(DENIED, {
      "a closed poll": () => vote(votePath(closed), ["a"]),
      "a draft": () => vote(votePath(draft), ["a"]),
      "an announcement without a poll": () => vote(votePath(plain), ["a"]),
      "an announcement that does not exist": () => vote(votePath(`missing-${uniqueId()}`), ["a"]),
    });
  });

  test("nobody reads or removes a vote but the admin, not even the device that cast it", async () => {
    const id = await seedAnnouncement({ kind: "question", poll: poll() });
    const mine = votePath(id);
    expect(await vote(mine, ["a"])).toBe(ALLOWED);
    for (const caller of [GUEST, account(), unverifiedAdmin()]) {
      await expectAll(DENIED, {
        "reading it": () => get(caller, mine),
        "listing the votes of the poll": () => list(caller, `announcements/${id}/votes`),
        "listing the votes of every poll": () => query(caller, "votes", { allDescendants: true }),
        "removing it": () => remove(caller, mine),
      });
    }
    const boss = admin();
    await expectAll(ALLOWED, {
      "reading it": () => get(boss, mine),
      "listing the votes of the poll": () => list(boss, `announcements/${id}/votes`),
      "removing it": () => remove(boss, mine),
    });
  });
});

// ---------------------------------------------------------------------------
// Private documents: preferences and Mon parcours
// ---------------------------------------------------------------------------

test.describe("rules: userPreferences", () => {
  test("preferences are read by their account only, the admin included", async () => {
    const uid = account();
    await seedDoc("userPreferences", uid, { theme: "dark", fcmTokens: ["a-device-token"] });
    const path = `userPreferences/${uid}`;
    expect(await get(uid, path), "one's own").toBe(ALLOWED);
    for (const caller of [GUEST, account("other"), admin()]) {
      expect(await get(caller, path), "someone else's").toBe(DENIED);
      expect(await list(caller, "userPreferences"), "everyone's").toBe(DENIED);
    }
    expect(await list(uid, "userPreferences"), "everyone's, by an account").toBe(DENIED);
  });

  test("an account writes its own preferences only, within their bounds", async () => {
    const uid = account();
    const path = `userPreferences/${uid}`;
    await expectAll(DENIED, {
      "a guest": () => create(GUEST, path, { theme: "dark" }),
      "another account": () => create(account("other"), path, { theme: "dark" }),
      "the admin": () => create(admin(), path, { theme: "dark" }),
      "a theme of 21 characters": () => create(uid, path, { theme: "t".repeat(21) }),
      "a holiday switch that is not a boolean": () => create(uid, path, { holidayThemes: "yes" }),
      "a reminder at 24 o'clock": () => create(uid, path, { pushReminderHour: 24 }),
      "a reminder at minute 60": () => create(uid, path, { pushReminderMinute: 60 }),
      "21 device tokens": () =>
        create(uid, path, { fcmTokens: Array.from({ length: 21 }, (_, i) => `token-${i}`) }),
      "201 daily readings": () =>
        create(uid, path, { dailyReadingIds: Array.from({ length: 201 }, (_, i) => `id-${i}`) }),
      "a place of four fields": () =>
        create(uid, path, { pushReminderPlace: { lat: 48.9, lng: 2.3, tz: "Europe/Paris", x: 1 } }),
      "26 fields": () =>
        create(uid, path, Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`f${i}`, i]))),
    });
    expect(
      await create(uid, path, {
        theme: "dark",
        pushReminderEnabled: true,
        pushReminderHour: 8,
        pushReminderMinute: 30,
        pushReminderPlace: null,
        fcmTokens: ["a-device-token"],
      }),
      "one's own",
    ).toBe(ALLOWED);
    expect(await update(uid, path, { theme: "light" }, ["theme"]), "a change").toBe(ALLOWED);
    expect(
      await update(account("other"), path, { fcmTokens: ["attacker-token"] }, ["fcmTokens"]),
      "another account, adding its device to the reminders",
    ).toBe(DENIED);
  });

  test("an account deletes its own preferences only", async () => {
    const uid = account();
    await seedDoc("userPreferences", uid, { theme: "dark" });
    const path = `userPreferences/${uid}`;
    for (const caller of [GUEST, account("other"), admin()]) {
      expect(await remove(caller, path)).toBe(DENIED);
    }
    expect(await remove(uid, path)).toBe(ALLOWED);
  });
});

test.describe("rules: parcours", () => {
  const journey = (extra: Fields = {}): Fields => ({
    v: 1,
    objectives: { tehilim: { kind: "tehilim", createdAt: "2026-11-01" } },
    days: { "2026-11-12": { tehilim: 3 } },
    ...extra,
  });
  const entries = (count: number): Fields =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, 1]));

  test("a journey is read and deleted by its account only, the admin included", async () => {
    const uid = account();
    await seedDoc("parcours", uid, journey());
    const path = `parcours/${uid}`;
    for (const caller of [GUEST, account("other"), admin()]) {
      expect(await get(caller, path), "reading someone else's").toBe(DENIED);
      expect(await list(caller, "parcours"), "listing everyone's").toBe(DENIED);
      expect(await remove(caller, path), "deleting someone else's").toBe(DENIED);
    }
    expect(await get(uid, path), "reading one's own").toBe(ALLOWED);
    expect(await remove(uid, path), "deleting one's own").toBe(ALLOWED);
  });

  test("an account writes its own journey only, with its three fields, within their bounds", async () => {
    const uid = account();
    const path = `parcours/${uid}`;
    await expectAll(DENIED, {
      "a guest": () => create(GUEST, path, journey()),
      "another account": () => create(account("other"), path, journey()),
      "the admin": () => create(admin(), path, journey()),
      "a field of its own": () => create(uid, path, journey({ note: "x".repeat(1000) })),
      "a version that is not an integer": () => create(uid, path, journey({ v: "1" })),
      "objectives that are a list": () => create(uid, path, journey({ objectives: [] })),
      "401 objectives": () => create(uid, path, journey({ objectives: entries(401) })),
      "days that are a list": () => create(uid, path, journey({ days: [] })),
      "4001 days": () => create(uid, path, journey({ days: entries(4001) })),
    });
    expect(await create(uid, path, journey()), "one's own").toBe(ALLOWED);
    expect(await update(uid, path, { v: 2 }, ["v"]), "a change").toBe(ALLOWED);
    expect(await update(account("other"), path, { v: 3 }, ["v"]), "by another account").toBe(
      DENIED,
    );
  });
});

// ---------------------------------------------------------------------------
// The admin, and everything the rules do not name
// ---------------------------------------------------------------------------

test.describe("rules: admin", () => {
  /** What only the admin does: hide a session, read a report, write the catalogue. */
  async function adminOnly(caller: Caller): Promise<number[]> {
    const session = await seedSession(account("owner"));
    const report = await seedReport(docId(session));
    return Promise.all([
      update(caller, session, { hidden: true, hiddenReason: "admin" }, ["hidden", "hiddenReason"]),
      get(caller, report),
      create(caller, `chiourim/rules-chiour-${uniqueId()}`, chiourFields()),
    ]);
  }

  test("the admin is the verified account of the admin's address", async () => {
    expect(await adminOnly(admin())).toEqual([ALLOWED, ALLOWED, ALLOWED]);
  });

  test("the admin's address, not verified, is an account like any other", async () => {
    // Anyone can sign up with email and password under that address; only
    // the owner of the mailbox gets it verified.
    expect(await adminOnly(unverifiedAdmin())).toEqual([DENIED, DENIED, DENIED]);
  });

  test("a verified account under another address is not the admin", async () => {
    const lookalikes = [
      "someone@example.com",
      "admin@phenixel.fr.example.com",
      "admin+1@phenixel.fr",
      "Admin@phenixel.fr",
    ];
    for (const email of lookalikes) {
      const caller = { uid: account(), email, emailVerified: true };
      expect(await adminOnly(caller), email).toEqual([DENIED, DENIED, DENIED]);
    }
  });
});

test.describe("rules: everything else", () => {
  test("a collection the rules do not name is closed, to the admin too", async () => {
    const id = `rules-${uniqueId()}`;
    await seedDoc("secrets", id, { value: "kept" });
    for (const caller of [GUEST, account(), admin()]) {
      await expectAll(DENIED, {
        reading: () => get(caller, `secrets/${id}`),
        listing: () => list(caller, "secrets"),
        creating: () => create(caller, `secrets/rules-${uniqueId()}`, { value: "forged" }),
        changing: () => update(caller, `secrets/${id}`, { value: "changed" }, ["value"]),
        deleting: () => remove(caller, `secrets/${id}`),
        // A subcollection under a document the rules do name.
        "writing under a session": () =>
          create(caller, `sessions/${id}/private/rules-${uniqueId()}`, { value: "forged" }),
      });
    }
  });
});
