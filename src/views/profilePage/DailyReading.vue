<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../../models/models";
import { userPreferencesService } from "../../services/userPreferencesService";
import { syncDailyReadingDownloads } from "../../services/offlineLibraryService";
import { pushService } from "../../services/pushService";
import { sessionService } from "../../services/sessionService";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { isNativeApp } from "../../composables/useNativeApp";
import { useToast } from "../../composables/useToast";
import DailyReadingItem from "./DailyReadingItem.vue";
import ReminderTimeModal from "./ReminderTimeModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{ userId: string }>();
const { t, locale } = useI18n();
const toast = useToast();

const ALL_TYPE = "Tout";

const TYPES = [
  { key: ALL_TYPE, labelKey: "study.types.all" },
  { key: "Tehilim", labelKey: "study.types.tehilim" },
  { key: "Mishna", labelKey: "study.types.mishna" },
  { key: "Talmud Bavli", labelKey: "study.types.talmud" },
  { key: "Tanakh", labelKey: "study.types.tanakh" },
];

// Type tabs that map to an actual corpus (everything except the "Tout" tab).
const CORPUS_TYPES = TYPES.filter((ty) => ty.key !== ALL_TYPE);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const byId = new Map<string, TextStudyJsonEntry>(allTexts.map((txt) => [String(txt.id), txt]));

const loading = ref(true);
const saving = ref(false);
const mode = ref<"reading" | "manage">("reading");

// Ids kept as strings for reliable Map lookups; converted back to numbers on save.
const selectedIds = ref<string[]>([]);
const completedIds = ref<Set<string>>(new Set());
// Texts whose content is folded away (UI-only): clicking the title toggles this,
// and marking a text as read folds it so only unread texts stay expanded.
const collapsedIds = ref<Set<string>>(new Set());

// --- Rappel push (app native uniquement) : la cloche de l'en-tête. ---
const reminderEnabled = ref(false);
const reminderHour = ref(18);
const reminderMinute = ref(0);
const reminderBusy = ref(false);
const showReminderModal = ref(false);

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

    reminderEnabled.value = prefs.pushReminderEnabled === true;
    reminderHour.value = prefs.pushReminderHour ?? 18;
    reminderMinute.value = prefs.pushReminderMinute ?? 0;

    // App native : garantit en tâche de fond que la lecture du jour est
    // disponible hors ligne (no-op sur le web).
    syncDailyReadingDownloads((prefs.dailyReadingIds ?? []).map(Number)).catch(() => {});

    const progress = prefs.dailyReadingProgress;
    if (progress && progress.date === todayKey()) {
      completedIds.value = new Set(progress.completedIds.map(String));
      // Texts already read today start folded so unread ones stand out.
      collapsedIds.value = new Set(completedIds.value);
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
    // La nouvelle liste doit rester lisible hors ligne (no-op sur le web).
    syncDailyReadingDownloads(selectedIds.value.map(Number)).catch(() => {});
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
    setCollapsed(id, false);
  } else {
    selectedIds.value = [...selectedIds.value, id];
  }
  await persistSelection();
}

async function toggleCompleted(id: string) {
  const next = new Set(completedIds.value);
  const nowRead = !next.has(id);
  if (nowRead) next.add(id);
  else next.delete(id);
  completedIds.value = next;
  // Marking read folds the text away; un-marking reopens it to keep reading.
  setCollapsed(id, nowRead);
  await persistProgress();
}

function setCollapsed(id: string, collapsed: boolean) {
  const next = new Set(collapsedIds.value);
  if (collapsed) next.add(id);
  else next.delete(id);
  collapsedIds.value = next;
}

// Clicking a text's title folds/unfolds it (even once read, to read it again).
function toggleCollapse(id: string) {
  setCollapsed(id, !collapsedIds.value.has(id));
}

const completedCount = computed(
  () => selectedIds.value.filter((id) => completedIds.value.has(id)).length,
);
const totalCount = computed(() => selectedIds.value.length);
const allDone = computed(() => totalCount.value > 0 && completedCount.value === totalCount.value);
const progressPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100),
);

// --- Rappel push : cloche inactive → modal horloge ; cloche active → coupe le rappel. ---
function onBellClick() {
  if (reminderBusy.value) return;
  if (reminderEnabled.value) {
    void disableReminder();
  } else {
    showReminderModal.value = true;
  }
}

function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function enableReminder(time: { hour: number; minute: number }) {
  reminderBusy.value = true;
  try {
    await pushService.enable(props.userId, String(locale.value), time.hour, time.minute);
    reminderEnabled.value = true;
    reminderHour.value = time.hour;
    reminderMinute.value = time.minute;
    toast.success(
      t("notifications.enabledToast", { time: formatReminderTime(time.hour, time.minute) }),
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "PERMISSION_DENIED") {
      toast.error(t("notifications.permissionDenied"));
    } else {
      console.error("Activation du rappel échouée:", e);
      toast.error(t("notifications.error"));
    }
  } finally {
    reminderBusy.value = false;
  }
}

