<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useTheme, type ThemeOption } from "../../composables/useTheme";
import { useFonts, type FontOption } from "../../composables/useFonts";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  userId: string;
}>();

const { t } = useI18n();
const { currentThemeId, themes, setTheme, previewTheme, cancelPreview } = useTheme();
const {
  currentLatinId,
  currentHebrewId,
  latinFonts,
  hebrewFonts,
  setLatinFont,
  setHebrewFont,
} = useFonts();

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

const selectLatinFont = async (font: FontOption) => {
  if (font.id === currentLatinId.value) return;
  saving.value = true;
  try {
    await setLatinFont(props.userId, font.id);
  } finally {
    saving.value = false;
  }
};

const selectHebrewFont = async (font: FontOption) => {
  if (font.id === currentHebrewId.value) return;
  saving.value = true;
  try {
    await setHebrewFont(props.userId, font.id);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold mb-2 text-text-primary">
      {{ t("profile.themeTitle") }}
    </h2>
    <p class="text-text-secondary mb-8">
      {{ t("profile.themeDescription") }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <button
        v-for="theme in themes"
        :key="theme.id"
        @click="selectTheme(theme.id)"
        @mouseenter="onMouseEnter(theme.id)"
        @mouseleave="onMouseLeave"
        :class="[
          'card group relative p-1 transition-all duration-300 cursor-pointer text-left',
          currentThemeId === theme.id
            ? 'ring-2 ring-primary shadow-card-hover'
            : 'card-hover',
        ]"
        :disabled="saving"
      >
        <!-- Preview card -->
        <div class="rounded-xl overflow-hidden">
          <!-- Color header preview -->
          <div
            class="h-24 relative"
            :style="{
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
            }"
          >
            <div class="absolute inset-0 flex items-end p-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-white/30"></div>
                <div>
                  <div class="h-2.5 w-20 rounded-full bg-white/60"></div>
                  <div class="h-2 w-12 rounded-full bg-white/40 mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Content preview -->
          <div class="bg-surface p-3 space-y-2">
            <div class="flex gap-2">
              <div
                class="h-2.5 w-16 rounded-full"
                :style="{ backgroundColor: theme.primary }"
              ></div>
              <div class="h-2.5 w-10 rounded-full bg-black/10 dark:bg-white/20"></div>
            </div>
            <div class="h-2 w-full rounded-full bg-black/5 dark:bg-white/10"></div>
            <div class="h-2 w-3/4 rounded-full bg-black/5 dark:bg-white/10"></div>
            <!-- Button preview -->
            <div class="pt-1">
              <div
                class="h-6 w-20 rounded-lg"
                :style="{ backgroundColor: theme.primary }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Theme name & status -->
        <div class="p-3 flex items-center justify-between">
          <span class="font-semibold text-text-primary">
            {{ getThemeName(theme) }}
          </span>
          <span
            v-if="currentThemeId === theme.id"
            class="flex items-center gap-1 text-xs font-medium text-primary"
          >
            <AppIcon name="check" :size="12" />
            {{ t("profile.themeActive") }}
          </span>
        </div>
      </button>
    </div>

    <p class="text-sm text-text-secondary mt-6 flex items-center gap-1.5">
      <AppIcon name="info" :size="14" />
      {{ t("profile.themeHint") }}
    </p>

    <!-- Polices -->
    <h2 class="text-2xl font-bold mt-12 mb-2 text-text-primary">
      {{ t("profile.fontsTitle") }}
    </h2>
    <p class="text-text-secondary mb-8">
      {{ t("profile.fontsDescription") }}
    </p>

    <h3 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("profile.fontLatinLabel") }}
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <button
        v-for="font in latinFonts"
        :key="font.id"
        @click="selectLatinFont(font)"
        :disabled="saving"
        :class="[
          'card p-4 text-left transition-all duration-300 cursor-pointer',
          currentLatinId === font.id ? 'ring-2 ring-primary' : 'card-hover',
        ]"
      >
        <span class="block text-3xl text-text-primary mb-2" :style="{ fontFamily: font.stack }"
          >Aa</span
        >
        <span class="flex items-center justify-between">
          <span>
            <span class="block font-semibold text-text-primary" :style="{ fontFamily: font.stack }">{{
              font.label
            }}</span>
            <span class="block text-xs text-text-secondary mt-0.5">{{
              t(`profile.fontsLatin.${font.id}`)
            }}</span>
          </span>
          <AppIcon
            v-if="currentLatinId === font.id"
            name="check"
            :size="14"
            class="text-primary"
          />
        </span>
      </button>
    </div>

    <h3 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("profile.fontHebrewLabel") }}
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button
        v-for="font in hebrewFonts"
        :key="font.id"
        @click="selectHebrewFont(font)"
        :disabled="saving"
        :class="[
          'card p-4 text-left transition-all duration-300 cursor-pointer',
          currentHebrewId === font.id ? 'ring-2 ring-primary' : 'card-hover',
        ]"
      >
        <span
          class="block text-3xl text-text-primary mb-2"
          dir="rtl"
          :style="{ fontFamily: font.stack }"
          >אבג</span
        >
        <span class="flex items-center justify-between">
          <span>
            <span class="block font-semibold text-text-primary">{{ font.label }}</span>
            <span class="block text-xs text-text-secondary mt-0.5">{{
              t(`profile.fontsHebrew.${font.id}`)
            }}</span>
          </span>
          <AppIcon
            v-if="currentHebrewId === font.id"
            name="check"
            :size="14"
            class="text-primary"
          />
        </span>
      </button>
    </div>
  </div>
</template>
