<script setup lang="ts">
/**
 * Individual Tehilim chapter page (/etude/tehilim/:chapter).
 *
 * Renders the same body markup the prerender step bakes into the static file,
 * by fetching `/texts/tehilim.json` at runtime and calling the shared
 * `buildChapterBody`. The big text file is fetched (and cached in-module), so it
 * never lands in the SPA bundle.
 */
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  buildChapterBody,
  chapterPath,
  chapterTitle,
  chapterDescription,
  isValidChapter,
} from "../content/tehilimChapter";
import { seoService } from "../services/seoService";

const SITE_URL = "https://petite-jerusalem.fr";

type TehilimData = Record<string, { he: string[] }>;
let cache: Promise<TehilimData> | null = null;
function loadTehilim(): Promise<TehilimData> {
  if (!cache) cache = fetch("/texts/tehilim.json").then((r) => r.json() as Promise<TehilimData>);
  return cache;
}

const route = useRoute();
const verses = ref<string[] | null>(null);
const loaded = ref(false);

const chapter = computed(() => Number(route.params.chapter));
const valid = computed(() => isValidChapter(chapter.value));

const bodyHtml = computed(() =>
  valid.value && verses.value ? buildChapterBody(chapter.value, verses.value) : "",
);

async function load() {
  loaded.value = false;
  verses.value = null;
  if (!valid.value) {
    loaded.value = true;
    return;
  }
  try {
    const data = await loadTehilim();
    verses.value = data[String(chapter.value)]?.he ?? null;
  } catch {
    verses.value = null;
  }
  loaded.value = true;
  applyMeta();
}

function applyMeta() {
  if (!valid.value) return;
  const url = `${SITE_URL}${chapterPath(chapter.value)}`;
  seoService.setMeta({
    title: chapterTitle(chapter.value),
    description: chapterDescription(chapter.value),
    canonical: url,
    og: { url, type: "article" },
  });
}

onMounted(load);
watch(() => route.params.chapter, load);
</script>

<template>
  <div v-if="bodyHtml" class="seo-page" v-html="bodyHtml"></div>
  <main v-else-if="loaded" class="seo-article">
    <h1>Tehilim introuvable</h1>
    <p>
      Ce psaume n'existe pas (les Tehilim vont de 1 à 150).
      <a href="/etude/tehilim/1">Commencer au Tehilim 1</a>.
    </p>
  </main>
</template>
