/**
 * Bot Telegram des auteurs : déposer un cours sans passer par le studio.
 * Mode d'emploi et mise en place dans docs/telegram.md.
 *
 * Deux fonctions :
 *
 * - `telegramWebhook` reçoit chaque message de Telegram (webhook enregistré
 *   par `node scripts/admin.mjs telegram:installer`). Un auteur se relie au
 *   bot par son lien studio : `https://t.me/<bot>?start=<jeton studio>`
 *   (le jeton, 64 caractères hexadécimaux, tient tout juste dans les 64 que
 *   permet Telegram). Révoquer le lien studio coupe donc aussi le bot. Puis
 *   la conversation (telegramFlow.ts) mène de l'audio au récapitulatif ; sur
 *   « Envoyer », un document `telegramSubmissions/{id}` est créé.
 * - `onTelegramSubmission` fait le travail lourd sur ce document :
 *   télécharger l'audio chez Telegram, le convertir en mp3 s'il le faut
 *   (vocal en Opus), le poser sous `chiourim/{slug}/audio.{ext}` et créer le
 *   chiour en brouillon, exactement comme le studio (studio.ts). Le cours
 *   arrive donc dans « À traiter » du backoffice ; seul l'admin publie.
 *
 * Le jeton du bot est un secret de Cloud Functions (TELEGRAM_BOT_TOKEN).
 * L'état de chaque conversation vit dans `telegramChats/{chatId}`, fermé
 * aux clients par les règles Firestore (pas de règle : accès refusé).
 */
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  audioFormat,
  audioFromMessage,
  converse,
  EMPTY_STATE,
  parseFfmpegDuration,
  TEXTS,
  webhookSecret,
  type AuthorContext,
  type ChatState,
  type Draft,
  type Input,
  type Reply,
  type TelegramMessageLike,
} from "./telegramFlow";
import {
  availableChiourSlug,
  bucket,
  createSerieForAuthor,
  grantDownloadUrl,
  type StudioAuthor,
} from "./studio";

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
/** L'API Bot ; TELEGRAM_API_BASE la remplace par un faux serveur, pour les essais locaux. */
const API_BASE = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

// ---- L'API Bot de Telegram ------------------------------------------------------

async function bot<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/bot${TELEGRAM_BOT_TOKEN.value()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
  } | null;
  if (!body?.ok) {
    throw new Error(`Telegram ${method} : ${response.status} ${body?.description ?? ""}`.trim());
  }
  return body.result as T;
}

function keyboard(reply: Reply) {
  return reply.buttons?.length
    ? {
        reply_markup: {
          inline_keyboard: reply.buttons.map((row) =>
            row.map((b) => ({ text: b.text, callback_data: b.data })),
          ),
        },
      }
    : {};
}

/** Envoie les réponses dans l'ordre ; rend l'identifiant du dernier message à boutons. */
async function sendReplies(chatId: number, replies: Reply[]): Promise<number | null> {
  let withButtons: number | null = null;
  for (const reply of replies) {
    const sent = await bot<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: reply.text,
      ...keyboard(reply),
    });
    if (reply.buttons?.length) withButtons = sent.message_id;
  }
  return withButtons;
}

/** Retire les boutons d'un message (une question passée) ; sans conséquence s'il échoue. */
async function clearButtons(chatId: number, messageId: number): Promise<void> {
  await bot("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => undefined);
}

// ---- Les données ----------------------------------------------------------------

interface ChatDoc {
  token: string;
  auteurId: string;
  auteurName: string;
  state?: ChatState;
  lastUpdateId?: number;
  /** Le dernier message à boutons : ses boutons tombent quand on passe à la suite. */
  keyboardMessageId?: number | null;
}

const chats = () => getFirestore().collection("telegramChats");
const submissions = () => getFirestore().collection("telegramSubmissions");

/** L'auteur d'un jeton studio actif, ou null (même règle que requireAuthor, studio.ts). */
async function authorOfToken(token: string): Promise<StudioAuthor | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const snap = await getFirestore().collection("studioTokens").doc(token).get();
  const data = snap.data();
  if (
    !snap.exists ||
    data?.active !== true ||
    typeof data.auteurId !== "string" ||
    !data.auteurId
  ) {
    return null;
  }
  return {
    auteurId: data.auteurId,
    auteurName:
      typeof data.auteurName === "string" && data.auteurName ? data.auteurName : data.auteurId,
  };
}

