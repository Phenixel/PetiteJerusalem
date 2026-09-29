// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  audioFormat,
  audioFromMessage,
  converse,
  EMPTY_STATE,
  parseCategories,
  parseEpisode,
  parseFfmpegDuration,
  TELEGRAM_DOWNLOAD_MAX,
  TEXTS,
  webhookSecret,
  type AudioRef,
  type AuthorContext,
  type ChatState,
  type Input,
  type Outcome,
  type Reply,
} from "../../functions/src/telegramFlow";
import { telegramLink, telegramWebhookSecret } from "../../scripts/lib/backoffice.mjs";

/**
 * Le bot Telegram des auteurs (functions/src/telegram.ts, docs/telegram.md) :
 * la conversation qui mène d'un audio à un chiour en brouillon. Ces tests
 * tiennent le parcours, la file d'attente, les corrections, les boutons
 * périmés, et la typographie française de tout ce que le bot écrit.
 */

const ctx: AuthorContext = {
  series: [
    { id: "rav-x--michna-berakhot", name: "Michna Berakhot", nextEpisode: 5 },
    { id: "rav-x--emouna", name: "Émouna", nextEpisode: 1 },
  ],
  categories: ["Michna", "Pessah"],
};

function audio(id: string, extra: Partial<AudioRef> = {}): AudioRef {
  return {
    fileId: `file-${id}`,
    fileUniqueId: `uniq-${id}`,
    kind: "voice",
    fileSize: 1_000_000,
    duration: 1500,
    mimeType: "audio/ogg",
    fileName: null,
    ...extra,
  };
}

/** Rejoue une suite d'entrées ; rend le dernier résultat et toutes les réponses. */
function play(inputs: Input[], state: ChatState = EMPTY_STATE, context = ctx) {
  const replies: Reply[] = [];
  let last: Outcome = { state, replies: [] };
  const submitted: Outcome["submit"][] = [];
  for (const input of inputs) {
    last = converse(last.state, input, context);
    replies.push(...last.replies);
    if (last.submit) submitted.push(last.submit);
  }
  return { last, replies, submitted };
}

const text = (t: string): Input => ({ type: "text", text: t });
const button = (data: string): Input => ({ type: "button", data });
const voice = (id: string, extra?: Partial<AudioRef>): Input => ({
  type: "audio",
  audio: audio(id, extra),
});

