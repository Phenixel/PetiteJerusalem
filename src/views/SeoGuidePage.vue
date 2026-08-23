<script setup lang="ts">
/**
 * Rend les pages de fond (`guidePages` dans src/content/seoPages.ts, à ce jour
 * /zmanim) à partir du même contenu que le prérendu : un visiteur et un
 * crawler voient exactement le même texte. Même schéma que TehilimPage, en
 * français seulement pour l'instant.
 */
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { guidePages, SITE_URL } from "../content/seoPages";
import { seoService } from "../services/seoService";
import { useSeoContentNav } from "../composables/useSeoContentNav";
import SignupPromptModal from "../components/SignupPromptModal.vue";

const route = useRoute();
const { showAuthPrompt, onContentClick } = useSeoContentNav();

const page = computed(() => guidePages.find((p) => p.path === route.path) ?? null);

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
    <h1>Page introuvable</h1>
    <p>
      Cette page n'existe pas.
      <a href="/horaires">Voir les horaires de Chabbat</a>.
    </p>
  </main>
  <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
</template>
