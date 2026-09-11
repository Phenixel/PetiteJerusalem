import { onScopeDispose, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "./useToast";
import {
  isSpeechAvailable,
  listen,
  speechLanguage,
  SpeechError,
  type SpeechFailure,
  type SpeechSession,
} from "../services/speechRecognition";

/**
 * La dictée vue d'un champ : un état « j'écoute », un bouton qui ouvre et
 * ferme le micro, et le texte entendu qui arrive par `onText`, d'abord au fil
 * de la parole (`final` à faux) puis clos.
 *
 * La langue de reconnaissance suit celle de l'interface : on dicte en hébreu
 * dans l'app en hébreu. Les échecs se disent en toast, dans les mots de
 * l'utilisateur ; rien ne remonte au champ, qui garde ce qu'il avait.
 */

const MESSAGE_KEY: Record<SpeechFailure, string> = {
  unsupported: "search.voice.unsupported",
  denied: "search.voice.denied",
  "no-speech": "search.voice.noSpeech",
  network: "search.voice.network",
  error: "search.voice.error",
};

export function useSpeechInput(onText: (text: string, final: boolean) => void) {
  const { t, locale } = useI18n();
  const toast = useToast();

  /** Le moteur existe (bouton affiché) : vérifié une fois, en arrière-plan. */
  const supported = ref(false);
  const listening = ref(false);
  let session: SpeechSession | null = null;

  void isSpeechAvailable().then((available) => {
    supported.value = available;
  });

  function report(error: unknown) {
    const reason = error instanceof SpeechError ? error.reason : "error";
    const message = t(MESSAGE_KEY[reason]);
    if (reason === "no-speech") toast.info(message);
    else toast.error(message);
  }

  async function start(): Promise<void> {
    if (listening.value) return;
    listening.value = true;
    try {
      session = await listen(speechLanguage(locale.value), {
        onPartial: (text) => onText(text, false),
        onResult: (text) => onText(text, true),
        onError: report,
        onEnd: () => {
          listening.value = false;
          session = null;
        },
      });
    } catch (error) {
      listening.value = false;
      session = null;
      report(error);
    }
  }

  function stop(): void {
    session?.stop();
  }

  function toggle(): void {
    if (listening.value) stop();
    else void start();
  }

  onScopeDispose(stop);

  return { supported, listening, start, stop, toggle };
}
