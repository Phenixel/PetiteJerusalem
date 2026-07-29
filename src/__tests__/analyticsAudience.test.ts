import { describe, it, expect } from "vitest";

import { resolveUserType } from "../config/analyticsAudience";

describe("resolveUserType (person property user_type)", () => {
  it("classe l'équipe en interne", () => {
    expect(resolveUserType("admin@phenixel.fr")).toBe("internal");
    expect(resolveUserType("contact.phenixel@gmail.com")).toBe("internal");
  });

  it("isole le compte de démonstration remis à Google", () => {
    expect(resolveUserType("testeur@exemple.com")).toBe("google_review");
  });

  it("reconnaît les testeurs du test fermé", () => {
    expect(resolveUserType("milkshake.2734@gmail.com")).toBe("tester");
  });

  it("considère tout compte inconnu comme un vrai utilisateur", () => {
    expect(resolveUserType("quelquun@example.com")).toBe("real");
    expect(resolveUserType("")).toBe("real");
    expect(resolveUserType(null)).toBe("real");
    expect(resolveUserType(undefined)).toBe("real");
  });

  it("ignore la casse et les espaces (Firebase renvoie l'email tel que saisi)", () => {
    expect(resolveUserType("  Admin@Phenixel.FR ")).toBe("internal");
  });
});