/** Ses séries (avec le prochain numéro d'épisode) et ses catégories. */
async function authorContext(auteurId: string): Promise<AuthorContext> {
  const db = getFirestore();
  const [series, chiourim] = await Promise.all([
    db.collection("series").where("auteurId", "==", auteurId).get(),
    db.collection("chiourim").where("auteurId", "==", auteurId).get(),
  ]);
  const lastEpisode = new Map<string, number>();
  const categories = new Set<string>();
  for (const doc of chiourim.docs) {
    const c = doc.data();
    if (typeof c.serieId === "string" && typeof c.episode === "number") {
      lastEpisode.set(c.serieId, Math.max(lastEpisode.get(c.serieId) ?? 0, c.episode));
    }
    for (const cat of Array.isArray(c.categories) ? c.categories : []) {
      if (typeof cat === "string" && cat.trim()) categories.add(cat.trim());
    }
  }
  return {
    series: series.docs.map((d) => ({
      id: d.id,
      name: String(d.data().name ?? d.id),
      nextEpisode: (lastEpisode.get(d.id) ?? 0) + 1,
    })),
    categories: [...categories],
  };
}

// ---- Le webhook -----------------------------------------------------------------

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessageLike & {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      text?: string;
      chat: { id: number; type: string };
      reply_markup?: { inline_keyboard: { text: string; callback_data?: string }[][] };
    };
  };
}

