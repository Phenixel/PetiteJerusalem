import { describe, expect, it } from "vitest";
import { HDate, HebrewCalendar, months } from "@hebcal/core";
import { activeOccasions } from "../services/dailyCycles";
import { isWalledCityPlace, type ZmanimPlace } from "../services/zmanimService";

/**
 * Pourim à Jérusalem : la ville, entourée d'une muraille depuis Josué, le fête
 * le 15 Adar (Chouchan Pourim), pas le 14. Le sidour de Jérusalem affichait Al
 * hanissim et la lecture de Pourim le 14, et rien le 15 (Magdil au lieu de
 * Migdol, pas de Vayavo Amalek). Ailleurs, en Israël comme en diaspora,
 * Pourim reste le 14.
 *
 * Repère : 5787 compte treize mois ; 14 Adar II = mardi 23 mars 2027,
 * 15 Adar II = mercredi 24 mars 2027.
 */

const place = (over: Partial<ZmanimPlace>): ZmanimPlace => ({
  source: "city",
  latitude: 31.769,
  longitude: 35.2163,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
  ...over,
});

const purim = new HDate(14, months.ADAR_II, 5787);
const shushan = new HDate(15, months.ADAR_II, 5787);

describe("Pourim dans le sidour", () => {
  it("se fête le 15 à Jérusalem", () => {
    expect(HebrewCalendar.getHolidaysOnDate(shushan)?.map((e) => e.getDesc())).toContain(
      "Shushan Purim",
    );
    const le14 = activeOccasions(purim, true, true);
    const le15 = activeOccasions(shushan, true, true);
    const keys = ["nissim", "pourim", "chir-pourim", "migdol"];
    expect(keys.filter((key) => le15.has(key))).toEqual(keys);
    expect(keys.filter((key) => le14.has(key))).toEqual([]);
    expect(le14.has("magdil")).toBe(true);
  });

  it("reste le 14 ailleurs, en Israël comme en diaspora", () => {
    for (const il of [true, false]) {
      expect(activeOccasions(purim, il).has("pourim")).toBe(true);
      expect(activeOccasions(purim, il).has("nissim")).toBe(true);
      expect(activeOccasions(shushan, il).has("pourim")).toBe(false);
    }
  });
});

describe("isWalledCityPlace", () => {
  it("reconnaît Jérusalem au catalogue et ses quartiers par la position", () => {
    expect(isWalledCityPlace(place({}))).toBe(true);
    // Gilo, Ramot : quartiers de Jérusalem, positions de l'appareil.
    expect(
      isWalledCityPlace(
        place({ source: "device", city: null, latitude: 31.7333, longitude: 35.1833 }),
      ),
    ).toBe(true);
    expect(
      isWalledCityPlace(
        place({ source: "device", city: null, latitude: 31.8167, longitude: 35.1937 }),
      ),
    ).toBe(true);
  });

  it("écarte les villes voisines et le reste du monde", () => {
    // Maalé Adoumim, Mevasseret Zion, Tel Aviv.
    expect(isWalledCityPlace(place({ city: null, latitude: 31.777, longitude: 35.298 }))).toBe(
      false,
    );
    expect(isWalledCityPlace(place({ city: null, latitude: 31.8022, longitude: 35.1497 }))).toBe(
      false,
    );
    expect(
      isWalledCityPlace(place({ city: "Tel Aviv", latitude: 32.0809, longitude: 34.7806 })),
    ).toBe(false);
    // Hors d'Israël, même aux coordonnées de Jérusalem (fuseau étranger).
    expect(isWalledCityPlace(place({ tzid: "Europe/Paris", city: "Paris" }))).toBe(false);
  });
});
