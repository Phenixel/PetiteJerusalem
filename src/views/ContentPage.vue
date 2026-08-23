<script setup lang="ts">
/**
 * Renders the long-form SEO landing pages (/finir-le-chass, /partage-tehilim)
 * from the shared `src/content/seoPages.ts` content, so a human visitor sees
 * the same markup the prerender step serves to crawlers.
 *
 * Chaque page a une adresse par langue (/finir-le-chass, /en/finish-the-shas,
 * /he/siyum-hashas) : c'est l'URL ouverte qui décide de la langue affichée, et
 * le routeur a déjà posé cette langue dans i18n. Sur l'adresse française, le
 * sélecteur de langue continue de faire basculer le texte sans changer d'URL.
 */
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { landingPages, SITE_URL, type Locale } from "../content/seoPages";
import { DEFAULT_SEO_LOCALE, SEO_LOCALES } from "../content/seoLocales";
import { seoService } from "../services/seoService";
import { useSeoContentNav } from "../composables/useSeoContentNav";
import SignupPromptModal from "../components/SignupPromptModal.vue";

const route = useRoute();
const { locale } = useI18n();
const { showAuthPrompt, onContentClick } = useSeoContentNav();

const page = computed(
  () => landingPages.find((p) => SEO_LOCALES.some((l) => p.paths[l] === route.path)) ?? null,
);

/**
 * La langue affichée : celle que l'URL impose quand elle porte un préfixe
 * (/en/…, /he/…), sinon celle de l'interface. L'adresse française est aussi
 * l'adresse historique, sans préfixe : le sélecteur de langue continue d'y
 * basculer le texte, comme avant, sans changer d'URL.
 */
const pageLocale = computed<Locale>(() => {
  const p = page.value;
  const prefixed = p
    ? SEO_LOCALES.find((l) => l !== DEFAULT_SEO_LOCALE && p.paths[l] === route.path)
    : null;
  if (prefixed) return prefixed;
  const code = locale.value as string;
  return code === "en" || code === "he" ? code : "fr";
});

const content = computed(() => page.value?.locales[pageLocale.value] ?? null);

const isRtl = computed(() => pageLocale.value === "he");

function applyMeta() {
  const c = content.value;
  const p = page.value;
  if (!c || !p) return;
  const url = `${SITE_URL}${p.paths[pageLocale.value]}`;
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