async function disableReminder() {
  reminderBusy.value = true;
  try {
    await pushService.disable(props.userId);
    reminderEnabled.value = false;
    toast.success(t("notifications.disabledToast"));
  } catch (e: unknown) {
    console.error("Désactivation du rappel échouée:", e);
    toast.error(t("notifications.error"));
  } finally {
    reminderBusy.value = false;
  }
}

// --- Manage view (browse the library, like the Bibliothèque) ---
const searchTerm = ref("");
const selectedType = ref(ALL_TYPE);

// "Tout" shows every corpus at once; any other tab stays scoped to itself.
const isAllSelected = computed(() => selectedType.value === ALL_TYPE);

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return allTexts.filter((txt) => {
    const matchesTerm = term === "" || txt.name.toLowerCase().includes(term);
    const matchesType = isAllSelected.value || String(txt.type) === selectedType.value;
    return matchesTerm && matchesType;
  });
});

// Group results by type (a type heading is only shown on the "Tout" tab), then
// by book/seder, so each section stays readable.
const groupedByType = computed(() => {
  return CORPUS_TYPES.map((ty) => {
    const texts = filtered.value.filter((txt) => String(txt.type) === ty.key);
    const groups: Record<string, TextStudyJsonEntry[]> = {};
    for (const txt of texts) (groups[txt.livre] ??= []).push(txt);
    return { key: ty.key, labelKey: ty.labelKey, groups, count: texts.length };
  }).filter((group) => group.count > 0);
});

