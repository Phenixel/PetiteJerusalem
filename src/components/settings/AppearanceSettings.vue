<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale } from "../../composables/useLocale";
import { useTheme, type ThemeOption } from "../../composables/useTheme";
import { useColorScheme, type ColorSchemeOption } from "../../composables/useColorScheme";
import { ensureAllFontsLoaded, useFonts, type FontOption } from "../../composables/useFonts";
import AppIcon from "../icons/AppIcon.vue";

/**
 * Les réglages d'apparence : langue, clair ou sombre, thème de couleurs,
 * polices. Un seul composant pour les deux endroits où on les propose,
 * l'onglet Préférences du profil et l'introduction de première ouverture :
 * ce sont les mêmes choix, ils doivent avoir la même tête.
 *
 * Chaque famille tient sur une ligne de trois, y compris sur un téléphone :
 * les options se comparent d'un regard, ce qu'un empilement ne permet pas.
 *
 * `userId` null (visiteur sans compte, réglages de l'app native) : les choix
 * sont gardés sur l'appareil, et le compte les adoptera à la connexion, voir
 * userPreferencesService.
 */

const props = withDefaults(
  defineProps<{
    userId: string | null;
    /** Titres pleins et explications (page de réglages) plutôt que de simples étiquettes. */
    withDescriptions?: boolean;
  }>(),
  { withDescriptions: false },
);

const { t } = useI18n();
const { currentLocale, availableLocales, setLocale } = useLocale();
const { currentSchemeId, schemes, setColorScheme } = useColorScheme();
/** Les couleurs du miroir sombre, dont « Système » montre la moitié. */
const darkScheme = schemes.find((option) => option.id === "dark") ?? schemes[0];
const { currentThemeId, themes, setTheme, previewTheme, cancelPreview } = useTheme();
const { currentLatinId, currentHebrewId, latinFonts, hebrewFonts, setLatinFont, setHebrewFont } =
  useFonts();

// Chaque option s'affiche dans sa propre police : les familles non embarquées
// dans index.html n'arrivent qu'ici (voir useFonts).
ensureAllFontsLoaded();

const saving = ref(false);
const previewingId = ref<string | null>(null);

/** Un réglage à la fois ; l'échec est déjà rattrapé par le composable. */
async function apply(change: () => Promise<void>): Promise<void> {
  saving.value = true;
  try {
    await change();
  } catch {
    // La valeur d'avant est déjà revenue à l'écran : rien à ajouter ici.
  } finally {
    saving.value = false;
  }
}

const selectScheme = (option: ColorSchemeOption) => {
  if (option.id === currentSchemeId.value) return;
  apply(() => setColorScheme(props.userId, option.id));
};

const selectTheme = (theme: ThemeOption) => {
  if (theme.id === currentThemeId.value) return;
  previewingId.value = null;
  apply(() => setTheme(props.userId, theme.id));
};

const selectLatinFont = (font: FontOption) => {
  if (font.id === currentLatinId.value) return;
  apply(() => setLatinFont(props.userId, font.id));
};

const selectHebrewFont = (font: FontOption) => {
  if (font.id === currentHebrewId.value) return;
  apply(() => setHebrewFont(props.userId, font.id));
};

// Survol d'un thème : les couleurs s'appliquent le temps du survol, on repose
// celles du choix courant en partant (y compris si l'écran se ferme entre-temps).
const onThemeEnter = (themeId: string) => {
  if (themeId !== currentThemeId.value) {
    previewingId.value = themeId;
    previewTheme(themeId);
  }
};

const onThemeLeave = () => {
  if (previewingId.value) {
    previewingId.value = null;
    cancelPreview();
  }
};

onUnmounted(() => {
  if (previewingId.value) cancelPreview();
});
</script>

