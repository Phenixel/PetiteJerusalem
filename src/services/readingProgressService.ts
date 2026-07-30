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

/** Marque-page posé par le lecteur sur un verset. */
export interface Bookmark {
  /** `${textId}#${section ?? 0}#${line}` : un seul marque-page par verset. */
  id: string;
  textId: string;
  section: number | null;
  line: number;
  path: string;
  label: string;
  at: number;
}

const POSITIONS_KEY = "pj-reading-positions";
const BOOKMARKS_KEY = "pj-bookmarks";
const MAX_POSITIONS = 50;
const MAX_BOOKMARKS = 200;
/** Délai avant d'envoyer les positions au cloud (regroupe les scrolls). */
const CLOUD_SAVE_DELAY_MS = 8000;

export function bookmarkId(textId: string, section: number | null, line: number): string {
  return `${textId}#${section ?? 0}#${line}`;
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
    return readJson<Record<string, ReadingPosition>>(POSITIONS_KEY, {});
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

  getBookmarks(textId: string): Bookmark[] {
    return this.bookmarksAll()
      .filter((b) => b.textId === textId)
      .sort((a, b) => (a.section ?? 0) - (b.section ?? 0) || a.line - b.line);
  }

  isBookmarked(textId: string, section: number | null, line: number): boolean {
    const id = bookmarkId(textId, section, line);
    return this.bookmarksAll().some((b) => b.id === id);
  }

  /** Ajoute ou retire le marque-page du verset. Renvoie l'état final. */
  toggleBookmark(bookmark: Omit<Bookmark, "id" | "at">): boolean {
    const id = bookmarkId(bookmark.textId, bookmark.section, bookmark.line);
    let all = this.bookmarksAll();
    const exists = all.some((b) => b.id === id);
    if (exists) {
      all = all.filter((b) => b.id !== id);
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
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_POSITIONS);
    writeJson(
      POSITIONS_KEY,
      Object.fromEntries(mergedList.map((p) => [p.textId, p])),
    );

    const byId = new Map<string, Bookmark>();
    for (const b of [...(prefs.bookmarks ?? []), ...this.bookmarksAll()]) byId.set(b.id, b);
    const mergedBookmarks = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, MAX_BOOKMARKS);
    writeJson(BOOKMARKS_KEY, mergedBookmarks);

    // N'écrit au cloud que si la fusion apporte quelque chose de local.
    const cloudState = JSON.stringify([cloud, prefs.bookmarks ?? []]);
    const mergedState = JSON.stringify([this.positions(), this.bookmarksAll()]);
    if (cloudState !== mergedState) await this.pushToCloud();
  }
}

export const readingProgressService = new ReadingProgressService();
