import { describe, it, expect } from "vitest";
import { buildWatchPayload } from "../services/watchPayloads";
import { getTehilimOfDay } from "../services/dailyCycles";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("buildWatchPayload", () => {
  const now = new Date(2026, 7, 6, 10, 0); // 6 août 2026, 10 h locale
  const payload = buildWatchPayload(t, "fr", now, "#1D6FDB");

  it("porte les libellés des écrans, déjà localisés", () => {
    expect(payload.v).toBe(1);
    expect(payload.locale).toBe("fr");
    expect(payload.accent).toBe("#1D6FDB");
    // Le natif ne traduit rien : tout ce qui s'affiche vient du payload.
    expect(payload.zmanimTitle).toBe("watch.zmanim");
    expect(payload.dailyTitle).toBe("watch.daily");
    expect(payload.textsTitle).toBe("watch.texts");
    expect(payload.tehilimTitle).toBe("watch.tehilim");
    expect(payload.pairing).toBe("watch.pairing");
  });

  it("garde le {n} du titre d'un psaume, que la montre compte elle-même", () => {
    // Sentinelle passée en paramètre : vue-i18n ne doit pas l'interpoler ici,
    // le numéro affiché dépend du psaume ouvert sur la montre.
    expect(payload.psalmTemplate).toContain("{n}");
  });

  it("annonce les psaumes du jour, les mêmes que la lecture quotidienne", () => {
    expect(payload.tehilimOfDay.label).toBe("watch.tehilimOfDay");
    expect(payload.tehilimOfDay.psalms).toEqual(getTehilimOfDay(now).psalms);
    expect(payload.tehilimOfDay.psalms.length).toBeGreaterThan(0);
    // Des numéros de psaumes, rien d'autre : le texte, lui, est embarqué dans
    // l'app de montre et ne transite pas.
    for (const n of payload.tehilimOfDay.psalms) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(150);
    }
  });

  it("borne les psaumes du jour au minuit local qui suit", () => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    expect(payload.expiresAt).toBe(midnight.getTime());
    // Comparaison numérique côté natif : aucune logique de calendrier là-bas
    // (le calendrier de l'appareil peut être hébraïque).
    expect(payload.expiresAt).toBeGreaterThan(now.getTime());
  });

  it("tient dans le format des messages du Data Layer et de WatchConnectivity", () => {
    // DataClient plafonne un DataItem à 100 ko, WatchConnectivity son
    // applicationContext dans le même ordre de grandeur : le payload de la
    // montre est du texte court, il doit rester très en deçà.
    expect(JSON.stringify(payload).length).toBeLessThan(4_000);
  });
});
