<script setup lang="ts">
/**
 * Le profil de l'app native : une page de réglages rangée comme celles d'un
 * téléphone, et non plus le menu latéral du site posé sur un écran étroit.
 *
 * Sur le site, le profil est un menu à gauche et un panneau à droite : il y a
 * la place, et un clic change de panneau. Dans l'app, ce menu passait en tête
 * de page, le panneau dessous, et chaque onglet faisait défiler jusqu'au
 * contenu. Ici, la page est une liste de lignes rangées par groupe, chacune
 * disant où elle mène et ce qui y est réglé ; un appui ouvre une vraie
 * sous-page (NativeProfileSection), avec son adresse et son retour arrière.
 *
 * Les groupes, dans l'ordre où l'on vient les chercher :
 *  - l'identité (ou, sans compte, l'invitation à en créer un) ;
 *  - mes lectures : les raccourcis vers ce qui vivait autrefois dans le profil ;
 *  - réglages : apparence, langue, notifications, préférences ;
 *  - mon compte : sécurité, déconnexion ;
 *  - aide et informations : ce que le pied de page du site porte.
 *
 * Voir docs/design.md, « Le profil de l'app est une liste, pas un menu ».
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { authService, type User } from "../../../services/authService";
import { analyticsService } from "../../../services/analyticsService";
import { seoService } from "../../../services/seoService";
import { feedbackContext } from "../../../services/feedbackService";
import { SITE_URL } from "../../../config/site";
import { useTheme } from "../../../composables/useTheme";
import { useColorScheme } from "../../../composables/useColorScheme";
import { useLocale } from "../../../composables/useLocale";
import { refreshPermission, useZmanReminders } from "../../../composables/useZmanReminders";
import { useZmanimOpinion } from "../../../composables/useZmanimOpinion";
import { useConsent } from "../../../composables/useConsent";
import { useOnboarding } from "../../../composables/useOnboarding";
import { useFeatureTips } from "../../../composables/useFeatureTips";
import { useToast } from "../../../composables/useToast";
import { useConfirm } from "../../../composables/useConfirm";
import { useHolidayTheme } from "../../../composables/useHolidayTheme";
import { openFeedback } from "../../../composables/useFeedback";
import AppIcon from "../../../components/icons/AppIcon.vue";
import type { IconName } from "../../../components/icons/registry";
import HolidayOrnaments from "../../../components/holiday/HolidayOrnaments.vue";
import SettingsGroup from "../../../components/settings/SettingsGroup.vue";
import SettingsRow from "../../../components/settings/SettingsRow.vue";

const { t } = useI18n();
const toast = useToast();

const currentUser = ref<User | null>(null);
const isLoading = ref(true);

const displayName = computed(() => currentUser.value?.name || t("common.anonymousUser"));
/** L'initiale du nom, dans le rond : une lettre, hébreu compris. */
const initial = computed(() => Array.from(displayName.value.trim())[0]?.toUpperCase() ?? "?");

// Le temps d'une fête, ses ornements accompagnent le nom, comme sur le
// bandeau du profil du site.
const { activeHolidayTheme } = useHolidayTheme();

// Ce que le compte apporte : les mêmes entrées que l'invitation du site.
const guestBenefits = computed<{ icon: IconName; label: string }[]>(() => [
  { icon: "users", label: t("profile.guestBenefits.sessions") },
  { icon: "book", label: t("profile.guestBenefits.dailyReading") },
  { icon: "bell", label: t("profile.guestBenefits.reminders") },
  { icon: "bookmark", label: t("profile.guestBenefits.sync") },
]);

// ---- Ce qui est réglé, lu au bout de chaque ligne --------------------------

const { currentThemeId } = useTheme();
const { currentSchemeId } = useColorScheme();
const appearanceValue = computed(
  () =>
    `${t(`profile.themes.${currentThemeId.value}`)} · ${t(`profile.appearances.${currentSchemeId.value}`)}`,
);

const { currentLocale, availableLocales } = useLocale();
const languageValue = computed(
  () => availableLocales.find((locale) => locale.code === currentLocale.value)?.label ?? "",
);

// Les rappels d'horaires et celui de l'entrée du Chabbat : ceux dont la
// sous-page Notifications fait le compte. Bloquées par le système, elles le
// disent à la place du nombre, qui mentirait.
const { reminders, restEnabled, permission } = useZmanReminders();
const notificationsBlocked = computed(() => permission.value === "denied");
const notificationsValue = computed(() => {
  if (notificationsBlocked.value) return t("profile.native.notificationsBlocked");
  const count = reminders.value.length + (restEnabled.value ? 1 : 0);
  return t("profile.native.notificationsSummary", { n: count }, count);
});

