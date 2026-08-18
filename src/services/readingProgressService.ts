import { authService, type User } from "./authService";
import { userPreferencesService } from "./userPreferencesService";

/**
 * Reprise de lecture et marque-pages.
 *
 * Toujours en localStorage (la bibliothèque est publique, la majorité des
 * lecteurs n'ont pas de compte), et synchronisé dans userPreferences pour les
 * connectés (reprise sur un autre appareil). En cas de conflit, la position la
 * plus récente gagne ; les marque-pages sont fusionnés par id.
 */

/** Dernière position de lecture dans un texte. */
export interface ReadingPosition {
  /** Id catalogue (textStudies.json), en string. */
  textId: string;
  /** Index de section (chapitre) pour les textes multi-sections, sinon null. */
  section: number | null;
  /** Index (base 0) de la ligne/verset dans la section. */
  line: number;
  /** Chemin canonique de lecture (/bibliotheque/…), sans query. */
  path: string;
  /** Libellé d'affichage ("Noah", "Shir Hashirim · Chapitre 2 (ב)"). */
  label: string;
  /** Epoch ms de la dernière mise à jour. */
  at: number;
}

/**
 * Espace des marque-pages : ceux posés dans la bibliothèque et ceux posés
 * dans la lecture quotidienne vivent séparément (même verset marquable des
 * deux côtés, listes indépendantes).
 */
export type BookmarkScope = "library" | "daily";

/** Marque-page posé par le lecteur sur un verset. */
export interface Bookmark {
  /** Un seul marque-page par verset et par espace (préfixe `daily:` pour la lecture quotidienne). */
  id: string;
  textId: string;
  section: number | null;
  line: number;
  path: string;
  label: string;
  at: number;
  /** Absent sur les marque-pages historiques : ils sont de la bibliothèque. */
  scope?: BookmarkScope;
}

/**
 * Textes liturgiques (Sli'hot, Brahot) : pas de « reprendre là où vous
 * étiez ». Le lecteur n'enregistre plus leurs positions, et celles héritées
 * d'une version antérieure (localStorage ou compte) sont purgées à la
 * lecture — reconnues à leur chemin, pour ne pas embarquer le catalogue ici.
 */
const LITURGY_PATH = /^\/bibliotheque\/(?:slihot|brahot)\//;

const POSITIONS_KEY = "pj-reading-positions";
const BOOKMARKS_KEY = "pj-bookmarks";
const TOMBSTONES_KEY = "pj-bookmark-tombstones";
const MAX_POSITIONS = 50;
const MAX_BOOKMARKS = 200;
const MAX_TOMBSTONES = 300;
/** Délai avant d'envoyer les positions au cloud (regroupe les scrolls). */
const CLOUD_SAVE_DELAY_MS = 8000;

export function bookmarkId(
  textId: string,
  section: number | null,
  line: number,
  scope: BookmarkScope = "library",
): string {
  const base = `${textId}#${section ?? 0}#${line}`;
  return scope === "daily" ? `daily:${base}` : base;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage plein ou indisponible : la lecture reste possible sans reprise.
  }
}

/**
 * Sérialisation canonique (clés d'objets triées) pour comparer l'état local à
 * l'état cloud : Firestore renvoie les maps triées alphabétiquement alors que
 * les positions locales sont rangées par récence — un JSON.stringify naïf les
 * verrait toujours différentes et pousserait une écriture à chaque lancement.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );
}

/** Les marque-pages, dans un ordre stable pour la comparaison ci-dessus. */
function sortedById(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => a.id.localeCompare(b.id));
}

/** Garde les tombstones les plus récentes (l'inventaire ne grossit pas sans fin). */
function pruneTombstones(tombstones: Record<string, number>): Record<string, number> {
  const entries = Object.entries(tombstones)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_TOMBSTONES);
  return Object.fromEntries(entries);
}

class ReadingProgressService {
  private user: User | null = null;
  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private syncPromise: Promise<void> | null = null;
  private authStarted = false;

