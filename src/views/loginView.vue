<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Capacitor } from "@capacitor/core";
import { authService, type User } from "../services/authService";
import {
  authErrorCode,
  describeEmailAuthError,
  isAuthCancellation,
  isAuthProviderUnavailable,
  type EmailAuthHelp,
  type SocialProvider,
} from "../services/authErrors";
import { ModerationError } from "../services/moderationService";
import { lastAuthMethod, restoreLastAuthMethod, type AuthMethod } from "../services/lastAuthMethod";
import { loginReason } from "../services/loginReason";
import { reservationService } from "../services/reservationService";
import { guestService } from "../services/guestService";
import { seoService } from "../services/seoService";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "../components/icons/AppIcon.vue";
import { useLocalePath } from "../composables/useLocalePath";
import { SITE_URL } from "../config/site";

/** Les pages traduites suivent l'espace de langue de l'URL ouverte. */
const { localePath } = useLocalePath();

const router = useRouter();
const { t } = useI18n();

const mode = ref<"login" | "signup">("login");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const displayName = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);
// La sortie que propose l'erreur email (voir describeEmailAuthError) : créer
// un compte, se connecter, ou le bouton de la dernière méthode utilisée. Le
// message brut de Firebase ne s'affiche plus : il part avec `*_failed`
// (`error_message`) et l'Error tracking, où il sert à quelque chose.
const errorHelp = ref<EmailAuthHelp | null>(null);
// L'erreur email qui a appelé l'aide, pour la mesure (`login_help_clicked`).
let errorReason: string | null = null;

/**
 * La dernière façon de se connecter sur cet appareil (lastAuthMethod) : son
 * bouton porte « Dernière utilisation », et une erreur email la rappelle.
 */
const lastMethod = ref<AuthMethod | null>(lastAuthMethod());

/** Les essais de chaque fournisseur depuis l'arrivée sur l'écran. */
const attempts: Record<SocialProvider, number> = { google: 0, apple: 0 };
// Le fournisseur dont la feuille native est ouverte. Tant qu'elle l'est, un
// second tap (le même bouton, ou l'autre fournisseur) ne lance rien : deux
// présentations concurrentes échouent en « Unable to open Safari » ou en
// code Apple 1000, que l'écran prendrait pour une limite de l'appareil.
const socialPending = ref<SocialProvider | null>(null);

function clearError() {
  errorMessage.value = null;
  errorHelp.value = null;
  errorReason = null;
}

function setMode(newMode: "login" | "signup") {
  mode.value = newMode;
  clearError();
}

const buttonText = computed(() => {
  if (loading.value) return t("login.pleaseWait");
  return mode.value === "login" ? t("login.signIn") : t("login.register");
});

/** L'échec d'une connexion par email, compté puis dit en clair. */
function failEmailAuth(reason: string, message: string, help: EmailAuthHelp | null = null) {
  analyticsService.capture("email_auth_failed", {
    mode: mode.value,
    reason,
    last_method: lastMethod.value,
  });
  errorMessage.value = message;
  errorHelp.value = help;
  errorReason = reason;
}

async function submitForm() {
  clearError();
  // Troisième chemin de connexion, et le seul dont les échecs étaient muets :
  // `signed_in`/`signed_up {method: email}` n'avaient pas de contrepartie. Un
  // mot de passe oublié, une adresse déjà prise ou un mot de passe trop court
  // ressortaient tous comme une visite de /login sans suite.
  analyticsService.capture("email_auth_submitted", { mode: mode.value });
  if (mode.value === "signup" && password.value !== confirmPassword.value) {
    failEmailAuth("password_mismatch", t("login.passwordsDoNotMatch"));
    return;
  }
  loading.value = true;
  try {
    if (mode.value === "signup") {
      await authService.signUpWithEmail(
        email.value.trim(),
        password.value,
        displayName.value.trim() || undefined,
      );
    } else {
      await authService.signInWithEmail(email.value.trim(), password.value);
    }

    const currentUser = await authService.getCurrentUser();
    if (currentUser) {
      reservationService
        .migrateGuestReservations(
          currentUser.email,
          currentUser.id,
          currentUser.name,
          guestService.getLocalGuestId(),
        )
        .catch((error) => console.error("Migration des réservations invité échouée:", error));
    }

    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/";
    router.push(redirectPath);
  } catch (e: unknown) {
    // Pas de captureException ici : les échecs email sont presque toujours des
    // erreurs utilisateur (mauvais mot de passe), pas des bugs. L'événement
    // funnel, lui, a sa place : c'est le décrochage qu'il mesure, pas le bug.
    // Un code Firebase (`auth/...`) plutôt que le message, qui est traduit.
    if (e instanceof ModerationError) {
      // Le nom affiché refusé : le message dit quel terme, il est déjà traduit.
      failEmailAuth("moderation", e.message);
      return;
    }
    const code = authErrorCode(e);
    const view = describeEmailAuthError(code, shownLastMethod.value);
    failEmailAuth(code ?? "error", t(view.key), view.help);
  } finally {
    loading.value = false;
  }
}

