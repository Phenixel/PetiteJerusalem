<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useOnboarding } from "../../composables/useOnboarding";
import { useConsent, type ConsentChoice } from "../../composables/useConsent";
import { authService } from "../../services/authService";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../icons/AppIcon.vue";
import OnboardingConsentStep from "./OnboardingConsentStep.vue";
import OnboardingSettingsStep from "./OnboardingSettingsStep.vue";
import OnboardingDailyStep from "./OnboardingDailyStep.vue";
import OnboardingLibraryStep from "./OnboardingLibraryStep.vue";

/**
 * L'introduction de première ouverture : des pages pleines, une idée par page.
 *
 * Elle occupe l'écran entier plutôt que de se glisser dans un coin : ce sont
 * les explications qui manquaient (à quoi sert la mesure d'audience, la
 * lecture du jour, le téléchargement des textes), et une bannière au pied de
 * page ne les faisait pas lire. Chaque page reste courte, et rien n'y est
 * définitif : tout se retrouve ensuite dans les écrans concernés.
 *
 * Le composant n'est monté que lorsqu'elle doit s'afficher (App.vue) : son
 * chunk ne pèse rien pour qui l'a déjà vue.
 */

const { t } = useI18n();
const router = useRouter();
const { completeOnboarding } = useOnboarding();
const { choice, setChoice } = useConsent();

/**
 * La page du consentement n'a lieu d'être que si le choix n'a pas déjà été
 * fait : les utilisateurs d'avant l'introduction ont répondu à la bannière,
 * leur décision tient, on ne la remet pas en jeu. Figée à l'ouverture, pour
 * que répondre ne fasse pas disparaître la page en cours de lecture.
 */
const steps = ["consent", "settings", "daily", "library"].filter(
  (step) => step !== "consent" || choice.value === null,
);

const index = ref(0);
const current = computed(() => steps[index.value]);
const isLast = computed(() => index.value === steps.length - 1);

/** Compte connecté : ses réglages partent chez Firestore, sinon ils restent sur l'appareil. */
const userId = ref<string | null>(null);
const stopAuth = authService.onAuthChanged((user) => {
  userId.value = user?.id ?? null;
});

function goTo(next: number): void {
  index.value = Math.min(Math.max(next, 0), steps.length - 1);
}

/** Fin de l'introduction, par la dernière page ou par un raccourci. */
function finish(via: string): void {
  analyticsService.capture("onboarding_finished", { via, step: current.value });
  completeOnboarding();
}

function onConsent(newChoice: ConsentChoice): void {
  setChoice(newChoice);
  goTo(index.value + 1);
}

/** « Composer ma lecture du jour » : la page demande un compte, le routeur s'en charge. */
function goToDailyReading(): void {
  finish("daily_reading");
  void router.push("/bibliotheque/lecture-du-jour");
}

function goToLibrary(): void {
  finish("library");
  void router.push("/bibliotheque");
}

// Le consentement n'a pas de porte de sortie (un choix explicite est attendu) ;
// partout ailleurs, la touche Échap vaut « passer ».
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && current.value !== "consent") finish("escape");
}

onMounted(() => {
  analyticsService.capture("onboarding_started", { steps: steps.length });
  // La page derrière ne doit pas défiler sous l'introduction, qui a son
  // propre défilement.
  document.documentElement.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
  stopAuth();
});

// Quelle page a été vue, et jusqu'où l'introduction est suivie : c'est ce qui
// dira si les explications sont lues ou si on part avant la fin.
watch(
  current,
  (step) => analyticsService.capture("onboarding_step_viewed", { step, index: index.value }),
  { immediate: true },
);
</script>

<template>
  <div
    class="fixed inset-0 z-[90] overflow-y-auto bg-bg-beige dark:bg-gray-900"
    role="dialog"
    aria-modal="true"
    :aria-label="t('onboarding.ariaLabel')"
  >
    <div
      class="mx-auto flex min-h-full w-full max-w-2xl flex-col px-6 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1.5rem+var(--safe-top))]"
    >
      <!-- Avancement, et la sortie : « Passer » n'apparaît qu'une fois le
           consentement tranché, il ne peut pas servir à l'esquiver. -->
      <header class="mb-8 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2" :aria-label="t('onboarding.ariaProgress')">
          <span
            v-for="(step, i) in steps"
            :key="step"
            class="h-1.5 rounded-full transition-all duration-300"
            :class="
              i === index
                ? 'w-6 bg-primary'
                : i < index
                  ? 'w-3 bg-primary/50'
                  : 'w-3 bg-black/10 dark:bg-white/15'
            "
          ></span>
        </div>
        <button
          v-if="current !== 'consent'"
          type="button"
          class="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
          @click="finish('skip')"
        >
          {{ t("onboarding.skip") }}
        </button>
      </header>

      <main class="flex-1 animate-[fadeIn_0.35s_ease]" :key="current">
        <OnboardingConsentStep v-if="current === 'consent'" @choose="onConsent" />
        <OnboardingSettingsStep v-else-if="current === 'settings'" :user-id="userId" />
        <OnboardingDailyStep
          v-else-if="current === 'daily'"
          :logged-in="userId !== null"
          @create="goToDailyReading"
        />
        <OnboardingLibraryStep v-else @open-library="goToLibrary" />
      </main>

      <!-- Le consentement porte ses propres boutons (accepter, refuser) :
           aucun « continuer » ne doit passer par-dessus le choix. -->
      <footer v-if="current !== 'consent'" class="mt-10 flex items-center justify-between gap-4">
        <button v-if="index > 0" type="button" class="back-link" @click="goTo(index - 1)">
          <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
          {{ t("onboarding.back") }}
        </button>
        <span v-else></span>
        <button
          type="button"
          class="btn btn-primary"
          @click="isLast ? finish('finish') : goTo(index + 1)"
        >
          {{ isLast ? t("onboarding.finish") : t("onboarding.next") }}
        </button>
      </footer>
    </div>
  </div>
</template>
