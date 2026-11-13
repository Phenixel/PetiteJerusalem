import { describe, it, expect } from "vitest";

import { emailHash, resolveUserType } from "../config/analyticsAudience";

describe("resolveUserType (person property user_type)", () => {
  it("classe l'équipe en interne", async () => {
    expect(await resolveUserType("admin@phenixel.fr")).toBe("internal");
    expect(await resolveUserType("contact.phenixel@gmail.com")).toBe("internal");
  });

  it("isole le compte de démonstration remis à Google", async () => {
    expect(await resolveUserType("testeur@exemple.com")).toBe("google_review");
  });

  it("considère tout compte inconnu comme un vrai utilisateur", async () => {
    expect(await resolveUserType("quelquun@example.com")).toBe("real");
    expect(await resolveUserType("")).toBe("real");
    expect(await resolveUserType(null)).toBe("real");
    expect(await resolveUserType(undefined)).toBe("real");
  });

  it("ignore la casse et les espaces (Firebase renvoie l'email tel que saisi)", async () => {
    expect(await resolveUserType("  Admin@Phenixel.FR ")).toBe("internal");
  });

  it("hashes an address the way the lists are written", async () => {
    // printf '%s' 'someone@example.com' | shasum -a 256
    expect(await emailHash(" Someone@Example.com ")).toBe(
      "72497f475e4f76d0b28f57c73a084ece576d170874eba3ee2609d9afe4b71aab",
    );
  });

  it("ships no address in clear: the bundle is public", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/config/analyticsAudience.ts", "utf8");
    const addresses = source.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    expect(addresses).toEqual(["someone@example.com"]);
  });
});
