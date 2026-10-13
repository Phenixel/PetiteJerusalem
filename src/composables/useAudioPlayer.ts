import { ref, computed } from "vue";
import { analyticsService } from "../services/analyticsService";
import { useViewedChiourim } from "./useViewedChiourim";
import { recordFinished, recordPosition, resumePosition } from "../services/listeningProgress";

/**
 * Lecteur audio global (singleton au niveau module).
 *
 * L'élément <audio> vit hors de l'arbre des composants : la lecture survit aux
 * navigations. La page détail (AudioPlayer) et le mini-lecteur
 * (GlobalAudioPlayer) pilotent tous deux cet état partagé.
 *
 * Il joue une file : les épisodes d'une série, les cours d'un texte, la
 * liste d'où l'on a lancé l'écoute. Un cours fini enchaîne sur le suivant,
 * comme une liste de lecture ; un cours entamé reprend là où on l'a laissé
 * (voir listeningProgress).
 */

export interface AudioTrack {
  src: string;
  title: string;
  /** Slug du chiour, pour relier le mini-lecteur à sa page détail. */
  slug?: string;
  /** La ligne sous le titre : le rav, la série. */
  subtitle?: string;
  /** De quoi dessiner la pochette sans relire le catalogue (voir ChiourCover). */
  cover?: { seed: string; label: string };
  /** Durée connue d'avance (le dépôt l'a mesurée), pour la file du lecteur. */
  duration?: number | null;
  /** D'où vient la file : la série, le rav, le texte (« Lecture depuis… »). */
  context?: string | null;
}

const track = ref<AudioTrack | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const previousVolume = ref(1);
const playbackRate = ref(1);
const isLoaded = ref(false);
/** La file en cours, et la place du morceau chargé dans cette file. */
const queue = ref<AudioTrack[]>([]);
const queueIndex = ref(-1);
/**
 * Le lecteur plein écran (NowPlayingSheet) : ouvert d'un appui sur la barre
 * du bas, il y montre le cours qui joue, ses commandes, la suite de la file.
 */
const sheetOpen = ref(false);

let audio: HTMLAudioElement | null = null;
// Seek demandé avant que les métadonnées soient chargées (clic sur la barre
// d'un morceau pas encore lancé) : appliqué dès loadedmetadata.
let pendingSeekRatio: number | null = null;
// Reprise d'un cours entamé, en secondes : appliquée dès loadedmetadata.
let pendingSeekSeconds: number | null = null;
// Le morceau en cours a-t-il été lancé par la file (fin du précédent) ?
let startedByQueue = false;
/**
 * D'où l'écoute a été lancée (propriété `source` de `chiour_played`) : la
 * page du cours, une série, un auteur, le catalogue, la reprise, un texte de
 * la bibliothèque. Gardée pour toute la file qu'elle a lancée.
 */
export type PlaySource = "chiour" | "serie" | "auteur" | "catalogue" | "reprise" | "texte";
let playSource: PlaySource = "chiour";
// Dernière position retenue (listeningProgress), pour n'écrire qu'à intervalles.
let lastRecorded = 0;
const RECORD_EVERY = 10;

// --- Engagement audio : écoute réelle, pas seulement des pages vues. ---
// `chiour_played` une fois par morceau lancé, puis `chiour_progress` aux
// jalons 25/50/75 (temps de lecture) et 100 (fin du morceau).
let trackedSrc: string | null = null;
const reachedMilestones = new Set<number>();

function trackProperties() {
  return {
    chiour_slug: track.value?.slug ?? null,
    chiour_title: track.value?.title ?? null,
    duration_seconds: Math.round(duration.value) || null,
  };
}

function trackPlayStarted() {
  if (!track.value || track.value.src === trackedSrc) return;
  trackedSrc = track.value.src;
  reachedMilestones.clear();
  analyticsService.capture("chiour_played", {
    ...trackProperties(),
    // Enchaîné par la file à la fin du précédent, ou lancé à la main.
    autoplay: startedByQueue,
    source: playSource,
    // Repris là où on l'avait laissé, ou écouté du début.
    // (la reprise peut attendre encore les métadonnées : pendingSeekSeconds).
    resumed: pendingSeekSeconds !== null || (audio !== null && audio.currentTime > 1),
  });
}

