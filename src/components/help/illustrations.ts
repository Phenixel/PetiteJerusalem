import { defineAsyncComponent, type Component } from "vue";
import type { HelpIllustration } from "../../content/help/catalog";

/**
 * The drawn screenshots a guide can show, by name (catalog.ts). Each loads
 * with the guide that shows it: the help center's list carries none.
 *
 * Some were drawn for the introduction and a chain's instructions, and
 * serve here as they are: the same gesture is shown the same way.
 */
export const HELP_ILLUSTRATION_COMPONENTS: Record<HelpIllustration, Component> = {
  "tab-bar": defineAsyncComponent(() => import("../mock/MockTabBarMove.vue")),
  "card-swipe": defineAsyncComponent(() => import("../mock/MockCardSwipe.vue")),
  "home-reorder": defineAsyncComponent(() => import("../mock/MockHomeReorder.vue")),
  "reading-scrub": defineAsyncComponent(() => import("../mock/MockReadingScrub.vue")),
  "zman-reminder": defineAsyncComponent(() => import("../mock/MockZmanReminder.vue")),
  "end-pull": defineAsyncComponent(() => import("../mock/MockEndPull.vue")),
  "reading-menu": defineAsyncComponent(() => import("../mock/MockReadingMenu.vue")),
  pinch: defineAsyncComponent(() => import("../mock/MockPinch.vue")),
  "auto-scroll": defineAsyncComponent(() => import("../mock/MockAutoScroll.vue")),
  "session-search": defineAsyncComponent(() => import("../mock/MockSessionSearch.vue")),
  "session-reserve": defineAsyncComponent(() => import("../mock/MockSessionReserve.vue")),
  "session-cancel": defineAsyncComponent(() => import("../mock/MockSessionCancel.vue")),
  "session-mark-read": defineAsyncComponent(() => import("../mock/MockSessionMarkRead.vue")),
  "session-read": defineAsyncComponent(() => import("../mock/MockSessionRead.vue")),
};
