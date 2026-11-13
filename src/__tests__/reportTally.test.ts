import { describe, expect, it } from "vitest";
import { EXACT_RECOUNT_LIMIT, tallyReporters } from "../../functions/src/reportTally";

/**
 * Who reported a session (functions/src/moderation.ts). Three distinct
 * accounts hide it; guests are shown to the admin but hide nothing, since a
 * guest identifier is forged in one request.
 */
describe("the people behind the reports of a session", () => {
  it("counts each person once, accounts and guests", () => {
    const tally = tallyReporters([
      { reporterId: "u1", reporterGuestId: null },
      { reporterId: "u1", reporterGuestId: null },
      { reporterId: "u2", reporterGuestId: null },
      { reporterId: null, reporterGuestId: "g1" },
      { reporterId: null, reporterGuestId: "g1" },
    ]);
    expect(tally).toEqual({ reporters: 3, accounts: 2 });
  });

  it("lets only accounts weigh in the hiding", () => {
    const guests = Array.from({ length: 50 }, (_, i) => ({
      reporterId: null,
      reporterGuestId: `g${i}`,
    }));
    expect(tallyReporters(guests)).toEqual({ reporters: 50, accounts: 0 });
  });

  it("counts a report with no identity for nobody", () => {
    expect(
      tallyReporters([{}, { reporterId: "", reporterGuestId: "" }, { reporterId: 7 }]),
    ).toEqual({
      reporters: 0,
      accounts: 0,
    });
  });

  it("keeps an account and a guest with the same identifier apart", () => {
    expect(
      tallyReporters([
        { reporterId: "same", reporterGuestId: null },
        { reporterId: null, reporterGuestId: "same" },
      ]),
    ).toEqual({ reporters: 2, accounts: 1 });
  });

  it("gives up the exact recount well above any real session", () => {
    // Three accounts hide a session: the limit must leave them all in sight.
    expect(EXACT_RECOUNT_LIMIT).toBeGreaterThanOrEqual(100);
  });
});
