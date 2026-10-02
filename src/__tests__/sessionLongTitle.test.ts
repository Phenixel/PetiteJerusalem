import { describe, expect, it, vi } from "vitest";
import { EnumTypeTextStudy } from "../models/typeTextStudy";

/**
 * Les règles Firestore bornent le slug d'une session à 200 caractères. Le
 * slug n'était pas tronqué : un titre de 250 caractères latins donnait un
 * slug de 250 caractères, la création était refusée (permission-denied) et
 * l'utilisateur ne lisait qu'un message générique.
 */

vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../services/firestoreService");

describe("une chaîne au titre long", () => {
  it("reçoit un slug que les règles acceptent", async () => {
    const { firestoreService } = await import("../services/firestoreService");
    vi.mocked(firestoreService.getSessionBySlug).mockResolvedValue(null);
    vi.mocked(firestoreService.createSession).mockResolvedValue("s1");
    const { sessionService } = await import("../services/sessionService");

    const title = "Chaine de lecture pour la guerison ".repeat(8).trim();
    expect(title.length).toBeGreaterThan(200);
    await sessionService.createSessionWithValidation(
      title,
      "Description",
      EnumTypeTextStudy.Tehilim,
      "2026-12-01",
      "u1",
      "Sarah",
    );

    const { slug } = vi.mocked(firestoreService.createSession).mock.calls[0][0];
    expect(slug!.length).toBeLessThanOrEqual(180);
    // Coupé à un mot entier, sans tiret final.
    expect(slug).toMatch(/^chaine-de-lecture-pour-la-guerison(-[a-z]+)*$/);
    // Le suffixe d'un doublon tient encore sous la borne des règles.
    expect(`${slug}-k3x9qz`.length).toBeLessThanOrEqual(200);
  });

  it("garde tel quel un slug court", async () => {
    const { truncateSlug } = await import("../services/sessionService");
    expect(truncateSlug("refoua-chelema-david")).toBe("refoua-chelema-david");
    // Un seul mot plus long que la borne se coupe net.
    expect(truncateSlug("a".repeat(250))).toBe("a".repeat(180));
  });

  it("borne aussi les champs du formulaire aux limites des règles", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "src/views/ShareReading/NewSession.vue",
      "src/components/EditSessionModal.vue",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain('maxlength="300"');
      expect(source, file).toContain('maxlength="5000"');
    }
  });
});
