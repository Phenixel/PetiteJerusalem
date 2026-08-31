import { describe, it, expect } from "vitest";
import {
  buildDailyReadingWidgetPayload,
  buildLibraryWidgetPayload,
  buildZmanimWidgetPayload,
  ZMANIM_WIDGET_DAYS,
} from "../services/widgetPayloads";
import { localDayKey } from "../services/dateService";
import { DEFAULT_PLACE } from "../services/zmanimService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

describe("buildZmanimWidgetPayload", () => {
  const now = new Date(2026, 7, 6, 10, 0); // 6 août 2026, 10h locale
  const payload = buildZmanimWidgetPayload(DEFAULT_PLACE, t, "fr", now);

  it("embarque une semaine d'horaires triés, labels et heures pré-formatés", () => {
    expect(payload.v).toBe(2);
    expect(payload.place).toBe("Paris");
    // ~14 zmanim par jour sur 7 jours (certains peuvent manquer aux latitudes extrêmes)
    expect(payload.times.length).toBeGreaterThanOrEqual(ZMANIM_WIDGET_DAYS * 10);
    for (let i = 1; i < payload.times.length; i++) {
      expect(payload.times[i].epoch).toBeGreaterThanOrEqual(payload.times[i - 1].epoch);
    }
    expect(payload.times[0].label).toMatch(/^zmanim\.names\./);
    // Les heures partent déjà formatées : le natif n'a aucun DateFormatter
    // (le réglage 12 h/24 h et le calendrier de l'appareil fausseraient tout).
    for (const zman of payload.times) expect(zman.time).toMatch(/^\d{2}:\d{2}$/);
    // Le gabarit « puis… » garde ses {placeholders} malgré la traduction.
    expect(payload.then).toContain("{label}");
    expect(payload.then).toContain("{time}");
    // L'accent part avec le payload : les widgets portent le thème de l'app.
    expect(payload.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // Le widget doit toujours trouver un « prochain » horaire aujourd'hui.
    expect(payload.times.some((z) => z.epoch > now.getTime())).toBe(true);
    // Et le dernier couvre bien la fin de la fenêtre de 7 jours.
    const lastDay = (payload.times.at(-1)!.epoch - now.getTime()) / 86_400_000;
    expect(lastDay).toBeGreaterThan(ZMANIM_WIDGET_DAYS - 1.5);
  });

  it("porte un jour hébraïque par jour embarqué, borné par les chkiot", () => {
    expect(payload.days).toHaveLength(ZMANIM_WIDGET_DAYS);
    // Les fenêtres se suivent sans trou : la fin de l'une ouvre la suivante.
    for (let i = 1; i < payload.days.length; i++) {
      expect(payload.days[i].from).toBe(payload.days[i - 1].until);
    }
    // L'instant courant tombe dans une fenêtre, une seule : le widget sait
    // toujours quel jour afficher, même une semaine sans rouvrir l'app.
    const covering = payload.days.filter((d) => d.from <= now.getTime() && now.getTime() < d.until);
    expect(covering).toHaveLength(1);
    // 6 août 2026 = 23 Av 5786 ; on dit le tahanoun, sans mise en avant.
    expect(covering[0].hebrewDate).toBe("23 Av 5786");
    expect(covering[0].tachanun).toBe("zmanim.tachanun.full");
    expect(covering[0].tachanunStrong).toBe(false);
    expect(covering[0].parasha).toContain("zmanim.shabbat.parasha");
  });

  it("met le tahanoun en avant les jours où l'on n'en dit pas", () => {
    // 13 août 2026 = Roch Hodech Eloul : pas de tahanoun.
    const roshChodesh = buildZmanimWidgetPayload(DEFAULT_PLACE, t, "fr", new Date(2026, 7, 13, 10));
    const day = roshChodesh.days[0];
    expect(day.tachanun).toBe("zmanim.tachanun.none");
    expect(day.tachanunStrong).toBe(true);
  });

  it("laisse le Chabbat sans ligne de tahanoun", () => {
    // Samedi 8 août 2026 : la question du tahanoun ne s'y pose pas.
    const shabbat = buildZmanimWidgetPayload(DEFAULT_PLACE, t, "fr", new Date(2026, 7, 8, 10));
    expect(shabbat.days[0].tachanun).toBeNull();
    expect(shabbat.days[0].tachanunStrong).toBe(false);
  });
});

describe("buildDailyReadingWidgetPayload", () => {
  const now = new Date(2026, 7, 6, 10, 0);
  const today = localDayKey(now);
  const firstText = (textStudiesJson as TextStudiesJson).textStudies[0];

  it("porte l'accent du thème passé par l'app", () => {
    const payload = buildDailyReadingWidgetPayload(null, t, now, "#E05A2B");
    expect(payload.accent).toBe("#E05A2B");
    expect(buildZmanimWidgetPayload(DEFAULT_PLACE, t, "fr", now, "#E05A2B").accent).toBe("#E05A2B");
  });

  it("laisse au natif les nombres de la ligne de progression", () => {
    // Les coches ne valent que jusqu'à minuit : leur décompte se fait côté
    // natif, le gabarit part donc avec ses sentinelles intactes.
    const payload = buildDailyReadingWidgetPayload(null, t, now);
    expect(payload.progressTemplate).toContain("{done}");
    expect(payload.progressTemplate).toContain("{total}");
  });

  it("sans utilisateur connecté : non configuré, message d'invite", () => {
    const payload = buildDailyReadingWidgetPayload(null, t, now);
    expect(payload.configured).toBe(false);
    expect(payload.items).toEqual([]);
    expect(payload.emptyLabel).toBe("dailyReading.widget.empty");
    expect(payload.date).toBe(today);
  });

  it("expire au prochain minuit local", () => {
    const payload = buildDailyReadingWidgetPayload(null, t, now);
    const expiry = new Date(payload.expiresAt);
    expect(payload.expiresAt).toBeGreaterThan(now.getTime());
    expect(expiry.getHours()).toBe(0);
    expect(expiry.getMinutes()).toBe(0);
    expect(localDayKey(new Date(payload.expiresAt - 1000))).toBe(today);
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

  it("la paracha seule suffit à être configuré", () => {
    const payload = buildDailyReadingWidgetPayload(
      {
        dailyReadingIds: [],
        dailyReadingOptions: ["parasha"],
        dailyReadingProgress: { date: "", completedIds: [] },
      },
      t,
      now,
    );
    // Un lecteur du chnei mikra sans liste quotidienne ne doit pas être
    // invité à « composer sa liste » par un widget qui affiche sa paracha.
    expect(payload.configured).toBe(true);
    expect(payload.items).toEqual([]);
    expect(payload.parasha).toBeTruthy();
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

describe("buildLibraryWidgetPayload", () => {
  const payload = buildLibraryWidgetPayload(t);

  it("porte les titres des raccourcis, tous traduits", () => {
    expect(payload.v).toBe(1);
    // Rien n'est écrit en dur côté natif : « Sidour » se dit « Siddur » en
    // anglais et « סידור » en hébreu, le widget ne saurait pas le deviner.
    expect(payload.title).toBe("study.title");
    for (const book of payload.books) expect(book.label).toMatch(/^study\.types\./);
  });

  it("livre les quatre volumes d'étude, puis le sidour", () => {
    // L'ordre compte : le widget Bibliothèque garnit sa planche des premiers,
    // et les raccourcis Sidour et Tehilim cherchent le leur par son corpus.
    expect(payload.books.map((b) => b.corpus)).toEqual([
      "tehilim",
      "michna",
      "talmud",
      "tanakh",
      "sidour",
    ]);
  });
});
