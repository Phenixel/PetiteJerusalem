<script setup lang="ts">
/**
 * Renders the "Tehilim par intention" hub (/tehilim) and the intention pages
 * (/tehilim/:slug) from the shared `src/content/seoPages.ts` content, so a human
 * visitor sees the same markup the prerender step serves to crawlers. These
 * pages are French-only for now (the brief defers i18n).
 */
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { tehilimPages, SITE_URL } from "../content/seoPages";
import { seoService } from "../services/seoService";
import { useSeoContentNav } from "../composables/useSeoContentNav";
import SignupPromptModal from "../components/SignupPromptModal.vue";

const route = useRoute();
const { showAuthPrompt, onContentClick } = useSeoContentNav();

const page = computed(() => tehilimPages.find((p) => p.path === route.path) ?? null);

function applyMeta() {
  const p = page.value;
  if (!p) return;
  const url = `${SITE_URL}${p.path}`;
  seoService.setMeta({
    title: p.title,
    description: p.description,
    canonical: url,
    og: { url, type: "article" },
  });
}

onMounted(applyMeta);
watch([() => route.path], applyMeta);
</script>

<template>
  <div v-if="page" class="seo-page" v-html="page.bodyHtml" @click="onContentClick"></div>
  <main v-else class="seo-article" @click="onContentClick">
    <h1>Intention introuvable</h1>
    <p>
      Cette intention n'existe pas (encore).
      <a href="/tehilim">Voir toutes les intentions « Tehilim par intention »</a>.
    </p>
  </main>
  <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
</template>
