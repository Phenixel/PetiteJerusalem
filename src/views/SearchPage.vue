<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import type { IconName } from "../components/icons/registry";
import CatalogSearchField from "../components/CatalogSearchField.vue";
import CollapseTransition from "../components/CollapseTransition.vue";
import { useSearchMode } from "../composables/useSearchMode";
import { useSpeechInput } from "../composables/useSpeechInput";
import { useOnline } from "../composables/useOnline";
import { useLocalePath } from "../composables/useLocalePath";
import { seoService } from "../services/seoService";
import { analyticsService } from "../services/analyticsService";
import { sessionService } from "../services/sessionService";
import { chiourService } from "../services/chiourService";
import { moderationService } from "../services/moderationService";
import { bookForEntry, isEntryOnDevice } from "../services/offlineLibraryService";
import type { SectionHeading } from "../services/textService";
import { studyEntries } from "../content/etudeTexts";
import {
  capHits,
  searchChiourim,
  searchCities,
  searchFestivals,
  searchPages,
  searchSessions,
  searchTexts,
  type SearchHit,
  type SearchKind,
} from "../services/globalSearch";
import {
  hasHebrewLetters,
  MIN_PASSAGE_TERM,
  normalizeHebrew,
  searchPassages,
  type PassageHit,
} from "../services/textContentSearch";
import type { Chiour, Session } from "../models/models";

/**
 * La recherche unique : tout ce que le site contient, cherché au même
 * endroit, au clavier ou à la voix.
 *
 * Les sources embarquées (le catalogue des textes, les villes, les fêtes,
 * les pages de l'app) répondent à chaque frappe, hors ligne aussi. Les
 * chaînes de lecture et les chiourim se chargent une fois, à la première
 * recherche, et se filtrent ensuite sur place ; sans réseau, le cache de
 * Firestore sert ce qu'il a, et la page dit ce qui manque. Les passages, dans
 * le texte même des livres présents sur l'appareil, se cherchent en hébreu,
 * au fil de l'eau (voir textContentSearch).
 *
 * Le terme vit dans l'adresse (`?q=`) : un résultat s'ouvre, le retour
 * retrouve la recherche, et l'adresse se partage. `?voice=1` ouvre le micro à
 * l'arrivée (le micro de l'accueil mène ici).
 */

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { pathLocale } = useLocalePath();
const online = useOnline();

// --- Le terme : suit la frappe, filtre avec un léger retard ---------------

const term = ref(String(route.query.q ?? ""));
const debounced = ref(term.value);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(term, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounced.value = value;
  }, 200);
});
onScopeDispose(() => clearTimeout(debounceTimer));

const query = computed(() => debounced.value.trim());
const hasQuery = computed(() => query.value !== "");

// L'adresse suit le terme, sans empiler d'historique : le retour arrière
// ramène à la page d'avant, pas à chaque lettre tapée.
watch(query, (q) => {
  void router.replace({ query: q ? { q } : {} });
});

const { searching } = useSearchMode(term);

// --- Sources embarquées ---------------------------------------------------

const pageHits = computed(() => capHits(searchPages(query.value, pathLocale.value, t)));
const textHits = computed(() => capHits(searchTexts(query.value)));
const cityHits = computed(() => capHits(searchCities(query.value, pathLocale.value)));
const festivalHits = computed(() => capHits(searchFestivals(query.value, pathLocale.value)));

// --- Sources en ligne : chargées une fois, filtrées sur place -------------

type RemoteState = "idle" | "loading" | "ready" | "failed";
const sessions = ref<Session[]>([]);
const chiourim = ref<Chiour[]>([]);
const remoteState = ref<RemoteState>("idle");

