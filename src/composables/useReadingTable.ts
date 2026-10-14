import { computed, ref, shallowRef } from "vue";
import type { Router } from "vue-router";
import { markReadingEntry } from "../services/readingEntry";

/**
 * La table d'étude : les textes qu'on a mis de côté pour y revenir, comme
 * des livres restés ouverts sur la table pendant qu'on en consulte un autre.
 *
 * On lit un texte, on le met de côté : il rejoint la barre du bas
 * (ReadingTableBar) et l'on retrouve la bibliothèque pour en chercher un
 * autre. Chaque texte posé garde l'endroit exact où on l'a laissé (le verset
 * en haut de l'écran, à sa hauteur dans la fenêtre) ; le rouvrir depuis la
 * table y ramène, au pixel près, et le texte qu'on quitte, s'il est lui
 * aussi sur la table, retient d'abord sa propre page.
 *
 * L'état vit ici, hors des composants : la barre, le panneau de la table, le
 * lecteur et le routeur (qui ne remet pas en haut un texte qu'on rouvre) le
 * partagent. Rien d'autre que Vue n'est importé : la barre est montée sur
 * toutes les pages et ce module fait partie du chargement initial.
 *
 * Sur l'appareil seulement (localStorage) : la table est celle d'une séance
 * d'étude, elle survit à un rechargement ou à une app refermée, mais ne
 * suit pas le compte d'un appareil à l'autre.
 */

/** Un texte posé sur la table. */
export interface TableText {
  /** Le livre : l'identifiant du texte au catalogue. Un texte n'y est qu'une fois. */
  key: string;
  /** Où le rouvrir : le chemin canonique du chapitre lu, sans query. */
  path: string;
  /** Le nom du texte (« Berechit », « Tehilim 23 »). */
  title: string;
  /** Le chapitre lu (« Chapitre 4 »), vide pour un texte d'une seule page. */
  place: string;
  /** Le rayon (`tehilim`, `talmud`...) : la teinte de sa reliure. */
  corpus: string;
  /** Le verset en haut de l'écran quand on l'a quitté, null sans versets repérés. */
  line: number | null;
  /** La hauteur de ce verset dans la fenêtre, en pixels. */
  offset: number;
  /**
   * Le défilement, compté depuis le haut du texte : le repli d'un texte sans
   * versets repérés (Guemara).
   */
  scrollY: number;
  /** Dernière mise à jour, en ms epoch. */
  at: number;
}

/** Ce que le lecteur ouvert sait dire de lui-même (voir registerTableReader). */
export interface TableReader {
  key: string;
  /**
   * L'état du texte à l'écran, à poser sur la table. `refresh` : pour
   * mettre à jour un texte déjà posé, ce qui ne vaut que pendant la lecture
   * (null sur la liste des chapitres, qui effacerait le chapitre retenu).
   */
  snapshot: (refresh?: boolean) => TableText | null;
}

const STORAGE_KEY = "pj-reading-table";
/**
 * Au-delà, le plus ancien posé quitte la table. Assez pour toute une séance
 * d'étude ; la borne ne sert qu'à garder le stockage raisonnable.
 */
export const MAX_TABLE_TEXTS = 24;

function isTableText(value: unknown): value is TableText {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.key === "string" &&
    typeof t.path === "string" &&
    t.path.startsWith("/") &&
    typeof t.title === "string" &&
    (t.line === null || typeof t.line === "number") &&
    typeof t.scrollY === "number"
  );
}

function load(): TableText[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { texts?: unknown };
    if (!Array.isArray(parsed.texts)) return [];
    // Un champ ajouté plus tard manque aux textes posés avant lui : on le
    // complète plutôt que de jeter le texte.
    return parsed.texts.filter(isTableText).map((t) => ({
      ...t,
      place: typeof t.place === "string" ? t.place : "",
      corpus: typeof t.corpus === "string" ? t.corpus : "",
      offset: typeof t.offset === "number" ? t.offset : 0,
      at: typeof t.at === "number" ? t.at : 0,
    }));
  } catch {
    return [];
  }
}

function save(texts: TableText[]): void {
  try {
    if (texts.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, texts }));
  } catch {
    // Stockage plein ou refusé (navigation privée) : la table vit le temps
    // de la visite, rien ne casse.
  }
}

// Chaque changement s'écrit aussitôt (voir save), sans attendre le tick
// suivant : une app refermée juste après avoir posé un texte le garde.
const texts = ref<TableText[]>(load());

/** Le panneau de la table, ouvert au-dessus de la page. */
const sheetOpen = ref(false);

/** Le lecteur à l'écran, s'il y en a un (voir registerTableReader). */
const reader = shallowRef<TableReader | null>(null);

/** Le texte à replacer à son endroit dès qu'il est rendu. */
let pendingRestore: TableText | null = null;

