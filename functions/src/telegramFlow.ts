/**
 * Bot Telegram des auteurs, la partie pure : la conversation qui mène d'un
 * audio à un chiour prêt à déposer. Sans dépendance à firebase-functions,
 * pour être testée depuis les tests unitaires du site
 * (src/__tests__/telegramFlow.test.ts).
 *
 * L'auteur envoie un audio (message vocal, fichier audio, ou document audio),
 * le bot pose ses questions une à une (titre, description, série, épisode,
 * catégories), montre le récapitulatif, et sur « Envoyer » rend le brouillon
 * à déposer (`submit`). Le reste (Firestore, téléchargement, Storage) vit
 * dans telegram.ts.
 *
 * Un audio reçu pendant qu'un cours est en cours de description attend son
 * tour dans `queue` : un auteur peut envoyer toute une série d'un coup.
 */
import { createHmac } from "node:crypto";

/** Ce que Telegram laisse télécharger à un bot (API Bot en ligne) : 20 Mo. */
export const TELEGRAM_DOWNLOAD_MAX = 20 * 1024 * 1024;

/** Mêmes bornes que le studio (functions/src/studio.ts, parseMetadata). */
export const LIMITS = {
  name: 200,
  description: 5000,
  serieName: 200,
  categories: 10,
  category: 60,
  episode: 10000,
} as const;

/** Un audio reçu, tel que Telegram le décrit (le fichier reste chez lui). */
export interface AudioRef {
  fileId: string;
  fileUniqueId: string;
  kind: "voice" | "audio" | "document";
  fileSize: number | null;
  /** En secondes ; Telegram la donne pour un vocal ou un audio, pas un document. */
  duration: number | null;
  mimeType: string | null;
  fileName: string | null;
}

export type Step =
  | "title"
  | "description"
  | "serie"
  | "newSerie"
  | "episode"
  | "categories"
  | "confirm"
  | "edit";

/** Le cours en train d'être décrit. */
export interface Draft {
  audio: AudioRef;
  step: Step;
  /** Correction d'un seul champ depuis le récapitulatif : on y revient ensuite. */
  editing: boolean;
  name: string | null;
  description: string;
  serieId: string | null;
  newSerieName: string | null;
  episode: number | null;
  categories: string[];
  /** Les séries proposées au dernier clavier (un bouton porte un rang, pas un identifiant). */
  serieChoices: string[];
  /** Les catégories proposées au dernier clavier. */
  categoryChoices: string[];
}

export interface ChatState {
  draft: Draft | null;
  queue: AudioRef[];
}

/** Ce que l'on sait de l'auteur, relu à chaque message. */
export interface AuthorContext {
  series: { id: string; name: string; nextEpisode: number }[];
  /** Les catégories de ses chiourim, proposées en boutons. */
  categories: string[];
}

export interface Button {
  text: string;
  data: string;
}

export interface Reply {
  text: string;
  buttons?: Button[][];
}

export type Input =
  | { type: "audio"; audio: AudioRef }
  | { type: "text"; text: string }
  | { type: "button"; data: string };

export interface Outcome {
  state: ChatState;
  replies: Reply[];
  /** Le brouillon validé par l'auteur, à déposer. */
  submit?: Draft;
  /** Un bouton d'une question déjà passée : rien n'a changé. */
  stale?: boolean;
  /** La première réponse remplace le message du bouton touché, au lieu de s'y ajouter. */
  edit?: boolean;
}

export const EMPTY_STATE: ChatState = { draft: null, queue: [] };

// ---- Typographie ------------------------------------------------------------

const NARROW_NBSP = " ";
const NBSP = " ";

/**
 * Les espaces insécables du français (voir CLAUDE.md), posées sur le texte
 * écrit ici seulement : un gabarit étiqueté (fr`Titre : ${name}`) corrige
 * ses parties fixes et laisse intact ce que l'auteur a tapé.
 */
