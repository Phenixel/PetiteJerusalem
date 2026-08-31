import { describe, expect, it } from "vitest";
import {
  KOTEL,
  arrowAngle,
  bearingToKotel,
  compassPoint,
  distanceToKotelKm,
} from "../services/kotelDirection";

/**
 * Le cap vers le Kotel : c'est le sens dans lequel on se tourne pour la
 * 'Amida, une erreur de calcul enverrait prier dans la mauvaise direction.
 *
 * Les valeurs de contrôle sont celles de l'orthodromie (grand cercle), à un
 * degré près : depuis Paris, une carte plate donnerait un cap une bonne
 * dizaine de degrés trop au sud.
 */
describe("direction du Kotel", () => {
  const PARIS = { latitude: 48.8566, longitude: 2.3522 };
  const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };
  const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

  it("depuis Paris : environ 112°, entre est et sud-est", () => {
    const bearing = bearingToKotel(PARIS.latitude, PARIS.longitude);
    expect(bearing).toBeGreaterThan(111);
    expect(bearing).toBeLessThan(114);
    // Paris tombe presque exactement sur la limite des deux aires (112,5°) :
    // l'une ou l'autre est juste, seul le cap en degrés tranche.
    expect(["e", "se"]).toContain(compassPoint(bearing));
  });

  it("depuis New York : cap au nord-est, et non plein est", () => {
    const bearing = bearingToKotel(NEW_YORK.latitude, NEW_YORK.longitude);
    expect(bearing).toBeGreaterThan(53);
    expect(bearing).toBeLessThan(55);
    expect(compassPoint(bearing)).toBe("ne");
  });

  it("depuis Tel-Aviv : cap au sud-est, le Kotel est à une heure de route", () => {
    const bearing = bearingToKotel(TEL_AVIV.latitude, TEL_AVIV.longitude);
    expect(compassPoint(bearing)).toBe("se");
    expect(distanceToKotelKm(TEL_AVIV.latitude, TEL_AVIV.longitude)).toBeLessThan(60);
  });

  it("depuis le Kotel : aucune distance", () => {
    expect(distanceToKotelKm(KOTEL.latitude, KOTEL.longitude)).toBeCloseTo(0, 6);
  });

  it("les distances valent celles des tables", () => {
    // Paris ↔ Jérusalem : 3 330 km à vol d'oiseau.
    expect(distanceToKotelKm(PARIS.latitude, PARIS.longitude)).toBeGreaterThan(3300);
    expect(distanceToKotelKm(PARIS.latitude, PARIS.longitude)).toBeLessThan(3360);
    // New York ↔ Jérusalem : 9 170 km.
    expect(distanceToKotelKm(NEW_YORK.latitude, NEW_YORK.longitude)).toBeGreaterThan(9100);
    expect(distanceToKotelKm(NEW_YORK.latitude, NEW_YORK.longitude)).toBeLessThan(9250);
  });

  it("les aires de vent suivent le cadran", () => {
    expect(compassPoint(0)).toBe("n");
    expect(compassPoint(44)).toBe("ne");
    expect(compassPoint(180)).toBe("s");
    expect(compassPoint(271)).toBe("o");
    expect(compassPoint(359)).toBe("n");
  });

  it("la flèche tourne avec l'appareil, et reste dans un tour", () => {
    // Sans boussole, la flèche vaut pour un cadran nord en haut.
    expect(arrowAngle(120, null)).toBe(120);
    // Appareil tourné vers l'est : le Kotel passe à sa droite.
    expect(arrowAngle(120, 90)).toBe(30);
    // Le passage par le nord ne sort pas de [0, 360[.
    expect(arrowAngle(10, 40)).toBe(330);
  });
});