const { opinion } = useZmanimOpinion();
const preferencesValue = computed(() => t(`zmanim.opinions.${opinion.value}.short`));

// ---- Aide et informations ---------------------------------------------------

// Réouvre la bannière de consentement (retrait possible à tout moment).
const { reopen: reopenConsent } = useConsent();
// L'introduction et les astuces ne se montrent qu'une fois : c'est d'ici
// qu'on les revoit.
const { replayOnboarding } = useOnboarding();
const { resetFeatureTips } = useFeatureTips();

function replayTips(): void {
  resetFeatureTips();
  toast.info(t("tips.replayed"));
}

const infoPages = [
  { to: "/informations", labelKey: "announcements.title", icon: "bell" },
  { to: "/a-propos", labelKey: "footer.about", icon: "info" },
  { to: "/mentions-legales", labelKey: "footer.legal", icon: "align-left" },
  { to: "/confidentialite", labelKey: "footer.privacy", icon: "eye" },
] as const;

// La version installée, au pied de la page : c'est elle qu'on demande à qui
// écrit pour un bug, et elle se trouve ici sans fouiller le téléphone.
const version = ref<string | null>(null);

// ---- Compte -----------------------------------------------------------------

const { confirm } = useConfirm();

// Sur le site, la déconnexion est un bouton à part ; ici, c'est une ligne
// parmi d'autres, qu'un pouce touche par mégarde en visant sa voisine, et se
// reconnecter demande un mot de passe et le réseau : elle pose la question.
// La page reste ensuite : elle bascule d'elle-même en réglages d'appareil
// (l'abonnement ci-dessous).
const logout = async () => {
  const accepted = await confirm({
    title: t("profile.native.logoutConfirm"),
    message: t("profile.native.logoutConfirmHint"),
    confirmLabel: t("common.logout"),
    danger: true,
  });
  if (accepted) await authService.logout();
};

// Les raccourcis mènent vers ce qui vivait dans le profil : le même suivi
// que sur le site, pour vérifier que les habitués les retrouvent.
const trackShortcut = (shortcut: string) => {
  analyticsService.capture("profile_shortcut_clicked", { shortcut });
};

let unsubscribeAuth: (() => void) | null = null;

