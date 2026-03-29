<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useTheme, type ThemeOption } from "../../composables/useTheme";

const props = defineProps<{
  userId: string;
}>();

const { t } = useI18n();
const { currentThemeId, themes, setTheme, previewTheme, cancelPreview } = useTheme();

const saving = ref(false);
const previewingId = ref<string | null>(null);

const selectTheme = async (themeId: string) => {
  if (themeId === currentThemeId.value) return;
  saving.value = true;
  previewingId.value = null;
  try {
    await setTheme(props.userId, themeId);
  } finally {
    saving.value = false;
  }
};

const onMouseEnter = (themeId: string) => {
  if (themeId !== currentThemeId.value) {
    previewingId.value = themeId;
    previewTheme(themeId);
  }
};

const onMouseLeave = () => {
  if (previewingId.value) {
    previewingId.value = null;
    cancelPreview();
  }
};

onUnmounted(() => {
  if (previewingId.value) {
    cancelPreview();
  }
});

const getThemeName = (theme: ThemeOption): string => {
  return t(`profile.themes.${theme.id}`);
};
</script>

<template>
  <div>
    <h2
      class="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
    >
      {{ t("profile.themeTitle") }}
    </h2>
    <p class="text-text-secondary dark:text-gray-400 mb-8">
      {{ t("profile.themeDescription") }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <button
        v-for="theme in themes"
        :key="theme.id"
        @click="selectTheme(theme.id)"
        @mouseenter="onMouseEnter(theme.id)"
        @mouseleave="onMouseLeave"
        :class="[
          'group relative rounded-2xl border-2 p-1 transition-all duration-300 cursor-pointer text-left',
          currentThemeId === theme.id
            ? 'border-primary shadow-lg scale-[1.02]'
            : 'border-white/40 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md',
        ]"
        :disabled="saving"
      >
        <!-- Preview card -->
        <div class="rounded-xl overflow-hidden">
          <!-- Gradient header preview -->
          <div
            class="h-24 relative"
            :style="{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
            }"
          >
            <div class="absolute inset-0 flex items-end p-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm"></div>
                <div>
                  <div class="h-2.5 w-20 rounded-full bg-white/60"></div>
                  <div class="h-2 w-12 rounded-full bg-white/40 mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Content preview (light mode) -->
          <div class="bg-white dark:bg-gray-800 p-3 space-y-2">
            <div class="flex gap-2">
              <div
                class="h-2.5 w-16 rounded-full"
                :style="{ backgroundColor: theme.primary }"
              ></div>
              <div class="h-2.5 w-10 rounded-full bg-gray-200 dark:bg-gray-600"></div>
            </div>
            <div class="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700"></div>
            <div class="h-2 w-3/4 rounded-full bg-gray-100 dark:bg-gray-700"></div>
            <!-- Button preview -->
            <div class="pt-1">
              <div
                class="h-6 w-20 rounded-lg"
                :style="{
                  background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
                }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Theme name & status -->
        <div class="p-3 flex items-center justify-between">
          <span class="font-semibold text-text-primary dark:text-gray-100">
            {{ getThemeName(theme) }}
          </span>
          <span
            v-if="currentThemeId === theme.id"
            class="flex items-center gap-1 text-xs font-medium text-primary"
          >
            <i class="fa-solid fa-check"></i>
            {{ t("profile.themeActive") }}
          </span>
        </div>
      </button>
    </div>

    <p class="text-sm text-text-secondary dark:text-gray-500 mt-6">
      <i class="fa-solid fa-circle-info mr-1"></i>
      {{ t("profile.themeHint") }}
    </p>
  </div>
</template>
