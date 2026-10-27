<script setup lang="ts">
/**
 * The panel that comes down from the top of the screen when a tefila opens.
 * It pushes the whole app down below it, as when the screen is split in
 * two, and stays under a fifth of the screen: the three quiet modes of the
 * phone (Do Not Disturb, silent, vibrate) as tiles, solid when the mode is
 * on, a touch turning it on or off (usePrayerQuiet, docs/design.md « A
 * tefila opens on the phone's quiet modes »). The app below stays in use:
 * it scrolls under the panel's lower edge, which stays put.
 *
 * A few seconds later (or at the first touch), it grows by a row of two
 * choices: « À chaque tefila » ("Every tefila") and « Fermer » ("Close").
 * « Fermer » first replaces the whole content by where these settings are
 * found again, with two buttons: « Fermer » again, and « Ne plus afficher
 * la prochaine fois » ("Don't show it next time"). A choice retracts the
 * panel upward as the app comes back up over it.
 *
 * It stays open until then: reading, scrolling or touching the app below
 * leaves it there, and nothing closes it on its own. Android back leaves
 * the tefila, the panel with it, and it comes back with the tefila as long
 * as « Fermer » was not touched (usePrayerQuiet). Modes applied by
 * themselves (« À chaque tefila ») bring it too, as a reminder of what is
 * on, until « Ne plus afficher la prochaine fois ».
 *
 * The panel's lower edge is glued to the app's upper edge: one offset,
 * the room the app leaves it (`appDrop.offset`), moves both.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import { prefersReducedMotion } from "../composables/useMotion";
import {
  appDrop,
  choosePrayerQuiet,
  closePrayerQuiet,
  dismissPrayerQuiet,
  DROP_MS,
  DROP_TRANSITION,
  isPrayerQuietKept,
  prayerQuiet,
  toggleQuietMode,
} from "../composables/usePrayerQuiet";
import { isQuietModeOn, type QuietMode } from "../services/prayerQuiet";
import type { IconName } from "./icons/registry";

const { t } = useI18n();
const route = useRoute();

/** The time to look at the modes before the choices come. */
const ACTIONS_DELAY_MS = 2000;

// Keys written out, so that the i18n guard finds their reader.
const MODES: { mode: QuietMode; icon: IconName; label: string }[] = [
  { mode: "dnd", icon: "circle-minus", label: "prayerQuiet.modes.dnd" },
  { mode: "silent", icon: "bell-off", label: "prayerQuiet.modes.silent" },
  { mode: "vibrate", icon: "vibrate", label: "prayerQuiet.modes.vibrate" },
];

const HINTS = {
  access: "prayerQuiet.hint.access",
  unavailable: "prayerQuiet.hint.unavailable",
} as const;

const tiles = computed(() =>
  MODES.map(({ mode, icon, label }) => ({
    mode,
    icon,
    label,
    on: prayerQuiet.state ? isQuietModeOn(prayerQuiet.state, mode) : false,
  })),
);
/** « À chaque tefila » keeps what is on: nothing on, nothing to keep. */
const anyOn = computed(() => tiles.value.some((tile) => tile.on));
/** What is on is already kept for every tefila: the choice shows as made. */
const kept = computed(() => isPrayerQuietKept(prayerQuiet.state));

const panel = ref<HTMLElement | null>(null);
const closing = ref(false);
/** The panel has taken its place above the screen: it may move from now on. */
const entered = ref(false);
const showActions = ref(false);
/** After « Fermer »: where to find the settings again, and whether to show it next time. */
const farewell = ref(false);
/** The panel's height, read with the app's offset so that the two move together. */
const height = ref(0);
let returnFocus: HTMLElement | null = null;
let closeTimer: number | undefined;
let actionsTimer: number | undefined;
let resizeObserver: ResizeObserver | null = null;

const panelStyle = computed(() => ({
  // The message takes the place of the modes without the panel jumping.
  minHeight: farewell.value ? `${height.value}px` : undefined,
  transform: `translate3d(0, ${appDrop.offset - height.value}px, 0)`,
  transition: !entered.value || prefersReducedMotion() ? "none" : DROP_TRANSITION,
}));

/**
 * Anchors and `scrollIntoView` land below the panel, not under it. Set on
 * the root, the element that scrolls.
 */
function reserveScroll(offset: number): void {
  document.documentElement.style.scrollPaddingTop = offset > 0 ? `${offset}px` : "";
}