/** Une lecture qui n'aboutit pas dans le délai passe pour un échec : on ne fait pas attendre les résultats. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function loadRemote(): Promise<void> {
  if (remoteState.value !== "idle") return;
  remoteState.value = "loading";
  const [loadedSessions, loadedChiourim] = await Promise.allSettled([
    withTimeout(sessionService.getAllSessions(), 10_000),
    withTimeout(chiourService.getAllChiourim(), 10_000),
  ]);
  if (loadedSessions.status === "fulfilled") sessions.value = loadedSessions.value;
  if (loadedChiourim.status === "fulfilled") chiourim.value = loadedChiourim.value;
  remoteState.value =
    loadedSessions.status === "fulfilled" && loadedChiourim.status === "fulfilled"
      ? "ready"
      : "failed";
}

watch(
  hasQuery,
  (has) => {
    if (has) void loadRemote();
  },
  { immediate: true },
);

// Le réseau revient après un échec : on retente, sans rien demander.
watch(online, (isOnline) => {
  if (!isOnline || remoteState.value !== "failed") return;
  remoteState.value = "idle";
  if (hasQuery.value) void loadRemote();
});

const sessionHits = computed(() =>
  capHits(
    searchSessions(sessions.value, query.value, {
      blockedCreatorIds: moderationService.getBlockedCreatorIds(),
      isFinished: (session) => sessionService.isSessionFinished(session),
    }),
  ),
);
const chiourHits = computed(() => capHits(searchChiourim(chiourim.value, query.value)));

// --- Les sections, dans l'ordre où elles se lisent ------------------------

interface Group {
  key: string;
  titleKey: string;
  icon: IconName;
  hits: SearchHit[];
  total: number;
}

const groups = computed<Group[]>(() =>
  [
    { key: "pages", titleKey: "search.sections.pages", icon: "compass" as const, ...pageHits.value },
    { key: "texts", titleKey: "search.sections.texts", icon: "book-open" as const, ...textHits.value },
    {
      key: "sessions",
      titleKey: "search.sections.sessions",
      icon: "users" as const,
      ...sessionHits.value,
    },
    {
      key: "chiourim",
      titleKey: "search.sections.chiourim",
      icon: "headphones" as const,
      ...chiourHits.value,
    },
    { key: "cities", titleKey: "search.sections.cities", icon: "map-pin" as const, ...cityHits.value },
    {
      key: "festivals",
      titleKey: "search.sections.festivals",
      icon: "calendar" as const,
      ...festivalHits.value,
    },
  ].filter((group) => group.total > 0),
);

// --- Dans les textes : les passages, en hébreu, sur l'appareil ------------

const hebrewQuery = computed(() => hasHebrewLetters(query.value));
const passageTermOk = computed(
  () => hebrewQuery.value && normalizeHebrew(query.value).length >= MIN_PASSAGE_TERM,
);
// Réactif au manifeste des téléchargements : un livre téléchargé entre deux
// recherches entre dans le périmètre sans recharger la page.
const onDeviceEntries = computed(() => studyEntries.filter((entry) => isEntryOnDevice(entry)));
const onDeviceBooks = computed(
  () => new Set(onDeviceEntries.value.map((entry) => bookForEntry(entry)?.path)).size,
);

const passages = ref<PassageHit[]>([]);
const passagesState = ref<"idle" | "searching" | "done">("idle");
// Numéro de la recherche en cours : une nouvelle frappe rend la précédente
// caduque, elle s'arrête au prochain livre et ne touche plus à l'écran.
let passageRun = 0;

watch(
  [query, passageTermOk, onDeviceEntries],
  async ([q, ok, entries]) => {
    const run = ++passageRun;
    passages.value = [];
    if (!ok) {
      passagesState.value = "idle";
      return;
    }
    passagesState.value = "searching";
    const hits = await searchPassages(entries, q, {
      isCancelled: () => run !== passageRun,
      onHits: (found) => {
        if (run === passageRun) passages.value = found;
      },
    });
    if (run !== passageRun) return;
    passages.value = hits;
    passagesState.value = "done";
  },
  { immediate: true },
);

/** Le titre d'une section dans la langue du lecteur (chapitre 3, daf 12b), à défaut son libellé. */
function headingText(heading: SectionHeading | undefined, fallback: string): string {
  if (!heading) return fallback;
  if (heading.kind === "chapter") return t("textReading.labels.chapter", { n: heading.n });
  if (heading.kind === "daf") return t("textReading.labels.daf", { daf: heading.daf });
  return t("textReading.labels.chapterDaf", {
    chapter: t("textReading.labels.chapter", { n: heading.n }),
    daf: t("textReading.labels.dafRange", { from: heading.from, to: heading.to }),
  });
}

