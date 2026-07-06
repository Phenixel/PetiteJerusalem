<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Capacitor } from "@capacitor/core";
import { authService } from "../services/authService";
import { reservationService } from "../services/reservationService";
import { seoService } from "../services/seoService";
import AppIcon from "../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();

const mode = ref<"login" | "signup">("login");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const displayName = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);

function setMode(newMode: "login" | "signup") {
  mode.value = newMode;
  errorMessage.value = null;
}

const buttonText = computed(() => {
  if (loading.value) return t("login.pleaseWait");
  return mode.value === "login" ? t("login.signIn") : t("login.register");
});

async function submitForm() {
  errorMessage.value = null;
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
        .migrateGuestReservations(currentUser.email, currentUser.id, currentUser.name)
        .catch((error) => console.error("Migration des réservations invité échouée:", error));
    }

    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/";
    router.push(redirectPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t("login.loginError");
    errorMessage.value = msg;
  } finally {
    loading.value = false;
  }
}

async function loginWithGoogle() {
  try {
    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/profile";

    const user = await authService.signInWithGooglePopup();

    reservationService
      .migrateGuestReservations(user.email, user.id, user.name)
      .catch((error) => console.error("Migration des réservations invité échouée:", error));

    router.push(redirectPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t("login.googleError");
    errorMessage.value = msg;
  }
}

// Apple exige "Sign in with Apple" sur l'app iOS dès qu'un autre login tiers
// est proposé. On n'affiche donc le bouton que sur la plateforme iOS.
const isApplePlatform = computed(() => Capacitor.getPlatform() === "ios");

async function loginWithApple() {
  try {
    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/profile";

    const user = await authService.signInWithApple();

    reservationService.migrateGuestReservations(user.email, user.id, user.name);

    router.push(redirectPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t("login.appleError");
    errorMessage.value = msg;
  }
}

onMounted(async () => {
  try {
    const user = await authService.getGoogleRedirectResult();
    if (user) {
      const redirectPath = authService.getAndClearRedirectPath() || "/profile";
      router.push(redirectPath);
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de la redirection Google:", error);
  }

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

  const url = window.location.origin + "/login";
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
          class="w-full mt-3 py-3 px-6 bg-black hover:bg-gray-900 rounded-xl font-semibold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3"
          @click="loginWithApple"
        >
          <i class="fa-brands fa-apple text-lg"></i>
          {{ t("login.signInWithApple") }}
        </button>
      </div>

      <p class="text-center text-sm text-text-secondary/60 font-medium mb-8">
        {{ t("common.or") }}
      </p>

      <div class="relative grid grid-cols-2 gap-0 bg-black/5 p-1 rounded-lg mb-8 dark:bg-white/10">
        <div
          class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface rounded-md shadow-sm transition-all duration-300 ease-out"
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

        <p
          v-if="errorMessage"
          class="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
        >
          <AppIcon name="alert-circle" :size="14" />
          {{ errorMessage }}
        </p>

        <button class="btn btn-primary w-full" type="submit" :disabled="loading">
          <AppIcon v-if="loading" name="spinner" :size="15" class="animate-spin" />
          {{ buttonText }}
        </button>
      </form>
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