/** /start <jeton> : relie cette conversation à l'auteur du lien studio. */
async function link(update: TelegramUpdate, chatId: number, payload: string): Promise<void> {
  const author = await authorOfToken(payload);
  if (!author) {
    await sendReplies(chatId, [{ text: TEXTS.badLink }]);
    return;
  }
  const from = update.message?.from;
  await chats()
    .doc(String(chatId))
    .set({
      token: payload,
      auteurId: author.auteurId,
      auteurName: author.auteurName,
      telegramUser: {
        id: from?.id ?? null,
        username: from?.username ?? null,
        firstName: from?.first_name ?? null,
      },
      state: EMPTY_STATE,
      lastUpdateId: update.update_id,
      keyboardMessageId: null,
      linkedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  logger.info(`telegram : conversation ${chatId} reliée à ${author.auteurId}.`);
  await sendReplies(chatId, [{ text: TEXTS.welcome(author.auteurName) }]);
}

/** Le libellé du bouton touché, pour le garder sous la question. */
function pressedLabel(update: TelegramUpdate): string | null {
  const query = update.callback_query;
  for (const row of query?.message?.reply_markup?.inline_keyboard ?? []) {
    for (const button of row) if (button.callback_data === query?.data) return button.text;
  }
  return null;
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const query = update.callback_query;
  const chat = message?.chat ?? query?.message?.chat;
  // Les groupes et canaux ne sont pas pour ce bot : les cours se déposent en tête-à-tête.
  if (!chat || chat.type !== "private") return;
  const chatId = chat.id;

  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(message?.text?.trim() ?? "");
  if (start?.[1]) {
    await link(update, chatId, start[1]);
    return;
  }

  const ref = chats().doc(String(chatId));
  const linked = (await ref.get()).data() as ChatDoc | undefined;
  if (!linked?.token) {
    if (query) await bot("answerCallbackQuery", { callback_query_id: query.id });
    await sendReplies(chatId, [{ text: TEXTS.notLinked }]);
    return;
  }
  const author = await authorOfToken(linked.token);
  if (!author) {
    if (query) await bot("answerCallbackQuery", { callback_query_id: query.id });
    await ref.delete();
    await sendReplies(chatId, [{ text: TEXTS.revoked }]);
    return;
  }

  // Ce que l'auteur a envoyé, traduit pour la conversation.
  let input: Input;
  if (query) {
    input = { type: "button", data: query.data ?? "" };
  } else if (message) {
    const reading = audioFromMessage(message);
    if (reading && "error" in reading) {
      const text =
        reading.error === "tooBig"
          ? TEXTS.tooBig(reading.sizeMb)
          : reading.error === "video"
            ? TEXTS.video
            : TEXTS.notAudio;
      await sendReplies(chatId, [{ text }]);
      return;
    }
    if (reading) input = { type: "audio", audio: reading.audio };
    else if (typeof message.text === "string") input = { type: "text", text: message.text };
    else {
      await sendReplies(chatId, [{ text: TEXTS.notAudio }]);
      return;
    }
  } else {
    return;
  }

  const ctx = await authorContext(author.auteurId);

  // L'état avance dans une transaction : deux messages rapprochés ne se
  // marchent pas dessus, et une mise à jour que Telegram renvoie (il le fait
  // tant qu'il n'a pas eu sa réponse) n'est comptée qu'une fois.
  const result = await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc = snap.data() as ChatDoc | undefined;
    if (!doc) return null;
    if ((doc.lastUpdateId ?? 0) >= update.update_id) return null;
    const outcome = converse(doc.state ?? EMPTY_STATE, input, ctx);
    tx.update(ref, {
      state: outcome.state,
      lastUpdateId: update.update_id,
      auteurName: author.auteurName,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (outcome.submit) {
      tx.create(submissions().doc(`${chatId}_${update.update_id}`), {
        chatId,
        token: linked.token,
        auteurId: author.auteurId,
        auteurName: author.auteurName,
        draft: outcome.submit,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { outcome, keyboardMessageId: doc.keyboardMessageId ?? null };
  });

  if (!result) {
    if (query) await bot("answerCallbackQuery", { callback_query_id: query.id });
    return;
  }
  const { outcome, keyboardMessageId } = result;
  let replies = outcome.replies;
  /** Le message à boutons une fois tout envoyé (undefined : inchangé). */
  let nextKeyboard: number | null | undefined = undefined;

  if (query) {
    await bot("answerCallbackQuery", {
      callback_query_id: query.id,
      ...(outcome.stale ? { text: TEXTS.stale } : {}),
    });
    const pressed = query.message;
    if (!outcome.stale && pressed) {
      if (outcome.edit && replies[0]) {
        // Le message du bouton se met à jour sur place (une catégorie cochée).
        const [first, ...rest] = replies;
        await bot("editMessageText", {
          chat_id: chatId,
          message_id: pressed.message_id,
          text: first.text,
          ...keyboard(first),
        }).catch(() => undefined);
        replies = rest;
        nextKeyboard = first.buttons?.length ? pressed.message_id : null;
      } else {
        // La question garde la réponse choisie, sans ses boutons.
        const label = pressedLabel(update);
        await bot("editMessageText", {
          chat_id: chatId,
          message_id: pressed.message_id,
          text: label ? `${pressed.text ?? ""}\n\n✓ ${label}` : (pressed.text ?? ""),
          reply_markup: { inline_keyboard: [] },
        }).catch(() => clearButtons(chatId, pressed.message_id));
      }
    }
  } else if (keyboardMessageId && replies.length) {
    // Une réponse écrite : les boutons de la question précédente ne servent plus.
    await clearButtons(chatId, keyboardMessageId);
  }

  if (replies.length) nextKeyboard = await sendReplies(chatId, replies);
  if (nextKeyboard !== undefined) {
    await ref.update({ keyboardMessageId: nextKeyboard }).catch(() => undefined);
  }
}

export const telegramWebhook = onRequest(
  { secrets: [TELEGRAM_BOT_TOKEN], timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }
    if (req.get("X-Telegram-Bot-Api-Secret-Token") !== webhookSecret(TELEGRAM_BOT_TOKEN.value())) {
      res.status(401).end();
      return;
    }
    const update = req.body as TelegramUpdate;
    try {
      await handleUpdate(update);
    } catch (error) {
      logger.error("telegramWebhook : échec du traitement", { error: String(error) });
      const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
      if (
        chatId &&
        (update.message?.chat.type ?? update.callback_query?.message?.chat.type) === "private"
      ) {
        await sendReplies(chatId, [{ text: TEXTS.error }]).catch(() => undefined);
      }
    }
    // Toujours 200 : une erreur rendue ferait renvoyer la même mise à jour en boucle.
    res.status(200).end();
  },
);

// ---- Le dépôt -------------------------------------------------------------------

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

/** ffmpeg : celui du paquet ffmpeg-static, ou FFMPEG_BIN (tests locaux). */
function ffmpegPath(): string | null {
  try {
    return (require("ffmpeg-static") as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Lance ffmpeg ; rend sa sortie d'erreur (où il écrit la durée) et son code. */
function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  const bin = ffmpegPath();
  if (!bin) return Promise.reject(new Error("ffmpeg introuvable"));
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-hide_banner", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-20_000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 480_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

/** Télécharge l'audio chez Telegram et le rend lisible partout ; rend fichier, format, durée. */
async function prepareAudio(
  draft: Draft,
  dir: string,
): Promise<{ path: string; ext: string; duration: number | null }> {
  const file = await bot<{ file_path?: string }>("getFile", { file_id: draft.audio.fileId });
  if (!file.file_path) throw new Error("Telegram n'a pas rendu le chemin du fichier.");
  const response = await fetch(
    `${API_BASE}/file/bot${TELEGRAM_BOT_TOKEN.value()}/${file.file_path}`,
    { signal: AbortSignal.timeout(120_000) },
  );
  if (!response.ok) throw new Error(`Téléchargement refusé par Telegram (${response.status}).`);
  const format = audioFormat(draft.audio, file.file_path);
  const input = join(dir, `source.${format.source}`);
  await writeFile(input, Buffer.from(await response.arrayBuffer()));

  let duration = draft.audio.duration;
  if (format.transcode) {
    const output = join(dir, `audio.${format.target}`);
    try {
      // La voix en mono, 64 kb/s : ce qu'il faut pour un cours, léger à écouter en 4G.
      const run = await runFfmpeg([
        "-y",
        "-i",
        input,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "64k",
        output,
      ]);
      if (run.code !== 0) throw new Error(`ffmpeg a échoué : ${run.stderr.slice(-500)}`);
      return {
        path: output,
        ext: format.target,
        duration: duration ?? parseFfmpegDuration(run.stderr),
      };
    } catch (error) {
      // Sans ffmpeg, un Ogg reste acceptable (le studio le prend aussi) : mieux
      // vaut un cours déposé tel quel qu'un cours perdu.
      const fallback = ["ogg", "oga", "opus"].includes(format.source) ? "ogg" : format.source;
      if (!CONTENT_TYPES[fallback]) throw error;
      logger.warn("telegram : conversion impossible, audio gardé tel quel", {
        error: String(error),
      });
      return { path: input, ext: fallback, duration };
    }
  }
  if (duration == null) {
    // ffmpeg sans sortie sort en erreur, mais annonce la durée d'abord.
    duration = await runFfmpeg(["-i", input])
      .then((run) => parseFfmpegDuration(run.stderr))
      .catch(() => null);
  }
  return { path: input, ext: format.target, duration };
}

/** La série du cours : la sienne, ou celle à créer ; null si elle n'est plus à lui. */
async function serieFor(draft: Draft, author: StudioAuthor): Promise<string | null> {
  if (draft.newSerieName) return createSerieForAuthor(draft.newSerieName, author);
  if (!draft.serieId) return null;
  const snap = await getFirestore().collection("series").doc(draft.serieId).get();
  return snap.exists && snap.data()?.auteurId === author.auteurId ? draft.serieId : null;
}

export const onTelegramSubmission = onDocumentCreated(
  {
    document: "telegramSubmissions/{submissionId}",
    secrets: [TELEGRAM_BOT_TOKEN],
    memory: "2GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() as {
      chatId: number;
      token: string;
      draft: Draft;
      status: string;
    };
    if (data.status !== "pending") return;
    await snap.ref.update({ status: "processing" });

    const draft = data.draft;
    const name = draft.name ?? "";
    const dir = await mkdtemp(join(tmpdir(), "telegram-"));
    try {
      const author = await authorOfToken(data.token);
      if (!author) throw new Error("Lien studio révoqué entre-temps.");

      const audio = await prepareAudio(draft, dir);
      const serieId = await serieFor(draft, author);
      const slug = await availableChiourSlug(name);
      const audioPath = `chiourim/${slug}/audio.${audio.ext}`;
      await bucket()
        .file(audioPath)
        .save(await readFile(audio.path), {
          resumable: false,
          metadata: { contentType: CONTENT_TYPES[audio.ext] ?? "application/octet-stream" },
        });
      const { mediaUrl, fileSize } = await grantDownloadUrl(audioPath);

      // Le même document que studioSubmitChiour (studio.ts), plus d'où il vient.
      await getFirestore()
        .collection("chiourim")
        .doc(slug)
        .set({
          slug,
          name,
          description: draft.description,
          auteur: author.auteurName,
          auteurId: author.auteurId,
          categories: draft.categories,
          niveau: null,
          serieId,
          episode: serieId ? draft.episode : null,
          audioPath,
          mediaUrl,
          duration: audio.duration,
          fileSize,
          published: false, // brouillon : publication réservée à l'admin
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedVia: "telegram",
        });

      await snap.ref.update({ status: "done", slug, doneAt: FieldValue.serverTimestamp() });
      logger.info(`telegram : chiour ${slug} déposé par ${author.auteurId}.`);
      await sendReplies(data.chatId, [{ text: TEXTS.submitted(name) }]).catch(() => undefined);
    } catch (error) {
      logger.error(`telegram : dépôt ${snap.id} en échec`, { error: String(error) });
      await snap.ref.update({ status: "failed", error: String(error).slice(0, 1000) });
      await sendReplies(data.chatId, [{ text: TEXTS.submitFailed(name) }]).catch(() => undefined);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
