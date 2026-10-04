// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sur le site, Firebase Auth garde le compte d'abord dans localStorage. La
 * persistance IndexedDB (celle de getAuth) sondait sa base toutes les 800 ms
 * sur toutes les pages, tant que l'onglet restait ouvert. IndexedDB reste dans
 * la liste : un compte qu'une version précédente y a laissé est retrouvé et
 * déplacé (vérifié de bout en bout par e2e/firebase/auth.spec.ts, « un compte
 * gardé dans IndexedDB par une version précédente reste connecté »).
 */
describe("la persistance de Firebase Auth sur le site", () => {
  const core = readFileSync("src/firebase/core.ts", "utf8");

  it("met localStorage en tête, IndexedDB ensuite", () => {
    expect(core).toMatch(
      /persistence:\s*\[\s*browserLocalPersistence,\s*indexedDBLocalPersistence,\s*browserSessionPersistence\s*\]/,
    );
  });

  it("garde le résolveur de popup de getAuth (connexion Google sur le site)", () => {
    expect(core).toContain("popupRedirectResolver: browserPopupRedirectResolver");
  });

  it("ne touche pas à l'app native, qui reste sur IndexedDB", () => {
    expect(core).toContain("initializeAuth(app, { persistence: indexedDBLocalPersistence })");
  });
});
