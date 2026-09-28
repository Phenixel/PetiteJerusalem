import { describe, expect, it } from "vitest";
import citiesJson from "../datas/cities.json";
import { CITY_ALIASES } from "../datas/cityAliases";
import { searchItems } from "../services/fuzzySearch";
import type { City } from "../services/zmanimService";

/**
 * La recherche du sélecteur de ville (CityPicker) : les noms de cities.json,
 * leurs autres noms (cityAliases), avec la recherche tolérante commune.
 */

const cities = citiesJson as City[];
const found = (term: string) =>
  searchItems(cities, term, (city) => [city.name, ...(CITY_ALIASES[city.name] ?? [])]).map(
    (city) => city.name,
  );

describe("autres noms des villes", () => {
  it("désignent chacun une ville de la liste", () => {
    const names = new Set(cities.map((city) => city.name));
    expect(Object.keys(CITY_ALIASES).filter((name) => !names.has(name))).toEqual([]);
  });
});

describe("recherche de ville", () => {
  it.each([
    ["london", "Londres"],
    ["ירושלים", "Jérusalem"],
    ["jerusalem", "Jérusalem"],
    ["tsfat", "Safed"],
    ["st etienne", "Saint-Étienne"],
    ["achdod", "Ashdod"],
    ["petach tikva", "Petah Tikva"],
    ["givatayim", "Guivatayim"],
    ["marseile", "Marseille"],
    ["telaviv", "Tel Aviv"],
  ])("« %s » trouve %s en premier", (term, city) => {
    expect(found(term)[0]).toBe(city);
  });

  it("met les villes qui commencent par la recherche devant", () => {
    expect(found("lon").indexOf("Londres")).toBeLessThan(found("lon").indexOf("Toulon"));
    expect(found("par")[0]).toBe("Paris");
  });
});
