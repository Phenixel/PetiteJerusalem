<script setup lang="ts">
/**
 * Une sous-page du profil de l'app : l'apparence, la langue, les
 * notifications, les préférences, et, pour un compte, ses informations et sa
 * sécurité.
 *
 * Ce sont de vraies pages, pas des panneaux (voir docs/design.md, « Deux
 * pages, un jeu d'onglets ») : chacune a son adresse (/profile/appearance...),
 * donc son retour Android, son glissement iOS et sa reprise de défilement.
 * Le lien du haut ramène au profil en remontant l'historique, pour que le
 * retour qui suit ne rouvre pas la sous-page qu'on vient de quitter.
 *
 * Les réglages eux-mêmes sont ceux du site (AppearanceSettings,
 * NotificationSettings...) : seule la façon d'y arriver change.
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService, type User } from "../../../services/authService";
import { analyticsService } from "../../../services/analyticsService";
import { useLocale } from "../../../composables/useLocale";
import AppIcon from "../../../components/icons/AppIcon.vue";
import AppearanceSettings from "../../../components/settings/AppearanceSettings.vue";
import NotificationSettings from "../../../components/settings/NotificationSettings.vue";
import PreferencesTab from "../PreferencesTab.vue";
import UserInfoForm from "../UserInfoForm.vue";
import SecuritySettings from "../SecuritySettings.vue";

/** Les sous-pages, dans l'ordre des routes (voir router/routes.ts). */
type ProfileSection =
  | "appearance"
  | "language"
  | "notifications"
  | "preferences"
  | "account"
  | "security";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// Figée au montage : en quittant la sous-page, la route change avant que la
// page ne soit démontée, et une section lue en direct passerait un instant à
// « undefined » (titre vide, événement de suivi faux).
const section = ref(String(route.params.section) as ProfileSection);
/** Les sous-pages qui n'ont de sens qu'avec un compte. */
const needsAccount = computed(() => section.value === "account" || section.value === "security");

const titles: Record<ProfileSection, string> = {
  appearance: "profile.tabs.appearance",
  language: "profile.languageTitle",
  notifications: "profile.tabs.notifications",
  preferences: "profile.tabs.preferences",
  account: "profile.myInformation",
  security: "security.title",
};
const title = computed(() => t(titles[section.value]));

// `profile_tab_opened` : l'événement du menu du site, avec les mêmes valeurs
// de `tab` (« my-info » pour les informations du compte). « language » est
// propre à l'app, où la langue a sa ligne (voir docs/tracking-plan.md).
const TRACKED_TAB: Record<ProfileSection, string> = {
  appearance: "appearance",
  language: "language",
  notifications: "notifications",
  preferences: "preferences",
  account: "my-info",
  security: "security",
};

const currentUser = ref<User | null>(null);
const isLoading = ref(true);
let unsubscribeAuth: (() => void) | null = null;

// Le lien du haut dit où il ramène : « Profil » pour un compte, « Réglages »
// sans, comme l'onglet de la barre du bas.
const backLabel = computed(() =>
  currentUser.value ? t("common.profile") : t("profile.guestTitle"),
);

function goBack(): void {
  // Arrivé du profil : on y remonte. Arrivé d'ailleurs (un lien direct), il
  // n'y a rien derrière, et le profil prend la place de la sous-page.
  if (router.options.history.state.back != null) router.back();
  else void router.replace("/profile");
}

// La sous-page Langue : la liste des langues, celle en cours cochée.
const { currentLocale, availableLocales, setLocale } = useLocale();

// D'une sous-page à l'autre, la même page reste montée (le routeur la
// réemploie) : la section suit alors la nouvelle adresse, tant que celle-ci
// en est bien une.
watch(
  () => route.params.section,
  (value) => {
    if (typeof value === "string" && value in TRACKED_TAB) section.value = value as ProfileSection;
  },
);

watch(
  section,
  (value) => {
    analyticsService.capture("profile_tab_opened", { tab: TRACKED_TAB[value] });
  },
  { immediate: true },
);

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
    isLoading.value = false;
    // Déconnecté sur une page de compte (ou le compte supprimé ailleurs) : la
    // garde de route ne se rejoue pas, on rend le profil, qui bascule de lui-
    // même en réglages d'appareil.
    if (!user && needsAccount.value) void router.replace("/profile");
  });
});

// La mise à jour du nom : le titre du profil en vit, au retour.
function updateUser(user: User): void {
  currentUser.value = user;
}

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="mx-auto w-full max-w-xl px-4 pt-6 pb-10">
    <button type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ backLabel }}
    </button>

    <h1 class="text-center text-3xl font-bold tracking-tight text-text-primary">
      {{ title }}
    </h1>

    <div class="mt-6">
      <AppearanceSettings
        v-if="section === 'appearance'"
        :user-id="currentUser?.id ?? null"
        :with-language="false"
        :scheme-title="t('profile.native.schemeTitle')"
      />

      <template v-else-if="section === 'language'">
        <p class="mb-5 text-center text-text-secondary">
          {{ t("profile.languageDescription") }}
        </p>
        <!-- Trois langues : une liste qu'on touche, la langue en cours cochée,
             comme l'avis suivi des horaires. -->
        <ul class="card flex flex-col divide-y divide-line overflow-hidden">
          <li v-for="locale in availableLocales" :key="locale.code">
            <button
              type="button"
              class="settings-row"
              :aria-pressed="currentLocale === locale.code"
              @click="setLocale(locale.code)"
            >
              <span class="text-2xl leading-none" aria-hidden="true">{{ locale.flag }}</span>
              <!-- Le sens d'écriture sur le nom seul : posé sur la case, il
                   calait « עברית » au bout opposé de la ligne. -->
              <span class="min-w-0 flex-1 font-medium text-text-primary">
                <span :dir="locale.dir">{{ locale.label }}</span>
              </span>
              <AppIcon
                name="check"
                :size="18"
                class="shrink-0"
                :class="currentLocale === locale.code ? 'text-primary' : 'opacity-0'"
              />
            </button>
          </li>
        </ul>
      </template>

      <NotificationSettings v-else-if="section === 'notifications'" />

      <PreferencesTab v-else-if="section === 'preferences'" />

      <!-- Pages de compte : la garde de route a déjà vérifié la connexion,
           l'attente ne dure que le temps de relire l'utilisateur. -->
      <template v-else-if="needsAccount">
        <div
          v-if="isLoading || !currentUser"
          class="flex justify-center py-12 text-text-secondary"
          aria-busy="true"
        >
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
          ></div>
        </div>
        <UserInfoForm
          v-else-if="section === 'account'"
          :user="currentUser"
          :show-title="false"
          @update="updateUser"
        />
        <SecuritySettings v-else :show-title="false" />
      </template>
    </div>
  </main>
</template>