onMounted(() => {
  unsubscribeAuth = authService.onAuthChanged((user) => {
    currentUser.value = user;
    isLoading.value = false;
  });
  // La permission se change dans les réglages du téléphone, hors de l'app :
  // relue à chaque arrivée plutôt que de se fier au dernier état vu.
  void refreshPermission();
  void feedbackContext().then((context) => {
    version.value = context.version;
  });

  const url = SITE_URL + "/profile";
  seoService.setMeta({
    title: t("seo.profileTitle"),
    description: t("seo.profileDescription"),
    canonical: url,
    og: { url },
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <main class="mx-auto w-full max-w-xl px-4 pt-8 pb-10">
    <!-- Le temps du verdict de session : l'attente n'occupe que la zone de
         contenu, sans saut de page. -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-16 text-text-secondary"
      aria-busy="true"
    >
      <div
        class="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
      ></div>
      <p class="font-medium">{{ t("profile.loadingProfile") }}</p>
    </div>

    <template v-else>
      <!-- Connecté : qui l'on est, d'un coup d'oeil. Le rond porte la couleur
           du thème, c'est la seule touche pleine de la page. -->
      <header v-if="currentUser" class="relative mb-8 flex flex-col items-center text-center">
        <span
          class="font-display flex h-20 w-20 items-center justify-center rounded-full bg-primary text-4xl text-white"
          aria-hidden="true"
        >
          {{ initial }}
        </span>
        <h1 class="mt-4 text-2xl font-bold tracking-tight text-text-primary">
          {{ displayName }}
        </h1>
        <p v-if="currentUser.email" class="mt-1 text-sm text-text-secondary">
          {{ currentUser.email }}
        </p>
        <RouterLink to="/profile/account" class="btn btn-soft btn-sm mt-4">
          <AppIcon name="pencil" :size="14" />
          {{ t("profile.native.editProfile") }}
        </RouterLink>
        <HolidayOrnaments
          v-if="activeHolidayTheme"
          :theme="activeHolidayTheme.id"
          class="absolute end-0 top-0 text-[2.25rem] text-primary"
          aria-hidden="true"
        />
      </header>

      <!-- Sans compte : la page est celle des réglages, et le compte se
           propose en tête, sans insister : une carte, deux boutons. -->
      <template v-else>
        <h1 class="mb-6 text-center text-3xl font-bold tracking-tight text-text-primary">
          {{ t("profile.guestTitle") }}
        </h1>
        <section class="card mb-8 p-5">
          <p class="text-sm leading-relaxed text-text-secondary">
            {{ t("profile.guestSettingsHint") }}
          </p>
          <ul class="mt-3 space-y-2 text-sm leading-relaxed text-text-primary">
            <li
              v-for="benefit in guestBenefits"
              :key="benefit.icon"
              class="flex items-start gap-2.5"
            >
              <AppIcon :name="benefit.icon" :size="15" class="mt-1 shrink-0 text-primary" />
              <span>{{ benefit.label }}</span>
            </li>
          </ul>
          <!-- L'un sous l'autre : côte à côte, « Créer un compte » passait
               sur deux lignes dans la moitié d'un téléphone. -->
          <div class="mt-5 flex flex-col gap-2.5">
            <RouterLink to="/login?mode=signup" class="btn btn-primary">
              {{ t("accountCta.signup") }}
            </RouterLink>
            <RouterLink to="/login" class="btn btn-soft">
              {{ t("accountCta.login") }}
            </RouterLink>
          </div>
        </section>
      </template>

      <div class="flex flex-col gap-7">
        <SettingsGroup v-if="currentUser" :title="t('profile.native.groups.reading')">
          <SettingsRow
            icon="book"
            :label="t('dailyReading.title')"
            to="/bibliotheque/lecture-du-jour"
            @click="trackShortcut('daily_reading')"
          />
          <SettingsRow
            icon="users"
            :label="t('home.dashboard.sessionsTitle')"
            to="/share-reading"
            @click="trackShortcut('my_sessions')"
          />
        </SettingsGroup>

        <SettingsGroup :title="t('profile.native.groups.settings')">
          <SettingsRow
            icon="palette"
            :label="t('profile.tabs.appearance')"
            :value="appearanceValue"
            to="/profile/appearance"
          />
          <SettingsRow
            icon="languages"
            :label="t('profile.languageTitle')"
            :value="languageValue"
            to="/profile/language"
          />
          <SettingsRow
            icon="bell"
            :label="t('profile.tabs.notifications')"
            :value="notificationsValue"
            :warn="notificationsBlocked"
            to="/profile/notifications"
          />
          <SettingsRow
            icon="settings"
            :label="t('profile.tabs.preferences')"
            :value="preferencesValue"
            to="/profile/preferences"
          />
        </SettingsGroup>

        <SettingsGroup v-if="currentUser" :title="t('profile.native.groups.account')">
          <SettingsRow icon="lock" :label="t('security.title')" to="/profile/security" />
          <SettingsRow icon="logout" :label="t('common.logout')" tone="danger" @click="logout" />
        </SettingsGroup>

        <SettingsGroup :title="t('profile.native.groups.help')">
          <SettingsRow icon="message" :label="t('footer.reportIssue')" @click="openFeedback()" />
          <SettingsRow icon="rocket" :label="t('onboarding.replay')" @click="replayOnboarding" />
          <SettingsRow icon="lightbulb" :label="t('tips.replay')" @click="replayTips" />
        </SettingsGroup>

        <SettingsGroup :title="t('profile.native.groups.info')">
          <SettingsRow
            v-for="page in infoPages"
            :key="page.to"
            :icon="page.icon"
            :label="t(page.labelKey)"
            :to="page.to"
          />
          <SettingsRow icon="cookie" :label="t('footer.manageCookies')" @click="reopenConsent" />
        </SettingsGroup>
      </div>

      <!-- Le pied de page du site, en petit : qui fait l'app, où la suivre,
           et la version installée. -->
      <footer
        class="mt-10 flex flex-col items-center gap-3 text-center text-sm text-text-secondary"
      >
        <a
          class="font-medium transition-colors hover:text-primary"
          href="https://phenixel.fr"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t("footer.madeBy") }} <strong>Phenixel</strong> 🐦‍🔥
        </a>
        <div class="flex items-center gap-2">
          <a
            class="icon-btn"
            href="https://github.com/Phenixel/PetiteJerusalem"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <AppIcon name="github" :size="19" />
          </a>
          <a
            class="icon-btn"
            href="https://x.com/Real_Phenixel"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            title="X"
          >
            <AppIcon name="x-twitter" :size="17" />
          </a>
        </div>
        <p v-if="version" class="text-xs tabular-nums">
          {{ t("profile.native.version", { version }) }}
        </p>
      </footer>
    </template>
  </main>
</template>
