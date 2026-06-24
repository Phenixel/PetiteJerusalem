<script setup lang="ts">
/**
 * Renders the long-form SEO landing pages (/finir-le-chass, /partage-tehilim)
 * from the shared `src/content/seoPages.ts` content, in the active language, so
 * a human visitor sees the same markup the prerender step serves to crawlers
 * (the static files are French; the live app switches with the language picker).
 */
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { landingPages, SITE_URL, type Locale } from "../content/seoPages";
import { seoService } from "../services/seoService";
import { useSeoContentNav } from "../composables/useSeoContentNav";
import SignupPromptModal from "../components/SignupPromptModal.vue";

const route = useRoute();
const { locale } = useI18n();
const { showAuthPrompt, onContentClick } = useSeoContentNav();

const page = computed(() => landingPages.find((p) => p.path === route.path) ?? null);

const content = computed(() => {
  const p = page.value;
  if (!p) return null;
  const code = locale.value as string;
  const loc: Locale = code === "en" || code === "he" ? code : "fr";
  return p.locales[loc];
});

const isRtl = computed(() => locale.value === "he");

function applyMeta() {
  const c = content.value;
  const p = page.value;
  if (!c || !p) return;
  const url = `${SITE_URL}${p.path}`;
  seoService.setMeta({
    title: c.title,
    description: c.description,
    canonical: url,
    og: { url, type: "article" },
  });
}

onMounted(applyMeta);
watch([() => route.path, locale], applyMeta);
</script>

<template>
  <div
    v-if="content"
    class="seo-page"
    :dir="isRtl ? 'rtl' : 'ltr'"
    v-html="content.bodyHtml"
    @click="onContentClick"
  ></div>
  <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
</template>