// Les messages de chaque fournisseur : l'appareil hors d'état, ou la panne.
const SOCIAL_ERROR_KEYS: Record<SocialProvider, { unavailable: string; error: string }> = {
  google: { unavailable: "login.authBrowserUnavailable", error: "login.googleError" },
  apple: { unavailable: "login.appleSignInUnavailable", error: "login.appleError" },
};

/**
 * Connexion par un tiers (Google, Apple) : le même parcours pour les deux, le
 * même funnel (`<provider>_signin_clicked` puis `signed_in`, ou en route
 * `_cancelled` / `_failed`), suivi du bug « bouton inerte » sur Google et de
 * la feuille Apple qui ne s'ouvre pas.
 */
async function socialSignIn(provider: SocialProvider, signIn: () => Promise<User>) {
  if (socialPending.value || loading.value) return;
  socialPending.value = provider;
  clearError();
  attempts[provider] += 1;
  // `attempt` : le rang de l'essai depuis l'arrivée. Il dit combien d'échecs
  // cèdent au deuxième essai (l'erreur Apple 1000, notamment).
  analyticsService.capture(`${provider}_signin_clicked`, { attempt: attempts[provider] });
  try {
    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/profile";

    const user = await signIn();

    reservationService
      .migrateGuestReservations(user.email, user.id, user.name, guestService.getLocalGuestId())
      .catch((error) => console.error("Migration des réservations invité échouée:", error));

    router.push(redirectPath);
  } catch (e: unknown) {
    // Sélecteur quitté, popup fermée, feuille Apple refusée : un renoncement,
    // pas une panne. Ni Error tracking ni message à l'écran ; un événement
    // funnel tout de même, pour que ces clics sans suite ne ressemblent pas
    // à un bouton inerte.
    if (isAuthCancellation(e)) {
      analyticsService.capture(`${provider}_signin_cancelled`);
      return;
    }
    console.error(`Connexion ${provider} échouée:`, e);
    // Ce que l'appareil ne sait pas faire : Safari indisponible pour Google
    // (restrictions Temps d'écran), la feuille Apple sans compte Apple
    // connecté (code 1000). On dit quoi vérifier, et vers quoi se replier,
    // plutôt qu'une erreur générique observée en prod (trois tentatives puis
    // abandon). Le code 1000 cède pourtant parfois au deuxième essai (deux
    // cas sur six en septembre 2026) : le message invite d'abord à réessayer.
    const unavailable = isAuthProviderUnavailable(provider, e);
    // Cet appareil-là ne peut pas, et aucun correctif n'y changera rien : comme
    // pour un mot de passe refusé plus haut, l'Error tracking n'a rien à en
    // faire. Le funnel garde la trace du décrochage, avec sa raison.
    if (!unavailable) {
      analyticsService.captureException(e, { auth_flow: provider });
    }
    analyticsService.capture(`${provider}_signin_failed`, {
      reason: unavailable ? "unavailable" : "error",
      error_message: e instanceof Error ? e.message : String(e),
      attempt: attempts[provider],
    });
    const keys = SOCIAL_ERROR_KEYS[provider];
    errorMessage.value = t(unavailable ? keys.unavailable : keys.error);
  } finally {
    socialPending.value = null;
  }
}

const loginWithGoogle = () => socialSignIn("google", () => authService.signInWithGooglePopup());

// Apple exige "Sign in with Apple" sur l'app iOS dès qu'un autre login tiers
// est proposé. On n'affiche donc le bouton que sur la plateforme iOS.
const isApplePlatform = computed(() => Capacitor.getPlatform() === "ios");

const loginWithApple = () => socialSignIn("apple", () => authService.signInWithApple());

/**
 * La dernière méthode, telle que cet écran peut la proposer : Apple n'a de
 * bouton que sur iOS, et une connexion Apple faite ailleurs ne se rappelle
 * pas ici, où l'on ne pourrait pas y donner suite.
 */
