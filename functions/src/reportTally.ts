/**
 * Who reported a session (functions/src/moderation.ts): the distinct people
 * behind its open reports, accounts and guests, and the accounts alone, which
 * are the only ones that weigh in the automatic hiding.
 *
 * Pure module, without Firebase: the app's tests import it.
 */

/**
 * Above this many open reports on one session, the exact recount is given
 * up. Creating a report is open to everyone (the App Store wants a guest to
 * be able to report), and each one used to read back every open report of
 * its session: a script posting N reports cost about N²/2 reads. No real
 * session comes near this figure; past it, the trigger only counts.
 */
export const EXACT_RECOUNT_LIMIT = 300;

/** What the tally reads of a report: its two identity fields. */
export interface ReportIdentity {
  reporterId?: unknown;
  reporterGuestId?: unknown;
}

export interface ReportTally {
  /** Distinct people, accounts and guests: what the back office shows. */
  reporters: number;
  /** Distinct accounts: what hides a session. */
  accounts: number;
}

/**
 * Counts the people behind a list of reports. A guest identifier is forged
 * in one request, so three anonymous reports from one device must not hide a
 * session: only accounts count for that. A report with no identity at all
 * counts for nobody.
 */
export function tallyReporters(reports: ReportIdentity[]): ReportTally {
  const reporters = new Set<string>();
  const accounts = new Set<string>();
  for (const report of reports) {
    const uid = report.reporterId;
    const guestId = report.reporterGuestId;
    if (typeof uid === "string" && uid) {
      reporters.add(`user:${uid}`);
      accounts.add(uid);
    } else if (typeof guestId === "string" && guestId) {
      reporters.add(`guest:${guestId}`);
    }
  }
  return { reporters: reporters.size, accounts: accounts.size };
}
