/**
 * Émulateurs Firebase (Auth + Firestore) vus depuis Node : ports du projet,
 * détection, et écriture de données de démo par l'API REST, sans SDK.
 *
 * Partagé par les captures d'écran des fiches (scripts/store-screenshots.mjs)
 * et par les tests de bout en bout (e2e/), qui préparent leurs données de la
 * même façon : un compte créé dans l'émulateur Auth, des documents posés dans
 * l'émulateur Firestore avec le jeton « owner » qui court-circuite les règles.
 *
 * La plage de ports est celle de firebase.json (bloc `emulators`) et de
 * src/firebase/*.ts : à garder en phase avec les deux.
 */

export const FIRESTORE_PORT = 8470;
export const AUTH_PORT = 8471;
export const PROJECT_ID = "petite-jerusalem-dev";

const FIRESTORE_ROOT = `http://localhost:${FIRESTORE_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_ROOT = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1`;

/** Attend qu'une URL réponde (un serveur qui démarre), sinon lève. */
export async function waitFor(url, label, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${label} ne répond pas sur ${url} après ${timeoutMs / 1000}s`);
}

/** Vrai si les deux émulateurs (Auth et Firestore) répondent. */
export async function emulatorsReachable() {
  try {
    const [auth, firestore] = await Promise.all([
      fetch(`http://localhost:${AUTH_PORT}/`),
      fetch(`http://localhost:${FIRESTORE_PORT}/`),
    ]);
    return auth.ok && firestore.ok;
  } catch {
    return false;
  }
}

/** Encode une valeur JS au format REST de Firestore. */
export function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  switch (typeof value) {
    case "string":
      return { stringValue: value };
    case "boolean":
      return { booleanValue: value };
    case "number":
      return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    case "object":
      return { mapValue: { fields: toFirestoreFields(value) } };
    default:
      throw new Error(`Type non géré : ${typeof value}`);
  }
}

export function toFirestoreFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]));
}

/** Décode un document REST de Firestore en valeur JS. */
export function fromFirestoreValue(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ("mapValue" in value) return fromFirestoreFields(value.mapValue.fields ?? {});
  throw new Error(`Valeur Firestore non gérée : ${JSON.stringify(value)}`);
}

export function fromFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFirestoreValue(v)]));
}

// "Bearer owner" : jeton spécial de l'émulateur qui court-circuite les règles.
const OWNER_HEADERS = { Authorization: "Bearer owner", "Content-Type": "application/json" };

/** Crée un document (échoue s'il existe déjà). */
export async function seedDoc(path, docId, data) {
  const res = await fetch(`${FIRESTORE_ROOT}/${path}?documentId=${encodeURIComponent(docId)}`, {
    method: "POST",
    headers: OWNER_HEADERS,
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`Seed ${path}/${docId} : ${res.status} ${await res.text()}`);
}

/** Lit un document, ou null s'il n'existe pas. */
export async function readDoc(path, docId) {
  const res = await fetch(`${FIRESTORE_ROOT}/${path}/${encodeURIComponent(docId)}`, {
    headers: OWNER_HEADERS,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture ${path}/${docId} : ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return fromFirestoreFields(doc.fields ?? {});
}

/** Crée un compte email dans l'émulateur Auth ; renvoie son uid. */
export async function createEmulatorUser({ email, password, displayName }) {
  const res = await fetch(`${AUTH_ROOT}/accounts:signUp?key=demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`Création du compte ${email} : ${await res.text()}`);
  const { localId } = await res.json();
  return localId;
}
