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