export function fr(strings: TemplateStringsArray, ...values: unknown[]): string {
  const fix = (part: string) =>
    part
      .replace(/ ([!?;])/g, `${NARROW_NBSP}$1`)
      .replace(/ :/g, `${NBSP}:`)
      .replace(/« /g, `«${NBSP}`)
      .replace(/ »/g, `${NBSP}»`);
  return strings.reduce(
    (text, part, i) => text + fix(part) + (i < values.length ? String(values[i]) : ""),
    "",
  );
}

// ---- Les textes -------------------------------------------------------------

export const TEXTS = {
  welcome: (auteurName: string) =>
    fr`Bonjour ${auteurName}, vous êtes relié à Petite Jérusalem.\n\n` +
    fr`Pour déposer un cours, envoyez-moi son audio ici : un message vocal, ou le fichier audio (mp3, m4a…). ` +
    fr`Je vous poserai ensuite quelques questions (titre, description, série), puis le cours arrivera chez l'équipe, qui le relira avant de le publier.\n\n` +
    fr`Vous pouvez envoyer plusieurs audios d'un coup : je les prends l'un après l'autre.`,
  help:
    fr`Envoyez-moi l'audio d'un cours (message vocal ou fichier audio) : je vous demanderai son titre, sa description et sa série, puis je le transmettrai à l'équipe.\n\n` +
    fr`/annuler abandonne le cours en cours.\n/passer saute une question facultative.`,
  notLinked:
    fr`Ce bot reçoit les cours des auteurs de Petite Jérusalem. ` +
    fr`Pour l'utiliser, ouvrez le lien Telegram que l'équipe vous a transmis.`,
  badLink: fr`Ce lien n'est pas valide, ou il a été remplacé. Demandez-en un nouveau à l'équipe.`,
  revoked: fr`Votre lien a été remplacé ou retiré. Ouvrez le nouveau lien que l'équipe vous a transmis.`,
  idle: fr`Pour déposer un cours, envoyez-moi son audio : un message vocal, ou le fichier audio.`,
  notAudio: fr`Je ne sais recevoir que des audios : un message vocal, ou un fichier audio (mp3, m4a, ogg, wav, aac).`,
  video: fr`Je ne prends pas les vidéos : envoyez seulement le son, en message vocal ou en fichier audio.`,
  tooBig: (sizeMb: string) =>
    fr`Ce fichier fait ${sizeMb} Mo : Telegram ne me laisse pas récupérer plus de 20 Mo. ` +
    fr`Envoyez-le plutôt en message vocal (bien plus léger), ou coupé en plusieurs parties, ou déposez-le par votre lien studio.`,
  queued: (waiting: number) =>
    waiting === 1
      ? fr`Bien reçu : je le garde pour juste après le cours en cours.`
      : fr`Bien reçu : je le garde, ${waiting} audios attendent après le cours en cours.`,
  nextAudio: (audio: AudioRef) => fr`Passons à l'audio suivant (${describeAudio(audio)}).`,
  askTitle: fr`Quel est le titre du cours ?`,
  askTitleFirst: (audio: AudioRef) =>
    fr`Bien reçu (${describeAudio(audio)}). Quel est le titre du cours ?`,
  titleTooLong: fr`Ce titre est trop long (${LIMITS.name} caractères au plus). Quel titre, plus court ?`,
  askDescription: fr`Quelques mots pour présenter le cours ? (ou « Passer »)`,
  descriptionTooLong: fr`Cette description est trop longue (${LIMITS.description} caractères au plus). Pouvez-vous la raccourcir ?`,
  askSerie: fr`Ce cours fait-il partie d'une série ?`,
  askSerieNone: fr`Ce cours fait-il partie d'une série ? Vous n'en avez pas encore : vous pouvez en créer une.`,
  askNewSerie: fr`Quel est le nom de la nouvelle série ?`,
  serieNameTooLong: fr`Ce nom est trop long (${LIMITS.serieName} caractères au plus). Quel nom, plus court ?`,
  serieFromText: (name: string) => fr`Série « ${name} ».`,
  newSerieFromText: (name: string) => fr`Je créerai la série « ${name} ».`,
  askEpisode: fr`Quel est son numéro dans la série ?`,
  badEpisode: fr`Il me faut un nombre entier, par exemple 4. Quel est son numéro dans la série ?`,
  askCategories: fr`Des catégories ? Touchez celles qui conviennent, ou écrivez-en de nouvelles (séparées par des virgules), puis « Valider ».`,
  askCategoriesNone: fr`Des catégories ? Écrivez-les, séparées par des virgules (par exemple : Michna, Pessah), ou « Passer ».`,
  tooManyCategories: fr`${LIMITS.categories} catégories au plus.`,
  categoriesAdded: (list: string) => fr`Catégories : ${list}. D'autres ? Sinon « Valider ».`,
  useButtons: fr`Touchez un des boutons ci-dessous.`,
  askEdit: fr`Que voulez-vous corriger ?`,
  cancelled: (name: string | null) =>
    name ? fr`Le cours « ${name} » est abandonné.` : fr`Le cours est abandonné.`,
  nothingToCancel: fr`Aucun cours en cours.`,
  sending: fr`J'envoie le cours à l'équipe, je vous préviens dès qu'il est arrivé.`,
  submitted: (name: string) =>
    fr`Le cours « ${name} » est bien arrivé. L'équipe le relira, puis il paraîtra dans l'app. Merci !`,
  submitFailed: (name: string) =>
    fr`Je n'ai pas pu enregistrer le cours « ${name} ». Renvoyez-moi l'audio pour réessayer ; si cela recommence, prévenez l'équipe.`,
  error: fr`Un souci de mon côté : réessayez dans un instant.`,
  stale: fr`Cette question est déjà passée.`,
} as const;

