import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Session, TextStudyReservation } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import fr from "../locales/fr";

/**
 * « Je participe » ne compte que les réservations encore valables. Un tirage
 * abandonné, ou une place de la chaîne perpétuelle non lue en 24 heures,
 * expire : tous les autres affichages l'ignorent, mais cette liste la
 * comptait encore (« 1/2 lues ») et proposait de la cocher.
 */

vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService");

const user = { id: "u1", name: "David", email: "u1@exemple.fr" };
const mine = (over: Partial<TextStudyReservation>): TextStudyReservation => ({
  id: "r",
  textStudyId: "103",
  section: 1,
  chosenById: "u1",
  chosenByName: "David",
  isCompleted: false,
  createdAt: new Date(),
  ...over,
});

describe("Je participe", () => {
  it("n'affiche ni ne compte une réservation expirée", async () => {
    const { default: MyParticipatedSessions } = await import(
      "../views/ShareReading/MyParticipatedSessions.vue"
    );
    const session: Session = {
      id: "s1",
      name: "Pour la guérison de David",
      type: EnumTypeTextStudy.Tehilim,
      description: "",
      dateLimit: new Date(Date.now() + 7 * 86_400_000),
      createdAt: new Date(),
      personId: "autre",
      creatorName: "Quelqu'un",
      reservations: [
        mine({ id: "lue", textStudyId: "103", isCompleted: true }),
        mine({
          id: "expiree",
          textStudyId: "104",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      ],
    };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:rest(.*)", component: { render: () => null } }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    createApp({
      render: () =>
        h(MyParticipatedSessions, {
          sessions: [session],
          currentUser: user,
          textStudiesMap: new Map(),
        }),
    })
      .use(createI18n({ legacy: false, locale: "fr", messages: { fr } }))
      .use(router)
      .mount(host);
    await nextTick();

    // Il ne reste que la lue : tout est lu.
    expect(host.textContent).toContain(fr.shareReading.allRead);
    expect(host.textContent).not.toContain("1/2");
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    host.remove();
  });
});