function formatBookName(livre: string): string {
  return sessionService.formatBookName(livre);
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h2 class="text-2xl font-bold mb-2 text-text-primary">
          {{ t("dailyReading.title") }}
        </h2>
        <!-- Le descriptif ne sert que le site ; l'état vide explique déjà la fonction. -->
        <p v-if="!isNativeApp" class="text-text-secondary max-w-xl">
          {{ t("dailyReading.description") }}
        </p>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- App native : la cloche active/coupe le rappel push quotidien. -->
        <button
          v-if="isNativeApp"
          @click="onBellClick"
          :disabled="reminderBusy"
          :class="[
            'inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors',
            reminderEnabled
              ? 'bg-primary/10 text-primary'
              : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10',
          ]"
          :aria-label="
            reminderEnabled ? t('notifications.disableAria') : t('notifications.enableAria')
          "
          :aria-pressed="reminderEnabled"
        >
          <AppIcon v-if="reminderBusy" name="spinner" :size="20" class="animate-spin" />
          <AppIcon v-else name="bell" :size="20" />
        </button>

        <button v-if="mode === 'reading'" @click="mode = 'manage'" class="btn btn-primary">
          <AppIcon name="settings" :size="14" />
          {{ t("dailyReading.manage") }}
        </button>
        <button v-else @click="mode = 'reading'" class="btn btn-soft">
          <AppIcon name="check" :size="14" />
          {{ t("dailyReading.done") }}
        </button>
      </div>
    </div>

    <ReminderTimeModal
      v-model:show="showReminderModal"
      :hour="reminderHour"
      :minute="reminderMinute"
      @confirm="enableReminder"
    />

    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-20 rounded-2xl bg-black/10 dark:bg-white/10"></div>
      <div class="h-40 rounded-2xl bg-black/10 dark:bg-white/10"></div>
    </div>

    <!-- ===== Manage mode: pick texts from the library ===== -->
    <template v-else-if="mode === 'manage'">
      <p class="text-sm text-text-secondary mb-4 flex items-center gap-1.5">
        <AppIcon name="info" :size="14" />
        {{ t("dailyReading.selectedCount", { count: totalCount }) }}
      </p>

      <!-- Recherche : collante sur l'app pour rester accessible au scroll. -->
      <div :class="isNativeApp ? 'app-sticky-search' : ''" class="flex justify-center mb-4">
        <div class="relative w-full md:w-96">
          <AppIcon
            name="search"
            :size="16"
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
          />
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="t('study.searchPlaceholder')"
            class="field !pl-11"
          />
          <button
            v-if="searchTerm"
            @click="searchTerm = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
          >
            <AppIcon name="x" :size="14" />
          </button>
        </div>
      </div>

      <div class="flex flex-col items-center gap-4 mb-8">
        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="ty in TYPES"
            :key="ty.key"
            @click="selectedType = ty.key"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedType === ty.key
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:bg-black/10 hover:text-text-primary dark:bg-white/10 dark:hover:bg-white/15',
            ]"
          >
            {{ t(ty.labelKey) }}
          </button>
        </div>
      </div>

      <div v-if="filtered.length > 0" class="space-y-10">
        <div v-for="typeGroup in groupedByType" :key="typeGroup.key" class="space-y-8">
          <!-- Type heading: shown only on the "Tout" tab, where several corpora mix. -->
          <h2 v-if="isAllSelected" class="text-xl font-bold text-text-primary">
            {{ t(typeGroup.labelKey) }}
          </h2>
          <section v-for="(texts, livre) in typeGroup.groups" :key="livre">
            <h3 class="text-lg font-bold text-text-primary mb-3">
              {{ formatBookName(String(livre)) }}
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="text in texts"
                :key="text.id"
                @click="toggleSelect(text)"
                :class="[
                  'flex items-center justify-between gap-2 p-3 rounded-lg transition-colors text-left',
                  isSelected(text.id)
                    ? 'bg-primary/10'
                    : 'bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/5 dark:hover:bg-white/10',
                ]"
              >
                <span class="min-w-0">
                  <span class="block font-medium text-text-primary truncate">
                    {{ appendHebrewNumeral(text.name) }}
                  </span>
                </span>
                <span
                  :class="[
                    'flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold',
                    isSelected(text.id) ? 'text-primary' : 'text-text-secondary/60',
                  ]"
                >
                  <AppIcon
                    :name="isSelected(text.id) ? 'circle-check' : 'circle-plus'"
                    :size="14"
                  />
                  {{ isSelected(text.id) ? t("dailyReading.added") : t("dailyReading.add") }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <AppIcon name="search" :size="32" class="text-text-secondary/40 mb-4" />
        <p class="text-text-secondary">{{ t("study.noResults") }}</p>
      </div>
    </template>

    <!-- ===== Reading mode: the selected texts, one after another ===== -->
    <template v-else>
      <!-- Empty list -->
      <div
        v-if="totalCount === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <AppIcon name="book" :size="32" class="text-primary/50 mb-4" />
        <h3 class="text-xl font-semibold text-text-primary mb-2">
          {{ t("dailyReading.emptyTitle") }}
        </h3>
        <p class="text-text-secondary mb-6 max-w-sm">
          {{ t("dailyReading.emptyDescription") }}
        </p>
        <button @click="mode = 'manage'" class="btn btn-primary">
          <AppIcon name="plus" :size="14" />
          {{ t("dailyReading.addTexts") }}
        </button>
      </div>

      <template v-else>
        <!-- Daily progress -->
        <div class="card p-5 mb-8">
          <div v-if="allDone" class="flex items-start gap-3">
            <AppIcon name="circle-check" :size="20" class="text-green-500 mt-0.5" />
            <div>
              <p class="font-semibold text-text-primary">
                {{ t("dailyReading.allReadTitle") }}
              </p>
              <p class="text-sm text-text-secondary">
                {{ t("dailyReading.allReadDescription") }}
              </p>
            </div>
          </div>
          <template v-else>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-text-primary">
                {{ t("dailyReading.progress", { done: completedCount, total: totalCount }) }}
              </span>
              <span class="text-sm font-semibold text-primary">{{ progressPct }}%</span>
            </div>
            <div class="h-2 w-full rounded-full bg-black/5 overflow-hidden dark:bg-white/10">
              <div
                class="h-full rounded-full bg-primary transition-all duration-500"
                :style="{ width: `${progressPct}%` }"
              ></div>
            </div>
          </template>
          <p class="text-xs text-text-secondary/70 mt-3 flex items-center gap-1.5">
            <AppIcon name="rotate" :size="12" />
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
            <!-- Discreet heading: click to fold/unfold the text -->
            <header class="mb-4">
              <button
                type="button"
                @click="toggleCollapse(String(entry.id))"
                class="group flex w-full items-start gap-3 text-left"
              >
                <AppIcon
                  name="chevron-down"
                  :size="13"
                  class="mt-1.5 text-text-secondary/60 transition-transform duration-200"
                  :class="collapsedIds.has(String(entry.id)) ? '-rotate-90' : ''"
                />
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-primary">
                    {{ formatBookName(entry.livre) }}
                  </span>
                  <span
                    class="flex items-center gap-2 text-lg font-bold text-text-primary transition-colors group-hover:text-primary"
                  >
                    {{ appendHebrewNumeral(entry.name) }}
                    <AppIcon
                      v-if="completedIds.has(String(entry.id))"
                      name="circle-check"
                      :size="15"
                      class="text-green-500"
                    />
                  </span>
                </span>
              </button>
            </header>

            <!-- Text content + "mark as read", hidden (but kept loaded) when folded -->
            <div v-show="!collapsedIds.has(String(entry.id))">
              <DailyReadingItem :entry="entry" />

              <!-- Discreet "mark as read" button -->
              <div class="mt-4">
                <button
                  @click="toggleCompleted(String(entry.id))"
                  :class="[
                    'inline-flex items-center gap-2 text-sm font-medium transition-colors',
                    completedIds.has(String(entry.id))
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-text-secondary hover:text-primary',
                  ]"
                >
                  <AppIcon
                    v-if="completedIds.has(String(entry.id))"
                    name="circle-check"
                    :size="15"
                  />
                  <span
                    v-else
                    class="w-3.5 h-3.5 rounded-full border-2 border-current shrink-0"
                  ></span>
                  {{
                    completedIds.has(String(entry.id))
                      ? t("dailyReading.readToday")
                      : t("dailyReading.markRead")
                  }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </template>
  </div>
</template>