export const BUTTONS = {
  skip: "Passer",
  newSerie: "Nouvelle série",
  noSerie: "Pas de série",
  noEpisode: "Sans numéro",
  validate: "Valider",
  send: "Envoyer",
  edit: "Corriger",
  cancel: "Annuler",
  back: "Retour au récapitulatif",
  fields: {
    title: "Titre",
    description: "Description",
    serie: "Série",
    episode: "Épisode",
    categories: "Catégories",
  },
} as const;

// ---- Lire un message Telegram -------------------------------------------------

const AUDIO_FILE_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "oga", "opus", "aac", "flac", "amr"];

/** Le sous-ensemble d'un message Telegram dont on a besoin. */
export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  duration?: number;
  mime_type?: string;
  file_name?: string;
}

export interface TelegramMessageLike {
  text?: string;
  voice?: TelegramFile;
  audio?: TelegramFile;
  document?: TelegramFile;
  video?: unknown;
  video_note?: unknown;
}

export type AudioReading =
  | { audio: AudioRef }
  | { error: "notAudio" | "video" }
  | { error: "tooBig"; sizeMb: string }
  | null;

function extensionOf(fileName: string | null | undefined): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName ?? "");
  return match ? match[1].toLowerCase() : "";
}

/**
 * L'audio d'un message, s'il en porte un. Un document ne compte que s'il est
 * annoncé comme audio, ou nommé comme tel (un vocal WhatsApp transféré arrive
 * en document `.opus`). `null` : le message n'a pas de fichier du tout.
 */
