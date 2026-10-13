<script setup lang="ts">
/**
 * La vitesse d'écoute : une pastille qui dit la vitesse en cours, et qui
 * ouvre la liste des vitesses (de 0,75× à 2×) où l'on touche celle qu'on
 * veut, cochée quand c'est la sienne. Faire défiler les vitesses d'appui en
 * appui obligeait à passer par toutes pour revenir en arrière.
 *
 * Le menu se ferme au choix, d'un appui à côté, par Échap (sans fermer le
 * lecteur plein écran autour) ou par le retour d'Android, et se parcourt aux
 * flèches. Ses couleurs sont celles du lecteur : le crème des titres, et la
 * reliure du cours pour l'encre, comme le bouton de lecture.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAudioPlayer } from "../../composables/useAudioPlayer";
import { useOverlay } from "../../composables/useOverlayStack";
import { analyticsService } from "../../services/analyticsService";
import { COVER_INK, playerTone } from "./cover";
import AppIcon from "../icons/AppIcon.vue";

defineOptions({ inheritAttrs: false });

/** Où s'ouvre le menu : sous la pastille, ou au-dessus (la barre du bas). */
withDefaults(defineProps<{ placement?: "below" | "above" }>(), {
  placement: "below",
});

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const { t, locale } = useI18n();
const player = useAudioPlayer();

const format = (speed: number) => `${speed.toLocaleString(locale.value)}×`;
const rate = computed(() => player.playbackRate.value.toLocaleString(locale.value));
const ink = computed(() =>
  playerTone(player.track.value?.cover?.seed ?? player.track.value?.slug ?? ""),
);

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const items = ref<HTMLButtonElement[]>([]);

function close(refocus = false) {
  open.value = false;
  if (refocus) trigger.value?.focus();
}

useOverlay(open, () => close(true));

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener("pointerdown", onOutside, true);
    await nextTick();
    const current = SPEEDS.indexOf(player.playbackRate.value);
    items.value[current >= 0 ? current : 1]?.focus();
  } else {
    document.removeEventListener("pointerdown", onOutside, true);
  }
});
onBeforeUnmount(() => document.removeEventListener("pointerdown", onOutside, true));

function onOutside(event: Event) {
  if (!root.value?.contains(event.target as Node)) close();
}

function choose(speed: number) {
  if (speed !== player.playbackRate.value) {
    // Le seul réglage d'écoute qui dise quelque chose du public : accélérer, ce
    // sont des habitués qui suivent une série ; ralentir, c'est de l'étude ligne
    // à ligne. Mêmes clés que `chiour_played`, pour recoller les deux.
    analyticsService.capture("chiour_speed_changed", {
      chiour_slug: player.track.value?.slug ?? null,
      chiour_title: player.track.value?.title ?? null,
      speed,
    });
    player.setSpeed(speed);
  }
  close(true);
}

/** Les flèches passent d'une vitesse à l'autre dans le menu. */
function onMenuKey(event: KeyboardEvent) {
  const index = items.value.indexOf(document.activeElement as HTMLButtonElement);
  const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (move !== undefined) {
    event.preventDefault();
    items.value[(index + move + SPEEDS.length) % SPEEDS.length]?.focus();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    items.value[event.key === "Home" ? 0 : SPEEDS.length - 1]?.focus();
  }
}
</script>

<template>
  <div ref="root" class="relative" @keydown.esc.stop.prevent="close(true)">
    <button
      ref="trigger"
      type="button"
      v-bind="$attrs"
      class="min-w-[3.25rem] rounded-pill px-3 py-1.5 text-sm font-bold tabular-nums transition-colors"
      :aria-label="t('audioPlayer.speedValue', { speed: rate })"
      :title="t('audioPlayer.speed')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ rate }}×
    </button>

    <Transition name="speed-menu">
      <div
        v-if="open"
        role="menu"
        :aria-label="t('audioPlayer.speed')"
        class="speed-menu absolute end-0 z-10 w-48 overflow-hidden rounded-control py-1 shadow-pop"
        :class="
          placement === 'above' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'
        "
        :style="{ backgroundColor: COVER_INK, color: ink }"
        @keydown="onMenuKey"
      >
        <p
          class="whitespace-nowrap px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider opacity-70"
        >
          {{ t("audioPlayer.speed") }}
        </p>
        <button
          v-for="speed in SPEEDS"
          :key="speed"
          ref="items"
          type="button"
          role="menuitemradio"
          :aria-checked="speed === player.playbackRate.value"
          class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm font-semibold tabular-nums transition-colors hover:bg-black/[0.06] focus-visible:bg-black/[0.08] focus-visible:outline-none"
          @click="choose(speed)"
        >
          {{ format(speed) }}
          <AppIcon v-if="speed === player.playbackRate.value" name="check" :size="16" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.speed-menu-enter-active,
.speed-menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.speed-menu-enter-from,
.speed-menu-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
  .speed-menu-enter-active,
  .speed-menu-leave-active {
    transition: none;
  }
}
</style>
