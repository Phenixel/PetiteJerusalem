import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

/**
 * La page de gestion d'une chaîne donne le même taux de réservation que la
 * carte publique. Elle comptait un texte entamé (un chapitre sur trois) comme
 * réservé : quatre textes entamés d'un chapitre chacun affichaient
 * « 4/4 textes réservés » et « 100 % », la carte publique 33 %.
 */

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

const texts: TextStudy[] = ["103", "104", "105", "106"].map(
  (id) =>
    ({
      id,
      name: `Texte ${id}`,
      livre: "Livre",
      link: "",
      totalSections: 3,
      type: EnumTypeTextStudy.Mishna,
      createdAt: new Date(),
    }) as unknown as TextStudy,
);

const reservations: TextStudyReservation[] = texts.map((text, i) => ({
  id: `r${i}`,
  textStudyId: text.id,
  section: 1,
  chosenByName: "Sarah",
  chosenByGuestId: "guest-1",
  isCompleted: false,
  createdAt: new Date(),
}));

const session = {
  id: "s1",
  name: "Chaîne",
  description: "",
  type: EnumTypeTextStudy.Mishna,
  creatorId: "u1",
  dateLimit: new Date(Date.now() + 7 * 86_400_000),
  reservations,
} as unknown as Session;

describe("la page de gestion d'une chaîne", () => {
  it("compte le taux de réservation en places, comme la carte publique", async () => {
    const { authService } = await import("../services/authService");
    const { sessionService } = await import("../services/sessionService");
    vi.spyOn(authService, "getCurrentUser").mockResolvedValue({
      id: "u1",
      name: "Sarah",
      email: "",
    } as never);
    vi.spyOn(sessionService, "getSessionById").mockResolvedValue(session);
    vi.spyOn(sessionService, "canManageSession").mockReturnValue(true);
    vi.spyOn(sessionService, "getSessionTextStudies").mockReturnValue(texts);

    const { default: SessionManagementPage } = await import("../views/SessionManagementPage.vue");
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/session-management/:id", component: { render: () => null } }],
    });
    await router.push("/session-management/s1");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(SessionManagementPage) })
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .use(router);
    app.mount(host);

    await vi.waitFor(() =>
      expect(host.textContent).toContain(fr.sessionManagement.stats.reservationRate),
    );
    await nextTick();

    const stat = (label: string) =>
      [...host.querySelectorAll("span.text-sm")]
        .find((el) => el.textContent?.trim() === label)
        ?.previousElementSibling?.textContent?.trim();
    // 4 places sur 12 : 33 %, aucun texte réservé en entier.
    expect(stat(fr.sessionManagement.stats.reservationRate)).toBe("33%");
    expect(stat(fr.sessionManagement.stats.reservedTexts)).toBe("0/4");
    expect(sessionService.getSessionReservationStats(session, texts).percentage).toBe(33);

    app.unmount();
    host.remove();
  });
});
