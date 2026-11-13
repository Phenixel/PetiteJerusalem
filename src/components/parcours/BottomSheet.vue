<script setup lang="ts">
/**
 * The bottom sheet of Mon parcours: a card's sheet, a day of the wall, the
 * catch-up. It rises from the foot of the screen, with its handle; the veil
 * or Escape close it (AppModal does the rest: keyboard, Android back,
 * scrolling locked behind).
 *
 * It behaves like the system's sheets: it slides up from below the screen
 * and goes back down when closed, and it can be pulled down by the finger,
 * from anywhere on it, as long as what is under the finger is not scrolled
 * (a tall sheet scrolls first, then the gesture is the sheet's). It follows
 * the finger, the veil clearing with it; released past a third of its
 * height, or flicked down, it closes and keeps going down from there,
 * otherwise it comes back up. The motion is in main.css (`.sheet-panel`).
 *
 * `tall`, for a sheet taller than the screen (Mes lumières): it opens at
 * half height, its beginning in view; swiped up, it unfolds to the top of
 * the screen, then its content scrolls. Without it, it opened at the top,
 * already unfolded.
 */
import { computed, nextTick, ref, watch } from "vue";
import AppModal from "../AppModal.vue";

const props = withDefaults(defineProps<{ open: boolean; label?: string; tall?: boolean }>(), {
  tall: false,
});
const emit = defineEmits<{ (e: "close"): void }>();

/** The content's wrapper: its parent is AppModal's panel, then the veil. */
const root = ref<HTMLElement | null>(null);
/** Under the finger: no easing. */
const dragging = ref(false);
/** Pulled at least once since it opened: the panel takes its offset. */
const held = ref(false);

const panelClass = computed(() =>
  [
    "sheet-panel",
    props.tall && "sheet-panel-tall",
    held.value && "sheet-held",
    dragging.value && "sheet-dragging",
  ]
    .filter(Boolean)
    .join(" "),
);
const overlayClass = computed(() =>
  dragging.value ? "sheet-overlay sheet-dragging" : "sheet-overlay",
);

watch(
  () => props.open,
  (open) => {
    if (open) held.value = false;
  },
);

/** A finger moves a little anyway: below this, it has not chosen a direction. */
const SLOP = 4;
/** Faster than this downward (px/ms), the release closes, wherever it is. */
const FLICK = 0.5;
/** Released lower than this share of its height, it closes. */
const CLOSE_SHARE = 0.33;

let gesture: { x: number; y: number; claimed: boolean; height: number } | null = null;
let offset = 0;
let last = { y: 0, t: 0 };
let speed = 0;

const panel = (): HTMLElement | null => root.value?.parentElement ?? null;
const veil = (): HTMLElement | null => panel()?.parentElement ?? null;

/** What scrolls under the finger and is not at its top: it scrolls back first. */
function scrolledUnder(target: Element): boolean {
  const stop = panel();
  for (let el: Element | null = target; el && el !== stop; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return (veil()?.scrollTop ?? 0) > 0;
}

function place(px: number): void {
  offset = px;
  panel()?.style.setProperty("--sheet-drag", `${px}px`);
  const share = gesture?.height ? Math.min(1, px / gesture.height) : 0;
  veil()?.style.setProperty("--sheet-veil", String(1 - share));
}

function onTouchStart(event: TouchEvent): void {
  gesture = null;
  const touch = event.touches[0];
  const target = event.target instanceof Element ? event.target : null;
  if (event.touches.length > 1 || !touch || !target) return;
  if (target.closest("input, textarea, select, [role='slider'], [data-sheet-nodrag]")) return;
  if (scrolledUnder(target)) return;
  const top = panel()?.getBoundingClientRect().top ?? 0;
  gesture = {
    x: touch.clientX,
    y: touch.clientY,
    claimed: false,
    height: Math.max(1, window.innerHeight - top),
  };
  last = { y: touch.clientY, t: event.timeStamp };
  speed = 0;
}

function onTouchMove(event: TouchEvent): void {
  const touch = event.touches[0];
  if (!gesture || !touch) return;
  const dy = touch.clientY - gesture.y;
  if (!gesture.claimed) {
    const dx = touch.clientX - gesture.x;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
    // The first clear move decides: down and vertical, the gesture is the
    // sheet's; up (a tall sheet unfolding) or sideways, the page keeps it.
    if (dy <= 0 || Math.abs(dy) < Math.abs(dx)) {
      gesture = null;
      return;
    }
    gesture.claimed = true;
    held.value = true;
    dragging.value = true;
  }
  event.preventDefault();
  const dt = event.timeStamp - last.t;
  if (dt > 0) speed = (touch.clientY - last.y) / dt;
  last = { y: touch.clientY, t: event.timeStamp };
  place(Math.max(0, dy));
}

function onTouchEnd(): void {
  const done = gesture;
  gesture = null;
  if (!done?.claimed) return;
  dragging.value = false;
  if (speed > FLICK || (offset > done.height * CLOSE_SHARE && speed > -FLICK)) {
    // The offset stays: the leave transition carries it down from here.
    // Told once the sheet and the veil have dropped `sheet-dragging`:
    // removed with it, they would have no transition and vanish at once.
    void nextTick(() => emit("close"));
    return;
  }
  place(0);
}

// The panel is AppModal's: the gesture is listened to on all of it, its
// margins included, and actively (a pull down must not scroll the veil).
watch(root, (el, _, onCleanup) => {
  const target = el?.parentElement;
  if (!target) return;
  target.addEventListener("touchstart", onTouchStart, { passive: true });
  target.addEventListener("touchmove", onTouchMove, { passive: false });
  target.addEventListener("touchend", onTouchEnd);
  target.addEventListener("touchcancel", onTouchEnd);
  onCleanup(() => {
    target.removeEventListener("touchstart", onTouchStart);
    target.removeEventListener("touchmove", onTouchMove);
    target.removeEventListener("touchend", onTouchEnd);
    target.removeEventListener("touchcancel", onTouchEnd);
  });
});
</script>

<template>
  <AppModal
    :open="open"
    :label="label"
    transition="sheet-modal"
    :overlay-class="overlayClass"
    :panel-class="panelClass"
    @close="emit('close')"
  >
    <div ref="root">
      <div class="mx-auto mb-4 h-1 w-10 rounded-pill bg-line-strong" aria-hidden="true" />
      <slot />
    </div>
  </AppModal>
</template>
