<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { TextStudyJsonEntry } from "../../models/models";
import { loadText, MissingTextFileError } from "../../services/textService";
import type { TextContent } from "../../services/textService";

const props = defineProps<{ entry: TextStudyJsonEntry }>();
const { t } = useI18n();

const loading = ref(true);
const error = ref(false);
const missing = ref(false);
const content = ref<TextContent | null>(null);

// Reference texts (more than one section) get verse numbers; texts read as a
// whole (Tehilim, a full parasha) don't need them.
const showVerseNumbers = computed(() => (props.entry.totalSections ?? 1) > 1);
const isMultiSection = computed(() => (content.value?.sections.length ?? 0) > 1);

async function load() {
  loading.value = true;
  error.value = false;
  missing.value = false;
  content.value = null;
  try {
    content.value = await loadText(props.entry);
  } catch (e) {
    if (e instanceof MissingTextFileError) missing.value = true;
    else error.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div v-if="loading" class="animate-pulse space-y-3 py-2">
      <div class="h-5 bg-gray-200 rounded w-full dark:bg-gray-700"></div>
      <div class="h-5 bg-gray-200 rounded w-5/6 dark:bg-gray-700"></div>
      <div class="h-5 bg-gray-200 rounded w-2/3 dark:bg-gray-700"></div>
    </div>

    <p v-else-if="missing || error" class="py-2 text-sm text-text-secondary dark:text-gray-400">
      <i class="fa-solid fa-triangle-exclamation mr-1 text-amber-500"></i>
      {{ t("dailyReading.loadError") }}
      <button @click="load" class="ml-2 text-primary hover:underline">
        {{ t("textReading.retry") }}
      </button>
    </p>

    <div v-else-if="content" class="space-y-6">
      <section v-for="section in content.sections" :key="section.index">
        <p
          v-if="isMultiSection"
          class="mb-3 text-sm font-semibold text-primary/80 dark:text-primary"
        >
          {{ section.label }}
        </p>

        <!-- Talmud: continuous text with a marker at each daf change -->
        <template v-if="content.type === 'Talmud Bavli'">
          <template v-for="block in section.dafBlocks ?? []" :key="block.daf">
            <div class="flex items-center gap-3 my-4">
              <span class="flex-1 border-t border-black/10 dark:border-white/10"></span>
              <span
                class="text-xs font-semibold text-primary/70 uppercase tracking-wider whitespace-nowrap dark:text-primary"
              >
                Daf {{ block.daf }}
              </span>
              <span class="flex-1 border-t border-black/10 dark:border-white/10"></span>
            </div>
            <p
              dir="rtl"
              class="font-hebrew text-xl leading-loose text-text-primary dark:text-gray-100"
            >
              {{ block.lines.join(" ") }}
            </p>
          </template>
        </template>

        <!-- Verses / mishnayot / psalm lines: each on its own line, flowing on the background -->
        <p
          v-else
          dir="rtl"
          class="font-hebrew text-xl leading-loose text-text-primary dark:text-gray-100"
        >
          <template v-for="(line, index) in section.he" :key="index">
            <span v-if="showVerseNumbers" class="text-xs align-super text-primary/60 select-none">
              {{ index + 1 }}&#8201;</span
            >{{ line }}<br />
          </template>
        </p>
      </section>
    </div>
  </div>
</template>