const shownLastMethod = computed<AuthMethod | null>(() =>
  lastMethod.value === "apple" && !isApplePlatform.value ? null : lastMethod.value,
);

/** Le fournisseur que l'aide propose : celui de la dernière connexion. */
const helpProvider = computed<SocialProvider>(() =>
  shownLastMethod.value === "apple" ? "apple" : "google",
);

/** Le libellé de la sortie proposée sous l'erreur. */
const helpLabel = computed(() => {
  switch (errorHelp.value) {
    case "signup":
      return t("login.help.signup");
    case "login":
      return t("login.help.login");
    case "provider":
      return helpProvider.value === "apple"
        ? t("login.signInWithApple")
        : t("login.signInWithGoogle");
    default:
      return null;
  }
});

/**
 * La sortie proposée par l'erreur : basculer vers l'inscription ou la
 * connexion en gardant l'adresse saisie, ou lancer le bon fournisseur.
 */
function followHelp() {
  const help = errorHelp.value;
  if (!help) return;
  analyticsService.capture("login_help_clicked", { help, reason: errorReason });
  if (help === "signup") setMode("signup");
  else if (help === "login") setMode("login");
  else if (helpProvider.value === "apple") void loginWithApple();
  else void loginWithGoogle();
}

/** « Dernière utilisation » sur ce bouton-là ? */
const isLastMethod = (method: AuthMethod) => shownLastMethod.value === method;

onMounted(async () => {
  const currentUser = await authService.getCurrentUser();
  if (currentUser) {
    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/profile";
    router.push(redirectPath);
    return;
  }

  const queryEmail = router.currentRoute.value.query.email as string;
  if (queryEmail) {
    email.value = queryEmail;
  }
  const queryMode = router.currentRoute.value.query.mode as string;
  if (queryMode === "signup") {
    mode.value = "signup";
  }

  // Le `localStorage` vidé (webview sous pression mémoire) : le natif s'en
  // souvient encore.
  if (lastMethod.value === null) lastMethod.value = await restoreLastAuthMethod();

  // L'arrivée sur l'écran, et ce qui y a mené : la lecture du jour, une
  // chaîne, le profil... (`reason`, voir loginReason). Sans elle, on ne savait
  // pas quelle fonction perdait les gens à la connexion.
  analyticsService.capture("login_viewed", {
    reason: loginReason(router.currentRoute.value.query.redirect),
    mode: mode.value,
    last_method: lastMethod.value,
  });

  const url = SITE_URL + "/login";
  seoService.setMeta({
    title: t("seo.loginTitle"),
    description: t("seo.loginDescription"),
    canonical: url,
    og: { url },
  });
});
</script>