  /**
   * Démarre l'écoute d'authentification (une fois) et, à la connexion,
   * fusionne l'état local avec celui du compte. À attendre avant de lire une
   * position quand la fraîcheur inter-appareils compte.
   */
  ensureSynced(): Promise<void> {
    if (!this.authStarted) {
      this.authStarted = true;
      this.syncPromise = new Promise((resolveFirst) => {
        let first = true;
        authService.onAuthChanged((user) => {
          this.user = user;
          const done = user ? this.syncWithCloud(user.id).catch(() => {}) : Promise.resolve();
          if (first) {
            first = false;
            void done.finally(() => resolveFirst());
          }
        });
      });
    }
    return this.syncPromise ?? Promise.resolve();
  }

  // ---- Positions ----

  private positions(): Record<string, ReadingPosition> {
    const byText = readJson<Record<string, ReadingPosition>>(POSITIONS_KEY, {});
    // Purge des positions liturgiques héritées : la prochaine écriture cloud
    // (savePosition/toggleBookmark) emporte aussi ce nettoyage côté compte.
    let changed = false;
    for (const [textId, position] of Object.entries(byText)) {
      if (LITURGY_PATH.test(position.path)) {
        delete byText[textId];
        changed = true;
      }
    }
    if (changed) writeJson(POSITIONS_KEY, byText);
    return byText;
  }

  /** Dernière position enregistrée pour un texte, sinon null. */
  getPosition(textId: string): ReadingPosition | null {
    return this.positions()[textId] ?? null;
  }

  /** Dernière position tous textes confondus (CTA « Reprendre ma lecture »). */
  getLastPosition(): ReadingPosition | null {
    const all = Object.values(this.positions());
    if (all.length === 0) return null;
    return all.reduce((a, b) => (b.at > a.at ? b : a));
  }

