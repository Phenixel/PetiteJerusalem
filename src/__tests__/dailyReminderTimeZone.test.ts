// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readTimeZone } from "../../functions/src/sunsetReminder";

/**
 * The fixed-time daily reminder is read in the device's time zone. Without
 * the reminder before chkia, the app sent no place at all and the server
 * read the chosen hour in Paris time: 20:00 arrived at 21:00 in Israel and
 * at 14:00 in New York, and the "read today" check used the Paris day. The
 * app now sends the device's `{ tzid }` alone (no position), and the server
 * reads it (functions/src/dailyReminder.ts).
 */
describe("the time zone of the fixed-time reminder", () => {
  it("is the device's when only the time zone was sent", () => {
    expect(readTimeZone({ tzid: "Asia/Jerusalem" })).toBe("Asia/Jerusalem");
    expect(readTimeZone({ tzid: "America/New_York" })).toBe("America/New_York");
  });

  it("is the place's when the reminder before chkia sent one", () => {
    expect(readTimeZone({ latitude: 31.8, longitude: 35.2, tzid: "Asia/Jerusalem" })).toBe(
      "Asia/Jerusalem",
    );
  });

  it("stays Paris for older documents and unknown zones", () => {
    expect(readTimeZone(null)).toBe("Europe/Paris");
    expect(readTimeZone(undefined)).toBe("Europe/Paris");
    expect(readTimeZone({ tzid: "" })).toBe("Europe/Paris");
    expect(readTimeZone({ tzid: "Mars/Olympus_Mons" })).toBe("Europe/Paris");
  });
});
