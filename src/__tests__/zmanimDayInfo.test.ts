import { describe, it, expect } from "vitest";
import { HDate } from "@hebcal/core";
import { DEFAULT_PLACE, holidayNames, tachanunStatus, type ZmanimPlace } from "../services/zmanimService";

// Le calendrier du jour sur la page des horaires : Roch Hodech et fêtes,
// et la ligne du tahanoun.

const israel: ZmanimPlace = {
  source: "city",
  latitude: 31.76904,
  longitude: 35.21633,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

const hd = (y: number, m: number, d: number) => new HDate(new Date(y, m - 1, d, 12));

describe("holidayNames", () => {
  it("nomme le Roch Hodech en français", () => {
    // 13 août 2026 = 30 Av 5786, Roch Hodech Eloul.
    const names = holidayNames(DEFAULT_PLACE, hd(2026, 8, 13), "fr");
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Roch");
    expect(names[0]).toContain("Eloul");
  });

  it("rend un jour ordinaire sans rien", () => {
    // 18 août 2026 = 5 Eloul 5786, jour de semaine ordinaire.
    expect(holidayNames(DEFAULT_PLACE, hd(2026, 8, 18), "fr")).toEqual([]);
  });

  it("suit le calendrier d'Israël en Asia/Jerusalem", () => {
    // 3 avril 2026 = 16 Nissan 5786 : Yom Tov II de Pessah en diaspora, déjà
    // 'Hol haMoed en Israël.
    const day = hd(2026, 4, 3);
    const diaspora = holidayNames(DEFAULT_PLACE, day, "en").join(" ");
    const israelNames = holidayNames(israel, day, "en").join(" ");
    expect(diaspora).toContain("Pesach II");
    expect(israelNames).toContain("CH’’M");
  });
});

describe("tachanunStatus", () => {
  it("jour ordinaire : Ta'hanoun à Cha'harit et Min'ha", () => {
    // Mardi 18 août 2026, 5 Eloul.
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 18))).toBe("full");
  });

  it("vendredi : Cha'harit seulement (veille de Chabbat)", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 21))).toBe("shacharitOnly");
  });

  it("Roch Hodech : pas de Ta'hanoun", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 13))).toBe("none");
  });

  it("Chabbat : pas de ligne du tout", () => {
    expect(tachanunStatus(DEFAULT_PLACE, hd(2026, 8, 22))).toBeNull();
  });
});
