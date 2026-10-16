import { nextTick, onScopeDispose, ref, type Ref } from "vue";
import { pickSlot, type HomeBlock, type TileBox } from "./useHomeLayout";
import { haptic } from "../services/haptics";

/**
 * Arranging the home page in place (P2-AccueilModifier): the blocks
 * themselves wobble, follow the finger and make room, right on the home page.
 *
 * - Outside edit mode, a long press with a finger on a block opens edit mode
 *   and picks that block up at once: the finger can keep going.
 * - In edit mode, a finger holds a block a moment before it lifts (a quick
 *   swipe still scrolls the page); a mouse picks it up straight away.
 * - The held block follows the pointer; the others slide aside as soon as it
 *   passes the middle of one of them (`pickSlot`), and the page scrolls on
 *   its own near the top or bottom edge of the screen. Released, the block
 *   slides into its place.
 *
 * The tiles are the `[data-block]` elements of `root`, which must be
 * positioned (`position: relative`): their offsets are measured from it.
 */
const ENTER_MS = 600;
const HOLD_MS = 280;
const SLOP = 10;
const EDGE = 80;
const SCROLL_STEP = 16;

interface Press {
  block: HomeBlock;
  pointerId: number;
  x0: number;
  y0: number;
  timer: ReturnType<typeof setTimeout>;
}

interface Drag {
  block: HomeBlock;
  el: HTMLElement;
  grabX: number;
  grabY: number;
  x: number;
  y: number;
  raf: number;
  /** A reorder is being laid out: the next one waits for it. */
  pending: boolean;
}

const reducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useHomeArrange(options: {
  root: Ref<HTMLElement | null>;
  editing: Ref<boolean>;
  /** The visible blocks, in their saved order. */
  order: Ref<HomeBlock[]>;
  /** Outside edit mode: whether the touched element lends itself to the long press. */
  accept: (target: Element) => boolean;
  onEnter: () => void;
  onDrop: (block: HomeBlock, to: number) => void;
}) {
  /** The order while a block is held, before it is saved. */
  const preview = ref<HomeBlock[] | null>(null);
  const dragging = ref<HomeBlock | null>(null);

  let press: Press | null = null;
  let drag: Drag | null = null;
  let swallowClick = false;

  const tiles = (): HTMLElement[] => [
    ...(options.root.value?.querySelectorAll<HTMLElement>("[data-block]") ?? []),
  ];
  const tileOf = (block: HomeBlock): HTMLElement | undefined =>
    tiles().find((el) => el.dataset.block === block);

  /**
   * Changes the layout, then slides each tile from where it was to where it
   * now stands (FLIP). The held tile is left alone: it follows the pointer.
   */
  async function animate(change: () => void): Promise<void> {
    const before = new Map(tiles().map((el) => [el, el.getBoundingClientRect()]));
    change();
    await nextTick();
    if (reducedMotion()) return;
    const moving = tiles().filter((el) => el !== drag?.el && before.has(el));
    for (const el of moving) {
      el.style.transition = "none";
      el.style.transform = "";
    }
    const after = moving.map((el) => el.getBoundingClientRect());
    moving.forEach((el, i) => {
      const from = before.get(el)!;
      const dx = from.left - after[i]!.left;
      const dy = from.top - after[i]!.top;
      if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    void options.root.value?.offsetWidth;
    for (const el of moving) {
      el.style.transition = "";
      el.style.transform = "";
    }
  }

  function frame(): void {
    const root = options.root.value;
    if (!drag || !root) return;
    // Near an edge of the screen, the page scrolls under the held block.
    if (drag.y < EDGE) window.scrollBy(0, -SCROLL_STEP * (1 - Math.max(0, drag.y) / EDGE));
    else if (drag.y > innerHeight - EDGE)
      window.scrollBy(0, SCROLL_STEP * (1 - Math.max(0, innerHeight - drag.y) / EDGE));

    const box = root.getBoundingClientRect();
    const { el } = drag;
    const tx = drag.x - drag.grabX - (box.left + el.offsetLeft);
    const ty = drag.y - drag.grabY - (box.top + el.offsetTop);
    el.style.transform = `translate(${tx}px, ${ty}px) scale(1.02)`;

    const order = preview.value;
    if (!drag.pending && order) {
      const boxes = order.map((block): TileBox => {
        const tile = tileOf(block);
        return {
          left: box.left + (tile?.offsetLeft ?? 0),
          top: box.top + (tile?.offsetTop ?? 0),
          width: tile?.offsetWidth ?? 0,
          height: tile?.offsetHeight ?? 0,
          wide: (tile?.offsetWidth ?? 0) > box.width * 0.75,
        };
      });
      const from = order.indexOf(drag.block);
      const rtl = getComputedStyle(root).direction === "rtl";
      const to = pickSlot(drag.x, drag.y, from, boxes, rtl);
      if (to !== from) {
        const current = drag;
        current.pending = true;
        haptic("tick");
        const next = order.filter((b) => b !== current.block);
        next.splice(to, 0, current.block);
        void animate(() => (preview.value = next)).then(() => (current.pending = false));
      }
    }
    drag.raf = requestAnimationFrame(frame);
  }

  function startDrag(
    block: HomeBlock,
    pointerId: number,
    x: number,
    y: number,
    grab?: { x: number; y: number },
  ): void {
    const el = tileOf(block);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const grabX = grab?.x ?? x - rect.left;
    const grabY = grab?.y ?? y - rect.top;
    preview.value = [...options.order.value];
    dragging.value = block;
    el.style.transition = "none";
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // The pointer is already released: nothing to capture.
    }
    drag = { block, el, grabX, grabY, x, y, raf: 0, pending: false };
    drag.raf = requestAnimationFrame(frame);
    // Followed on the window: moving the tile in the page releases its
    // pointer capture, and the finger may leave the blocks.
    addEventListener("pointermove", follow);
    addEventListener("pointerup", endDrag);
    addEventListener("pointercancel", endDrag);
  }

  function follow(event: PointerEvent): void {
    if (!drag) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  function endDrag(): void {
    const current = drag;
    if (!current) return;
    drag = null;
    cancelAnimationFrame(current.raf);
    removeEventListener("pointermove", follow);
    removeEventListener("pointerup", endDrag);
    removeEventListener("pointercancel", endDrag);
    const to = preview.value?.indexOf(current.block) ?? -1;
    if (to >= 0 && to !== options.order.value.indexOf(current.block)) {
      options.onDrop(current.block, to);
    }
    preview.value = null;
    dragging.value = null;
    // Released: it slides from where the finger left it into its place.
    current.el.style.transition = "";
    current.el.style.transform = "";
  }

  function cancelPress(): void {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  onScopeDispose(() => {
    cancelPress();
    endDrag();
  });

  const handlers = {
    onPointerdown(event: PointerEvent): void {
      const target = event.target as Element | null;
      const tile = target?.closest<HTMLElement>("[data-block]");
      if (!target || !tile || target.closest(".tile-pill") || drag) return;
      const block = tile.dataset.block as HomeBlock;
      const { pointerId, clientX: x, clientY: y } = event;

      if (options.editing.value) {
        if (!options.order.value.includes(block)) return; // a hidden block stays put
        if (event.pointerType !== "touch") {
          if (event.button !== 0) return;
          event.preventDefault();
          startDrag(block, pointerId, x, y);
          return;
        }
        cancelPress();
        press = {
          block,
          pointerId,
          x0: x,
          y0: y,
          timer: setTimeout(() => {
            press = null;
            haptic("press");
            startDrag(block, pointerId, x, y);
          }, HOLD_MS),
        };
        return;
      }

      if (event.pointerType !== "touch" || !options.accept(target)) return;
      cancelPress();
      swallowClick = false;
      press = {
        block,
        pointerId,
        x0: x,
        y0: y,
        timer: setTimeout(() => {
          press = null;
          swallowClick = true;
          haptic("press");
          // Where the finger holds the block, before edit mode shifts the
          // page (its bar comes in above): the block stays under the finger.
          const content = tile.querySelector(".tile-body > *")?.getBoundingClientRect();
          const grab = content && { x: x - content.left, y: y - content.top };
          options.onEnter();
          // Edit mode lays the tiles out: the block is picked up once it has.
          void nextTick(() => startDrag(block, pointerId, x, y, grab));
        }, ENTER_MS),
      };
    },
    onPointermove(event: PointerEvent): void {
      if (press && event.pointerId === press.pointerId) {
        if (Math.abs(event.clientX - press.x0) > SLOP || Math.abs(event.clientY - press.y0) > SLOP)
          cancelPress();
      }
    },
    onPointerup: cancelPress,
    onPointercancel: cancelPress,
    // While a block is held, the finger moves it, not the page.
    onTouchmove(event: TouchEvent): void {
      if (drag && event.cancelable) event.preventDefault();
    },
    onClickCapture(event: MouseEvent): void {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextmenu(event: Event): void {
      if (press || drag || options.editing.value) event.preventDefault();
    },
  };

  return { preview, dragging, animate, handlers };
}
