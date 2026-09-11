import { isNativeApp } from "../composables/useNativeApp";

/**
 * La dictée : ce qu'on dit au micro devient le terme de recherche.
 *
 * Deux moteurs, une seule façade :
 *
 * - **app native** : le plugin @capacitor-community/speech-recognition, qui
 *   parle au `SpeechRecognizer` d'Android et au `SFSpeechRecognizer` d'iOS.
 *   L'un et l'autre reconnaissent sur l'appareil quand le système a la langue
 *   installée (Android 12 et plus avec les services vocaux de Google, iOS 13
 *   et plus pour le français, l'anglais et l'hébreu) ; sinon ils passent par
 *   le réseau, et hors ligne la dictée échoue proprement (« demande une
 *   connexion »). Le choix appartient au système, pas à l'app.
 * - **site web** : l'API Web Speech du navigateur (Chrome, Edge, Safari) ;
 *   absente de Firefox, le bouton n'y paraît pas. Elle n'est pas disponible
 *   dans la webview de l'app, d'où le plugin.
 *
 * Le plugin est chargé à la demande : le site n'en embarque pas une ligne.
 *
 * Ce que la façade lisse : le web rend des résultats intermédiaires puis
 * s'arrête tout seul au silence ; Android s'arrête tout seul mais annonce la
 * fin AVANT le dernier résultat ; iOS ne s'arrête que quand on le lui demande.
 * D'où les trois minuteries ci-dessous.
 */

export type SpeechFailure = "unsupported" | "denied" | "no-speech" | "network" | "error";

export class SpeechError extends Error {
  readonly reason: SpeechFailure;
  constructor(reason: SpeechFailure, message?: string) {
    super(message ?? reason);
    this.name = "SpeechError";
    this.reason = reason;
  }
}

const LANGUAGES: Record<string, string> = { fr: "fr-FR", en: "en-US", he: "he-IL" };

/** La langue de reconnaissance qui va avec la langue de l'interface. */
export function speechLanguage(locale: string): string {
  return LANGUAGES[locale.slice(0, 2).toLowerCase()] ?? LANGUAGES.fr;
}

export interface SpeechCallbacks {
  /** Ce qui est compris jusqu'ici, à chaque mise à jour. */
  onPartial: (text: string) => void;
  /** Le texte final, une fois la dictée close. Absent si rien n'a été entendu. */
  onResult: (text: string) => void;
  /** La dictée est close, avec ou sans résultat, avec ou sans erreur. Toujours appelé, une fois. */
  onEnd: () => void;
  onError: (error: SpeechError) => void;
}

export interface SpeechSession {
  /** Clore la dictée : le texte entendu jusque-là devient le résultat. */
  stop(): void;
}

/** Silence après le dernier mot entendu au bout duquel la dictée se clôt d'elle-même. */
export const SILENCE_MS = 2500;
/** Une fois le micro fermé, le temps laissé au dernier résultat pour arriver. */
export const FINAL_GRACE_MS = 1200;
/** Sans rien entendre du tout, on n'écoute pas indéfiniment. */
export const NO_SPEECH_MS = 10_000;

// ---------------------------------------------------------------------------
// Web Speech API
// ---------------------------------------------------------------------------

/** Le peu de l'API Web Speech qu'on emploie ; TypeScript ne la déclare pas partout. */
export interface WebRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: WebRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface WebRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
export type WebRecognitionCtor = new () => WebRecognition;

/** Le constructeur du navigateur, préfixé ou non, ou null s'il n'en a pas. */
export function webRecognitionCtor(scope: unknown = globalThis): WebRecognitionCtor | null {
  const w = scope as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as WebRecognitionCtor | null;
}

/** Les codes d'erreur de l'API Web Speech ramenés aux nôtres. */
function webFailure(code: string): SpeechFailure {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "network":
      return "network";
    case "no-speech":
    case "aborted":
      return "no-speech";
    default:
      return "error";
  }
}

export function listenWeb(
  language: string,
  callbacks: SpeechCallbacks,
  ctor: WebRecognitionCtor | null = webRecognitionCtor(),
): SpeechSession {
  if (!ctor) throw new SpeechError("unsupported");
  const recognition = new ctor();
  recognition.lang = language;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let text = "";
  let failure: SpeechFailure | null = null;
  let ended = false;

  recognition.onresult = (event) => {
    text = Array.from(event.results, (result) => result[0]?.transcript ?? "")
      .join("")
      .trim();
    if (text) callbacks.onPartial(text);
  };
  recognition.onerror = (event) => {
    failure = webFailure(event.error);
  };
  // Le navigateur clôt lui-même au silence ; `onend` arrive dans tous les cas,
  // erreur comprise, c'est là que tout se décide.
  recognition.onend = () => {
    if (ended) return;
    ended = true;
    if (text) callbacks.onResult(text);
    else callbacks.onError(new SpeechError(failure ?? "no-speech"));
    callbacks.onEnd();
  };
  recognition.start();
  return { stop: () => recognition.stop() };
}

