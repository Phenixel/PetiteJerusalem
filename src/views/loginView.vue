<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { authService } from "../services/authService";
import { seoService } from "../services/seoService";

const router = useRouter();
const route = useRoute();
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
    router.push("/");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t("login.loginError");
    errorMessage.value = msg;
  } finally {
    loading.value = false;
  }
}

async function loginWithGoogle() {
  try {
    const redirectPath = (route.query.redirect as string) || "/profile";

    await authService.signInWithGooglePopup();

    router.push(redirectPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t("login.googleError");
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
    const redirectPath = (route.query.redirect as string) || "/profile";
    router.push(redirectPath);
    return;
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
    <section
      class="w-full max-w-lg bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-8 md:p-12 animate-[fadeIn_0.5s_ease] dark:bg-gray-800/60 dark:border-gray-700"
    >
      <div class="text-center mb-10">
        <h1 class="text-3xl font-bold text-text-primary mb-2 dark:text-gray-100">
          {{ t("login.welcome") }}
        </h1>
        <p class="text-text-secondary dark:text-gray-400">{{ t("login.connectToContinue") }}</p>
      </div>

      <div class="mb-8">
        <button
          class="w-full py-3 px-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl font-semibold text-text-primary shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
          @click="loginWithGoogle"
        >
          <i class="fa-brands fa-google text-[#4285F4]"></i>
          {{ t("login.signInWithGoogle") }}
        </button>
      </div>

      <div class="flex items-center gap-4 mb-8">
        <div class="h-px bg-gray-200 flex-1 dark:bg-gray-700"></div>
        <p class="text-sm text-text-secondary/60 font-medium dark:text-gray-500">
          {{ t("common.or") }}
        </p>
        <div class="h-px bg-gray-200 flex-1 dark:bg-gray-700"></div>
      </div>

      <div
        class="relative grid grid-cols-2 gap-0 bg-gray-100/50 p-1 rounded-full mb-8 border border-gray-200/50 dark:bg-gray-700/50 dark:border-gray-600"
      >
        <div
          class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-gray-600 rounded-full shadow-sm transition-all duration-300 ease-out"
          :class="mode === 'login' ? 'left-1' : 'left-1 translate-x-full'"
        ></div>
        <button
          type="button"
          class="relative z-10 py-2.5 text-sm font-bold text-center transition-colors duration-300 rounded-full"
          :class="{
            'text-text-primary dark:text-gray-100': mode === 'login',
            'text-text-secondary hover:text-text-primary dark:text-gray-400 dark:hover:text-gray-200':
              mode !== 'login',
          }"
          @click="setMode('login')"
          :disabled="loading"
        >
          {{ t("login.signIn") }}
        </button>
        <button
          type="button"
          class="relative z-10 py-2.5 text-sm font-bold text-center transition-colors duration-300 rounded-full"
          :class="{
            'text-text-primary dark:text-gray-100': mode === 'signup',
            'text-text-secondary hover:text-text-primary dark:text-gray-400 dark:hover:text-gray-200':
              mode !== 'signup',
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
            <label
              class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
              for="displayName"
              >{{ t("login.displayName") }}</label
            >
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              :placeholder="t('login.displayNamePlaceholder')"
            />
          </div>
        </Transition>

        <div class="mb-5">
          <label
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
            for="email"
            >{{ t("login.email") }}</label
          >
          <input
            id="email"
            v-model="email"
            type="email"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
            :placeholder="t('login.emailPlaceholder')"
            required
          />
        </div>

        <div class="mb-5">
          <label
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
            for="password"
            >{{ t("login.password") }}</label
          >
          <input
            id="password"
            v-model="password"
            type="password"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
            placeholder="••••••••"
            required
          />
        </div>

        <Transition name="slide-up">
          <div v-if="mode === 'signup'" class="mb-5 overflow-hidden">
            <label
              class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
              for="confirmPassword"
              >{{ t("login.confirmPassword") }}</label
            >
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              placeholder="••••••••"
              required
            />
          </div>
        </Transition>

        <div
          v-if="errorMessage"
          class="p-4 mb-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium animate-[shake_0.4s_ease] dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400"
        >
          <i class="fa-solid fa-circle-exclamation mr-2"></i>{{ errorMessage }}
        </div>

        <button
          class="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          type="submit"
          :disabled="loading"
        >
          <i v-if="loading" class="fa-solid fa-circle-notch fa-spin mr-2"></i>
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