function close(): void {
  if (closing.value) return;
  closing.value = true;
  // The focus goes back where it was only if it is still in the panel: the
  // app below may have taken it since.
  const hadFocus = panel.value?.contains(document.activeElement) ?? false;
  appDrop.offset = 0;
  reserveScroll(0);
  closeTimer = window.setTimeout(
    () => {
      closePrayerQuiet();
      if (hadFocus) returnFocus?.focus?.({ preventScroll: true });
    },
    prefersReducedMotion() ? 0 : DROP_MS,
  );
}

function choose(action: "never" | "always"): void {
  choosePrayerQuiet(action);
  close();
}

/**
 * « Fermer »: the modes stay for this prayer, the panel will not come back
 * in it, and it says where the settings live. It closes with one of the
 * message's two buttons.
 */
function sayFarewell(): void {
  dismissPrayerQuiet();
  farewell.value = true;
}

function onTile(mode: QuietMode, on: boolean): void {
  revealActions();
  void toggleQuietMode(mode, !on);
}

function revealActions(): void {
  window.clearTimeout(actionsTimer);
  showActions.value = true;
}

/** The app goes down by the panel's height, and follows it when it grows. */
function lower(): void {
  if (!panel.value || closing.value || !entered.value) return;
  const next = panel.value.offsetHeight;
  // The room is already the right one: nothing to write (the observer
  // signals itself once as soon as it observes, with the height of the
  // panel that has just been measured).
  if (next === height.value && appDrop.offset === next) return;
  height.value = next;
  appDrop.offset = next;
  reserveScroll(next);
}

/**
 * The same, from the panel's own resize callback, on the next frame.
 *
 * Lowering the app resizes `<html>` and `<body>`: the room is a padding on
 * the app's stage (App.vue), so the document grows by it. Both are observed
 * above us, and higher up in the tree than the panel (useScrollFrame on
 * `<html>`, useAutoScroll on `<body>`): writing the room from inside a
 * resize callback leaves the browser notifications it can no longer deliver
 * in the loop it is in, and it reports a « ResizeObserver loop completed
 * with undelivered notifications » error. Nothing moves wrong on screen,
 * but the error is unhandled and lands in the Error tracking (seen on the
 * Android app v4.0.0, Chrome 155, on a Min'ha). Measured in the callback,
 * written once the loop is over.
 */
let lowerFrame = 0;
function lowerNextFrame(): void {
  if (lowerFrame) return;
  lowerFrame = requestAnimationFrame(() => {
    lowerFrame = 0;
    lower();
  });
}

onMounted(async () => {
  returnFocus = document.activeElement as HTMLElement | null;
  // First in place above the screen, without moving (`entered` is false):
  // then the panel comes down and the app with it, from there.
  await nextTick();
  if (!panel.value) return;
  height.value = panel.value.offsetHeight;
  await nextTick();
  void panel.value.getBoundingClientRect();
  entered.value = true;
  lower();
  // The panel takes the focus, so that a screen reader reaches it first,
  // without a ring around a button nobody has reached with the keyboard.
  panel.value.focus({ preventScroll: true });
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => lowerNextFrame());
    resizeObserver.observe(panel.value);
  }
  actionsTimer = window.setTimeout(revealActions, ACTIONS_DELAY_MS);
});

onBeforeUnmount(() => {
  window.clearTimeout(closeTimer);
  window.clearTimeout(actionsTimer);
  resizeObserver?.disconnect();
  if (lowerFrame) cancelAnimationFrame(lowerFrame);
  appDrop.offset = 0;
  reserveScroll(0);
});

// The choices may make it grow: the app follows (the observer can be late).
watch([showActions, farewell], () => void nextTick(lower));
watch(
  () => prayerQuiet.hint,
  () => void nextTick(lower),
);

// Leaving the page (a link, the history) closes it with the page.
watch(
  () => route.fullPath,
  () => close(),
);
</script>

