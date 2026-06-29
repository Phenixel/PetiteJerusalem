<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import { userPreferencesService } from "../../services/userPreferencesService";
import { sessionService } from "../../services/sessionService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import DailyReadingItem from "./DailyReadingItem.vue";

const props = defineProps<{ userId: string }>();
const { t } = useI18n();

const TYPES = [
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const byId = new Map<string, TextStudyJsonEntry>(allTexts.map((txt) => [String(txt.id), txt]));

const loading = ref(true);
const saving = ref(false);
const mode = ref<"reading" | "manage">("reading");

// Ids kept as strings for reliable Map lookups; converted back to numbers on save.
const selectedIds = ref<string[]>([]);
const completedIds = ref<Set<string>>(new Set());

const selectedEntries = computed(
  () => selectedIds.value.map((id) => byId.get(id)).filter(Boolean) as TextStudyJsonEntry[],
);

/** Local calendar day (YYYY-MM-DD), so the daily tracking resets at local midnight. */
function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

onMounted(async () => {
  try {
    const prefs = await userPreferencesService.getPreferences(props.userId);
    selectedIds.value = (prefs.dailyReadingIds ?? []).map(String);

    const progress = prefs.dailyReadingProgress;
    if (progress && progress.date === todayKey()) {
      completedIds.value = new Set(progress.completedIds.map(String));
    } else {
      // New day (or never tracked): start fresh and persist the reset once.
      completedIds.value = new Set();
      if (progress && progress.completedIds.length > 0) {
        await persistProgress();
      }
    }
  } finally {
    loading.value = false;
  }
});

async function persistSelection() {
  saving.value = true;
  try {
    await userPreferencesService.savePreferences(props.userId, {
      dailyReadingIds: selectedIds.value.map(Number),
    });
  } finally {
    saving.value = false;
  }
}

async function persistProgress() {
  await userPreferencesService.savePreferences(props.userId, {
    dailyReadingProgress: {
      date: todayKey(),
      completedIds: [...completedIds.value].map(Number),
    },
  });
}

function isSelected(id: string | number): boolean {
  return selectedIds.value.includes(String(id));
}

async function toggleSelect(entry: TextStudyJsonEntry) {
  const id = String(entry.id);
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
    const next = new Set(completedIds.value);
    next.delete(id);
    completedIds.value = next;
  } else {
    selectedIds.value = [...selectedIds.value, id];
  }
  await persistSelection();
}

async function toggleCompleted(id: string) {
  const next = new Set(completedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  completedIds.value = next;
  await persistProgress();
}

const completedCount = computed(
  () => selectedIds.value.filter((id) => completedIds.value.has(id)).length,
);
const totalCount = computed(() => selectedIds.value.length);
const allDone = computed(() => totalCount.value > 0 && completedCount.value === totalCount.value);
const progressPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100),
);

// --- Manage view (browse the library, like the Bibliothèque) ---
const searchTerm = ref("");
const selectedType = ref("Tehilim");

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return allTexts.filter(
    (txt) =>
      String(txt.type) === selectedType.value &&
      (term === "" || txt.name.toLowerCase().includes(term)),
  );
});

const groupedByBook = computed(() => {
  const groups: Record<string, TextStudyJsonEntry[]> = {};
  for (const txt of filtered.value) (groups[txt.livre] ??= []).push(txt);
  return groups;
});

