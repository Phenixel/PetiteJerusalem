import { computed, ref } from "vue";
import { isNativeApp } from "./useNativeApp";
import { homeHighlights, type Announcement } from "../services/announcements";

/**
 * L'état partagé des informations de l'équipe : la liste, ce qui est nouveau
 * pour cet appareil, et ce que l'accueil met en avant.
 *
 * « Nouveau » se compte depuis la dernière visite de la liste, gardée sur
 * l'appareil : il n'y a pas besoin de compte pour savoir ce qu'on a déjà vu,
 * et un invité est prévenu comme un inscrit.
 */

const SEEN_KEY = "pj_announcements_seen";

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

const items = ref<Announcement[]>([]);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
const seenAt = ref<number | null>(readSeen());
/** Version de l'app installée (notes de version), nulle sur le site. */
const installed = ref<string | null>(null);

let loading: Promise<void> | null = null;

async function readInstalledVersion(): Promise<string | null> {
  if (!isNativeApp) return null;
  try {
    const { App } = await import("@capacitor/app");
    return (await App.getInfo()).version;
  } catch {
    return null;
  }
}

/**
 * Charge la liste (Firestore arrive avec, à la demande). `force` repart du
 * serveur, pour le tirer-pour-rafraîchir et le retour sur la page.
 */
function load(force = false): Promise<void> {
  if (loading) return loading;
  if (status.value === "loading") return Promise.resolve();
  if (status.value !== "ready") status.value = "loading";
  loading = (async () => {
    try {
      const [{ announcementService }, version] = await Promise.all([
        import("../services/announcementService"),
        installed.value === null ? readInstalledVersion() : Promise.resolve(installed.value),
      ]);
      installed.value = version;
      if (force) announcementService.invalidate();
      items.value = await announcementService.getAll();
      status.value = "ready";
    } catch (error) {
      console.warn("Informations indisponibles:", error);
      // Une liste déjà affichée le reste : hors ligne, mieux vaut l'ancienne.
      if (status.value !== "ready") status.value = "error";
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function saveSeen(time: number): void {
  if (seenAt.value !== null && time <= seenAt.value) return;
  seenAt.value = time;
  try {
    localStorage.setItem(SEEN_KEY, String(time));
  } catch {
    // Stockage indisponible : le compteur reviendra, rien de plus grave.
  }
}

/** La liste a été vue : plus rien n'est nouveau jusqu'à la prochaine annonce. */
function markAllSeen(): void {
  saveSeen(items.value.reduce((max, a) => Math.max(max, a.publishedAt?.getTime() ?? 0), 0));
}

/**
 * Une annonce ouverte seule (depuis une notification, l'accueil) : elle et
 * les plus anciennes ne sont plus nouvelles. Un seul repère par appareil,
 * c'est le prix de la simplicité ; les plus anciennes ont eu leur tour.
 */
function markSeenUpTo(date: Date | null): void {
  if (date) saveSeen(date.getTime());
}

export function useAnnouncements() {
  const highlights = computed(() => homeHighlights(items.value, seenAt.value, installed.value));
  return {
    items,
    status,
    seenAt,
    highlights,
    load,
    markAllSeen,
    markSeenUpTo,
  };
}