export function audioFromMessage(message: TelegramMessageLike): AudioReading {
  if (message.video || message.video_note) return { error: "video" };
  let kind: AudioRef["kind"];
  let file: TelegramFile;
  if (message.voice) {
    kind = "voice";
    file = message.voice;
  } else if (message.audio) {
    kind = "audio";
    file = message.audio;
  } else if (message.document) {
    const mime = message.document.mime_type ?? "";
    const isAudio =
      mime.startsWith("audio/") ||
      AUDIO_FILE_EXTENSIONS.includes(extensionOf(message.document.file_name));
    if (!isAudio) return { error: "notAudio" };
    kind = "document";
    file = message.document;
  } else {
    return null;
  }
  if (file.file_size != null && file.file_size > TELEGRAM_DOWNLOAD_MAX) {
    return { error: "tooBig", sizeMb: (file.file_size / 1048576).toFixed(0) };
  }
  return {
    audio: {
      fileId: file.file_id,
      fileUniqueId: file.file_unique_id,
      kind,
      fileSize: file.file_size ?? null,
      duration: typeof file.duration === "number" && file.duration > 0 ? file.duration : null,
      mimeType: file.mime_type ?? null,
      fileName: file.file_name ?? null,
    },
  };
}

/** « message vocal de 12 min », « cours.mp3, 45 min »… pour que l'auteur s'y retrouve. */
export function describeAudio(audio: AudioRef): string {
  const minutes =
    audio.duration != null
      ? audio.duration < 60
        ? `${audio.duration} s`
        : `${Math.round(audio.duration / 60)} min`
      : null;
  const what = audio.kind === "voice" ? "message vocal" : (audio.fileName ?? "fichier audio");
  return minutes ? `${what}, ${minutes}` : what;
}

// ---- La conversation --------------------------------------------------------

/** Les étapes qui acceptent « Passer » (et /passer). */
const SKIPPABLE: Step[] = ["description", "serie", "episode", "categories"];

function newDraft(audio: AudioRef): Draft {
  return {
    audio,
    step: "title",
    editing: false,
    name: null,
    description: "",
    serieId: null,
    newSerieName: null,
    episode: null,
    categories: [],
    serieChoices: [],
    categoryChoices: [],
  };
}

function hasSerie(draft: Draft): boolean {
  return draft.serieId != null || draft.newSerieName != null;
}

function serieName(draft: Draft, ctx: AuthorContext): string | null {
  if (draft.newSerieName) return draft.newSerieName;
  if (draft.serieId) return ctx.series.find((s) => s.id === draft.serieId)?.name ?? draft.serieId;
  return null;
}

/** Le numéro proposé : le suivant de la série, 1 pour une série nouvelle. */
function suggestedEpisode(draft: Draft, ctx: AuthorContext): number {
  if (draft.serieId) return ctx.series.find((s) => s.id === draft.serieId)?.nextEpisode ?? 1;
  return 1;
}

/** Les catégories à proposer : celles de l'auteur, puis celles déjà choisies. */
function categoryOptions(draft: Draft, ctx: AuthorContext): string[] {
  return [...new Set([...ctx.categories, ...draft.categories])]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .slice(0, 24);
}

/** Des boutons, deux par ligne. */
function rows(buttons: Button[], perRow = 2): Button[][] {
  const out: Button[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow));
  return out;
}