/** « Berakhot · Chapitre 2 · verset 5 » : où le passage se trouve. */
function passagePlace(hit: PassageHit): string {
  const parts = [hit.entry.name];
  if (hit.entry.totalSections > 1) parts.push(headingText(hit.sectionHeading, hit.sectionLabel));
  parts.push(t("textReading.verseN", { n: hit.line + 1 }));
  return parts.join(" · ");
}

// --- Rien du tout ---------------------------------------------------------

const busy = computed(
  () => remoteState.value === "loading" || passagesState.value === "searching",
);
const nothing = computed(
  () => hasQuery.value && !busy.value && groups.value.length === 0 && passages.value.length === 0,
);

// --- La dictée ------------------------------------------------------------

let dictated = false;
const {
  supported: voiceSupported,
  listening,
  toggle,
  start,
} = useSpeechInput((text, final) => {
  term.value = text;
  if (final) dictated = true;
});

// --- Mesure : une recherche par visite, et ce qu'on y ouvre ----------------

let tracked = false;
watch(hasQuery, (has) => {
  if (!has || tracked) return;
  tracked = true;
  analyticsService.capture("global_search_used", { source: dictated ? "voice" : "typed" });
});

function trackOpen(kind: SearchKind | "passage") {
  analyticsService.capture("global_search_result_opened", { kind, voice: dictated });
}

onMounted(() => {
  seoService.setMeta({
    title: t("seo.searchTitle"),
    description: t("search.subtitle"),
    robots: "noindex, follow",
  });
  // Venu du micro de l'accueil : la dictée commence tout de suite, et
  // l'adresse oublie l'ordre pour ne pas le rejouer au retour.
  if (route.query.voice !== undefined) {
    void router.replace({ query: query.value ? { q: query.value } : {} });
    void start();
  }
});
</script>