<template>
  <div>
    <!-- Langue -->
    <h2 v-if="withDescriptions" class="text-2xl font-bold mb-2 text-text-primary">
      {{ t("profile.languageTitle") }}
    </h2>
    <h2 v-else class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("profile.languageTitle") }}
    </h2>
    <p v-if="withDescriptions" class="text-text-secondary mb-6">
      {{ t("profile.languageDescription") }}
    </p>

    <div class="grid grid-cols-3 gap-3 mb-10">
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

    <!-- Apparence claire ou sombre -->
    <h2 v-if="withDescriptions" class="text-2xl font-bold mb-2 text-text-primary">
      {{ t("profile.appearanceTitle") }}
    </h2>
    <h2 v-else class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("profile.appearanceTitle") }}
    </h2>
    <p v-if="withDescriptions" class="text-text-secondary mb-6">
      {{ t("profile.appearanceDescription") }}
    </p>

    <div class="grid grid-cols-3 gap-3 mb-10">
      <button
        v-for="option in schemes"
        :key="option.id"
        type="button"
        class="card p-2 text-center transition-all duration-300"
        :class="currentSchemeId === option.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="selectScheme(option)"
      >
        <!-- Miroir de l'apparence : une page en réduction. « Système » montre
             les deux, coupées en diagonale. -->
        <span
          class="relative block h-16 overflow-hidden rounded-xl ring-1 ring-black/5 sm:h-20 dark:ring-white/10"
          :style="{ backgroundColor: option.background }"
        >
          <span class="absolute inset-0 flex flex-col justify-center gap-1.5 p-3">
            <span
              class="block h-1.5 w-3/5 rounded-full"
              :style="{ backgroundColor: option.ink, opacity: 0.85 }"
            ></span>
            <span
              class="block h-1 w-full rounded-full"
              :style="{ backgroundColor: option.ink, opacity: 0.35 }"
            ></span>
            <span
              class="block h-1 w-4/5 rounded-full"
              :style="{ backgroundColor: option.ink, opacity: 0.35 }"
            ></span>
          </span>
          <span
            v-if="option.id === 'system'"
            class="scheme-half absolute inset-0"
            :style="{ backgroundColor: darkScheme.background }"
          >
            <span class="absolute inset-0 flex flex-col justify-center gap-1.5 p-3">
              <span
                class="block h-1.5 w-3/5 rounded-full"
                :style="{ backgroundColor: darkScheme.ink, opacity: 0.85 }"
              ></span>
              <span
                class="block h-1 w-full rounded-full"
                :style="{ backgroundColor: darkScheme.ink, opacity: 0.35 }"
              ></span>
              <span
                class="block h-1 w-4/5 rounded-full"
                :style="{ backgroundColor: darkScheme.ink, opacity: 0.35 }"
              ></span>
            </span>
          </span>
        </span>
        <span class="mt-2 flex flex-col items-center gap-0.5">
          <span class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm">
            {{ t(`profile.appearances.${option.id}`) }}
          </span>
          <span
            v-if="currentSchemeId === option.id"
            class="flex items-center gap-1 text-xs font-medium text-primary"
          >
            <AppIcon name="check" :size="12" />
            {{ t("profile.themeActive") }}
          </span>
        </span>
      </button>
    </div>

    <!-- Thème de couleurs -->
    <h2 v-if="withDescriptions" class="text-2xl font-bold mb-2 text-text-primary">
      {{ t("profile.themeTitle") }}
    </h2>
    <h2 v-else class="text-sm font-semibold text-text-secondary mb-3">
      {{ t("profile.themeTitle") }}
    </h2>
    <p v-if="withDescriptions" class="text-text-secondary mb-6">
      {{ t("profile.themeDescription") }}
    </p>

    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        class="card relative p-1 text-left transition-all duration-300"
        :class="
          currentThemeId === theme.id ? 'ring-2 ring-primary shadow-card-hover' : 'card-hover'
        "
        :disabled="saving"
        @click="selectTheme(theme)"
        @mouseenter="onThemeEnter(theme.id)"
        @mouseleave="onThemeLeave"
      >
        <span class="block overflow-hidden rounded-xl">
          <!-- En-tête coloré du thème -->
          <span
            class="relative block h-16 sm:h-24"
            :style="{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }"
          >
            <span class="absolute inset-0 flex items-end p-2 sm:p-3">
              <span class="flex items-center gap-1.5 sm:gap-2">
                <span class="block h-5 w-5 rounded-full bg-white/30 sm:h-8 sm:w-8"></span>
                <span class="block">
                  <span class="block h-2 w-10 rounded-full bg-white/60 sm:h-2.5 sm:w-20"></span>
                  <span class="mt-1 block h-1.5 w-6 rounded-full bg-white/40 sm:h-2 sm:w-12"></span>
                </span>
              </span>
            </span>
          </span>

          <!-- Aperçu du contenu -->
          <span class="block space-y-1.5 bg-surface p-2 sm:space-y-2 sm:p-3">
            <span class="flex gap-1.5 sm:gap-2">
              <span
                class="block h-2 w-8 rounded-full sm:h-2.5 sm:w-16"
                :style="{ backgroundColor: theme.primary }"
              ></span>
              <span
                class="block h-2 w-5 rounded-full bg-black/10 sm:h-2.5 sm:w-10 dark:bg-white/20"
              ></span>
            </span>
            <span class="block h-1.5 w-full rounded-full bg-black/5 sm:h-2 dark:bg-white/10"></span>
            <span class="block h-1.5 w-3/4 rounded-full bg-black/5 sm:h-2 dark:bg-white/10"></span>
            <span class="block pt-1">
              <span
                class="block h-4 w-12 rounded-lg sm:h-6 sm:w-20"
                :style="{ backgroundColor: theme.primary }"
              ></span>
            </span>
          </span>
        </span>

        <!-- Nom du thème, et son état -->
        <span class="flex flex-col items-start gap-0.5 p-2 sm:p-3">
          <span class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm">
            {{ t(`profile.themes.${theme.id}`) }}
          </span>
          <span
            v-if="currentThemeId === theme.id"
            class="flex items-center gap-1 text-xs font-medium text-primary"
          >
            <AppIcon name="check" :size="12" />
            {{ t("profile.themeActive") }}
          </span>
        </span>
      </button>
    </div>

    <p
      v-if="withDescriptions"
      class="mt-5 hidden items-center gap-1.5 text-sm text-text-secondary sm:flex"
    >
      <AppIcon name="info" :size="14" />
      {{ t("profile.themeHint") }}
    </p>

    <!-- Polices -->
    <h2 v-if="withDescriptions" class="mt-12 mb-2 text-2xl font-bold text-text-primary">
      {{ t("profile.fontsTitle") }}
    </h2>
    <h2 v-else class="mt-10 mb-3 text-sm font-semibold text-text-secondary">
      {{ t("profile.fontsTitle") }}
    </h2>
    <p v-if="withDescriptions" class="mb-6 text-text-secondary">
      {{ t("profile.fontsDescription") }}
    </p>

    <h3 class="mb-3 text-sm font-semibold text-text-secondary">
      {{ t("profile.fontLatinLabel") }}
    </h3>
    <div class="grid grid-cols-3 gap-3 mb-8">
      <button
        v-for="font in latinFonts"
        :key="font.id"
        type="button"
        class="card p-3 text-center transition-all duration-300"
        :class="currentLatinId === font.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="selectLatinFont(font)"
      >
        <span class="mb-1 block text-2xl text-text-primary" :style="{ fontFamily: font.stack }">
          Aa
        </span>
        <span
          class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm"
          :style="{ fontFamily: font.stack }"
        >
          {{ font.label }}
        </span>
        <span class="mt-0.5 block text-xs leading-tight text-text-secondary">
          {{ t(`profile.fontsLatin.${font.id}`) }}
        </span>
      </button>
    </div>

    <h3 class="mb-3 text-sm font-semibold text-text-secondary">
      {{ t("profile.fontHebrewLabel") }}
    </h3>
    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="font in hebrewFonts"
        :key="font.id"
        type="button"
        class="card p-3 text-center transition-all duration-300"
        :class="currentHebrewId === font.id ? 'ring-2 ring-primary' : 'card-hover'"
        :disabled="saving"
        @click="selectHebrewFont(font)"
      >
        <span
          class="mb-1 block text-2xl text-text-primary"
          dir="rtl"
          :style="{ fontFamily: font.stack }"
        >
          אבג
        </span>
        <span class="block text-xs font-semibold leading-tight text-text-primary sm:text-sm">
          {{ font.label }}
        </span>
        <span class="mt-0.5 block text-xs leading-tight text-text-secondary">
          {{ t(`profile.fontsHebrew.${font.id}`) }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* « Système » : la moitié sombre est posée en diagonale sur la moitié claire. */
.scheme-half {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
</style>
