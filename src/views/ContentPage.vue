<script setup lang="ts">
/**
 * Renders the long-form SEO landing pages (/finir-le-chass, /partage-tehilim)
 * from the shared `src/content/seoPages.ts` content, so a human visitor sees
 * exactly the same markup the prerender step serves to crawlers.
 */
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { landingPages, SITE_URL } from "../content/seoPages";
import { seoService } from "../services/seoService";

const route = useRoute();

const page = computed(() => landingPages.find((p) => p.path === route.path) ?? null);

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
watch(() => route.path, applyMeta);
</script>

<template>
  <div v-if="page" class="seo-page" v-html="page.bodyHtml"></div>
</template>
