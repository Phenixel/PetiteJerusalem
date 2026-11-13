import { computed, ref } from "vue";
import type { AudioTrack } from "./useAudioPlayer";

/**
 * The two pieces of player state the app shell reads on every page: the
 * loaded track and whether the full-screen player covers the bar.
 *
 * They live apart from useAudioPlayer so that App.vue, the bottom chrome and
 * the home page can ask "is a lesson loaded?" without pulling the whole
 * player (audio element, media session, listening progress, analytics) into
 * the initial bundle. useAudioPlayer owns and writes them.
 */
export const track = ref<AudioTrack | null>(null);
export const sheetOpen = ref(false);

/**
 * La barre du lecteur est visible dès qu'un morceau est chargé, sur toutes
 * les pages (celle du cours comprise : elle n'a plus de lecteur à elle), sauf
 * quand le lecteur plein écran la recouvre.
 */
export function useMiniPlayerVisible() {
  return computed(() => !!track.value && !sheetOpen.value);
}
