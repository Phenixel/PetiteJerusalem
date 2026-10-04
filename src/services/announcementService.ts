import type { DocumentData } from "firebase/firestore";
import type { Firestore } from "firebase/firestore/lite";
import { isNativeApp } from "../composables/useNativeApp";
import { cached } from "./cached";
import {
  ANNOUNCEMENT_KINDS,
  type Announcement,
  type AnnouncementKind,
  type LocalizedText,
} from "./announcements";

/**
 * Lecture des informations de l'équipe (voir services/announcements.ts).
 * Chargé à la demande : il tire Firestore, que l'accueil n'importe pas.
 */

type FirestoreApi = typeof import("firebase/firestore/lite");

/**
 * Le Firestore de lecture. Sur le site, Firestore Lite (voir
 * ../firebase/firestoreLite) : l'accueil d'un visiteur n'a besoin du SDK
 * complet que pour ces informations. Dans l'app native, le SDK complet, dont
 * le cache garde les informations lisibles hors ligne. Les deux exposent les
 * mêmes fonctions de lecture sous les mêmes noms.
 */
async function firestore(): Promise<{ fs: FirestoreApi; db: Firestore }> {
  if (isNativeApp) {
    const [fs, { db }] = await Promise.all([
      import("firebase/firestore"),
      import("../firebase/firestore"),
    ]);
    return { fs: fs as unknown as FirestoreApi, db: db as unknown as Firestore };
  }
  const [fs, { liteDb }] = await Promise.all([
    import("firebase/firestore/lite"),
    import("../firebase/firestoreLite"),
  ]);
  return { fs, db: liteDb };
}

/** Relue au plus toutes les dix minutes : une annonce doit se voir vite. */
const CACHE_TTL = 10 * 60 * 1000;

/** Assez pour des années d'annonces à la cadence d'une petite équipe. */
const LIST_LIMIT = 100;

function toDate(value: unknown): Date | null {
  const maybe = value as { toDate?: () => Date } | null | undefined;
  return typeof maybe?.toDate === "function" ? maybe.toDate() : null;
}

function toText(value: unknown): LocalizedText {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const text: LocalizedText = { fr: typeof raw.fr === "string" ? raw.fr : "" };
  if (typeof raw.en === "string" && raw.en.trim()) text.en = raw.en;
  if (typeof raw.he === "string" && raw.he.trim()) text.he = raw.he;
  return text;
}

/** Un document Firestore, lu sans rien supposer de sa forme. */
export function parseAnnouncement(id: string, data: DocumentData): Announcement {
  const kind = ANNOUNCEMENT_KINDS.includes(data.kind) ? (data.kind as AnnouncementKind) : "news";
  const link = data.link as { url?: unknown; label?: unknown } | null | undefined;
  return {
    id,
    kind,
    title: toText(data.title),
    body: toText(data.body),
    published: data.published === true,
    publishedAt: toDate(data.publishedAt),
    updatedAt: toDate(data.updatedAt),
    link:
      link && typeof link.url === "string" && link.url.trim()
        ? { url: link.url.trim(), label: toText(link.label) }
        : null,
    version: typeof data.version === "string" && data.version.trim() ? data.version.trim() : null,
    resolved: data.resolved === true,
    notify: data.notify === true,
    notifiedAt: toDate(data.notifiedAt),
  };
}

class AnnouncementService {
  // La requête filtre sur `published` : les règles refusent toute liste qui
  // pourrait contenir un brouillon (voir firestore.rules).
  private readonly list = cached(CACHE_TTL, async () => {
    const { fs, db } = await firestore();
    const snap = await fs.getDocs(
      fs.query(
        fs.collection(db, "announcements"),
        fs.where("published", "==", true),
        fs.orderBy("publishedAt", "desc"),
        fs.limit(LIST_LIMIT),
      ),
    );
    return snap.docs.map((d) => parseAnnouncement(d.id, d.data()));
  });

  /** Les annonces publiées, la plus récente d'abord. */
  getAll(): Promise<Announcement[]> {
    return this.list.get();
  }

  /** Oublie la liste : la prochaine lecture repart du serveur. */
  invalidate(): void {
    this.list.invalidate();
  }

  /**
   * Une annonce, depuis la liste si elle y est et encore fraîche, sinon lue
   * seule (lien de notification). `null` : elle n'existe pas, ou plus pour le
   * public (brouillon, retirée : les règles refusent la lecture). Une autre
   * erreur (hors ligne) remonte : l'annonce existe peut-être, la page ne doit
   * pas dire le contraire.
   */
  async get(id: string): Promise<Announcement | null> {
    const known = this.list.isStale() ? null : this.list.peek()?.find((a) => a.id === id);
    if (known) return known;
    try {
      const { fs, db } = await firestore();
      const snap = await fs.getDoc(fs.doc(db, "announcements", id));
      return snap.exists() ? parseAnnouncement(snap.id, snap.data()) : null;
    } catch (error) {
      if ((error as { code?: string }).code === "permission-denied") return null;
      throw error;
    }
  }
}

export const announcementService = new AnnouncementService();
