import { describe, it, expect, vi } from "vitest";

// adminService tire studioService, qui tire Storage et Functions : on
// neutralise les trois modules d'init Firebase, les fonctions testées ici
// sont pures.
vi.mock("../firebase/firestore", () => ({ db: {} }));
vi.mock("../firebase/storage", () => ({ storage: {} }));
vi.mock("../firebase/functions", () => ({ functions: {} }));

import { isAdminEmail } from "../config/admin";
import { generateStudioToken } from "../services/adminService";

describe("isAdminEmail (garde UX du backoffice)", () => {
  it("accepte uniquement le compte admin", () => {
    expect(isAdminEmail("admin@phenixel.fr")).toBe(true);
  });

  it("refuse tout autre email, vide ou absent", () => {
    expect(isAdminEmail("visiteur@example.com")).toBe(false);
    expect(isAdminEmail("ADMIN@PHENIXEL.FR")).toBe(false); // sensible à la casse, comme les rules
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe("generateStudioToken (lien secret du studio)", () => {
  it("produit 64 caractères hexadécimaux (32 octets)", () => {
    const token = generateStudioToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne produit jamais deux fois le même token", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateStudioToken()));
    expect(tokens.size).toBe(100);
  });
});
