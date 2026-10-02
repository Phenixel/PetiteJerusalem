import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { Session } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { moderationService } from "../services/moderationService";
import ReportSessionModal from "../components/ReportSessionModal.vue";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

/**
 * Le signalement sur la chaîne perpétuelle (docs/moderation.md). Elle reçoit
 * des noms sans fin, et un signalement y vise un nom :
 * - le bouton « Signaler » ne s'éteint pas après un premier signalement ;
 * - « Bloquer ce créateur » n'est pas proposé : son créateur est l'équipe
 *   (`petite-jerusalem`), et la case retirait toute la chaîne de l'appareil ;
 * - un blocage posé avant ne la cache plus.
 * Les sessions ordinaires ne changent pas.
 */

const session = (over: Partial<Session> = {}): Session => ({
  id: "session-ordinaire",
  name: "Pour la guérison de David",
  type: EnumTypeTextStudy.Tehilim,
  description: "",
  dateLimit: new Date("2100-01-01"),
  createdAt: new Date("2026-09-01"),
  personId: "createur",
  creatorName: "Quelqu'un",
  reservations: [],
  ...over,
});
const chain = session({
  id: "chaine-perpetuelle",
  personId: "petite-jerusalem",
  perpetual: true,
});

beforeEach(() => localStorage.clear());

describe("signaler et bloquer, chaîne perpétuelle ou session ordinaire", () => {
  it("une session ordinaire se signale une fois par appareil, la chaîne autant qu'il faut", () => {
    localStorage.setItem(
      "pj_reported_sessions",
      JSON.stringify(["session-ordinaire", "chaine-perpetuelle"]),
    );
    expect(moderationService.isReportLocked(session())).toBe(true);
    expect(moderationService.isReportLocked(chain)).toBe(false);
    expect(moderationService.isReportLocked(session({ id: "autre" }))).toBe(false);
  });

  it("le créateur de la chaîne ne se bloque pas, celui d'une session ordinaire si", () => {
    expect(moderationService.canBlockCreator(session())).toBe(true);
    expect(moderationService.canBlockCreator(chain)).toBe(false);
    expect(moderationService.canBlockCreator(session({ personId: "" }))).toBe(false);
  });

  it("un blocage déjà posé ne cache pas la chaîne, et cache toujours le reste", () => {
    moderationService.blockCreator("petite-jerusalem");
    moderationService.blockCreator("createur");
    expect(moderationService.isBlockedForViewer(chain)).toBe(false);
    expect(moderationService.isBlockedForViewer(session())).toBe(true);
  });
});

describe("la fenêtre de signalement", () => {
  let host: HTMLElement | null = null;
  afterEach(() => host?.remove());

  async function open(target: Session) {
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    host = document.createElement("div");
    document.body.appendChild(host);
    createApp({ render: () => h(ReportSessionModal, { show: true, session: target }) })
      .use(i18n)
      .mount(host);
    await nextTick();
    return host;
  }

  it("ne propose pas de bloquer le créateur de la chaîne, et demande le nom visé", async () => {
    const modal = await open(chain);
    expect(modal.querySelector('input[type="checkbox"]')).toBeNull();
    expect(modal.textContent).not.toContain(fr.moderation.blockCreator);
    expect(modal.textContent).toContain(fr.moderation.reportSubtitlePerpetual);
    expect(modal.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      fr.moderation.detailsPlaceholderPerpetual,
    );
  });

  it("propose toujours de bloquer le créateur d'une session ordinaire", async () => {
    const modal = await open(session());
    expect(modal.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(modal.textContent).toContain(fr.moderation.blockCreator);
    expect(modal.textContent).toContain(fr.moderation.reportSubtitle);
  });

  it("a ses textes dans les trois langues", () => {
    for (const locale of [fr, en, he]) {
      expect(locale.moderation.reportSubtitlePerpetual).toBeTruthy();
      expect(locale.moderation.detailsPlaceholderPerpetual).toBeTruthy();
    }
  });
});
