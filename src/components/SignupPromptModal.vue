<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

interface Props {
  show: boolean;
  guestEmail?: string;
  // "reservation": shown after a guest reserves (default).
  // "auth": shown when a visitor must sign in/up to perform an action
  //         (e.g. create a session).
  variant?: "reservation" | "auth";
}

interface Emits {
  (e: "update:show", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "reservation",
});
const emit = defineEmits<Emits>();

// Header + body adapt to the variant. Defaults keep the original
// "reservation confirmed" appearance so existing usage is unchanged.
const isAuth = computed(() => props.variant === "auth");
const headerIcon = computed(() => (isAuth.value ? "fa-circle-plus" : "fa-check"));
const headerIconWrapClass = computed(() =>
  isAuth.value
    ? "bg-primary/10 dark:bg-primary/20"
    : "bg-green-100 dark:bg-green-900/30",
);
const headerIconClass = computed(() =>
  isAuth.value ? "text-primary" : "text-green-600 dark:text-green-400",
);
const title = computed(() =>
  isAuth.value ? t("signupPrompt.createSessionTitle") : t("signupPrompt.reservationConfirmed"),
);
const subtitle = computed(() =>
  isAuth.value ? t("signupPrompt.createSessionSubtitle") : t("signupPrompt.subtitle"),
);
// The benefits list is reservation-specific; keep the auth prompt compact.
const showBenefits = computed(() => !isAuth.value);
const footerNote = computed(() =>
  isAuth.value ? t("signupPrompt.createSessionHaveAccount") : t("signupPrompt.alreadyHaveAccount"),
);

const closeModal = () => {
  emit("update:show", false);
};

const goToLogin = (mode: "signup" | "google" | "login") => {
  const currentPath = route.fullPath;
  const query: Record<string, string> = { redirect: currentPath };
  if (mode === "signup") {
    query.mode = "signup";
  }
  if (props.guestEmail) {
    query.email = props.guestEmail;
  }
  closeModal();
  router.push({ path: "/login", query });
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm cursor-pointer"
        @click="closeModal"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:bg-gray-800 dark:border-gray-700 animate-[scaleIn_0.3s_ease]"
          @click.stop
        >
          <!-- Header : confirmation ou invitation à se connecter -->
          <div class="p-6 pb-2 text-center">
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              :class="headerIconWrapClass"
            >
              <i class="fa-solid text-2xl" :class="[headerIcon, headerIconClass]"></i>
            </div>
            <h3 class="text-xl font-bold text-text-primary dark:text-gray-100 mb-1">
              {{ title }}
            </h3>
            <p class="text-sm text-text-secondary dark:text-gray-400">
              {{ subtitle }}
            </p>
          </div>

          <!-- Liste des avantages -->
          <div v-if="showBenefits" class="px-6 py-4">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <span
                  class="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0"
                >
                  <i class="fa-solid fa-rotate text-primary text-sm"></i>
                </span>
                <span class="text-sm text-text-primary dark:text-gray-200">{{
                  t("signupPrompt.benefits.recover")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0"
                >
                  <i
                    class="fa-solid fa-circle-check text-green-600 dark:text-green-400 text-sm"
                  ></i>
                </span>
                <span class="text-sm text-text-primary dark:text-gray-200">{{
                  t("signupPrompt.benefits.track")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"
                >
                  <i class="fa-solid fa-chart-simple text-blue-600 dark:text-blue-400 text-sm"></i>
                </span>
                <span class="text-sm text-text-primary dark:text-gray-200">{{
                  t("signupPrompt.benefits.profile")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"
                >
                  <i class="fa-solid fa-rocket text-amber-600 dark:text-amber-400 text-sm"></i>
                </span>
                <span class="text-sm text-text-primary dark:text-gray-200">{{
                  t("signupPrompt.benefits.upcoming")
                }}</span>
              </div>
            </div>
          </div>

          <!-- Boutons d'action -->
          <div class="px-6 pb-4 pt-2 space-y-3">
            <button
              @click="goToLogin('google')"
              class="w-full py-3 px-6 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl font-semibold text-text-primary shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <i class="fa-brands fa-google text-[#4285F4]"></i>
              {{ t("signupPrompt.signUpGoogle") }}
            </button>

            <button
              @click="goToLogin('signup')"
              class="w-full py-3 px-6 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <i class="fa-solid fa-envelope mr-2"></i>
              {{ t("signupPrompt.signUpEmail") }}
            </button>

            <button
              @click="closeModal"
              class="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors dark:text-gray-400 dark:hover:text-gray-200"
            >
              {{ t("signupPrompt.later") }}
            </button>
          </div>

          <!-- Note pour les utilisateurs existants -->
          <div class="px-6 pb-5">
            <p class="text-xs text-center text-text-secondary/70 dark:text-gray-500">
              {{ footerNote }}
              <a
                href="#"
                class="text-primary font-semibold hover:underline"
                @click.prevent="goToLogin('login')"
              >
                {{ t("signupPrompt.signIn") }}
              </a>
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active {
  animation: fadeIn 0.3s ease;
}
.modal-leave-active {
  animation: fadeIn 0.3s ease reverse;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
