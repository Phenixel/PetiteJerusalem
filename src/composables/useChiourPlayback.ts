import type { Chiour } from "../models/models";
import { serieService } from "../services/serieService";
import { useAudioPlayer, type AudioTrack, type PlaySource } from "./useAudioPlayer";

/**
 * Jouer des cours depuis une liste, comme on lance un morceau d'un album :
 * la liste affichée devient la file du lecteur, et l'écoute enchaîne sur le
 * cours suivant. Toucher le cours qui joue le met en pause.
 */

/** Le nom de la série d'un cours, si le cache des séries le connaît déjà. */
function serieNameOf(chiour: Chiour): string | null {
  if (!chiour.serieId) return null;
  return serieService.peekSeries()?.find((s) => s.id === chiour.serieId)?.name ?? null;
}

/** La ligne sous le titre d'un cours : le rav, la série. */
export function chiourSubtitle(chiour: Chiour, serieName = serieNameOf(chiour)): string {
  return [chiour.auteur, serieName].filter(Boolean).join(" · ");
}

/** La pochette d'un cours : celle de sa série, sinon celle de son rav. */
export function chiourCover(chiour: Chiour, serieName = serieNameOf(chiour)) {
  if (chiour.serieId && serieName) return { seed: chiour.serieId, label: serieName };
  if (chiour.auteur) return { seed: chiour.auteurId ?? chiour.auteur, label: chiour.auteur };
  return { seed: chiour.slug, label: chiour.name };
}

/** Accents et majuscules ôtés, pour comparer un titre et un nom de série. */
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Le titre d'un cours là où sa série n'est pas dite (la recherche, l'onglet,
 * le partage) : suivi du nom de la série, sauf s'il le contient déjà.
 * « Chapitre 3 (2/7) » devient « Chapitre 3 (2/7) · Shaar Habitahon » ;
 * « Shaar Habitahon Shiour 12 » reste tel quel.
 */
export function titleWithSerie(title: string, serieName: string | null | undefined): string {
  if (!serieName || fold(title).includes(fold(serieName))) return title;
  return `${title} · ${serieName}`;
}

/**
 * Le titre d'un cours sans le nom de sa série quand il le répète, pour une
 * liste où la série est déjà dite : « Shaar Habitahon Shiour 10 Chapitre 2 »
 * devient « Shiour 10 Chapitre 2 » sous « Shaar Habitahon ». Accents et
 * majuscules ignorés pour la comparaison ; le reste garde sa graphie, sa
 * première lettre en capitale. Un titre qui n'est que le nom de la série
 * reste entier.
 */
export function shortTitle(title: string, prefix: string | null | undefined): string {
  if (!prefix) return title;
  if (!fold(title).startsWith(fold(prefix))) return title;
  const rest = title.slice(prefix.length).replace(/^[\s\-\u2013:,.·]+/, "");
  if (!rest) return title;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function chiourTrack(chiour: Chiour, context: string | null = null): AudioTrack {
  const serieName = serieNameOf(chiour);
  return {
    src: chiour.mediaUrl,
    title: chiour.name,
    slug: chiour.slug,
    subtitle: chiour.auteur ?? "",
    cover: chiourCover(chiour, serieName),
    duration: chiour.duration,
    context: context ?? serieName ?? chiour.auteur,
    serie: serieName,
    texteId: chiour.texteId,
    texteChapitre: chiour.texteChapitre,
    episode: chiour.episode,
  };
}

export function useChiourPlayback() {
  const player = useAudioPlayer();

  const isCurrent = (slug: string) => player.track.value?.slug === slug;
  const isPlaying = (slug: string) => isCurrent(slug) && player.isPlaying.value;

  /**
   * Joue `chiour` en faisant de `list` la file : les cours qui ont un audio,
   * dans l'ordre affiché. Le cours qui joue déjà se met en pause (ou repart).
   * `context` dit d'où vient la file, en tête du lecteur plein écran
   * (« Lecture depuis Chaar Habita'hon ») ; par défaut la série du cours.
   */
  function playFrom(
    list: Chiour[],
    chiour: Chiour,
    source: PlaySource,
    context: string | null = null,
  ) {
    if (isCurrent(chiour.slug)) {
      player.toggle();
      return;
    }
    const playable = list.filter((c) => c.mediaUrl);
    const index = playable.findIndex((c) => c.slug === chiour.slug);
    if (index === -1) {
      if (chiour.mediaUrl) player.play(chiourTrack(chiour, context), source);
      return;
    }
    player.playQueue(
      playable.map((c) => chiourTrack(c, context)),
      index,
      source,
    );
  }

  return { player, isCurrent, isPlaying, playFrom };
}
