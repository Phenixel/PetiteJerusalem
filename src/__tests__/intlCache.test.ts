import { afterEach, describe, expect, it, vi } from "vitest";
import { dateTimeFormat, numberFormat, resetIntlCache } from "../services/intlCache";
import { formatZmanTime } from "../services/zmanimService";

describe("cache des formateurs Intl", () => {
  afterEach(() => {
    resetIntlCache();
    vi.restoreAllMocks();
  });

  it("rend le même formateur pour la même locale et les mêmes options", () => {
    const a = dateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" });
    const b = dateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" });
    expect(b).toBe(a);
    expect(dateTimeFormat("en", { hour: "2-digit", minute: "2-digit" })).not.toBe(a);
    expect(dateTimeFormat("fr", { hour: "2-digit" })).not.toBe(a);
    expect(numberFormat("fr", { maximumFractionDigits: 0 })).toBe(
      numberFormat("fr", { maximumFractionDigits: 0 }),
    );
  });

  it("ne construit qu'un formateur pour vingt horaires de la même page", () => {
    const built = vi.spyOn(Intl, "DateTimeFormat");
    const date = new Date(Date.UTC(2026, 7, 7, 4, 27));
    const times = Array.from({ length: 20 }, () => formatZmanTime(date, "Europe/Paris", "fr"));
    expect(new Set(times).size).toBe(1);
    expect(times[0]).toBe("06:27");
    expect(built).toHaveBeenCalledTimes(1);
  });
});