/** Retient la position du morceau en cours (listeningProgress). */
function recordCurrent(force = false) {
  if (!audio || !track.value?.slug) return;
  if (!force && Math.abs(audio.currentTime - lastRecorded) < RECORD_EVERY) return;
  lastRecorded = audio.currentTime;
  recordPosition(track.value.slug, audio.currentTime, duration.value);
}

function trackMilestone(milestone: number) {
  if (!track.value || track.value.src !== trackedSrc || reachedMilestones.has(milestone)) return;
  reachedMilestones.add(milestone);
  analyticsService.capture("chiour_progress", { ...trackProperties(), milestone });
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const sStr = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sStr}`;
  return `${m}:${sStr}`;
}

function updateMediaSession() {
  if (!("mediaSession" in navigator) || !track.value) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.value.title,
    artist: track.value.subtitle || "Petite Jerusalem",
    album: "Petite Jerusalem",
  });
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;

  audio = new Audio();
  audio.preload = "metadata";

  audio.addEventListener("loadedmetadata", () => {
    if (!audio) return;
    duration.value = audio.duration;
    isLoaded.value = true;
    if (pendingSeekRatio !== null) {
      audio.currentTime = pendingSeekRatio * audio.duration;
      pendingSeekRatio = null;
      pendingSeekSeconds = null;
    } else if (pendingSeekSeconds !== null) {
      if (pendingSeekSeconds < audio.duration) audio.currentTime = pendingSeekSeconds;
      pendingSeekSeconds = null;
    }
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio) return;
    // timeupdate tire ~4×/s : publier chaque tick re-rendrait les composants
    // abonnés (mini-lecteur monté sur toutes les pages) 4×/s pendant toute
    // l'écoute. L'affichage est à la seconde (formatTime, barre de progression),
    // on ne publie donc qu'au changement de seconde, les seeks passent aussi.
    if (Math.abs(audio.currentTime - currentTime.value) >= 1) {
      currentTime.value = audio.currentTime;
    }
    recordCurrent();
    if (duration.value > 0) {
      const pct = (audio.currentTime / duration.value) * 100;
      if (pct >= 75) trackMilestone(75);
      else if (pct >= 50) trackMilestone(50);
      else if (pct >= 25) trackMilestone(25);
    }
  });
  audio.addEventListener("play", () => {
    isPlaying.value = true;
    trackPlayStarted();
    // C'est le démarrage de l'écoute qui marque un chiour comme vu, pas
    // l'arrivée sur sa page (voir DetailChiour). Idempotent et inerte pour un
    // visiteur non connecté.
    if (track.value?.slug) useViewedChiourim().markViewed(track.value.slug);
  });
  audio.addEventListener("pause", () => {
    isPlaying.value = false;
    recordCurrent(true);
  });
  audio.addEventListener("ended", () => {
    isPlaying.value = false;
    trackMilestone(100);
    if (track.value?.slug) recordFinished(track.value.slug, duration.value);
    // La file continue : l'épisode suivant, comme une liste de lecture.
    if (hasNext.value) next(true);
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => audio?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      if (hasNext.value) next();
    });
  }

  return audio;
}

function load(newTrack: AudioTrack) {
  const el = ensureAudio();
  if (track.value?.src === newTrack.src) {
    // Même source : on rafraîchit juste les métadonnées (titre, slug).
    track.value = newTrack;
    updateMediaSession();
    return;
  }
  track.value = newTrack;
  currentTime.value = 0;
  duration.value = 0;
  isLoaded.value = false;
  pendingSeekRatio = null;
  lastRecorded = 0;
  pendingSeekSeconds = newTrack.slug ? resumePosition(newTrack.slug) : null;
  el.src = newTrack.src;
  el.volume = volume.value;
  el.playbackRate = playbackRate.value;
  updateMediaSession();
}

function play(newTrack?: AudioTrack, source: PlaySource = "chiour") {
  if (newTrack) {
    playSource = source;
    // Un morceau hors de la file en cours la remplace : il est seul.
    const index = queue.value.findIndex((t) => t.src === newTrack.src);
    if (index === -1) {
      queue.value = [newTrack];
      queueIndex.value = 0;
    } else {
      queueIndex.value = index;
    }
    startedByQueue = false;
    load(newTrack);
  }
  ensureAudio()
    .play()
    .catch(() => {
      // Lecture refusée (politique autoplay…) : l'état reste en pause.
    });
}

/**
 * Joue une liste à partir d'un de ses morceaux : la suite s'enchaînera seule.
 * Le morceau déjà chargé n'est pas relancé, la file change simplement autour
 * de lui.
 */
function playQueue(tracks: AudioTrack[], index: number, source: PlaySource) {
  const start = tracks[index];
  if (!start) return;
  playSource = source;
  queue.value = tracks;
  queueIndex.value = index;
  startedByQueue = false;
  load(start);
  play();
}

const hasNext = computed(() => queueIndex.value >= 0 && queueIndex.value < queue.value.length - 1);
const hasPrevious = computed(() => queueIndex.value > 0);

/** Le morceau suivant de la file ; `auto` quand c'est la fin du précédent qui l'appelle. */
function next(auto = false) {
  const following = queue.value[queueIndex.value + 1];
  if (!following) return;
  queueIndex.value += 1;
  startedByQueue = auto;
  load(following);
  play();
}

/** Joue le morceau de la file à cette place (la file du lecteur plein écran). */
function playAt(index: number) {
  const target = queue.value[index];
  if (!target) return;
  if (index === queueIndex.value) {
    if (!isPlaying.value) play();
    return;
  }
  queueIndex.value = index;
  startedByQueue = false;
  load(target);
  play();
}

/**
 * Comme partout : au-delà des premières secondes, revient au début du
 * morceau ; au début, passe au précédent de la file.
 */
function previous() {
  const before = queue.value[queueIndex.value - 1];
  if (audio && (audio.currentTime > 5 || !before)) {
    audio.currentTime = 0;
    return;
  }
  if (!before) return;
  queueIndex.value -= 1;
  startedByQueue = false;
  load(before);
  play();
}

function toggle() {
  if (!audio || !track.value) return;
  if (isPlaying.value) audio.pause();
  else play();
}

function skip(seconds: number) {
  if (!audio || !isLoaded.value) return;
  audio.currentTime = Math.max(0, Math.min(duration.value, audio.currentTime + seconds));
}

function seekRatio(ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (!audio || !isLoaded.value) {
    pendingSeekRatio = clamped;
    return;
  }
  audio.currentTime = clamped * duration.value;
}

function setVolume(v: number) {
  volume.value = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume.value;
}

function toggleMute() {
  if (volume.value > 0) {
    previousVolume.value = volume.value;
    setVolume(0);
  } else {
    setVolume(previousVolume.value || 1);
  }
}

function setSpeed(speed: number) {
  playbackRate.value = speed;
  if (audio) audio.playbackRate = speed;
}

/** Arrête la lecture et ferme le mini-lecteur. */
function close() {
  recordCurrent(true);
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  track.value = null;
  isPlaying.value = false;
  currentTime.value = 0;
  duration.value = 0;
  isLoaded.value = false;
  pendingSeekRatio = null;
  pendingSeekSeconds = null;
  sheetOpen.value = false;
  queue.value = [];
  queueIndex.value = -1;
}

const progress = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

const isMuted = computed(() => volume.value === 0);

export function useAudioPlayer() {
  return {
    track,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    progress,
    isMuted,
    queue,
    queueIndex,
    hasNext,
    hasPrevious,
    play,
    playQueue,
    playAt,
    next,
    previous,
    toggle,
    skip,
    seekRatio,
    setVolume,
    toggleMute,
    setSpeed,
    close,
    sheetOpen,
    openSheet: () => {
      if (track.value) sheetOpen.value = true;
    },
    closeSheet: () => {
      sheetOpen.value = false;
    },
  };
}

/**
 * La barre du lecteur est visible dès qu'un morceau est chargé, sur toutes
 * les pages (celle du cours comprise : elle n'a plus de lecteur à elle), sauf
 * quand le lecteur plein écran la recouvre.
 */
export function useMiniPlayerVisible() {
  return computed(() => !!track.value && !sheetOpen.value);
}
