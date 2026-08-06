import { describe, it, expect } from "vitest";
import {
  buildDailyReadingWidgetPayload,
  buildZmanimWidgetPayload,
  localDayKey,
  ZMANIM_WIDGET_DAYS,
} from "../services/widgetPayloads";
import { DEFAULT_PLACE } from "../services/zmanimService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("buildZmanimWidgetPayload", () => {
  const now = new Date(2026, 7, 6, 10, 0); // 6 août 2026, 10h locale
  const payload = buildZmanimWidgetPayload(DEFAULT_PLACE, t, "fr", now);

  it("embarque une semaine d'horaires triés, labels localisés", () => {
    expect(payload.v).toBe(1);
    expect(payload.tzid).toBe("Europe/Paris");
    expect(payload.place).toBe("Paris");
    // ~14 zmanim par jour sur 7 jours (certains peuvent manquer aux latitudes extrêmes)
    expect(payload.times.length).toBeGreaterThanOrEqual(ZMANIM_WIDGET_DAYS * 10);
    for (let i = 1; i < payload.times.length; i++) {
      expect(payload.times[i].epoch).toBeGreaterThanOrEqual(payload.times[i - 1].epoch);
    }
    expect(payload.times[0].label).toMatch(/^zmanim\.names\./);
    // Le widget doit toujours trouver un « prochain » horaire aujourd'hui.
    expect(payload.times.some((z) => z.epoch > now.getTime())).toBe(true);
    // Et le dernier couvre bien la fin de la fenêtre de 7 jours.
    const lastDay = (payload.times.at(-1)!.epoch - now.getTime()) / 86_400_000;
    expect(lastDay).toBeGreaterThan(ZMANIM_WIDGET_DAYS - 1.5);
  });
});

describe("buildDailyReadingWidgetPayload", () => {
  const now = new Date(2026, 7, 6, 10, 0);
  const today = localDayKey(now);
  const firstText = (textStudiesJson as TextStudiesJson).textStudies[0];

  it("sans utilisateur connecté : non configuré, message d'invite", () => {
    const payload = buildDailyReadingWidgetPayload(null, t, now);
    expect(payload.configured).toBe(false);
    expect(payload.items).toEqual([]);
    expect(payload.emptyLabel).toBe("dailyReading.widget.empty");
    expect(payload.date).toBe(today);
  });

  it("liste + option tehilim, progression du jour respectée", () => {
    const payload = buildDailyReadingWidgetPayload(
      {
        dailyReadingIds: [Number(firstText.id)],
        dailyReadingOptions: ["tehilim-jour", "parasha"],
        dailyReadingProgress: {
          date: today,
          completedIds: [Number(firstText.id)],
          completedOptions: [],
        },
      },
      t,
      now,
    );
    expect(payload.configured).toBe(true);
    // Les lectures du moment sont en tête, comme sur la page.
    expect(payload.items[0].key).toBe("tehilim-jour");
    expect(payload.items[0].done).toBe(false);
    const text = payload.items.find((i) => i.key === String(firstText.id));
    expect(text).toBeDefined();
    expect(text!.label).toBe(firstText.name);
    expect(text!.done).toBe(true);
    // La paracha (suivi hebdomadaire) est à part, hors items quotidiens.
    expect(payload.parasha).toBeTruthy();
    expect(payload.parashaDone).toBe(false);
  });

  it("une progression d'un autre jour repart de zéro", () => {
    const payload = buildDailyReadingWidgetPayload(
      {
        dailyReadingIds: [Number(firstText.id)],
        dailyReadingOptions: [],
        dailyReadingProgress: {
          date: "2026-08-05",
          completedIds: [Number(firstText.id)],
          completedOptions: ["tehilim-jour"],
        },
      },
      t,
      now,
    );
    expect(payload.items.every((i) => !i.done)).toBe(true);
    expect(payload.date).toBe(today);
  });
});