<template>
  <section
    ref="panel"
    class="prayer-quiet"
    role="region"
    aria-labelledby="prayer-quiet-title"
    tabindex="-1"
    :class="{ 'prayer-quiet-farewell': farewell }"
    :style="panelStyle"
  >
    <h2 id="prayer-quiet-title" class="sr-only">{{ t("prayerQuiet.title") }}</h2>
    <div v-if="farewell" class="quiet-farewell" role="status">
      <p class="text-sm text-text-primary">{{ t("prayerQuiet.farewell") }}</p>
      <div class="flex flex-wrap justify-center gap-1.5">
        <button type="button" class="btn btn-primary quiet-action" @click="close">
          {{ t("prayerQuiet.close") }}
        </button>
        <button type="button" class="btn btn-soft quiet-action" @click="choose('never')">
          {{ t("prayerQuiet.never") }}
        </button>
      </div>
    </div>
    <template v-else>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="tile in tiles"
          :key="tile.mode"
          type="button"
          class="quiet-tile"
          :class="{ 'quiet-tile-on': tile.on }"
          :aria-pressed="tile.on"
          @click="onTile(tile.mode, tile.on)"
        >
          <AppIcon :name="tile.icon" :size="18" />
          <span class="text-xs font-semibold leading-tight">{{ t(tile.label) }}</span>
          <span class="quiet-tile-state">
            {{ tile.on ? t("prayerQuiet.on") : t("prayerQuiet.off") }}
          </span>
        </button>
      </div>
      <p v-if="prayerQuiet.hint" class="mt-2 text-xs text-text-secondary" role="status">
        {{ t(HINTS[prayerQuiet.hint]) }}
      </p>
      <Transition name="quiet-actions">
        <div v-if="showActions" class="mt-2 flex flex-wrap justify-center gap-1.5">
          <button
            type="button"
            class="btn btn-soft quiet-action"
            :disabled="!anyOn"
            :aria-pressed="kept"
            @click="choose('always')"
          >
            <AppIcon v-if="kept" name="check" :size="14" />
            {{ t("prayerQuiet.always") }}
          </button>
          <button type="button" class="btn btn-primary quiet-action" @click="sayFarewell">
            {{ t("prayerQuiet.close") }}
          </button>
        </div>
      </Transition>
    </template>
  </section>
</template>

<style scoped>
/* Over the app, at the top of the screen: it comes down as the app goes
   down, and retracts upward as the app comes back up. The page scrolls
   under its lower edge, which casts its shadow on it; under the native
   sheets (45), the tab bar (50) and the status bar veil (55). */
.prayer-quiet {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 44;
  padding: calc(var(--safe-top) + 0.5rem) 0.75rem 0.625rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
  outline: none;
  will-change: transform;
}
/* The rounded upper corners of the app below, drawn by the panel: the page
   scrolls under them as under the rest of its edge. Each is a square whose
   inner corner is rounded, with a flat shadow in the panel's color clipped
   to the square: a shadow is never drawn inside its own box, so what it
   fills is what lies outside the curve. */
.prayer-quiet::before,
.prayer-quiet::after {
  content: "";
  position: absolute;
  top: 100%;
  width: var(--radius-xl);
  height: var(--radius-xl);
  box-shadow: 0 0 0 var(--radius-xl) var(--color-surface);
  clip-path: inset(0);
  pointer-events: none;
}
.prayer-quiet::before {
  left: 0;
  border-top-left-radius: var(--radius-xl);
}
.prayer-quiet::after {
  right: 0;
  border-top-right-radius: var(--radius-xl);
}
/* A mode, like a tile of the system's quick settings: its drawing, its
   name and its state, solid in the theme color when it is on. */
.quiet-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  min-width: 0;
  padding: 0.5rem 0.25rem;
  border-radius: var(--radius-btn);
  text-align: center;
  color: var(--color-text-primary);
  background-color: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}
.quiet-tile-on {
  color: var(--color-on-brand);
  background-color: var(--color-brand);
}
.quiet-tile:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.quiet-tile-state {
  font-size: 0.6875rem;
  line-height: 1.2;
  opacity: 0.8;
}
/* The three choices hold on one line of a 360 px phone. */
.quiet-action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
}
.prayer-quiet-farewell {
  display: flex;
  flex-direction: column;
}
/* The message, in the room the modes held: centered, its button below. */
.quiet-farewell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.5rem;
  text-align: center;
  animation: quiet-fade 0.2s ease;
}
@keyframes quiet-fade {
  from {
    opacity: 0;
  }
}
.quiet-actions-enter-active {
  transition: opacity 0.2s ease;
}
.quiet-actions-enter-from {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .quiet-tile,
  .quiet-actions-enter-active {
    transition: none;
  }
  .quiet-farewell {
    animation: none;
  }
}
</style>
