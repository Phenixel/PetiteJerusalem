import { computed, ref } from "vue";
import { isNativeApp } from "./useNativeApp";
import { homeHighlights, type Announcement } from "../services/announcements";
import { isOutdated } from "../services/appUpdateService";

/**
 * L'état partagé des informations de l'équipe : la liste, ce qui est nouveau
 * pour cet appareil, et ce que l'accueil met en avant.
 *
 * « Nouveau » se compte depuis la dernière visite de la liste, gardée sur
 * l'appareil : il n'y a pas besoin de compte pour savoir ce qu'on a déjà vu,
 * et un invité est prévenu comme un inscrit.
 */

const SEEN_KEY = "pj_announcements_seen";
/** La version de l'app installée lors de la dernière visite de la liste. */
const SEEN_VERSION_KEY = "pj_announcements_seen_version";
/** Les réponses de l'appareil aux sondages : { [id d'information]: choix }. */
const POLL_VOTES_KEY = "pj_poll_votes";
/** L'identifiant tiré au hasard sous lequel l'appareil vote. */
const POLL_VOTER_KEY = "pj_poll_voter";

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function readVotes(): Record<string, string[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(POLL_VOTES_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && entry[1].every((c) => typeof c === "string"),
      ),
    );
  } catch {
    return {};
  }
}

/**
 * L'identifiant de vote de l'appareil, créé au premier vote. Sans stockage,
 * un identifiant neuf à chaque vote : le vote compte, il ne se remplace pas.
 */
function voterId(): string {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  try {
    const known = localStorage.getItem(POLL_VOTER_KEY);
    if (known && /^[\w-]{8,64}$/.test(known)) return known;
    const id = fresh();
    localStorage.setItem(POLL_VOTER_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

const items = ref<Announcement[]>([]);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
const seenAt = ref<number | null>(readSeen());
const seenVersion = ref<string | null>(readSeenVersion());
/** Version de l'app installée (notes de version), nulle sur le site. */
const installed = ref<string | null>(null);
/** Ce que l'appareil a répondu aux sondages. */
const votes = ref<Record<string, string[]>>(readVotes());
const answered = computed(() => new Set(Object.keys(votes.value)));

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

/**
 * La liste a été vue : plus rien n'est nouveau jusqu'à la prochaine annonce,
 * ou jusqu'à l'installation d'une version dont la note attendait (voir
 * unreadAnnouncements).
 */
function markAllSeen(): void {
  saveSeen(items.value.reduce((max, a) => Math.max(max, a.publishedAt?.getTime() ?? 0), 0));
  if (installed.value) saveSeenVersion(installed.value);
}

function saveSeenVersion(version: string): void {
  if (version === seenVersion.value) return;
  seenVersion.value = version;
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch {
    // Stockage indisponible : la note reviendra, rien de plus grave.
  }
}

/**
 * Une annonce ouverte seule (depuis une notification, l'accueil) : elle et
 * les plus anciennes ne sont plus nouvelles. Un seul repère par appareil,
 * c'est le prix de la simplicité ; les plus anciennes ont eu leur tour.
 *
 * Une note de version lue avec sa version installée avance aussi le repère
 * de version : la date seule ne suffit plus à l'éteindre (voir
 * unreadAnnouncements), elle resterait « Nouveau » jusqu'à la prochaine
 * visite de la liste. Lue avant l'installation, elle reviendra, comme une
 * note vue dans la liste.
 */
async function markSeenUpTo(a: Announcement): Promise<void> {
  if (a.publishedAt) saveSeen(a.publishedAt.getTime());
  if (a.kind !== "release" || !a.version) return;
  // Ouverte depuis une notification, la page arrive avant la liste : la
  // version installée n'a pas encore été lue.
  if (installed.value === null) installed.value = await readInstalledVersion();
  if (!installed.value || isOutdated(installed.value, a.version)) return;
  if (seenVersion.value && isOutdated(seenVersion.value, a.version)) saveSeenVersion(a.version);
}

/**
 * Vote à un sondage, ou change son vote : un seul vote par appareil, le
 * dernier compte. Retenu sur l'appareil une fois accepté par le serveur ; le
 * sondage quitte alors l'accueil.
 */
async function answerPoll(a: Announcement, choices: string[]): Promise<void> {
  const { submitPollVote } = await import("../services/announcementService");
  await submitPollVote(a.id, voterId(), choices);
  votes.value = { ...votes.value, [a.id]: choices };
  try {
    localStorage.setItem(POLL_VOTES_KEY, JSON.stringify(votes.value));
  } catch {
    // Stockage indisponible : le vote est compté, l'appareil l'oubliera.
  }
}

export function useAnnouncements() {
  const highlights = computed(() =>
    homeHighlights(
      items.value,
      seenAt.value,
      installed.value,
      Date.now(),
      seenVersion.value,
      answered.value,
    ),
  );
  return {
    items,
    status,
    seenAt,
    seenVersion,
    installed,
    votes,
    highlights,
    load,
    markAllSeen,
    markSeenUpTo,
    answerPoll,
  };
}
