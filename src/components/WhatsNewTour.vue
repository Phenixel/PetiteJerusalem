<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import FeatureTour, { type TourStep } from "./FeatureTour.vue";
import AppIcon from "./icons/AppIcon.vue";
import MockParcoursDeck from "./mock/MockParcoursDeck.vue";
import MockDafPage from "./mock/MockDafPage.vue";
import MockAudioPlayer from "./mock/MockAudioPlayer.vue";
import { WHATS_NEW_TIP, useFeatureTips } from "../composables/useFeatureTips";
import { isOnboardingOpen } from "../composables/useOnboarding";
import {
  holdTabBarChange,
  playTabBarChange,
  stopTabBarChange,
  tabBarChange,
} from "../composables/useTabBarChange";

/**
 * What changed since the version people had installed, played once, at the
 * first opening after the update (see docs/design.md, "What's new plays out
 * once, after an update").
 *
 * It is a tip like the others (FeatureTour, useFeatureTips: once per device,
 * one per opening, « Plus tard », « Passer »), mounted by the app rather than
 * by a page: its first step is the bottom bar, which is on every page, and
 * a tab touched through the spotlight must not end the tour by leaving the
 * page that held it.
 *
 *  1. the bar itself: it opens as people knew it, then changes in front of
 *     them (useTabBarChange): the library book jumps and merges into Étude,
 *     Sidour rises in its place. « Revoir » plays it again;
 *  2. Mon parcours, the day's readings as a stack of cards;
 *  3. the Talmud in the form of its page, and in French;
 *  4. the class player, which follows you and opens full screen.
 *
 * The other steps are drawn screenshots (src/components/mock): they show
 * the novelty wherever the tour happens to open.
 */

const props = withDefaults(defineProps<{ delay?: number }>(), { delay: 450 });

const { t } = useI18n();
const { shouldShowTip } = useFeatureTips();

/** « Revoir », in the bubble of the first step: the change, once more. */
const ReplayChange = defineComponent({
  name: "WhatsNewReplay",
  setup() {
    return () =>
      h(
        "button",
        {
          type: "button",
          class:
            "inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80",
          onClick: () => playTabBarChange(),
        },
        [h(AppIcon, { name: "rotate-ccw", size: 14 }), t("tips.whatsNew.replay")],
      );
  },
});

const steps = computed<TourStep[]>(() => [
  {
    key: "tabs",
    title: t("tips.whatsNew.tabs.title"),
    text: t("tips.whatsNew.tabs.text"),
    target: () => document.querySelector<HTMLElement>('nav[data-tour="tab-bar"]'),
    component: ReplayChange,
    radius: 0,
    // Room above the bar: the book jumps over the times circle.
    padding: 48,
  },
  {
    key: "parcours",
    title: t("tips.whatsNew.parcours.title"),
    text: t("tips.whatsNew.parcours.text"),
    component: MockParcoursDeck,
  },
  {
    key: "daf",
    title: t("tips.whatsNew.daf.title"),
    text: t("tips.whatsNew.daf.text"),
    component: MockDafPage,
  },
  {
    key: "audio",
    title: t("tips.whatsNew.audio.title"),
    text: t("tips.whatsNew.audio.text"),
    component: MockAudioPlayer,
  },
]);

/**
 * The bar is held in its old form from the opening (App.vue holds it before
 * the first frame, see `holdTabBarChange`), so that the change happens in
 * front of people. Once the native preferences have answered, the tour knows
 * for sure: not due, the real tabs come back at once; due but unable to show
 * (another window, the bar off screen), they come back shortly after.
 */
const HOLD_GRACE_MS = 1500;
let releaseHold: ReturnType<typeof setTimeout> | null = null;

function clearHold(): void {
  if (releaseHold) clearTimeout(releaseHold);
  releaseHold = null;
}

onMounted(async () => {
  // A fresh install has the introduction on screen: no old bar to show it.
  const due = !isOnboardingOpen.value && (await shouldShowTip(WHATS_NEW_TIP));
  if (!due) {
    if (tabBarChange.value === "held") stopTabBarChange();
    return;
  }
  holdTabBarChange();
  releaseHold = setTimeout(() => {
    if (tabBarChange.value === "held") stopTabBarChange();
  }, props.delay + HOLD_GRACE_MS);
});

function onStep(_index: number, key: string): void {
  clearHold();
  if (key === "tabs") playTabBarChange();
  else stopTabBarChange();
}

function onFinish(): void {
  clearHold();
  stopTabBarChange();
}

onBeforeUnmount(onFinish);
</script>

<template>
  <FeatureTour
    :tip="WHATS_NEW_TIP"
    :steps="steps"
    :delay="delay"
    @step="onStep"
    @finish="onFinish"
  />
</template>
