import { ref } from "vue";
import { i18n } from "../i18n";
import { ModerationError } from "../services/moderationService";
import { AppError } from "../services/appError";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// État module-level : une seule liste de toasts pour toute l'app,
// affichée par ToastContainer monté dans App.vue.
const toasts = ref<Toast[]>([]);
let nextId = 0;

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 5000,
  error: 6000,
};

function show(message: string, type: ToastType, duration = DEFAULT_DURATIONS[type]): number {
  const id = ++nextId;
  toasts.value.push({ id, message, type });
  window.setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id: number): void {
  const index = toasts.value.findIndex((toast) => toast.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
}

/** Code d'erreur Firebase/Firestore ("permission-denied", "unavailable"…) s'il existe. */
function firebaseErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

export function useToast() {
  const success = (message: string) => show(message, "success");
  const error = (message: string) => show(message, "error");
  const info = (message: string) => show(message, "info");

  /**
   * Toast d'erreur adapté à l'exception : une erreur métier (AppError) a son
   * message traduit sous `errors.<code>`, un code Firestore de droits
   * manquants ou de service indisponible a le sien, sinon `fallbackMessage`.
   */
  const errorFromException = (err: unknown, fallbackMessage: string) => {
    // Terme interdit détecté par la modération : le message dit QUEL terme
    // pose problème, bien plus actionnable que le message générique.
    if (err instanceof ModerationError) {
      return error(err.message);
    }
    if (err instanceof AppError) {
      const key = `errors.${err.code}`;
      return error(i18n.global.te(key) ? i18n.global.t(key) : fallbackMessage);
    }
    const code = firebaseErrorCode(err);
    if (code === "permission-denied") {
      return error(i18n.global.t("errors.permissionDenied"));
    }
    if (code === "unavailable" || code === "deadline-exceeded") {
      return error(i18n.global.t("errors.unavailable"));
    }
    return error(fallbackMessage);
  };

  return { toasts, success, error, info, errorFromException, dismiss };
}