/**
 * Le dernier texte posé, pour l'animation qui le réduit dans la barre :
 * d'où il part (le cadre de la page) et ce qu'il porte.
 */
export interface TableFlight {
  key: string;
  title: string;
  corpus: string;
  from: { top: number; left: number; width: number; height: number };
}
const flight = shallowRef<TableFlight | null>(null);

function indexOf(key: string): number {
  return texts.value.findIndex((t) => t.key === key);
}

/**
 * Pose un texte sur la table, ou met à jour sa page s'il y est déjà (il
 * garde alors sa place). Un nouveau texte se pose au bout, de l'autre côté
 * des précédents.
 */
export function placeOnTable(text: TableText): void {
  const index = indexOf(text.key);
  if (index !== -1) {
    texts.value.splice(index, 1, text);
  } else {
    texts.value.push(text);
    if (texts.value.length > MAX_TABLE_TEXTS)
      texts.value.splice(0, texts.value.length - MAX_TABLE_TEXTS);
  }
  save(texts.value);
}

/** Met à jour la page d'un texte déjà sur la table ; sans effet sinon. */
export function refreshOnTable(text: TableText | null): void {
  if (text && indexOf(text.key) !== -1) placeOnTable(text);
}

export function removeFromTable(key: string): void {
  const index = indexOf(key);
  if (index !== -1) texts.value.splice(index, 1);
  save(texts.value);
  if (texts.value.length === 0) sheetOpen.value = false;
}

export function clearTable(): void {
  texts.value = [];
  save(texts.value);
  sheetOpen.value = false;
}

export function isOnTable(key: string): boolean {
  return indexOf(key) !== -1;
}

/**
 * Le lecteur s'inscrit tant qu'un texte est à l'écran : le panneau sait
 * alors lequel est ouvert, et peut le poser à son tour. Renvoie le retrait.
 */
export function registerTableReader(entry: TableReader): () => void {
  reader.value = entry;
  return () => {
    if (reader.value === entry) reader.value = null;
  };
}

/** Le lecteur ouvert retient sa page, s'il est sur la table. */
export function refreshOpenReader(): void {
  const current = reader.value;
  if (current && isOnTable(current.key)) refreshOnTable(current.snapshot(true));
}

/**
 * Met de côté le texte ouvert : il rejoint la table (ou y retient sa page)
 * et s'envole vers la barre depuis `from`, le cadre de la page.
 */
export function setAside(text: TableText, from: TableFlight["from"] | null): void {
  placeOnTable(text);
  flight.value = from ? { key: text.key, title: text.title, corpus: text.corpus, from } : null;
}

export function endFlight(): void {
  flight.value = null;
}

/**
 * Rouvre un texte de la table, à l'endroit où on l'a laissé. Le texte
 * qu'on quitte retient d'abord sa page s'il est lui aussi sur la table.
 * Le routeur ne le remet pas en haut (hasTableRestore), le lecteur le
 * replace une fois rendu (takeTableRestore).
 */
export function openFromTable(key: string, router: Router): void {
  refreshOpenReader();
  const text = texts.value.find((t) => t.key === key);
  sheetOpen.value = false;
  if (!text) return;
  // Le texte déjà sous les yeux, à la page qu'il vient de retenir : rien à rouvrir.
  if (reader.value?.key === key && router.currentRoute.value.path === text.path) return;
  pendingRestore = { ...text };
  markReadingEntry("table");
  void router.push(text.path);
}

/** Vrai si `path` est un texte de la table qui attend d'être replacé. */
export function hasTableRestore(path: string): boolean {
  return pendingRestore !== null && pendingRestore.path === path;
}

/** Le texte à replacer sur `path`, une seule fois ; null s'il n'y en a pas. */
export function takeTableRestore(path: string): TableText | null {
  if (!pendingRestore || pendingRestore.path !== path) return null;
  const text = pendingRestore;
  pendingRestore = null;
  return text;
}

export function openTableSheet(): void {
  if (texts.value.length === 0) return;
  // Le texte à l'écran retient sa page : le panneau le montre où il en est.
  refreshOpenReader();
  sheetOpen.value = true;
}

export function closeTableSheet(): void {
  sheetOpen.value = false;
}

/** La barre du bas est là dès qu'un texte est posé (voir useBottomChrome). */
export const tableBarVisible = computed(() => texts.value.length > 0);

export function useReadingTable() {
  return {
    texts,
    sheetOpen,
    flight,
    /** L'identifiant du texte à l'écran, s'il y en a un. */
    openKey: computed(() => reader.value?.key ?? null),
    /** Le lecteur ouvert, pour qu'on puisse le poser depuis le panneau. */
    reader,
  };
}

/** Pour les tests : vide la table et oublie ce qui attend. */
export function resetReadingTableForTests(): void {
  texts.value = load();
  sheetOpen.value = false;
  reader.value = null;
  pendingRestore = null;
  flight.value = null;
}
