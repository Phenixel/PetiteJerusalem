import { ref, computed } from "vue";
import { useRoute } from "vue-router";

/**
 * Lecteur audio global (singleton au niveau module).
 *
 * L'élément <audio> vit hors de l'arbre des composants : la lecture survit aux
 * navigations. La page détail (AudioPlayer) et le mini-lecteur
 * (GlobalAudioPlayer) pilotent tous deux cet état partagé.
 */

export interface AudioTrack {
  src: string;
  title: string;
  /** Slug du chiour, pour relier le mini-lecteur à sa page détail. */
  slug?: string;
}

const track = ref<AudioTrack | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const previousVolume = ref(1);
const playbackRate = ref(1);
const isLoaded = ref(false);

let audio: HTMLAudioElement | null = null;
// Seek demandé avant que les métadonnées soient chargées (clic sur la barre
// d'un morceau pas encore lancé) : appliqué dès loadedmetadata.
let pendingSeekRatio: number | null = null;

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
    artist: "Petite Jerusalem",
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
    }
  });
  audio.addEventListener("timeupdate", () => {
    if (audio) currentTime.value = audio.currentTime;
  });
  audio.addEventListener("play", () => {
    isPlaying.value = true;
  });
  audio.addEventListener("pause", () => {
    isPlaying.value = false;
  });
  audio.addEventListener("ended", () => {
    isPlaying.value = false;
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => audio?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
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
  el.src = newTrack.src;
  el.volume = volume.value;
  el.playbackRate = playbackRate.value;
  updateMediaSession();
}

function play(newTrack?: AudioTrack) {
  if (newTrack) load(newTrack);
  ensureAudio()
    .play()
    .catch(() => {
      // Lecture refusée (politique autoplay…) : l'état reste en pause.
    });
}

function pause() {
  audio?.pause();
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
    isLoaded,
    progress,
    isMuted,
    load,
    play,
    pause,
    toggle,
    skip,
    seekRatio,
    setVolume,
    toggleMute,
    setSpeed,
    close,
  };
}

/**
 * Le mini-lecteur est visible dès qu'un morceau est chargé, sauf sur la page
 * détail de ce même chiour (le lecteur complet y est déjà affiché).
 */
export function useMiniPlayerVisible() {
  const route = useRoute();
  return computed(() => {
    if (!track.value) return false;
    return !(route.name === "detail-chiour" && route.params.slug === track.value.slug);
  });
}
