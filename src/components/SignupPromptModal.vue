<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";

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
const headerIcon = computed<IconName>(() => (isAuth.value ? "circle-plus" : "check"));
const headerIconWrapClass = computed(() =>
  isAuth.value
    ? "bg-primary/10 text-primary"
    : "bg-green-600/10 text-green-600 dark:text-green-400",
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
      <div v-if="show" class="modal-overlay" @click="closeModal">
        <div class="modal-panel animate-[scaleIn_0.3s_ease]" @click.stop>
          <!-- Header : confirmation ou invitation à se connecter -->
          <div class="text-center">
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              :class="headerIconWrapClass"
            >
              <AppIcon :name="headerIcon" :size="24" />
            </div>
            <h3 class="text-xl font-bold text-text-primary mb-1">
              {{ title }}
            </h3>
            <p class="text-sm text-text-secondary">
              {{ subtitle }}
            </p>
          </div>

          <!-- Liste des avantages -->
          <div v-if="showBenefits" class="py-5">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <AppIcon name="check" :size="14" class="text-green-600 dark:text-green-400" />
                <span class="text-sm text-text-primary">{{
                  t("signupPrompt.benefits.recover")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <AppIcon name="check" :size="14" class="text-green-600 dark:text-green-400" />
                <span class="text-sm text-text-primary">{{
                  t("signupPrompt.benefits.track")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <AppIcon name="check" :size="14" class="text-green-600 dark:text-green-400" />
                <span class="text-sm text-text-primary">{{
                  t("signupPrompt.benefits.profile")
                }}</span>
              </div>
              <div class="flex items-center gap-3">
                <AppIcon name="check" :size="14" class="text-green-600 dark:text-green-400" />
                <span class="text-sm text-text-primary">{{
                  t("signupPrompt.benefits.upcoming")
                }}</span>
              </div>
            </div>
          </div>

          <!-- Boutons d'action -->
          <div class="pt-2 space-y-3">
            <button @click="goToLogin('google')" class="btn btn-soft w-full">
              <AppIcon name="google" :size="16" class="text-[#4285F4]" />
              {{ t("signupPrompt.signUpGoogle") }}
            </button>

            <button @click="goToLogin('signup')" class="btn btn-primary w-full">
              <AppIcon name="envelope" :size="16" />
              {{ t("signupPrompt.signUpEmail") }}
            </button>

            <button
              @click="closeModal"
              class="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {{ t("signupPrompt.later") }}
            </button>
          </div>

          <!-- Note pour les utilisateurs existants -->
          <p class="mt-3 text-xs text-center text-text-secondary/70">
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
    </Transition>
  </Teleport>
</template>

<style scoped>
/* fadeIn is defined globally in main.css */
.modal-enter-active {
  animation: fadeIn 0.3s ease;
}
.modal-leave-active {
  animation: fadeIn 0.3s ease reverse;
}
</style>
