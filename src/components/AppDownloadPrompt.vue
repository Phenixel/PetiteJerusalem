<script setup lang="ts">
/**
 * On the website, a window that offers the app, once, a few seconds after the
 * visitor arrives (docs/design.md, « The site offers the app, once »).
 *
 * - Never in the app, never to a crawler (the page must read the same for
 *   the search engines), never on top of the consent banner: it waits for
 *   the visitor's answer to it.
 * - Once: closed with « Plus tard », it comes back after sixty days at the
 *   earliest; a store opened, never again.
 * - The stores offered follow the device (detectStores): the iPhone sees the
 *   App Store, Android Google Play, a computer both.
 *
 * It carries the sidour drawn, as the cards of the app do, rather than an
 * icon.
 */
import { onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { detectStores, type StoreKey } from "../composables/useAppDownload";
import { useConsent } from "../composables/useConsent";
import { isOnboardingOpen } from "../composables/useOnboarding";
import { isNativeApp } from "../composables/useNativeApp";
import { analyticsService } from "../services/analyticsService";
import { appPromptDue, appPromptStore } from "../services/appPrompt";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import ArtSiddur from "./art/ArtSiddur.vue";

const { t } = useI18n();
const { choice } = useConsent();
const stores = detectStores();

/** The time the visitor takes to see the page before the window comes. */
const DELAY_MS = 4000;
const open = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

if (
  !isNativeApp &&
  typeof navigator !== "undefined" &&
  !navigator.webdriver &&
  appPromptDue(appPromptStore.read(), Date.now(), navigator.userAgent)
) {
  // Waits for the consent banner to be answered, and for no first-run tour.
  watch(
    () => choice.value !== null && !isOnboardingOpen.value,
    (ready) => {
      clearTimeout(timer);
      if (!ready) return;
      timer = setTimeout(() => {
        open.value = true;
        analyticsService.capture("app_prompt_shown", { stores: stores.length });
      }, DELAY_MS);
    },
    { immediate: true },
  );
}
onBeforeUnmount(() => clearTimeout(timer));

function later(): void {
  open.value = false;
  appPromptStore.write({ snoozedAt: Date.now() });
  analyticsService.capture("app_prompt_dismissed");
}

function download(store: StoreKey): void {
  appPromptStore.write({ done: true });
  analyticsService.capture("app_download_clicked", {
    store,
    offered: stores.length,
    source: "app_prompt",
  });
  open.value = false;
}
</script>

<template>
  <AppModal :open="open" labelledby="app-prompt-title" @close="later">
    <div class="app-prompt">
      <span class="app-prompt-art" aria-hidden="true"><ArtSiddur /></span>
      <h2 id="app-prompt-title" class="font-display text-2xl font-bold leading-tight">
        {{ t("appPrompt.title") }}
      </h2>
      <p class="mt-2 text-[15px] leading-relaxed text-text-secondary">
        {{ t("appPrompt.text") }}
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-3">
        <a
          v-for="store in stores"
          :key="store.key"
          class="btn btn-primary gap-2"
          :href="store.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t(store.ariaKey)"
          @click="download(store.key)"
        >
          <AppIcon :name="store.icon" :size="18" />
          {{ t(store.labelKey) }}
        </a>
      </div>
      <button
        type="button"
        class="mt-3 min-h-10 px-3 text-sm font-semibold text-text-secondary hover:text-primary"
        data-autofocus
        @click="later"
      >
        {{ t("appPrompt.later") }}
      </button>
    </div>
  </AppModal>
</template>

<style scoped>
.app-prompt {
  display: flex;
  max-width: 24rem;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px 0;
  text-align: center;
}
/* The sidour, standing, as on the card of the moment. */
.app-prompt-art {
  display: block;
  height: 112px;
  margin-bottom: 14px;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.2));
}
.app-prompt-art :deep(svg) {
  height: 100%;
  width: auto;
}
</style>
