<script setup lang="ts">
/**
 * The panel opened at the top of the screen when a tefila opens: the whole
 * app goes down below it, as when the screen is split in two, and the three
 * quiet modes of the phone (Do Not Disturb, silent, vibrate) sit there with
 * their current state (usePrayerQuiet, docs/design.md « A tefila opens on
 * the phone's quiet modes »).
 *
 * It closes with « Commencer » ("Start"), a tap on the lowered app, the app
 * pushed back up with the finger, Escape or Android back; the app then rises
 * back over it, from where the finger let it go.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import { prefersReducedMotion } from "../composables/useMotion";
import { useOverlay } from "../composables/useOverlayStack";
import {
  appDrop,
  closePrayerQuiet,
  DROP_MS,
  holdApp,
  prayerQuiet,
  releaseApp,
  toggleQuietMode,
} from "../composables/usePrayerQuiet";
import { isQuietModeOn, type QuietMode } from "../services/prayerQuiet";
import type { IconName } from "./icons/registry";

const { t } = useI18n();
const route = useRoute();

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

const rows = computed(() =>
  MODES.map(({ mode, icon, label }) => ({
    mode,
    icon,
    label,
    on: prayerQuiet.state ? isQuietModeOn(prayerQuiet.state, mode) : false,
  })),
);

const panel = ref<HTMLElement | null>(null);
const closing = ref(false);
const height = ref(0);
let returnFocus: HTMLElement | null = null;
let closeTimer: number | undefined;
let resizeObserver: ResizeObserver | null = null;

// Android back closes it, as Escape does.
useOverlay(
  computed(() => prayerQuiet.open && !closing.value),
  () => close(),
);

function close(): void {
  if (closing.value) return;
  closing.value = true;
  appDrop.dragging = false;
  appDrop.offset = 0;
  closeTimer = window.setTimeout(
    () => {
      void releaseApp();
      closePrayerQuiet();
      returnFocus?.focus?.({ preventScroll: true });
    },
    prefersReducedMotion() ? 0 : DROP_MS,
  );
}

/** The app goes down by the panel's height, and follows it if it changes. */
function lower(): void {
  if (!panel.value || closing.value) return;
  height.value = panel.value.offsetHeight;
  if (!appDrop.dragging) appDrop.offset = height.value;
}

onMounted(async () => {
  returnFocus = document.activeElement as HTMLElement | null;
  holdApp();
  // The stage is first held where it is, then lowered: the translation
  // starts from 0, so the browser animates it.
  await nextTick();
  lower();
  // The panel takes the focus (the app below it is inert), without a ring
  // around a button nobody has reached with the keyboard.
  panel.value?.focus({ preventScroll: true });
  if (typeof ResizeObserver !== "undefined" && panel.value) {
    resizeObserver = new ResizeObserver(() => lower());
    resizeObserver.observe(panel.value);
  }
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.clearTimeout(closeTimer);
  resizeObserver?.disconnect();
  document.removeEventListener("keydown", onKeydown);
  void releaseApp();
});

// Leaving the page (a link, the history) closes it with the page.
watch(
  () => route.fullPath,
  () => close(),
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

// The lowered app: a tap closes, pushed up it follows the finger, and
// released past a third of the way (or flicked) it goes back up.
let startY = 0;
let startAt = 0;
let pointer: number | null = null;

function onPointerDown(event: PointerEvent): void {
  if (closing.value || pointer !== null) return;
  pointer = event.pointerId;
  startY = event.clientY;
  startAt = event.timeStamp;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointer) return;
  const dy = event.clientY - startY;
  if (!appDrop.dragging && Math.abs(dy) < 8) return;
  appDrop.dragging = true;
  appDrop.offset = Math.min(height.value, Math.max(0, height.value + dy));
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointer) return;
  pointer = null;
  if (!appDrop.dragging) {
    close();
    return;
  }
  const dy = event.clientY - startY;
  const speed = dy / Math.max(1, event.timeStamp - startAt);
  if (appDrop.offset < (height.value * 2) / 3 || speed < -0.5) {
    close();
    return;
  }
  appDrop.dragging = false;
  appDrop.offset = height.value;
}

function onPointerCancel(event: PointerEvent): void {
  if (event.pointerId !== pointer) return;
  pointer = null;
  appDrop.dragging = false;
  if (!closing.value) appDrop.offset = height.value;
}
</script>

<template>
  <section
    ref="panel"
    class="prayer-quiet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="prayer-quiet-title"
    tabindex="-1"
  >
    <h2 id="prayer-quiet-title" class="font-display text-xl font-bold text-text-primary mb-3">
      {{ t("prayerQuiet.title") }}
    </h2>
    <ul class="flex flex-col">
      <li v-for="row in rows" :key="row.mode" class="quiet-row">
        <label class="flex items-center gap-3 py-2.5 cursor-pointer">
          <AppIcon
            :name="row.icon"
            :size="20"
            class="shrink-0"
            :class="row.on ? 'text-primary' : 'text-text-secondary'"
          />
          <span class="flex-1 min-w-0">
            <span class="block font-semibold text-text-primary">
              {{ t(row.label) }}
            </span>
            <span class="block text-sm text-text-secondary">
              {{ row.on ? t("prayerQuiet.on") : t("prayerQuiet.off") }}
            </span>
          </span>
          <ToggleSwitch
            :model-value="row.on"
            @update:model-value="toggleQuietMode(row.mode, $event)"
          />
        </label>
      </li>
    </ul>
    <p v-if="prayerQuiet.hint" class="mt-2 text-sm text-text-secondary" role="status">
      {{ t(HINTS[prayerQuiet.hint]) }}
    </p>
    <button type="button" class="btn btn-primary w-full mt-4" @click="close">
      {{ t("prayerQuiet.start") }}
    </button>
  </section>
  <!-- On the lowered app: it closes the panel, and the finger pushes it up. -->
  <Teleport to="#app-stage">
    <button
      type="button"
      class="prayer-quiet-catcher"
      :aria-label="t('prayerQuiet.back')"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    ></button>
  </Teleport>
</template>

<style scoped>
/* Behind the app, at the top of the screen: the app goes down to uncover
   it, and comes back up over it. */
.prayer-quiet {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  padding: calc(var(--safe-top) + 1rem) 1.5rem 1.25rem;
  background: var(--color-surface);
  outline: none;
}
.quiet-row + .quiet-row {
  border-top: 1px solid var(--color-line);
}
/* Above everything in the stage, the bottom bar included, which goes down
   with the rest. */
.prayer-quiet-catcher {
  position: absolute;
  inset: 0;
  z-index: 2147483000;
  background: transparent;
  touch-action: none;
  cursor: pointer;
}
</style>
