/**
 * Formulaire de support, la partie pure : valider ce que le client envoie et
 * le mettre en forme pour l'API Notion. Sans dépendance à firebase-functions,
 * pour être testée depuis les tests unitaires du site (src/__tests__).
 */

/** La source de données (data source) de la base « Formulaire de support ». */
export const NOTION_DATA_SOURCE_ID = "26b35db9-0d4d-80a2-8db8-000b67a4b989";

/** Les valeurs acceptées du client, et leur libellé dans la base Notion. */
export const KINDS = {
  idea: "Nouvelle idée",
  bug: "Bug",
  error: "Erreur",
  other: "Autre",
} as const;
export const SUPPORTS = { web: "Web", app: "Application" } as const;
export const PLATFORMS = { web: "Web", ios: "iOS", android: "Android" } as const;

export type FeedbackKind = keyof typeof KINDS;
export type FeedbackSupport = keyof typeof SUPPORTS;
export type FeedbackPlatform = keyof typeof PLATFORMS;

/** Le message tel que le client l'envoie, une fois validé. */
export interface FeedbackInput {
  kind: FeedbackKind;
  /** Précision libre quand `kind` vaut « other ». */
  otherKind: string;
  details: string;
  /** Email ou numéro de téléphone, vide si la personne ne veut pas de réponse. */
  contact: string;
  support: FeedbackSupport;
  platform: FeedbackPlatform;
  version: string;
}

/** Une propriété Notion a droit à 2000 caractères par fragment de texte. */
const NOTION_TEXT_MAX = 2000;
const DETAILS_MAX = NOTION_TEXT_MAX;
const OTHER_MAX = 200;
const CONTACT_MAX = 200;
const VERSION_MAX = 60;

/** Un envoi refusé : le callable la traduit en `invalid-argument`. */
export class FeedbackValidationError extends Error {}

function asTrimmedString(value: unknown, field: string, max: number, required = false): string {
  if (value == null) {
    if (required) throw new FeedbackValidationError(`Champ requis : ${field}.`);
    return "";
  }
  if (typeof value !== "string" || value.length > max) {
    throw new FeedbackValidationError(`Champ invalide : ${field}.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new FeedbackValidationError(`Champ requis : ${field}.`);
  }
  return trimmed;
}

function asKey<T extends Record<string, string>>(value: unknown, table: T, field: string): keyof T {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(table, value)) {
    throw new FeedbackValidationError(`Champ invalide : ${field}.`);
  }
  return value;
}

/** Valide et normalise ce que le client envoie. */
export function parseFeedback(data: unknown): FeedbackInput {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const kind = asKey(raw.kind, KINDS, "kind");
  const otherKind = kind === "other" ? asTrimmedString(raw.otherKind, "otherKind", OTHER_MAX) : "";
  const details = asTrimmedString(raw.details, "details", DETAILS_MAX, true);
  const contact = asTrimmedString(raw.contact, "contact", CONTACT_MAX);
  const support = asKey(raw.support, SUPPORTS, "support");
  const platform = asKey(raw.platform, PLATFORMS, "platform");
  const version = asTrimmedString(raw.version, "version", VERSION_MAX);
  return { kind, otherKind, details, contact, support, platform, version };
}

/** Un email si la valeur en a la forme ; sinon c'est un numéro de téléphone. */
export function isEmail(contact: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}

function richText(content: string) {
  return [{ type: "text", text: { content: content.slice(0, NOTION_TEXT_MAX) } }];
}

/**
 * La page Notion à créer : les propriétés portent les noms exacts des
 * colonnes de la base (y compris l'espace final de « De quoi s’agit il ? »,
 * hérité du formulaire d'origine). Une option de sélection inconnue (« Erreur »
 * la première fois) est créée par Notion à la volée.
 */
export function buildNotionPage(input: FeedbackInput): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    "Donnez des détails": { title: richText(input.details) },
    "De quoi s’agit il ? ": { multi_select: [{ name: KINDS[input.kind] }] },
    Support: { select: { name: SUPPORTS[input.support] } },
    Plateforme: { select: { name: PLATFORMS[input.platform] } },
  };
  if (input.otherKind) {
    properties["Si autre"] = { rich_text: richText(input.otherKind) };
  }
  if (input.version) {
    properties.Version = { rich_text: richText(input.version) };
  }
  if (input.contact) {
    if (isEmail(input.contact)) {
      properties["Pour vous contacter"] = { email: input.contact };
    } else {
      properties["Téléphone"] = { phone_number: input.contact };
    }
  }
  return {
    parent: { type: "data_source_id", data_source_id: NOTION_DATA_SOURCE_ID },
    properties,
  };
}
