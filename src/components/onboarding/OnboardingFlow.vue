<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useOnboarding } from "../../composables/useOnboarding";
import { useConsent, type ConsentChoice } from "../../composables/useConsent";
import { pushOverlay } from "../../composables/useOverlayStack";
import { authService } from "../../services/authService";
import { analyticsService } from "../../services/analyticsService";
import AppIcon from "../icons/AppIcon.vue";
import OnboardingConsentStep from "./OnboardingConsentStep.vue";
import OnboardingSettingsStep from "./OnboardingSettingsStep.vue";
import OnboardingOfflineStep from "./OnboardingOfflineStep.vue";
import OnboardingEssentialsStep from "./OnboardingEssentialsStep.vue";
import OnboardingGesturesStep from "./OnboardingGesturesStep.vue";

/**
 * L'introduction de première ouverture : quelques réglages, l'essentiel en
 * trois lignes, puis, pour qui le veut, les gestes de la lecture.
 *
 * Elle comptait six pages avec le consentement, des captures animées dès la
 * troisième, et près de la moitié des gens la passaient, presque tous dès la
 * première page après le consentement. Elle en compte maintenant cinq avec le
 * consentement (quatre sans) :
 * - consent : la mesure d'audience, qui demande un choix explicite ;
 * - settings : langue, clair ou sombre, thème ;
 * - offline : les textes à emporter, le seul réglage qui fasse quelque chose ;
 * - essentials : ce que contient l'app, et la lecture du jour à composer ;
 * - gestures : les gestes de la lecture, en captures.
 *
 * Les quatre premières se lisent : elles n'ont pas de « Passer ». La dernière
 * est la seule qu'on puisse passer, et c'est sans dommage, les mêmes gestes
 * reviennent en astuces sur la page de lecture (voir docs/design.md).
 *
 * Rien n'y est définitif : tout se retrouve ensuite dans les écrans concernés.
 *
 * App native seulement (voir useOnboarding), et le composant n'est monté que
 * lorsqu'elle doit s'afficher (App.vue) : son chunk ne pèse rien pour qui l'a
 * déjà vue, ni pour les visiteurs du site.
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
const steps = ["consent", "settings", "offline", "essentials", "gestures"].filter(
  (step) => step !== "consent" || choice.value === null,
);

const index = ref(0);
const current = computed(() => steps[index.value]);
const isLast = computed(() => index.value === steps.length - 1);
/** Seuls les gestes se passent : le reste, on tient à ce qu'il soit lu. */
const skippable = computed(() => current.value === "gestures");

/** Compte connecté : ses réglages partent chez Firestore, sinon ils restent sur l'appareil. */
const userId = ref<string | null>(null);
const stopAuth = authService.onAuthChanged((user) => {
  userId.value = user?.id ?? null;
});

function goTo(next: number): void {
  index.value = Math.min(Math.max(next, 0), steps.length - 1);
}

// Retour Android : la page précédente de l'introduction s'il y en a une,
// sinon rien du tout. Sans cette inscription, le geste minimisait l'app à
// sa toute première ouverture, en plein milieu des explications.
const removeOverlay = pushOverlay(() => {
  if (index.value > 0) goTo(index.value - 1);
});

/**
 * Fin de l'introduction, par la dernière page ou par un raccourci.
 *
 * « Composer ma lecture du jour » (via `daily`) est sur la page de
 * l'essentiel, après tout ce qu'il faut lire : il termine l'introduction
 * avant d'y conduire, sans les gestes, qu'on peut passer. Plus tôt, il la
 * coupait en deux (la page demande un compte, le routeur emmenait vers la
 * connexion, et l'introduction, notée comme vue, ne revenait jamais).
 */
function finish(via: string): void {
  const toDaily = via === "daily";
  analyticsService.capture("onboarding_finished", {
    via,
    step: current.value,
    wants_daily_reading: toDaily,
  });
  completeOnboarding();
  if (toDaily) void router.push("/bibliotheque/lecture-du-jour");
}

function onConsent(newChoice: ConsentChoice): void {
  setChoice(newChoice);
  goTo(index.value + 1);
}

// La touche Échap vaut « Passer », là seulement où l'on peut passer.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && skippable.value) finish("escape");
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
  removeOverlay();
});

/** La surface défilante de l'introduction, remise en haut à chaque page. */
const scroller = ref<HTMLElement | null>(null);

// Quelle page a été vue, et jusqu'où l'introduction est suivie : c'est ce qui
// dira si les explications sont lues ou si on part avant la fin. On en profite
// pour remonter en haut : le bouton « continuer » est en bas de page, sans
// cela la page suivante s'ouvrirait à sa moitié.
watch(
  current,
  (step) => {
    if (scroller.value) scroller.value.scrollTop = 0;
    analyticsService.capture("onboarding_step_viewed", { step, index: index.value });
  },
  { immediate: true },
);
</script>

<template>
  <div
    ref="scroller"
    class="fixed inset-0 z-[90] overflow-y-auto bg-bg-beige dark:bg-gray-900"
    role="dialog"
    aria-modal="true"
    :aria-label="t('onboarding.ariaLabel')"
  >
    <div
      class="mx-auto flex min-h-full w-full max-w-2xl flex-col px-6 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1.5rem+var(--safe-top))]"
    >
      <!-- Avancement, et la sortie : « Passer » n'apparaît que sur les
           gestes, la seule page qu'on puisse sauter. -->
      <header class="mb-6 flex items-center justify-between gap-4">
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
          v-if="skippable"
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
        <OnboardingOfflineStep v-else-if="current === 'offline'" />
        <OnboardingEssentialsStep v-else-if="current === 'essentials'" @compose="finish('daily')" />
        <OnboardingGesturesStep v-else />
      </main>

      <!-- Le consentement porte ses propres boutons (accepter, refuser) :
           aucun « continuer » ne doit passer par-dessus le choix. -->
      <footer v-if="current !== 'consent'" class="mt-8 flex items-center justify-between gap-4">
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