describe("bot Telegram : le parcours d'un cours", () => {
  it("mène de l'audio au brouillon à déposer, série existante et catégories comprises", () => {
    const { last, submitted, replies } = play([
      voice("a"),
      text("  Berakhot, chapitre 5  "),
      text("La prière et sa concentration."),
      button("serie:0"), // triées par nom : « Émouna » avant « Michna Berakhot »
      button("episode:1"),
      button("cat:0"),
      text("Tefila"),
      button("cat:ok"),
      button("confirm:send"),
    ]);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      name: "Berakhot, chapitre 5",
      description: "La prière et sa concentration.",
      serieId: "rav-x--emouna",
      newSerieName: null,
      episode: 1,
      categories: ["Michna", "Tefila"],
      audio: { fileId: "file-a" },
    });
    expect(last.state).toEqual({ draft: null, queue: [] });
    expect(replies.at(-1)?.text).toBe(TEXTS.sending);
  });

  it("propose le numéro qui suit dans la série choisie", () => {
    const { last } = play([
      voice("a"),
      text("Titre"),
      button("description:skip"),
      button("serie:1"),
    ]);
    expect(last.state.draft?.step).toBe("episode");
    expect(last.replies[0].buttons?.[0][0]).toEqual({ text: "Épisode 5", data: "episode:5" });
  });

  it("crée une série à partir d'un nom tapé, et reconnaît une série existante", () => {
    const created = play([voice("a"), text("Titre"), text("/passer"), text("Hilkhot Chabbat")]);
    expect(created.last.state.draft).toMatchObject({
      serieId: null,
      newSerieName: "Hilkhot Chabbat",
      step: "episode",
    });
    const known = play([voice("a"), text("Titre"), text("/passer"), text("michna berakhot")]);
    expect(known.last.state.draft).toMatchObject({
      serieId: "rav-x--michna-berakhot",
      newSerieName: null,
    });
  });

  it("saute l'épisode quand le cours n'a pas de série", () => {
    const { last, submitted } = play([
      voice("a"),
      text("Titre"),
      text("/passer"),
      button("serie:none"),
      button("cat:ok"),
      button("confirm:send"),
    ]);
    expect(submitted[0]).toMatchObject({ serieId: null, episode: null, categories: [] });
    expect(last.state.draft).toBeNull();
  });

  it("redemande un titre trop long ou un épisode qui n'est pas un nombre", () => {
    const long = play([voice("a"), text("x".repeat(201))]);
    expect(long.last.state.draft?.step).toBe("title");
    const episode = play([
      voice("a"),
      text("Titre"),
      text("/passer"),
      button("serie:0"),
      text("cinq"),
    ]);
    expect(episode.last.state.draft?.step).toBe("episode");
    expect(episode.last.replies[0].text).toContain(TEXTS.badEpisode);
  });

  it("met les audios reçus en cours de route en file, et passe au suivant après l'envoi", () => {
    const { last, replies } = play([
      voice("a"),
      voice("b"),
      voice("b"), // le même fichier renvoyé : une seule fois
      voice("c"),
      text("Premier"),
      text("/passer"),
      button("serie:none"),
      button("cat:ok"),
      button("confirm:send"),
    ]);
    expect(replies[1].text).toBe(TEXTS.queued(1));
    expect(replies[3].text).toBe(TEXTS.queued(2));
    expect(last.state.draft).toMatchObject({ step: "title", audio: { fileId: "file-b" } });
    expect(last.state.queue.map((a) => a.fileId)).toEqual(["file-c"]);
  });

  it("abandonne le cours en cours avec /annuler, et reprend la file", () => {
    const { last } = play([voice("a"), voice("b"), text("Titre"), text("/annuler")]);
    expect(last.replies[0].text).toBe(TEXTS.cancelled("Titre"));
    expect(last.state.draft?.audio.fileId).toBe("file-b");
    expect(last.state.queue).toEqual([]);
  });

  it("corrige un seul champ depuis le récapitulatif, puis y revient", () => {
    const upToConfirm: Input[] = [
      voice("a"),
      text("Tite"),
      text("/passer"),
      button("serie:none"),
      button("cat:ok"),
    ];
    const { last } = play([
      ...upToConfirm,
      button("confirm:edit"),
      button("edit:title"),
      text("Titre"),
    ]);
    expect(last.state.draft).toMatchObject({ step: "confirm", name: "Titre", editing: false });
    expect(last.replies[0].text).toContain("Titre : Titre");

    // Une série choisie en correction appelle son numéro avant le récapitulatif.
    const serie = play([
      ...upToConfirm,
      button("confirm:edit"),
      button("edit:serie"),
      button("serie:1"),
    ]);
    expect(serie.last.state.draft?.step).toBe("episode");
    const back = converse(serie.last.state, button("episode:5"), ctx);
    expect(back.state.draft).toMatchObject({ step: "confirm", episode: 5 });
  });

  it("ignore un bouton d'une question déjà passée", () => {
    const { last } = play([
      voice("a"),
      text("Titre"),
      text("Une description"),
      button("description:skip"),
    ]);
    expect(last.stale).toBe(true);
    expect(last.state.draft?.step).toBe("serie");
    expect(last.state.draft?.description).toBe("Une description");
  });

  it("coche et décoche une catégorie sur place", () => {
    const { last } = play([
      voice("a"),
      text("Titre"),
      text("/passer"),
      button("serie:none"),
      button("cat:1"),
    ]);
    expect(last.edit).toBe(true);
    expect(last.state.draft?.categories).toEqual(["Pessah"]);
    expect(last.replies[0].buttons?.[0][1].text).toBe("✓ Pessah");
    const again = converse(last.state, button("cat:1"), ctx);
    expect(again.state.draft?.categories).toEqual([]);
  });

  it("invite à envoyer un audio tant qu'aucun cours n'est en cours", () => {
    expect(converse(EMPTY_STATE, text("Bonjour"), ctx).replies[0].text).toBe(TEXTS.idle);
    expect(converse(EMPTY_STATE, text("/aide"), ctx).replies[0].text).toBe(TEXTS.help);
    expect(converse(EMPTY_STATE, button("confirm:send"), ctx).stale).toBe(true);
  });
});