  savePosition(position: Omit<ReadingPosition, "at">): void {
    const byText = this.positions();
    byText[position.textId] = { ...position, at: Date.now() };
    // Cap : on garde les lectures les plus récentes.
    const entries = Object.values(byText)
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_POSITIONS);
    writeJson(
      POSITIONS_KEY,
      Object.fromEntries(entries.map((p) => [p.textId, p])),
    );
    this.scheduleCloudSave();
  }

  /** Oublie la position d'un texte (bouton « Ignorer » de la bannière). */
  clearPosition(textId: string): void {
    const byText = this.positions();
    if (!(textId in byText)) return;
    delete byText[textId];
    writeJson(POSITIONS_KEY, byText);
    this.scheduleCloudSave();
  }

  // ---- Marque-pages ----

  private bookmarksAll(): Bookmark[] {
    return readJson<Bookmark[]>(BOOKMARKS_KEY, []);
  }

  getBookmarks(textId: string, scope: BookmarkScope = "library"): Bookmark[] {
    return this.bookmarksAll()
      .filter((b) => b.textId === textId && (b.scope ?? "library") === scope)
      .sort((a, b) => (a.section ?? 0) - (b.section ?? 0) || a.line - b.line);
  }

  /** Nombre de marque-pages par texte (badges de la bibliothèque). */
  getBookmarkCounts(scope: BookmarkScope = "library"): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const b of this.bookmarksAll()) {
      if ((b.scope ?? "library") !== scope) continue;
      counts[b.textId] = (counts[b.textId] ?? 0) + 1;
    }
    return counts;
  }

  /** Marque-pages supprimés (id → date), pour que la fusion ne les ressuscite pas. */
  private tombstones(): Record<string, number> {
    return readJson<Record<string, number>>(TOMBSTONES_KEY, {});
  }

  /** Ajoute ou retire le marque-page du verset. Renvoie l'état final. */
  toggleBookmark(bookmark: Omit<Bookmark, "id" | "at">): boolean {
    const id = bookmarkId(
      bookmark.textId,
      bookmark.section,
      bookmark.line,
      bookmark.scope ?? "library",
    );
    let all = this.bookmarksAll();
    const exists = all.some((b) => b.id === id);
    if (exists) {
      all = all.filter((b) => b.id !== id);
      writeJson(TOMBSTONES_KEY, pruneTombstones({ ...this.tombstones(), [id]: Date.now() }));
    } else {
      all = [...all, { ...bookmark, id, at: Date.now() }]
        .sort((a, b) => b.at - a.at)
        .slice(0, MAX_BOOKMARKS);
    }
    writeJson(BOOKMARKS_KEY, all);
    void this.pushToCloud();
    return !exists;
  }

  // ---- Synchronisation cloud ----

  private scheduleCloudSave(): void {
    if (!this.user) return;
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = setTimeout(() => void this.pushToCloud(), CLOUD_SAVE_DELAY_MS);
  }

  private async pushToCloud(): Promise<void> {
    if (!this.user) return;
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = null;
    }
    try {
      await userPreferencesService.savePreferences(this.user.id, {
        readingPositions: this.positions(),
        bookmarks: this.bookmarksAll(),
        deletedBookmarks: this.tombstones(),
      });
    } catch {
      // Hors-ligne ou refus : l'état local reste la référence, on réessaiera
      // à la prochaine écriture.
    }
  }

  /** Fusionne local ↔ cloud (position la plus récente par texte, union des marque-pages). */
  private async syncWithCloud(userId: string): Promise<void> {
    const prefs = await userPreferencesService.getPreferences(userId);
    const local = this.positions();
    const cloud = prefs.readingPositions ?? {};
    const merged: Record<string, ReadingPosition> = { ...cloud };
    for (const [textId, position] of Object.entries(local)) {
      if (!merged[textId] || position.at > merged[textId].at) merged[textId] = position;
    }
    const mergedList = Object.values(merged)
      // Le cloud peut encore porter des positions liturgiques : filtrées ici,
      // la comparaison ci-dessous verra la différence et poussera la purge.
      .filter((p) => !LITURGY_PATH.test(p.path))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_POSITIONS);
    writeJson(
      POSITIONS_KEY,
      Object.fromEntries(mergedList.map((p) => [p.textId, p])),
    );

    // Tombstones : union (la suppression la plus récente par id gagne), pour
    // qu'un marque-page supprimé sur un appareil ne soit pas ressuscité par un
    // autre resté avec l'ancienne liste. Un re-ajout postérieur (b.at plus
    // récent que la tombstone) reprend le dessus.
    const cloudTombstones = prefs.deletedBookmarks ?? {};
    const tombstones: Record<string, number> = { ...cloudTombstones };
    for (const [id, at] of Object.entries(this.tombstones())) {
      if (!tombstones[id] || at > tombstones[id]) tombstones[id] = at;
    }
    const prunedTombstones = pruneTombstones(tombstones);
    writeJson(TOMBSTONES_KEY, prunedTombstones);

    const byId = new Map<string, Bookmark>();
    for (const b of [...(prefs.bookmarks ?? []), ...this.bookmarksAll()]) {
      const deletedAt = prunedTombstones[b.id];
      if (deletedAt !== undefined && deletedAt >= b.at) continue;
      const existing = byId.get(b.id);
      if (!existing || b.at > existing.at) byId.set(b.id, b);
    }
    const mergedBookmarks = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, MAX_BOOKMARKS);
    writeJson(BOOKMARKS_KEY, mergedBookmarks);

    // N'écrit au cloud que si la fusion apporte quelque chose de local
    // (comparaison canonique : l'ordre des clés/éléments ne compte pas).
    const cloudState = stableStringify([cloud, sortedById(prefs.bookmarks ?? []), cloudTombstones]);
    const mergedState = stableStringify([
      this.positions(),
      sortedById(this.bookmarksAll()),
      prunedTombstones,
    ]);
    if (cloudState !== mergedState) await this.pushToCloud();
  }
}

export const readingProgressService = new ReadingProgressService();