/** Pose la question de l'étape `step` ; met à jour les choix proposés. */
function ask(
  draft: Draft,
  step: Step,
  ctx: AuthorContext,
  lead?: string,
): { draft: Draft; reply: Reply } {
  const next: Draft = { ...draft, step };
  const prefix = lead ? `${lead}\n\n` : "";
  switch (step) {
    case "title":
      return { draft: next, reply: { text: prefix + TEXTS.askTitle } };
    case "description":
      return {
        draft: next,
        reply: {
          text: prefix + TEXTS.askDescription,
          buttons: [[{ text: BUTTONS.skip, data: "description:skip" }]],
        },
      };
    case "serie": {
      const series = [...ctx.series].sort((a, b) => a.name.localeCompare(b.name, "fr"));
      next.serieChoices = series.map((s) => s.id);
      return {
        draft: next,
        reply: {
          text: prefix + (series.length ? TEXTS.askSerie : TEXTS.askSerieNone),
          buttons: [
            ...rows(
              series.map((s, i) => ({ text: s.name, data: `serie:${i}` })),
              1,
            ),
            [
              { text: BUTTONS.newSerie, data: "serie:new" },
              { text: BUTTONS.noSerie, data: "serie:none" },
            ],
          ],
        },
      };
    }
    case "newSerie":
      return { draft: next, reply: { text: prefix + TEXTS.askNewSerie } };
    case "episode": {
      const n = suggestedEpisode(draft, ctx);
      return {
        draft: next,
        reply: {
          text: prefix + TEXTS.askEpisode,
          buttons: [
            [
              { text: `Épisode ${n}`, data: `episode:${n}` },
              { text: BUTTONS.noEpisode, data: "episode:none" },
            ],
          ],
        },
      };
    }
    case "categories": {
      const options = categoryOptions(draft, ctx);
      next.categoryChoices = options;
      return {
        draft: next,
        reply: {
          text: prefix + (options.length ? TEXTS.askCategories : TEXTS.askCategoriesNone),
          buttons: categoryKeyboard(next),
        },
      };
    }
    case "confirm":
      return { draft: { ...next, editing: false }, reply: summary(next, ctx, prefix) };
    case "edit":
      return {
        draft: next,
        reply: {
          text: prefix + TEXTS.askEdit,
          buttons: [
            ...rows(
              [
                { text: BUTTONS.fields.title, data: "edit:title" },
                { text: BUTTONS.fields.description, data: "edit:description" },
                { text: BUTTONS.fields.serie, data: "edit:serie" },
                ...(hasSerie(draft)
                  ? [{ text: BUTTONS.fields.episode, data: "edit:episode" }]
                  : []),
                { text: BUTTONS.fields.categories, data: "edit:categories" },
              ],
              2,
            ),
            [{ text: BUTTONS.back, data: "edit:back" }],
          ],
        },
      };
  }
}

function categoryKeyboard(draft: Draft): Button[][] {
  const toggles = draft.categoryChoices.map((cat, i) => ({
    text: draft.categories.includes(cat) ? `✓ ${cat}` : cat,
    data: `cat:${i}`,
  }));
  return [
    ...rows(toggles, 2),
    [{ text: draft.categories.length ? BUTTONS.validate : BUTTONS.skip, data: "cat:ok" }],
  ];
}

/** Le récapitulatif, avec ses trois boutons. */
function summary(draft: Draft, ctx: AuthorContext, prefix = ""): Reply {
  const serie = serieName(draft, ctx);
  const lines = [
    fr`Voici le cours :`,
    "",
    fr`Titre : ${draft.name ?? ""}`,
    fr`Description : ${draft.description || "(aucune)"}`,
    fr`Série : ${serie ? (draft.newSerieName ? `${serie} (nouvelle)` : serie) : "(aucune)"}`,
    ...(serie ? [fr`Épisode : ${draft.episode ?? "(sans numéro)"}`] : []),
    fr`Catégories : ${draft.categories.length ? draft.categories.join(", ") : "(aucune)"}`,
    fr`Audio : ${describeAudio(draft.audio)}`,
  ];
  return {
    text: prefix + lines.join("\n"),
    buttons: [
      [{ text: BUTTONS.send, data: "confirm:send" }],
      [
        { text: BUTTONS.edit, data: "confirm:edit" },
        { text: BUTTONS.cancel, data: "confirm:cancel" },
      ],
    ],
  };
}

/** L'étape qui suit celle qu'on vient de remplir (ou le récapitulatif, en correction). */
function after(draft: Draft, filled: Step): Step {
  if (draft.editing) {
    // Une série nouvellement choisie appelle son numéro avant de revenir.
    if (filled === "serie" || filled === "newSerie") return hasSerie(draft) ? "episode" : "confirm";
    return "confirm";
  }
  switch (filled) {
    case "title":
      return "description";
    case "description":
      return "serie";
    case "serie":
    case "newSerie":
      return hasSerie(draft) ? "episode" : "categories";
    case "episode":
      return "categories";
    default:
      return "confirm";
  }
}

