import { beforeEach, describe, expect, it } from "vitest";
import {
  aliyaKey,
  resetChneiMikraChecksForTests,
  useChneiMikraChecks,
} from "../composables/useChneiMikraChecks";

// Le chnei mikra : une case par montée, rangée par semaine (le Chabbat de la
// paracha), gardée sur l'appareil.

describe("les montées cochées du chnei mikra", () => {
  beforeEach(() => {
    localStorage.clear();
    resetChneiMikraChecksForTests();
  });

  it("une montée se coche puis se décoche, et la coche survit à un rechargement", () => {
    const checks = useChneiMikraChecks();
    const key = aliyaKey(264, 0);
    expect(checks.toggle("2026-10-17", key)).toBe(true);
    resetChneiMikraChecksForTests();
    expect(useChneiMikraChecks().isChecked("2026-10-17", key)).toBe(true);
    expect(checks.toggle("2026-10-17", key)).toBe(false);
    expect(checks.isChecked("2026-10-17", key)).toBe(false);
  });

  it("chaque semaine a ses coches : la suivante repart de zéro", () => {
    const checks = useChneiMikraChecks();
    checks.toggle("2026-10-17", aliyaKey(264, 0));
    expect(checks.isChecked("2026-10-24", aliyaKey(264, 0))).toBe(false);
  });

  it("ne garde que les treize dernières semaines", () => {
    const checks = useChneiMikraChecks();
    for (let week = 1; week <= 15; week++) {
      checks.toggle(`2026-${String(week).padStart(2, "0")}-01`, aliyaKey(1, 0));
    }
    expect(checks.isChecked("2026-01-01", aliyaKey(1, 0))).toBe(false);
    expect(checks.isChecked("2026-02-01", aliyaKey(1, 0))).toBe(false);
    expect(checks.isChecked("2026-03-01", aliyaKey(1, 0))).toBe(true);
    expect(checks.isChecked("2026-15-01", aliyaKey(1, 0))).toBe(true);
  });
});
