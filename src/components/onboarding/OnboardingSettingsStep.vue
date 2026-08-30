<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "../../composables/useLocale";
import { useTheme } from "../../composables/useTheme";
import { ensureAllFontsLoaded, useFonts, type FontOption } from "../../composables/useFonts";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Deuxième page : l'apparence, en une seule page et sans défilement caché.
 * Les trois langues, les trois thèmes et les trois polices de chaque écriture
 * sont côte à côte : on les compare d'un regard, au lieu de les découvrir les
 * uns après les autres.
 *
 * Les réglages passent par les mêmes composables que l'onglet Préférences :
 * sans compte ils sont gardés sur l'appareil, avec un compte ils partent chez
 * Firestore et suivent l'utilisateur (userPreferencesService).
 */

const props = defineProps<{ userId: string | null }>();

const { t } = useI18n();
const { currentLocale, availableLocales, setLocale } = useLocale();
const { currentThemeId, themes, setTheme } = useTheme();
const { currentLatinId, currentHebrewId, latinFonts, hebrewFonts, setLatinFont, setHebrewFont } =
  useFonts();

// Chaque option s'affiche dans sa propre police : les familles qui ne sont pas
// embarquées dans index.html n'arrivent qu'ici (voir useFonts).
ensureAllFontsLoaded();

const saving = ref(false);

/** Un réglage à la fois : l'échec d'enregistrement est déjà dit par le composable. */
async function apply(change: () => Promise<void>): Promise<void> {
  saving.value = true;
  try {
    await change();
  } catch {
    // Le composable a déjà remis la valeur d'avant : rien à ajouter ici.
  } finally {
    saving.value = false;
  }
}

const chooseTheme = (themeId: string) =>
  themeId === currentThemeId.value ? undefined : apply(() => setTheme(props.userId, themeId));

const chooseLatin = (font: FontOption) =>
  font.id === currentLatinId.value ? undefined : apply(() => setLatinFont(props.userId, font.id));

const chooseHebrew = (font: FontOption) =>
  font.id === currentHebrewId.value ? undefined : apply(() => setHebrewFont(props.userId, font.id));
</script>

<template>
  <div>
    <h1 class="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
      {{ t("onboarding.settings.title") }}
    </h1>
    <p class="text-text-secondary text-lg mb-8">
      {{ t("onboarding.settings.intro") }}
    </p>

    <!-- Langue -->
    <h2 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("onboarding.settings.languageTitle") }}
    </h2>
    <div class="grid grid-cols-3 gap-3 mb-8">
      <button
        v-for="locale in availableLocales"
        :key="locale.code"
        type="button"
        class="card p-3 text-center transition-all duration-300"
        :class="currentLocale === locale.code ? 'ring-2 ring-primary' : 'card-hover'"
        @click="setLocale(locale.code)"
      >
        <span class="block text-2xl mb-1">{{ locale.flag }}</span>
        <span
          class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm"
          :dir="locale.dir"
        >
          {{ locale.label }}
        </span>
      </button>
    </div>

    <!-- Thème -->
    <h2 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("onboarding.settings.themeTitle") }}
    </h2>
    <div class="grid grid-cols-3 gap-3 mb-8">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        class="card p-2 text-center transition-all duration-300"
        :class="currentThemeId === theme.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="chooseTheme(theme.id)"
      >
        <span
          class="relative block h-16 rounded-xl mb-2"
          :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
        >
          <span
            v-if="currentThemeId === theme.id"
            class="absolute inset-0 flex items-center justify-center text-white"
          >
            <AppIcon name="check" :size="22" />
          </span>
        </span>
        <span class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm">
          {{ t(`profile.themes.${theme.id}`) }}
        </span>
      </button>
    </div>

    <!-- Police de l'interface -->
    <h2 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("onboarding.settings.fontLatinTitle") }}
    </h2>
    <div class="grid grid-cols-3 gap-3 mb-8">
      <button
        v-for="font in latinFonts"
        :key="font.id"
        type="button"
        class="card p-3 text-center transition-all duration-300"
        :class="currentLatinId === font.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="chooseLatin(font)"
      >
        <span class="block text-2xl text-text-primary mb-1" :style="{ fontFamily: font.stack }">
          Aa
        </span>
        <span
          class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm"
          :style="{ fontFamily: font.stack }"
        >
          {{ font.label }}
        </span>
      </button>
    </div>

    <!-- Police des textes en hébreu -->
    <h2 class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("onboarding.settings.fontHebrewTitle") }}
    </h2>
    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="font in hebrewFonts"
        :key="font.id"
        type="button"
        class="card p-3 text-center transition-all duration-300"
        :class="currentHebrewId === font.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="chooseHebrew(font)"
      >
        <span
          class="block text-2xl text-text-primary mb-1"
          dir="rtl"
          :style="{ fontFamily: font.stack }"
        >
          אבג
        </span>
        <span class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm">{{
          font.label
        }}</span>
      </button>
    </div>

    <p class="text-sm text-text-secondary mt-6 flex items-center gap-1.5">
      <AppIcon name="info" :size="14" />
      {{ t("onboarding.settings.hint") }}
    </p>
  </div>
</template>
