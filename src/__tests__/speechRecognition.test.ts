import { describe, expect, it, vi } from "vitest";
import {
  listenWeb,
  SpeechError,
  speechLanguage,
  webRecognitionCtor,
  type SpeechCallbacks,
  type WebRecognition,
  type WebRecognitionResultEvent,
} from "../services/speechRecognition";

/**
 * La dictée sur le web : ce que la façade fait de l'API Web Speech du
 * navigateur, sans navigateur. Le moteur natif (plugin Capacitor) ne se
 * teste que sur un appareil.
 */

/** Un moteur de reconnaissance en carton, que le test fait parler. */
class FakeRecognition implements WebRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 5;
  onresult: ((event: WebRecognitionResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  hear(...transcripts: string[]) {
    this.onresult?.({ results: transcripts.map((transcript) => [{ transcript }]) });
  }
}

interface Log {
  partials: string[];
  results: string[];
  errors: SpeechError[];
  ends: number;
}

/** Des callbacks qui notent tout ce qu'ils reçoivent. */
function callbacks(): SpeechCallbacks & { log: Log } {
  const log: Log = { partials: [], results: [], errors: [], ends: 0 };
  return {
    log,
    onPartial: (text) => log.partials.push(text),
    onResult: (text) => log.results.push(text),
    onError: (error) => log.errors.push(error),
    onEnd: () => {
      log.ends++;
    },
  };
}

describe("langue de reconnaissance", () => {
  it("suit la langue de l'interface, le français en repli", () => {
    expect(speechLanguage("fr")).toBe("fr-FR");
    expect(speechLanguage("en")).toBe("en-US");
    expect(speechLanguage("he")).toBe("he-IL");
    expect(speechLanguage("de")).toBe("fr-FR");
  });
});

describe("dictée web", () => {
  it("trouve le constructeur du navigateur, préfixé ou non", () => {
    expect(webRecognitionCtor({})).toBeNull();
    expect(webRecognitionCtor({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
    expect(webRecognitionCtor({ SpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
  });

  it("refuse de commencer sans moteur", () => {
    expect(() => listenWeb("fr-FR", callbacks(), null)).toThrow(SpeechError);
  });

  it("règle le moteur sur la langue, écoute une phrase, et rend le texte au fil de l'eau puis clos", () => {
    const { log, ...handlers } = callbacks();
    const session = listenWeb("he-IL", handlers, FakeRecognition);
    const engine = FakeRecognition.instances.at(-1)!;
    expect(engine.lang).toBe("he-IL");
    expect(engine.interimResults).toBe(true);
    expect(engine.continuous).toBe(false);
    expect(engine.started).toBe(true);

    engine.hear("ברכ");
    engine.hear("ברכות ", "פרק");
    expect(log.partials).toEqual(["ברכ", "ברכות פרק"]);

    session.stop();
    expect(log.results).toEqual(["ברכות פרק"]);
    expect(log.errors).toEqual([]);
    expect(log.ends).toBe(1);
  });

  it("dit qu'il n'a rien entendu quand la dictée se clôt sans texte", () => {
    const { log, ...handlers } = callbacks();
    const session = listenWeb("fr-FR", handlers, FakeRecognition);
    session.stop();
    expect(log.results).toEqual([]);
    expect(log.errors.map((e) => e.reason)).toEqual(["no-speech"]);
    expect(log.ends).toBe(1);
  });

  it("traduit les erreurs du navigateur, et ne clôt qu'une fois", () => {
    const { log, ...handlers } = callbacks();
    listenWeb("fr-FR", handlers, FakeRecognition);
    const engine = FakeRecognition.instances.at(-1)!;
    engine.onerror?.({ error: "not-allowed" });
    engine.onend?.();
    engine.onend?.();
    expect(log.errors.map((e) => e.reason)).toEqual(["denied"]);
    expect(log.ends).toBe(1);
  });

  it("garde le texte entendu même si le navigateur signale une erreur ensuite", () => {
    const { log, ...handlers } = callbacks();
    listenWeb("fr-FR", handlers, FakeRecognition);
    const engine = FakeRecognition.instances.at(-1)!;
    engine.hear("Berakhot");
    engine.onerror?.({ error: "aborted" });
    engine.onend?.();
    expect(log.results).toEqual(["Berakhot"]);
    expect(log.errors).toEqual([]);
  });
});

describe("SpeechError", () => {
  it("porte sa raison", () => {
    const error = new SpeechError("network");
    expect(error.reason).toBe("network");
    expect(error.name).toBe("SpeechError");
    expect(vi.isMockFunction(error)).toBe(false);
  });
});
