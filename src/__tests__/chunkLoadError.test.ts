import { describe, expect, it } from "vitest";
import { chunkNameFrom, isChunkLoadError } from "../config/chunkLoadError";

/**
 * Reconnaissance d'un chunk devenu injoignable, qui déclenche le rechargement
 * unique de `main.ts`. Les messages testés sont ceux des navigateurs (Safari,
 * Chrome, Firefox), pas notre rédaction : celui de Safari vient de l'Error
 * tracking PostHog, sur un lien de session ouvert le 24/09.
 */

const SAFARI_MIME = "'text/html' is not a valid JavaScript MIME type.";
const CHROME_MIME =
  "Failed to load module script: Expected a JavaScript module script but the server responded " +
  'with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts ' +
  "per HTML spec.";
const FIREFOX_MIME =
  'Loading module from "https://petite-jerusalem.fr/assets/DetailSession-B1x2y3z4.js" was ' +
  'blocked because of a disallowed MIME type ("text/html").';
const CHROME_FETCH =
  "Failed to fetch dynamically imported module: " +
  "https://petite-jerusalem.fr/assets/DetailSession-B1x2y3z4.js";
const FIREFOX_FETCH = "error loading dynamically imported module";
const SAFARI_IMPORT = "Importing a module script failed.";

describe("isChunkLoadError", () => {
  it("reconnaît un module dynamique injoignable", () => {
    expect(isChunkLoadError(CHROME_FETCH)).toBe(true);
    expect(isChunkLoadError(FIREFOX_FETCH)).toBe(true);
    expect(isChunkLoadError(SAFARI_IMPORT)).toBe(true);
  });

  it("reconnaît le HTML de l'application servi à la place du script", () => {
    // La réécriture du hosting répond 200 et text/html pour un chunk disparu :
    // le chargement réussit, c'est le type MIME qui est refusé.
    expect(isChunkLoadError(SAFARI_MIME)).toBe(true);
    expect(isChunkLoadError(CHROME_MIME)).toBe(true);
    expect(isChunkLoadError(FIREFOX_MIME)).toBe(true);
  });

  it("laisse passer les erreurs qui n'ont rien à voir", () => {
    expect(isChunkLoadError("TypeError: undefined is not a function")).toBe(false);
    expect(isChunkLoadError("Firebase: Error (auth/network-request-failed).")).toBe(false);
    expect(isChunkLoadError("Script error.")).toBe(false);
    expect(isChunkLoadError("")).toBe(false);
  });
});

describe("chunkNameFrom", () => {
  it("prend le nom du fichier quand le message porte son adresse", () => {
    expect(chunkNameFrom(CHROME_FETCH)).toBe("DetailSession-B1x2y3z4.js");
    expect(chunkNameFrom(FIREFOX_MIME)).toBe("DetailSession-B1x2y3z4.js");
  });

  it("renvoie null quand le message n'en cite aucune", () => {
    expect(chunkNameFrom(SAFARI_MIME)).toBeNull();
    expect(chunkNameFrom(SAFARI_IMPORT)).toBeNull();
  });
});
