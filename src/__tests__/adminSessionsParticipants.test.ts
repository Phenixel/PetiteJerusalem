import { describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Session, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import fr from "../locales/fr";

/**
 * Le backoffice donne le même nombre de participants que la page publique
 * d'une chaîne. Il comptait toutes les réservations, tirages expirés sans
 * lecture compris : trois invités partis sans lire faisaient « 3
 * participants » à l'admin, 0 sur la page publique.
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService");
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../composables/useAdminSummary", () => ({ refreshAdminSummary: vi.fn() }));

const expired = (i: number): TextStudyReservation => ({
  id: `r${i}`,
  textStudyId: "103",
  section: i + 1,
  chosenByGuestId: `guest-${i}`,
  chosenByName: `Invité ${i}`,
  isCompleted: false,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() - 60_000).toISOString(),
});

const session = {
  id: "s1",
  name: "Chaîne abandonnée",
  description: "",
  type: EnumTypeTextStudy.Tehilim,
  creatorName: "Sarah",
  createdAt: new Date(),
  dateLimit: new Date(Date.now() + 7 * 86_400_000),
  reservations: [expired(0), expired(1), expired(2)],
} as unknown as Session;

describe("le backoffice des sessions", () => {
  it("ne compte pas les tirages expirés parmi les participants", async () => {
    const { adminService } = await import("../services/adminService");
    vi.spyOn(adminService, "listAllSessions").mockResolvedValue([session]);
    vi.spyOn(adminService, "listReports").mockResolvedValue([]);
    const { sessionService } = await import("../services/sessionService");

    const { default: AdminSessionsPage } = await import("../views/Admin/AdminSessionsPage.vue");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
    });
    const host = document.createElement("div");
    const app = createApp({ render: () => h(AdminSessionsPage) })
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .use(router);
    app.mount(host);

    await vi.waitFor(() => expect(host.textContent).toContain("Chaîne abandonnée"));
    expect(sessionService.getSessionReservationStats(session).participants).toBe(0);
    expect(host.textContent).toContain("aucun participant");
    expect(host.textContent).not.toContain("3 participants");
    app.unmount();
  });
});