<template>
  <main class="flex-1 container mx-auto px-4 py-6 max-w-3xl">
    <!-- App native : le titre se replie dès la première lettre, la barre
         monte en haut de l'écran (voir useSearchMode). -->
    <CollapseTransition>
      <div v-show="!searching" class="text-center mb-6">
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
          {{ t("search.title") }}
        </h1>
        <p class="mt-2 text-text-secondary">{{ t("search.subtitle") }}</p>
      </div>
    </CollapseTransition>

    <CatalogSearchField
      v-model:term="term"
      :placeholder="t('search.placeholder')"
      :voice="voiceSupported"
      :listening="listening"
      autofocus
      wide
      @voice="toggle"
    />
    <p
      v-if="listening"
      class="mt-3 text-center text-sm font-medium text-primary"
      aria-live="polite"
    >
      {{ t("search.voice.listening") }}
    </p>

    <p v-if="!hasQuery" class="mt-10 text-center text-text-secondary">
      {{ t("search.hint") }}
    </p>

    <div v-else class="mt-8 space-y-10">
      <section v-for="group in groups" :key="group.key">
        <h2 class="flex items-baseline justify-between gap-3 mb-1">
          <span class="text-xl font-bold text-text-primary">{{ t(group.titleKey) }}</span>
          <span class="text-sm font-medium text-text-secondary tabular-nums">{{ group.total }}</span>
        </h2>
        <ul class="result-list">
          <li v-for="hit in group.hits" :key="hit.id">
            <RouterLink :to="hit.to" class="result-row group" @click="trackOpen(hit.kind)">
              <AppIcon :name="group.icon" :size="18" class="shrink-0 text-text-secondary/70" />
              <span class="min-w-0 flex-1">
                <span
                  class="block font-medium text-text-primary group-hover:text-primary transition-colors"
                >
                  {{ hit.title }}
                </span>
                <span v-if="hit.subtitle" class="block text-sm text-text-secondary">
                  {{ hit.subtitle }}
                </span>
              </span>
              <span
                v-if="hit.finished"
                class="chip shrink-0 bg-black/5 text-text-secondary dark:bg-white/10"
              >
                {{ t("search.finished") }}
              </span>
              <span v-else-if="hit.tagKey" class="chip shrink-0 bg-primary/10 text-primary">
                {{ t(hit.tagKey) }}
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="group.total > group.hits.length" class="mt-2 text-sm text-text-secondary">
          {{ t("search.more", { count: group.total - group.hits.length }) }}
        </p>
      </section>

      <!-- Dans les textes : seulement pour un terme en hébreu, la langue des lignes. -->
      <section v-if="hebrewQuery">
        <h2 class="flex items-baseline justify-between gap-3 mb-1">
          <span class="text-xl font-bold text-text-primary">
            {{ t("search.sections.passages") }}
          </span>
          <span
            v-if="passagesState === 'done'"
            class="text-sm font-medium text-text-secondary tabular-nums"
          >
            {{ passages.length }}
          </span>
        </h2>
        <p class="text-sm text-text-secondary mb-1">
          {{ t("search.passagesScope", { count: onDeviceBooks }, onDeviceBooks) }}
        </p>
        <p v-if="!passageTermOk" class="text-sm text-text-secondary">
          {{ t("search.passagesShort", { count: MIN_PASSAGE_TERM }) }}
        </p>
        <ul v-if="passages.length" class="result-list">
          <li v-for="hit in passages" :key="hit.to">
            <RouterLink :to="hit.to" class="result-row group" @click="trackOpen('passage')">
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-text-secondary">{{ passagePlace(hit) }}</span>
                <span
                  class="result-he block text-lg leading-relaxed text-text-primary group-hover:text-primary transition-colors"
                  dir="rtl"
                >
                  {{ hit.before }}<mark class="result-mark">{{ hit.match }}</mark>{{ hit.after }}
                </span>
              </span>
            </RouterLink>
          </li>
        </ul>
        <p
          v-if="passagesState === 'searching'"
          class="mt-2 flex items-center gap-2 text-sm text-text-secondary"
        >
          <AppIcon name="spinner" :size="14" class="animate-spin" />
          {{ t("search.passagesSearching") }}
        </p>
        <p
          v-else-if="passagesState === 'done' && passages.length === 0"
          class="text-sm text-text-secondary"
        >
          {{ t("search.passagesNone", { term: query }) }}
        </p>
      </section>

      <p v-if="remoteState === 'loading'" class="flex items-center gap-2 text-sm text-text-secondary">
        <AppIcon name="spinner" :size="14" class="animate-spin" />
        {{ t("search.remoteLoading") }}
      </p>
      <p v-else-if="remoteState === 'failed'" class="text-sm text-text-secondary">
        {{ online ? t("search.remoteFailed") : t("search.offlineRemote") }}
      </p>

      <p v-if="nothing" class="py-6 text-center text-text-secondary">
        {{ t("search.noResults", { term: query }) }}
      </p>
    </div>
  </main>
</template>

<style scoped>
/* Des lignes séparées d'un filet, pas des cartes : un résultat est un endroit
   où aller, pas une réponse (voir docs/design.md, « Le cadre se mérite »). */
.result-list > li + li {
  border-top: 1px solid var(--color-line);
}
.result-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: 0.75rem;
}
.result-he {
  font-family: var(--font-hebrew);
}
/* Le mot trouvé : un fond de la couleur du thème, léger, sans changer l'encre. */
.result-mark {
  background-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  color: inherit;
  border-radius: 2px;
}
</style>
