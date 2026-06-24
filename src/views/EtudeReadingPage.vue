<script setup lang="ts">
/**
 * Public reading pages for the whole library, under keyword URLs:
 *   /etude/:corpus/:slug          (single section, or a multi-section hub)
 *   /etude/:corpus/:slug/:section (one chapter of a multi-section text)
 *
 * Renders the same markup the prerender bakes into the static files, by
 * resolving the URL to a study entry, fetching its text at runtime (via the
 * shared loadText) and building the body with the shared builders. The big text
 * files are fetched, never bundled.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  SITE_URL,
  entryByCorpusSlug,
  isMultiSection,
  hubPath,
  sectionPath,
  buildHubBody,
  buildSectionBody,
  hubTitle,
  hubDescription,
  sectionTitle,
  sectionDescription,
} from "../content/etudeTexts";
import { loadText, type TextContent, type TextSection } from "../services/textService";
import type { TextStudyJsonEntry } from "../models/models";
import { seoService } from "../services/seoService";
import { useSeoContentNav } from "../composables/useSeoContentNav";
import SignupPromptModal from "../components/SignupPromptModal.vue";

const route = useRoute();
const { showAuthPrompt, onContentClick } = useSeoContentNav();

const loaded = ref(false);
const content = ref<TextContent | null>(null);

const corpus = computed(() => String(route.params.corpus));
const slug = computed(() => String(route.params.slug));
const sectionParam = computed(() =>
  route.params.section !== undefined ? Number(route.params.section) : undefined,
);
const entry = computed<TextStudyJsonEntry | null>(() => entryByCorpusSlug(corpus.value, slug.value));

/** A multi-section text with no :section → show the chapter-list hub. */
const isHub = computed(() => Boolean(entry.value && isMultiSection(entry.value) && sectionParam.value === undefined));

const section = computed<TextSection | null>(() => {
  if (!content.value || !entry.value || isHub.value) return null;
  if (sectionParam.value !== undefined)
    return content.value.sections.find((s) => s.index === sectionParam.value) ?? null;
  return content.value.sections[0] ?? null;
});

const bodyHtml = computed(() => {
  if (!entry.value || !content.value) return "";
  if (isHub.value) return buildHubBody(entry.value, content.value);
  return section.value ? buildSectionBody(entry.value, content.value, section.value) : "";
});

function applyMeta() {
  const e = entry.value;
  if (!e) return;
  if (isHub.value) {
    const url = `${SITE_URL}${hubPath(e)}`;
    seoService.setMeta({ title: hubTitle(e), description: hubDescription(e), canonical: url, og: { url, type: "article" } });
  } else if (section.value) {
    const url = `${SITE_URL}${sectionPath(e, section.value.index)}`;
    seoService.setMeta({
      title: sectionTitle(e, section.value),
      description: sectionDescription(e, section.value),
      canonical: url,
      og: { url, type: "article" },
    });
  }
}

async function load() {
  loaded.value = false;
  content.value = null;
  if (!entry.value) {
    loaded.value = true;
    return;
  }
  try {
    content.value = await loadText(entry.value);
  } catch {
    content.value = null;
  }
  loaded.value = true;
  applyMeta();
}

onMounted(load);
watch(() => [route.params.corpus, route.params.slug, route.params.section], load);
</script>

<template>
  <div v-if="bodyHtml" class="seo-page" v-html="bodyHtml" @click="onContentClick"></div>
  <main v-else-if="loaded" class="seo-article" @click="onContentClick">
    <h1>Texte introuvable</h1>
    <p>
      Ce texte n'existe pas ou n'est pas encore disponible.
      <a href="/etude">Revenir à la bibliothèque</a>.
    </p>
  </main>
  <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
</template>