<template>
  <main class="min-h-screen py-16 px-6 flex items-center justify-center">
    <section class="w-full max-w-lg card p-8 animate-[fadeIn_0.5s_ease]">
      <div class="text-center mb-10">
        <h1 class="text-3xl font-bold text-text-primary mb-2">
          {{ t("login.welcome") }}
        </h1>
        <p class="text-text-secondary">{{ t("login.connectToContinue") }}</p>
      </div>

      <!-- « Dernière utilisation » : posé sur le bord du bouton de la méthode
           employée la dernière fois sur cet appareil (lastAuthMethod), hors
           du bouton, dont le libellé reste celui de la commande. -->
      <div class="mb-8">
        <div class="relative">
          <span
            v-if="isLastMethod('google')"
            class="pointer-events-none absolute -top-2.5 end-3 z-10 rounded-full border border-primary/30 bg-surface px-2.5 py-0.5 text-[11px] font-semibold leading-tight text-primary"
          >
            {{ t("login.lastUsed") }}
          </span>
          <button
            class="btn btn-soft w-full"
            :disabled="socialPending !== null || loading"
            @click="loginWithGoogle"
          >
            <AppIcon name="google" :size="16" />
            {{ t("login.signInWithGoogle") }}
          </button>
        </div>

        <div v-if="isApplePlatform" class="relative mt-3">
          <span
            v-if="isLastMethod('apple')"
            class="pointer-events-none absolute -top-2.5 end-3 z-10 rounded-full border border-primary/30 bg-surface px-2.5 py-0.5 text-[11px] font-semibold leading-tight text-primary"
          >
            {{ t("login.lastUsed") }}
          </span>
          <button
            class="w-full py-3 px-6 bg-black hover:bg-gray-900 rounded-btn font-semibold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 disabled:opacity-60"
            :disabled="socialPending !== null || loading"
            @click="loginWithApple"
          >
            <AppIcon name="apple" :size="18" />
            {{ t("login.signInWithApple") }}
          </button>
        </div>
      </div>

      <p class="text-center text-sm text-text-secondary/60 font-medium mb-8">
        {{ t("common.or") }}
      </p>

      <div class="relative grid grid-cols-2 gap-0 bg-black/5 p-1 rounded-btn mb-8 dark:bg-white/10">
        <div
          class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface rounded-control shadow-sm transition-all duration-300 ease-out"
          :class="mode === 'login' ? 'left-1' : 'left-1 translate-x-full'"
        ></div>
        <button
          type="button"
          class="relative z-10 py-2.5 text-sm font-bold text-center transition-colors duration-300"
          :class="{
            'text-text-primary': mode === 'login',
            'text-text-secondary hover:text-text-primary': mode !== 'login',
          }"
          @click="setMode('login')"
          :disabled="loading"
        >
          {{ t("login.signIn") }}
        </button>
        <button
          type="button"
          class="relative z-10 py-2.5 text-sm font-bold text-center transition-colors duration-300"
          :class="{
            'text-text-primary': mode === 'signup',
            'text-text-secondary hover:text-text-primary': mode !== 'signup',
          }"
          @click="setMode('signup')"
          :disabled="loading"
        >
          {{ t("login.signUp") }}
        </button>
      </div>

      <form @submit.prevent="submitForm" class="flex flex-col">
        <Transition name="slide-up">
          <div v-if="mode === 'signup'" class="mb-5 overflow-hidden">
            <label class="block text-sm font-semibold text-text-primary mb-2" for="displayName">{{
              t("login.displayName")
            }}</label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              class="field"
              :placeholder="t('login.displayNamePlaceholder')"
            />
          </div>
        </Transition>

        <div class="mb-5">
          <label
            class="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2"
            for="email"
          >
            {{ t("common.email") }}
            <span
              v-if="isLastMethod('email')"
              class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-tight text-primary"
            >
              {{ t("login.lastUsed") }}
            </span>
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="field"
            :placeholder="t('login.emailPlaceholder')"
            required
          />
        </div>

        <div class="mb-5">
          <label class="block text-sm font-semibold text-text-primary mb-2" for="password">{{
            t("common.password")
          }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="field"
            placeholder="••••••••"
            required
          />
        </div>

        <Transition name="slide-up">
          <div v-if="mode === 'signup'" class="mb-5 overflow-hidden">
            <label
              class="block text-sm font-semibold text-text-primary mb-2"
              for="confirmPassword"
              >{{ t("login.confirmPassword") }}</label
            >
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="field"
              placeholder="••••••••"
              required
            />
          </div>
        </Transition>

        <div v-if="errorMessage" class="mb-4" role="alert">
          <p class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AppIcon name="alert-circle" :size="14" class="mt-0.5 shrink-0" />
            {{ errorMessage }}
          </p>
          <!-- La sortie qui va avec l'erreur : créer le compte, s'y connecter,
               ou le bouton de la dernière méthode utilisée. -->
          <button
            v-if="helpLabel"
            type="button"
            class="btn btn-soft btn-sm mt-3"
            :disabled="socialPending !== null || loading"
            @click="followHelp"
          >
            <AppIcon
              :name="
                errorHelp === 'provider'
                  ? helpProvider
                  : errorHelp === 'signup'
                    ? 'circle-plus'
                    : 'login'
              "
              :size="14"
            />
            {{ helpLabel }}
          </button>
        </div>

        <button class="btn btn-primary w-full" type="submit" :disabled="loading">
          <AppIcon v-if="loading" name="spinner" :size="15" class="animate-spin" />
          {{ buttonText }}
        </button>
      </form>

      <!-- Acceptation des conditions (exigence App Store 1.2 pour le contenu
           utilisateur) : vaut pour l'inscription comme pour les logins Google/Apple. -->
      <p class="mt-6 text-center text-xs text-text-secondary/80 leading-relaxed">
        {{ t("login.termsNotice") }}
        <RouterLink :to="localePath('conditions')" class="underline hover:text-text-primary">
          {{ t("login.termsLink") }}
        </RouterLink>
        {{ t("login.termsAnd") }}
        <RouterLink :to="localePath('confidentialite')" class="underline hover:text-text-primary">
          {{ t("login.privacyLink") }}
        </RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 120px;
  opacity: 1;
}

.slide-up-enter-from,
.slide-up-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
  margin-bottom: 0 !important;
}
</style>
