<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Capacitor } from "@capacitor/core";
import { authService, type User } from "../services/authService";
import {
  isAppleSignInUnavailable,
  isAuthBrowserUnavailable,
  isAuthCancellation,
} from "../services/authErrors";
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
// Message brut de l'erreur Firebase/plugin, affiché en petit sous le message
// i18n : indispensable pour diagnostiquer à distance les échecs de connexion
// Google/Apple remontés par les testeurs (l'erreur varie selon l'appareil).
const errorDetail = ref<string | null>(null);

function setMode(newMode: "login" | "signup") {
  mode.value = newMode;
  errorMessage.value = null;
  errorDetail.value = null;
}

const buttonText = computed(() => {
  if (loading.value) return t("login.pleaseWait");
  return mode.value === "login" ? t("login.signIn") : t("login.register");
});

async function submitForm() {
  errorMessage.value = null;
  errorDetail.value = null;
  // Troisième chemin de connexion, et le seul dont les échecs étaient muets :
  // `signed_in`/`signed_up {method: email}` n'avaient pas de contrepartie. Un
  // mot de passe oublié, une adresse déjà prise ou un mot de passe trop court
  // ressortaient tous comme une visite de /login sans suite.
  analyticsService.capture("email_auth_submitted", { mode: mode.value });
  loading.value = true;
  try {
    if (mode.value === "signup") {
      if (password.value !== confirmPassword.value) {
        throw new Error(t("login.passwordsDoNotMatch"));
      }
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
    const code = (e as { code?: unknown } | null)?.code;
    analyticsService.capture("email_auth_failed", {
      mode: mode.value,
      reason: typeof code === "string" ? code : "error",
    });
    const msg = e instanceof Error ? e.message : t("login.loginError");
    errorMessage.value = msg;
  } finally {
    loading.value = false;
  }
}

/**
 * Connexion par un tiers (Google, Apple) : le même parcours pour les deux, le
 * même funnel (`<provider>_signin_clicked` puis `signed_in`, ou en route
 * `_cancelled` / `_failed`), suivi du bug « bouton inerte » sur Google et de
 * la feuille Apple qui ne s'ouvre pas.
 */
async function socialSignIn(provider: "google" | "apple", signIn: () => Promise<User>) {
  errorMessage.value = null;
  errorDetail.value = null;
  analyticsService.capture(`${provider}_signin_clicked`);
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
    analyticsService.captureException(e, { auth_flow: provider });
    // Ce que l'appareil ne peut pas faire, et que réessayer ne changera pas :
    // Safari indisponible pour Google (restrictions Temps d'écran), la feuille
    // Apple sans compte Apple connecté (code 1000). On dit quoi vérifier, et
    // vers quoi se replier, plutôt qu'une erreur générique observée en prod
    // (trois tentatives puis abandon).
    const unavailable =
      provider === "google" ? isAuthBrowserUnavailable(e) : isAppleSignInUnavailable(e);
    analyticsService.capture(`${provider}_signin_failed`, {
      reason: unavailable ? "unavailable" : "error",
      error_message: e instanceof Error ? e.message : String(e),
    });
    if (provider === "google") {
      errorMessage.value = unavailable ? t("login.authBrowserUnavailable") : t("login.googleError");
    } else {
      errorMessage.value = unavailable ? t("login.appleSignInUnavailable") : t("login.appleError");
    }
    errorDetail.value = e instanceof Error ? e.message : String(e);
  }
}

const loginWithGoogle = () => socialSignIn("google", () => authService.signInWithGooglePopup());

// Apple exige "Sign in with Apple" sur l'app iOS dès qu'un autre login tiers
// est proposé. On n'affiche donc le bouton que sur la plateforme iOS.
const isApplePlatform = computed(() => Capacitor.getPlatform() === "ios");

const loginWithApple = () => socialSignIn("apple", () => authService.signInWithApple());

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

      <div class="mb-8">
        <button class="btn btn-soft w-full" @click="loginWithGoogle">
          <AppIcon name="google" :size="16" />
          {{ t("login.signInWithGoogle") }}
        </button>

        <button
          v-if="isApplePlatform"
          class="w-full mt-3 py-3 px-6 bg-black hover:bg-gray-900 rounded-btn font-semibold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3"
          @click="loginWithApple"
        >
          <AppIcon name="apple" :size="18" />
          {{ t("login.signInWithApple") }}
        </button>
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
          <label class="block text-sm font-semibold text-text-primary mb-2" for="email">{{
            t("common.email")
          }}</label>
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

        <div v-if="errorMessage" class="mb-4">
          <p class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AppIcon name="alert-circle" :size="14" />
            {{ errorMessage }}
          </p>
          <p v-if="errorDetail" class="mt-1 text-xs text-text-secondary/70 break-words">
            {{ errorDetail }}
          </p>
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