describe("bot Telegram : les fichiers reçus", () => {
  it("prend un vocal, un fichier audio, ou un document audio", () => {
    const file = { file_id: "f", file_unique_id: "u", file_size: 1000 };
    expect(audioFromMessage({ voice: { ...file, duration: 30, mime_type: "audio/ogg" } })).toEqual({
      audio: expect.objectContaining({ kind: "voice", duration: 30 }),
    });
    expect(audioFromMessage({ audio: { ...file, file_name: "cours.mp3" } })).toEqual({
      audio: expect.objectContaining({ kind: "audio", fileName: "cours.mp3" }),
    });
    // Un vocal WhatsApp transféré : un document .opus sans type audio annoncé.
    expect(
      audioFromMessage({
        document: { ...file, file_name: "PTT-2026.opus", mime_type: "application/octet-stream" },
      }),
    ).toEqual({ audio: expect.objectContaining({ kind: "document" }) });
  });

  it("refuse ce qui n'est pas un audio, les vidéos, et ce que Telegram ne laisse pas télécharger", () => {
    const file = { file_id: "f", file_unique_id: "u" };
    expect(
      audioFromMessage({
        document: { ...file, file_name: "notes.pdf", mime_type: "application/pdf" },
      }),
    ).toEqual({
      error: "notAudio",
    });
    expect(audioFromMessage({ video: {} })).toEqual({ error: "video" });
    expect(audioFromMessage({ audio: { ...file, file_size: TELEGRAM_DOWNLOAD_MAX + 1 } })).toEqual({
      error: "tooBig",
      sizeMb: "20",
    });
    expect(audioFromMessage({ text: "Bonjour" })).toBeNull();
  });

  it("convertit en mp3 ce que l'app ne lit pas partout, garde mp3, m4a et aac", () => {
    expect(audioFormat({ mimeType: "audio/ogg", fileName: null }, "voice/file_1.oga")).toEqual({
      source: "oga",
      target: "mp3",
      transcode: true,
    });
    expect(audioFormat({ mimeType: "audio/mpeg", fileName: "a.mp3" }, "music/file_2.mp3")).toEqual({
      source: "mp3",
      target: "mp3",
      transcode: false,
    });
    expect(
      audioFormat({ mimeType: "audio/x-m4a", fileName: null }, "documents/file_3"),
    ).toMatchObject({
      target: "m4a",
      transcode: false,
    });
    expect(
      audioFormat({ mimeType: null, fileName: "cours.wav" }, "documents/file_4.wav"),
    ).toMatchObject({
      target: "mp3",
      transcode: true,
    });
  });

  it("lit la durée qu'annonce ffmpeg", () => {
    expect(parseFfmpegDuration("  Duration: 01:02:03.50, start: 0.000000, bitrate: 32 kb/s")).toBe(
      3724,
    );
    expect(parseFfmpegDuration("rien")).toBeNull();
  });

  it("lit les catégories et les épisodes tapés", () => {
    expect(parseCategories("Michna, Pessah ;  Hilkhot  Chabbat,,")).toEqual([
      "Michna",
      "Pessah",
      "Hilkhot Chabbat",
    ]);
    expect(parseEpisode("12")).toBe(12);
    expect(parseEpisode("épisode 3")).toBe(3);
    expect(parseEpisode("0")).toBeNull();
    expect(parseEpisode("trois")).toBeNull();
  });
});

describe("bot Telegram : le lien et le webhook", () => {
  it("dérive le secret du webhook de la même façon côté script et côté function", () => {
    expect(telegramWebhookSecret("123:ABC")).toBe(webhookSecret("123:ABC"));
    // Telegram n'accepte que A-Z, a-z, 0-9, _ et -, 256 caractères au plus.
    expect(webhookSecret("123:ABC")).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });

  it("fait tenir le jeton studio dans le paramètre /start de Telegram", () => {
    const token = "a".repeat(64); // generateStudioToken : 32 octets en hexadécimal
    const link = telegramLink("PetiteJerusalemBot", token);
    expect(link).toBe(`https://t.me/PetiteJerusalemBot?start=${token}`);
    expect(new URL(link).searchParams.get("start")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe("bot Telegram : typographie de ce qu'il écrit", () => {
  /** Tout ce que le bot peut écrire, sur un parcours qui passe partout. */
  function everything(): string[] {
    const fixed = Object.values(TEXTS).flatMap((t) =>
      typeof t === "string"
        ? [t]
        : [
            (t as (...a: unknown[]) => string)("Rav X", audio("z")),
            (t as (...a: unknown[]) => string)(2),
          ].filter((v): v is string => typeof v === "string"),
    );
    const { replies } = play([
      voice("a"),
      voice("b"),
      text("Titre"),
      text("Description"),
      text("Nouvelle"),
      text("3"),
      text("Michna"),
      button("cat:ok"),
      button("confirm:edit"),
      button("edit:back"),
      button("confirm:send"),
    ]);
    const empty = play([voice("a"), text("Titre"), text("/passer")], EMPTY_STATE, {
      series: [],
      categories: [],
    });
    return [
      ...fixed,
      ...[...replies, ...empty.replies].flatMap((r) => [
        r.text,
        ...(r.buttons ?? []).flat().map((b) => b.text),
      ]),
    ];
  }

  it("n'a aucune espace sécable avant une ponctuation double, ni dans les guillemets", () => {
    const offenders = everything().filter((t) => / [!?;:»]/.test(t) || t.includes("« "));
    expect(offenders).toEqual([]);
  });

  it("ne porte aucun tiret long", () => {
    // Écrits en échappement, comme dans typography.test.ts : en clair, ils feraient échouer ce dernier.
    const longDash = new RegExp("[\\u2013\\u2014]");
    expect(everything().filter((t) => longDash.test(t))).toEqual([]);
  });
});