function advance(
  state: ChatState,
  draft: Draft,
  filled: Step,
  ctx: AuthorContext,
  lead?: string,
): Outcome {
  const { draft: next, reply } = ask(draft, after(draft, filled), ctx, lead);
  return { state: { ...state, draft: next }, replies: [reply] };
}

/** Termine le cours en cours (envoyé ou abandonné) et passe au suivant de la file. */
function finish(state: ChatState, ctx: AuthorContext, replies: Reply[]): Outcome {
  const [nextAudio, ...queue] = state.queue;
  if (!nextAudio) return { state: { draft: null, queue: [] }, replies };
  const { draft, reply } = ask(newDraft(nextAudio), "title", ctx, TEXTS.nextAudio(nextAudio));
  return { state: { draft, queue }, replies: [...replies, reply] };
}

/** Les catégories d'une saisie « Michna, Pessah » : sans doublon, bornées. */
export function parseCategories(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((c) => c.trim().replace(/\s+/g, " "))
    .filter((c) => c && c.length <= LIMITS.category);
}

/** Un entier d'épisode valide, ou null. */
export function parseEpisode(text: string): number | null {
  const match = /^\s*(?:(?:épisode|episode|ep\.?|n°|no|#)\s*)?(\d{1,5})\s*$/i.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= LIMITS.episode ? n : null;
}

function repeat(state: ChatState, draft: Draft, ctx: AuthorContext, lead?: string): Outcome {
  const { draft: next, reply } = ask(draft, draft.step, ctx, lead);
  return { state: { ...state, draft: next }, replies: [reply] };
}

/** Une réponse écrite à la question en cours. */
function onText(state: ChatState, draft: Draft, text: string, ctx: AuthorContext): Outcome {
  const value = text.trim();
  switch (draft.step) {
    case "title":
      if (!value) return repeat(state, draft, ctx);
      if (value.length > LIMITS.name) return repeat(state, draft, ctx, TEXTS.titleTooLong);
      return advance(state, { ...draft, name: value }, "title", ctx);
    case "description":
      if (value.length > LIMITS.description)
        return repeat(state, draft, ctx, TEXTS.descriptionTooLong);
      return advance(state, { ...draft, description: value }, "description", ctx);
    case "serie": {
      // Un nom tapé : une série existante si le nom correspond, sinon une nouvelle.
      if (!value) return repeat(state, draft, ctx);
      if (value.length > LIMITS.serieName) return repeat(state, draft, ctx, TEXTS.serieNameTooLong);
      const known = ctx.series.find(
        (s) => s.name.localeCompare(value, "fr", { sensitivity: "base" }) === 0,
      );
      const next = known
        ? { ...draft, serieId: known.id, newSerieName: null }
        : { ...draft, serieId: null, newSerieName: value };
      return advance(
        state,
        next,
        "serie",
        ctx,
        known ? TEXTS.serieFromText(known.name) : TEXTS.newSerieFromText(value),
      );
    }
    case "newSerie":
      if (!value) return repeat(state, draft, ctx);
      if (value.length > LIMITS.serieName) return repeat(state, draft, ctx, TEXTS.serieNameTooLong);
      return advance(state, { ...draft, serieId: null, newSerieName: value }, "newSerie", ctx);
    case "episode": {
      const n = parseEpisode(value);
      if (n == null) return repeat(state, draft, ctx, TEXTS.badEpisode);
      return advance(state, { ...draft, episode: n }, "episode", ctx);
    }
    case "categories": {
      const added = parseCategories(value);
      if (!added.length) return repeat(state, draft, ctx);
      const categories = [...new Set([...draft.categories, ...added])];
      if (categories.length > LIMITS.categories)
        return repeat(state, draft, ctx, TEXTS.tooManyCategories);
      const next = { ...draft, categories };
      return repeat(state, next, ctx, TEXTS.categoriesAdded(categories.join(", ")));
    }
    case "confirm":
    case "edit":
      return repeat(state, draft, ctx, TEXTS.useButtons);
  }
}

/** « Passer » : la valeur vide de l'étape, puis la suivante. */
function onSkip(state: ChatState, draft: Draft, ctx: AuthorContext): Outcome {
  switch (draft.step) {
    case "description":
      return advance(state, { ...draft, description: "" }, "description", ctx);
    case "serie":
      return advance(
        state,
        { ...draft, serieId: null, newSerieName: null, episode: null },
        "serie",
        ctx,
      );
    case "episode":
      return advance(state, { ...draft, episode: null }, "episode", ctx);
    case "categories":
      return advance(state, draft, "categories", ctx);
    default:
      return repeat(state, draft, ctx);
  }
}

const STALE: Omit<Outcome, "state"> = { replies: [], stale: true };

/** Un bouton touché. Un bouton d'une question déjà passée ne change rien. */
function onButton(state: ChatState, draft: Draft, data: string, ctx: AuthorContext): Outcome {
  const [step, value = ""] = data.split(":");
  const expected = step === "cat" ? "categories" : step;
  if (expected !== draft.step) return { state, ...STALE };

  switch (draft.step) {
    case "description":
      return value === "skip" ? onSkip(state, draft, ctx) : { state, ...STALE };
    case "serie": {
      if (value === "none") return onSkip(state, draft, ctx);
      if (value === "new") return repeat(state, { ...draft, step: "newSerie" }, ctx);
      const serieId = draft.serieChoices[Number(value)];
      if (!serieId || !ctx.series.some((s) => s.id === serieId)) return { state, ...STALE };
      const changed = serieId !== draft.serieId;
      return advance(
        state,
        { ...draft, serieId, newSerieName: null, episode: changed ? null : draft.episode },
        "serie",
        ctx,
      );
    }
    case "episode": {
      if (value === "none") return onSkip(state, draft, ctx);
      const n = parseEpisode(value);
      return n == null
        ? { state, ...STALE }
        : advance(state, { ...draft, episode: n }, "episode", ctx);
    }
    case "categories": {
      if (value === "ok") return advance(state, draft, "categories", ctx);
      const cat = draft.categoryChoices[Number(value)];
      if (cat == null) return { state, ...STALE };
      const categories = draft.categories.includes(cat)
        ? draft.categories.filter((c) => c !== cat)
        : [...draft.categories, cat];
      if (categories.length > LIMITS.categories)
        return repeat(state, draft, ctx, TEXTS.tooManyCategories);
      return { ...repeat(state, { ...draft, categories }, ctx), edit: true };
    }
    case "confirm":
      if (value === "send")
        return { ...finish(state, ctx, [{ text: TEXTS.sending }]), submit: draft };
      if (value === "edit")
        return { ...repeat(state, { ...draft, step: "edit" }, ctx), edit: true };
      if (value === "cancel") return finish(state, ctx, [{ text: TEXTS.cancelled(draft.name) }]);
      return { state, ...STALE };
    case "edit": {
      if (value === "back") {
        return { ...repeat(state, { ...draft, step: "confirm" }, ctx), edit: true };
      }
      const fields: Record<string, Step> = {
        title: "title",
        description: "description",
        serie: "serie",
        episode: "episode",
        categories: "categories",
      };
      const target = fields[value];
      if (!target || (target === "episode" && !hasSerie(draft))) return { state, ...STALE };
      return repeat(state, { ...draft, step: target, editing: true }, ctx);
    }
    default:
      return { state, ...STALE };
  }
}

/**
 * Le cœur du bot : l'état de la conversation, ce que l'auteur vient d'envoyer,
 * et ce qu'on sait de lui ; rend le nouvel état et les réponses. Le lien
 * (/start <jeton>) est traité avant, dans telegram.ts.
 */
export function converse(state: ChatState, input: Input, ctx: AuthorContext): Outcome {
  const draft = state.draft;

  if (input.type === "audio") {
    if (!draft) {
      const { draft: next, reply } = ask(newDraft(input.audio), "title", ctx);
      return {
        state: { ...state, draft: next },
        replies: [{ ...reply, text: TEXTS.askTitleFirst(input.audio) }],
      };
    }
    // Le même fichier renvoyé (Telegram garde son identifiant unique) : une fois suffit.
    const known = [draft.audio, ...state.queue].some(
      (a) => a.fileUniqueId === input.audio.fileUniqueId,
    );
    const queue = known ? state.queue : [...state.queue, input.audio];
    return { state: { ...state, queue }, replies: [{ text: TEXTS.queued(queue.length) }] };
  }

  if (input.type === "text") {
    const command = /^\/([a-z]+)(?:@\w+)?\b/i.exec(input.text.trim())?.[1]?.toLowerCase();
    if (command === "annuler" || command === "cancel") {
      if (!draft) return { state, replies: [{ text: TEXTS.nothingToCancel }] };
      return finish(state, ctx, [{ text: TEXTS.cancelled(draft.name) }]);
    }
    if (command === "aide" || command === "help" || command === "start") {
      return { state, replies: [{ text: TEXTS.help }] };
    }
    if (!draft) return { state, replies: [{ text: TEXTS.idle }] };
    if (command === "passer" || command === "skip") {
      return SKIPPABLE.includes(draft.step) ? onSkip(state, draft, ctx) : repeat(state, draft, ctx);
    }
    if (command) return repeat(state, draft, ctx, TEXTS.help);
    return onText(state, draft, input.text, ctx);
  }

  if (!draft) return { state, ...STALE };
  return onButton(state, draft, input.data, ctx);
}

// ---- Webhook et fichier audio ---------------------------------------------------

/**
 * Le secret que Telegram renvoie à chaque appel du webhook (en-tête
 * X-Telegram-Bot-Api-Secret-Token), dérivé du jeton du bot : un seul secret
 * à garder, TELEGRAM_BOT_TOKEN. La même dérivation est dans
 * scripts/lib/backoffice.mjs (telegramWebhookSecret), qui l'enregistre
 * auprès de Telegram ; un test vérifie qu'elles s'accordent.
 */
export function webhookSecret(botToken: string): string {
  return createHmac("sha256", "petite-jerusalem/telegram-webhook").update(botToken).digest("hex");
}

/** Ce que l'app lit partout (iOS compris) et que l'on garde tel quel. */
const KEPT_FORMATS = ["mp3", "m4a", "aac"];

const MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

/**
 * Le format du fichier reçu et ce qu'on en fait. Un vocal Telegram est de
 * l'Opus dans un conteneur Ogg, que Safari n'a lu que tardivement : on le
 * convertit en mp3, comme tout ce qui n'est pas mp3, m4a ou aac.
 * `filePath` est le chemin que rend getFile (« voice/file_12.oga »).
 */
export function audioFormat(
  audio: Pick<AudioRef, "mimeType" | "fileName">,
  filePath: string,
): { source: string; target: string; transcode: boolean } {
  const source =
    extensionOf(filePath) ||
    extensionOf(audio.fileName) ||
    MIME_EXTENSIONS[audio.mimeType ?? ""] ||
    "bin";
  const normalized = source === "mpga" || source === "mpeg" ? "mp3" : source;
  if (KEPT_FORMATS.includes(normalized)) {
    return { source: normalized, target: normalized, transcode: false };
  }
  return { source: normalized, target: "mp3", transcode: true };
}

/** La durée qu'ffmpeg écrit en tête (« Duration: 00:12:34.56 »), en secondes. */
export function parseFfmpegDuration(stderr: string): number | null {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return seconds > 0 ? Math.round(seconds) : null;
}
