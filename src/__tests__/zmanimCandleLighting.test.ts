import { afterEach, describe, expect, it } from "vitest";
import { HDate } from "@hebcal/core";
import {
  candleLightingChoice,
  candleLightingMinutes,
  CANDLE_LIGHTING_CHOICES,
  DEFAULT_PLACE,
  localCandleLightingMinutes,
  restPeriodAt,
  setCandleLightingChoice,
  type ZmanimPlace,
} from "../services/zmanimService";

/**
 * L'écart d'allumage : combien de minutes avant la chkia (voir audit 3.5).
 *
 * L'application ne connaissait que Jérusalem (40) et donnait 18 partout
 * ailleurs, Israël compris. Or Israël allume 20, et Haïfa 30. Sur l'avis du
 * Rav Ovadia, l'heure annoncée était donc deux minutes trop tard dans
 * trente-trois villes du pays.
 */

const city = (name: string, latitude: number, longitude: number, tzid: string): ZmanimPlace => ({
  source: "city",
  latitude,
  longitude,
  tzid,
  city: name,
});

const jerusalem = city("Jérusalem", 31.7683, 35.2137, "Asia/Jerusalem");
const haifa = city("Haïfa", 32.794, 34.9896, "Asia/Jerusalem");
const telAviv = city("Tel Aviv", 32.0853, 34.7818, "Asia/Jerusalem");
const petahTikva = city("Petah Tikva", 32.0871, 34.8878, "Asia/Jerusalem");

/** Une position relevée par l'appareil : pas de nom, mais un fuseau. */
const deviceInIsrael: ZmanimPlace = {
  source: "device",
  latitude: 32.05,
  longitude: 34.85,
  tzid: "Asia/Jerusalem",
  city: null,
};

afterEach(() => setCandleLightingChoice(null));

describe("l'usage du lieu", () => {
  it("donne 40 à Jérusalem, 30 à Haïfa, 20 en Israël et 18 ailleurs", () => {
    expect(localCandleLightingMinutes(jerusalem)).toBe(40);
    expect(localCandleLightingMinutes(haifa)).toBe(30);
    expect(localCandleLightingMinutes(telAviv)).toBe(20);
    expect(localCandleLightingMinutes(DEFAULT_PLACE)).toBe(18);
  });

  it("suit le fuseau, et non le nom : une position d'appareil en Israël allume à 20", () => {
    // C'est ce que l'ancienne table ne savait pas faire : sans nom de ville,
    // une position relevée en Israël retombait sur les 18 de la diaspora.
    expect(localCandleLightingMinutes(deviceInIsrael)).toBe(20);
  });

  it("range Petah Tikva avec le pays, son usage étant partagé", () => {
    // Petah Tikva suit tantôt Jérusalem (40), tantôt le pays (20) : on ne
    // tranche pas à la place de l'utilisateur, on retient le pays, et c'est
    // le réglage qui dit l'autre.
    expect(localCandleLightingMinutes(petahTikva)).toBe(20);
  });
});

describe("le réglage de l'utilisateur", () => {
  it("l'emporte sur l'usage du lieu", () => {
    expect(candleLightingMinutes(jerusalem)).toBe(40);
    setCandleLightingChoice(18);
    expect(candleLightingMinutes(jerusalem)).toBe(18);
    // L'usage du lieu, lui, ne bouge pas : c'est lui que le site annonce.
    expect(localCandleLightingMinutes(jerusalem)).toBe(40);
  });

  it("rend la main au lieu avec null", () => {
    setCandleLightingChoice(30);
    expect(candleLightingChoice()).toBe(30);
    setCandleLightingChoice(null);
    expect(candleLightingChoice()).toBeNull();
    expect(candleLightingMinutes(telAviv)).toBe(20);
  });

  it("refuse un écart qui n'est pas proposé", () => {
    setCandleLightingChoice(25);
    expect(candleLightingChoice()).toBeNull();
    expect(CANDLE_LIGHTING_CHOICES).toEqual([18, 20, 30, 40]);
  });
});

describe("l'allumage du cadre de repos", () => {
  it("suit l'écart retenu", () => {
    // Chabbat du 19 septembre 2026 à Tel Aviv : l'allumage se lit sur la
    // chkia du VENDREDI 18, à 18:43:09. Vingt minutes avant, 18:23 ; les
    // dix-huit d'avant donnaient 18:25, deux minutes trop tard.
    const shabbat = new HDate(new Date(2026, 8, 19, 12));
    const at = (place: ZmanimPlace) =>
      restPeriodAt(place, shabbat, "fr")!.start.toLocaleTimeString("fr-FR", {
        timeZone: place.tzid,
        hour: "2-digit",
        minute: "2-digit",
      });

    expect(at(telAviv)).toBe("18:23");
    setCandleLightingChoice(18);
    expect(at(telAviv)).toBe("18:25");
  });
});