// ---------------------------------------------------------------------------
// App native (plugin Capacitor)
// ---------------------------------------------------------------------------

async function loadNativePlugin() {
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  return SpeechRecognition;
}

/** Ce que le plugin dit d'un échec au démarrage, ramené à nos raisons. */
function nativeFailure(error: unknown): SpeechError {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (/permission|denied|not authorized/.test(lower)) return new SpeechError("denied", message);
  if (/network|internet|connexion/.test(lower)) return new SpeechError("network", message);
  if (/not available|unavailable/.test(lower)) return new SpeechError("unsupported", message);
  return new SpeechError("error", message);
}

async function listenNative(language: string, callbacks: SpeechCallbacks): Promise<SpeechSession> {
  const plugin = await loadNativePlugin();
  if (!(await plugin.available()).available) throw new SpeechError("unsupported");
  const permission = await plugin.requestPermissions();
  if (permission.speechRecognition !== "granted") throw new SpeechError("denied");

  let text = "";
  let ended = false;
  let closing = false;
  let silence: ReturnType<typeof setTimeout> | undefined;
  let grace: ReturnType<typeof setTimeout> | undefined;

  const finish = (error?: SpeechError) => {
    if (ended) return;
    ended = true;
    clearTimeout(silence);
    clearTimeout(grace);
    void plugin.removeAllListeners().catch(() => {});
    if (error) callbacks.onError(error);
    else if (text) callbacks.onResult(text);
    else callbacks.onError(new SpeechError("no-speech"));
    callbacks.onEnd();
  };

  /** Le micro se ferme ; le dernier résultat a encore un délai pour arriver. */
  const close = () => {
    if (closing) return;
    closing = true;
    clearTimeout(silence);
    void plugin.stop().catch(() => {});
    clearTimeout(grace);
    grace = setTimeout(() => finish(), FINAL_GRACE_MS);
  };

  const armSilence = (delay: number) => {
    clearTimeout(silence);
    silence = setTimeout(close, delay);
  };

  await plugin.addListener("partialResults", ({ matches }) => {
    const heard = matches?.[0]?.trim() ?? "";
    if (!heard) return;
    text = heard;
    callbacks.onPartial(text);
    if (closing) {
      // Android annonce la fin de l'écoute avant son dernier résultat : celui-ci
      // vient d'arriver, il ne reste qu'à laisser passer un éventuel dernier.
      clearTimeout(grace);
      grace = setTimeout(() => finish(), 400);
    } else {
      armSilence(SILENCE_MS);
    }
  });
  await plugin.addListener("listeningState", ({ status }) => {
    if (status === "stopped") close();
  });

  // Sans un mot pendant dix secondes, on n'attend pas davantage.
  armSilence(NO_SPEECH_MS);

  try {
    const result = await plugin.start({ language, maxResults: 3, partialResults: true, popup: false });
    // Un moteur qui rend tout d'un coup plutôt qu'au fil de l'eau.
    const heard = result?.matches?.[0]?.trim();
    if (heard) {
      text = heard;
      callbacks.onPartial(text);
      finish();
    }
  } catch (error) {
    finish(nativeFailure(error));
  }

  return { stop: close };
}

// ---------------------------------------------------------------------------
// Façade
// ---------------------------------------------------------------------------

/**
 * Sans rien charger ni demander : la dictée a-t-elle une chance d'exister ?
 * Décide d'afficher ou non le bouton du micro. L'app native a le plugin (sa
 * vraie disponibilité se vérifie à l'appel, elle dépend de l'appareil) ; le
 * site dépend du navigateur.
 */
export function speechMayBeAvailable(): boolean {
  return isNativeApp || webRecognitionCtor() !== null;
}

/** Vérifie auprès du moteur, cette fois : le plugin interroge l'appareil. */
export async function isSpeechAvailable(): Promise<boolean> {
  if (!isNativeApp) return webRecognitionCtor() !== null;
  try {
    return (await (await loadNativePlugin()).available()).available;
  } catch {
    return false;
  }
}

/**
 * Ouvre le micro dans la langue donnée. Rejette avec une SpeechError si la
 * dictée ne peut pas commencer (pas de moteur, permission refusée) ; sinon
 * tout passe par les callbacks, et `onEnd` arrive toujours, une fois.
 */
export function listen(language: string, callbacks: SpeechCallbacks): Promise<SpeechSession> {
  if (isNativeApp) return listenNative(language, callbacks);
  return Promise.resolve(listenWeb(language, callbacks));
}