function formatBookName(livre: string): string {
  return sessionService.formatBookName(livre);
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h2
          class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
        >
          {{ t("dailyReading.title") }}
        </h2>
        <p class="text-text-secondary dark:text-gray-400 max-w-xl">
          {{ t("dailyReading.description") }}
        </p>
      </div>

      <button
        v-if="mode === 'reading'"
        @click="mode = 'manage'"
        class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <i class="fa-solid fa-sliders text-xs"></i>
        {{ t("dailyReading.manage") }}
      </button>
      <button
        v-else
        @click="mode = 'reading'"
        class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
      >
        <i class="fa-solid fa-check text-xs"></i>
        {{ t("dailyReading.done") }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-20 bg-gray-200 rounded-2xl dark:bg-gray-700"></div>
      <div class="h-40 bg-gray-200 rounded-2xl dark:bg-gray-700"></div>
    </div>

    <!-- ===== Manage mode: pick texts from the library ===== -->
    <template v-else-if="mode === 'manage'">
      <p class="text-sm text-text-secondary mb-4 dark:text-gray-400">
        <i class="fa-solid fa-circle-info mr-1"></i>
        {{ t("dailyReading.selectedCount", { count: totalCount }) }}
      </p>

      <div class="flex flex-col items-center gap-4 mb-8">
        <div class="relative w-full md:w-96">
          <i
            class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 dark:text-gray-500"
          ></i>
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="t('study.searchPlaceholder')"
            class="w-full pl-11 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl text-text-primary placeholder-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all dark:bg-gray-800/60 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <button
            v-if="searchTerm"
            @click="searchTerm = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text-primary transition-colors dark:text-gray-500 dark:hover:text-gray-300"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="ty in TYPES"
            :key="ty.key"
            @click="selectedType = ty.key"
            :class="[
              'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
              selectedType === ty.key
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-white/60 text-text-secondary border-white/60 hover:bg-white/80 hover:text-text-primary dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200',
            ]"
          >
            {{ t(ty.labelKey) }}
          </button>
        </div>
      </div>

      <div v-if="filtered.length > 0" class="space-y-8">
        <section v-for="(texts, livre) in groupedByBook" :key="livre">
          <h3
            class="text-lg font-bold text-text-primary mb-3 pl-3 border-l-4 border-primary dark:text-gray-100"
          >
            {{ formatBookName(String(livre)) }}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="text in texts"
              :key="text.id"
              @click="toggleSelect(text)"
              :class="[
                'flex items-center justify-between gap-2 p-3 rounded-xl border transition-all text-left',
                isSelected(text.id)
                  ? 'bg-primary/10 border-primary/40 dark:bg-primary/20'
                  : 'bg-white/60 border-white/40 hover:border-primary hover:shadow-md dark:bg-gray-800/60 dark:border-gray-700 dark:hover:border-primary',
              ]"
            >
              <span class="min-w-0">
                <span class="block font-medium text-text-primary truncate dark:text-gray-200">
                  {{ appendHebrewNumeral(text.name) }}
                </span>
              </span>
              <span
                :class="[
                  'flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold',
                  isSelected(text.id) ? 'text-primary' : 'text-text-secondary/60 dark:text-gray-500',
                ]"
              >
                <i :class="isSelected(text.id) ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-plus'"></i>
                {{ isSelected(text.id) ? t("dailyReading.added") : t("dailyReading.add") }}
              </span>
            </button>
          </div>
        </section>
      </div>

      <div v-else class="text-center py-12 text-text-secondary dark:text-gray-400">
        <i class="fa-solid fa-magnifying-glass text-3xl mb-3 block opacity-40"></i>
        <p>{{ t("study.noResults") }}</p>
      </div>
    </template>

    <!-- ===== Reading mode: the selected texts, one after another ===== -->
    <template v-else>
      <!-- Empty list -->
      <div
        v-if="totalCount === 0"
        class="flex flex-col items-center justify-center p-12 text-center bg-white/60 backdrop-blur-sm rounded-2xl border border-white/60 dark:bg-gray-800/40 dark:border-gray-700"
      >
        <div
          class="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl mb-4 dark:bg-primary/20"
        >
          <i class="fa-solid fa-book-bookmark"></i>
        </div>
        <h3 class="text-xl font-semibold text-text-primary mb-2 dark:text-gray-100">
          {{ t("dailyReading.emptyTitle") }}
        </h3>
        <p class="text-text-secondary mb-6 max-w-sm dark:text-gray-400">
          {{ t("dailyReading.emptyDescription") }}
        </p>
        <button
          @click="mode = 'manage'"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <i class="fa-solid fa-plus text-xs"></i>
          {{ t("dailyReading.addTexts") }}
        </button>
      </div>

      <template v-else>
        <!-- Daily progress -->
        <div
          class="mb-8 p-5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 dark:bg-gray-800/60 dark:border-gray-700"
        >
          <div v-if="allDone" class="flex items-start gap-3">
            <i class="fa-solid fa-circle-check text-green-500 text-xl mt-0.5"></i>
            <div>
              <p class="font-semibold text-text-primary dark:text-gray-100">
                {{ t("dailyReading.allReadTitle") }}
              </p>
              <p class="text-sm text-text-secondary dark:text-gray-400">
                {{ t("dailyReading.allReadDescription") }}
              </p>
            </div>
          </div>
          <template v-else>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-text-primary dark:text-gray-200">
                {{ t("dailyReading.progress", { done: completedCount, total: totalCount }) }}
              </span>
              <span class="text-sm font-semibold text-primary">{{ progressPct }}%</span>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-200 overflow-hidden dark:bg-gray-700">
              <div
                class="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                :style="{ width: `${progressPct}%` }"
              ></div>
            </div>
          </template>
          <p class="text-xs text-text-secondary/70 mt-3 dark:text-gray-500">
            <i class="fa-solid fa-rotate mr-1"></i>
            {{ t("dailyReading.resetsDaily") }}
          </p>
        </div>

        <!-- Texts, one after another, directly on the page background -->
        <div class="space-y-12">
          <article
            v-for="entry in selectedEntries"
            :key="entry.id"
            :class="completedIds.has(String(entry.id)) ? 'opacity-60' : ''"
          >
            <!-- Discreet heading -->
            <header class="mb-4">
              <p class="text-xs font-semibold text-primary uppercase tracking-wide">
                {{ formatBookName(entry.livre) }}
              </p>
              <h3 class="text-lg font-bold text-text-primary dark:text-gray-100">
                {{ appendHebrewNumeral(entry.name) }}
              </h3>
            </header>

            <!-- Text content -->
            <DailyReadingItem :entry="entry" />

            <!-- Discreet "mark as read" button -->
            <div class="mt-4">
              <button
                @click="toggleCompleted(String(entry.id))"
                :class="[
                  'inline-flex items-center gap-2 text-sm font-medium transition-colors',
                  completedIds.has(String(entry.id))
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-text-secondary hover:text-primary dark:text-gray-400',
                ]"
              >
                <i
                  :class="
                    completedIds.has(String(entry.id))
                      ? 'fa-solid fa-circle-check'
                      : 'fa-regular fa-circle'
                  "
                ></i>
                {{
                  completedIds.has(String(entry.id))
                    ? t("dailyReading.readToday")
                    : t("dailyReading.markRead")
                }}
              </button>
            </div>
          </article>
        </div>
      </template>
    </template>
  </div>
</template>
