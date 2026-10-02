<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { EnumTypeTextStudy } from "../../models/typeTextStudy";
import { sessionService } from "../../services/sessionService";
import { TextTypeService } from "../../services/textTypeService";
import { localDayKey } from "../../services/dateService";
import { deadlineDays, isShortDeadline } from "../../services/sessionDeadline";
import { authService } from "../../services/authService";
import { ModerationError } from "../../services/moderationService";
import type { User } from "../../services/authService";
import { seoService } from "../../services/seoService";
import { analyticsService } from "../../services/analyticsService";
import SignupPromptModal from "../../components/SignupPromptModal.vue";
import AppSelect from "../../components/AppSelect.vue";
import AppDateField from "../../components/AppDateField.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { SITE_URL } from "../../config/site";
import { findPerpetualSession } from "../../services/perpetualChain";
import type { Session } from "../../models/models";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const isLoading = ref(false);
const message = ref("");
const currentUser = ref<User | null>(null);
// Visitors who aren't signed in get the sign-in prompt (like the share home
// page) instead of being redirected away.
const showAuthPrompt = ref(false);

const textStudyTypes = TextTypeService.getAllTypes();
const typeOptions = textStudyTypes.map((type) => ({
  value: String(type.value),
  label: type.label,
}));

const sessionData = reactive({
  name: "",
  description: "",
  type: "" as EnumTypeTextStudy | "",
  dateLimit: "",
  // Décoché par défaut : les invités peuvent réserver avec leur nom seul.
  guestEmailRequired: false,
});

/** Une date limite dans le passé n'a pas de sens : le calendrier s'arrête à aujourd'hui. */
const todayKey = localDayKey();

/** Passerelle entre la liste (des chaînes) et le type énuméré du formulaire. */
const typeValue = computed({
  get: () => String(sessionData.type),
  set: (value: string) => {
    sessionData.type = value as EnumTypeTextStudy | "";
  },
});

/**
 * Une chaîne de Tehilim pour un malade ou un défunt a souvent du mal à
 * trouver 150 lecteurs. Dès que le type Tehilim est choisi, une ligne
 * discrète propose aussi la chaîne perpétuelle, qui lit pour les noms qu'on
 * lui confie ; elle ne détourne pas de la création, qui reste possible.
 */
const perpetualSession = ref<Session | null>(null);
const showPerpetualHint = computed(
  () => sessionData.type === EnumTypeTextStudy.Tehilim && perpetualSession.value !== null,
);
const perpetualLink = computed(() => {
  const chain = perpetualSession.value;
  return chain ? `/share-reading/session/${chain.slug || chain.id}?proposer=1` : "";
});
watch(
  () => sessionData.type,
  async (type) => {
    if (type !== EnumTypeTextStudy.Tehilim || perpetualSession.value) return;
    try {
      perpetualSession.value = findPerpetualSession(await sessionService.getAllSessions());
    } catch {
      // Sans la liste, pas de suggestion : la création suit son cours.
    }
  },
);
const trackPerpetualHint = () => {
  analyticsService.capture("perpetual_chain_opened", { source: "new_session" });
};

const availableBooks = ref<string[]>([]);
const selectedBooks = ref<string[]>([]);
const isBookSelectionEnabled = ref(false);

const buttonText = computed(() => {
  return isLoading.value ? t("newSession.creating") : t("newSession.create");
});

watch(
  () => sessionData.type,
  async (newType) => {
    selectedBooks.value = [];
    availableBooks.value = [];
    isBookSelectionEnabled.value = false;

    if (newType) {
      try {
        const books = await sessionService.getBooksByType(newType as EnumTypeTextStudy);
        if (books.length > 0) {
          availableBooks.value = books;
          selectedBooks.value = [...books];
          isBookSelectionEnabled.value = true;
        }
      } catch (error) {
        console.error("Erreur lors du chargement des livres:", error);
      }
    }
  },
);

const toggleAllBooks = () => {
  if (selectedBooks.value.length === availableBooks.value.length) {
    selectedBooks.value = [];
  } else {
    selectedBooks.value = [...availableBooks.value];
  }
};

const formatBookName = (bookName: string) => {
  return sessionService.formatBookName(bookName);
};

onMounted(async () => {
  currentUser.value = await authService.getCurrentUser();
  // Entrée du funnel de création (session_created en est la sortie).
  analyticsService.capture("session_create_started", {
    is_authenticated: currentUser.value != null,
  });
  if (!currentUser.value) {
    showAuthPrompt.value = true;
  }
  const url = SITE_URL + "/share-reading/new-session";
  seoService.setMeta({
    title: t("seo.newSessionTitle"),
    description: t("seo.newSessionDescription"),
    canonical: url,
    og: { url },
  });
});

/**
 * Les champs obligatoires, dans l'ordre du formulaire : l'intitulé que porte
 * leur étiquette, et l'identifiant de la commande à l'écran.
 *
 * Le nom et la description sont des champs natifs marqués `required` : le
 * navigateur les retient avant même que le formulaire parte. Le type et la
 * date limite sont des commandes de la maison (AppSelect, AppDateField), donc
 * sans validation native ; c'est ici qu'on les retient, et il faut dire lequel
 * manque. Observé en production : un formulaire rempli, cinq livres choisis,
 * et « Veuillez remplir tous les champs » pour seule réponse ; aucune de ces
 * chaînes n'a été créée.
 */
const requiredFields = computed(() => [
  { id: "name", label: t("newSession.sessionTitle"), filled: sessionData.name.trim() !== "" },
  {
    id: "description",
    label: t("newSession.sessionDescription"),
    filled: sessionData.description.trim() !== "",
  },
  { id: "type", label: t("newSession.textType"), filled: sessionData.type !== "" },
  { id: "dateLimit", label: t("common.dateLimit"), filled: sessionData.dateLimit !== "" },
]);

/**
 * Le message d'erreur s'affiche sous le formulaire : sur un téléphone, le
 * champ en cause est presque toujours hors de l'écran. On y amène donc le
 * regard, puis le curseur.
 */
const focusField = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  element?.focus({ preventScroll: true });
};

/**
 * Sortie négative du funnel de création, jusqu'ici totalement muette :
 * `session_created` n'avait aucune contrepartie. Un formulaire abandonné sur
 * une validation, un terme refusé par la modération ou une écriture Firestore
 * en échec se lisaient tous de la même façon dans les stats : un
 * `session_create_started` sans suite.
 */
const trackCreateFailed = (reason: "validation" | "moderation" | "error", detail?: string) => {
  analyticsService.capture("session_create_failed", {
    reason,
    // Pas l'intitulé de la chaîne (noms de personnes) : seulement de quoi
    // trier. Le terme refusé par la modération est porté par le message.
    detail: detail ?? null,
    text_type: sessionData.type || null,
    books_count: selectedBooks.value.length,
    is_authenticated: currentUser.value != null,
  });
};

const createSession = async () => {
  if (!currentUser.value) {
    // Le visiteur a rempli le formulaire puis découvre qu'il faut un compte :
    // c'est une friction, pas une simple validation.
    trackCreateFailed("validation", "not_authenticated");
    showAuthPrompt.value = true;
    return;
  }

  // Un seul champ à la fois : celui que le formulaire attend en premier. Deux
  // reproches d'un coup se lisent moins bien qu'un seul, et le second se pose
  // de lui-même au clic suivant.
  const missing = requiredFields.value.find((field) => !field.filled);
  if (missing) {
    // Le détail nomme le champ (`missing_dateLimit`) : un `missing_fields`
    // global ne disait pas lequel, et c'est tout ce qu'on voulait savoir.
    trackCreateFailed("validation", `missing_${missing.id}`);
    message.value = t("newSession.fieldRequired", { field: missing.label });
    focusField(missing.id);
    return;
  }

  if (isBookSelectionEnabled.value && selectedBooks.value.length === 0) {
    trackCreateFailed("validation", "no_book_selected");
    message.value = t("newSession.selectAtLeastOne");
    return;
  }

  // Une date limite ce soir ou demain soir : on demande si c'est bien voulu
  // (voir services/sessionDeadline). Refuser ramène au champ de la date.
  if (isShortDeadline(sessionData.dateLimit)) {
    const days = deadlineDays(sessionData.dateLimit);
    const confirmed = await confirm({
      title: t("newSession.shortDeadline.title"),
      message: t(
        days <= 1 ? "newSession.shortDeadline.today" : "newSession.shortDeadline.tomorrow",
      ),
      confirmLabel: t("newSession.shortDeadline.confirm"),
      cancelLabel: t("newSession.shortDeadline.change"),
    });
    analyticsService.capture("session_deadline_warned", { deadline_days: days, confirmed });
    if (!confirmed) {
      focusField("dateLimit");
      return;
    }
  }

  isLoading.value = true;
  message.value = "";

  try {
    const sessionId = await sessionService.createSessionWithValidation(
      sessionData.name,
      sessionData.description,
      sessionData.type as EnumTypeTextStudy,
      sessionData.dateLimit,
      currentUser.value!.id,
      currentUser.value!.name,
      selectedBooks.value.length > 0 ? selectedBooks.value : undefined,
      sessionData.guestEmailRequired,
    );

    analyticsService.capture("session_created", {
      session_id: sessionId,
      text_type: sessionData.type,
      books_count: selectedBooks.value.length,
      // Toujours vrai (la création exige un compte), mais posé comme sur
      // `session_create_started` : les deux bouts du funnel se comparent
      // alors sur la même propriété, sans traitement particulier.
      is_authenticated: true,
      guest_email_required: sessionData.guestEmailRequired,
      // Fin de journée locale, comme la date limite enregistrée : lue en
      // minuit UTC, la date reculait d'un jour à l'ouest de Greenwich.
      deadline_days: deadlineDays(sessionData.dateLimit),
    });

    // Le toast est monté au niveau de l'app : il survit à la redirection et
    // reste visible sur la page de la session nouvellement créée. `partager`
    // y ouvre la fenêtre de partage, avec un mot pour dire pourquoi : une
    // chaîne que personne ne voit reste vide (voir DetailSession).
    toast.success(t("newSession.createdSuccess"));
    router.push({ path: `/share-reading/session/${sessionId}`, query: { partager: "1" } });
  } catch (error) {
    console.error("Erreur lors de la création de la session:", error);
    if (error instanceof ModerationError) {
      // Terme interdit : erreur utilisateur (pas un bug), avec le terme en cause.
      trackCreateFailed("moderation", error.message);
      message.value = error.message;
    } else {
      trackCreateFailed("error", error instanceof Error ? error.message : String(error));
      analyticsService.captureException(error, { flow: "session_create" });
      message.value = t("newSession.createError");
    }
    // Pas de finally : en cas de succès, la page est quittée et le bouton
    // reste inactif jusque-là (sinon un second clic créerait un doublon).
    isLoading.value = false;
  }
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <!-- Largeur contenue : un formulaire pleine largeur est illisible sur grand écran. -->
  <main class="mx-auto max-w-3xl px-6 py-12 min-h-screen">
    <div class="text-center mb-12 animate-[fadeIn_0.5s_ease]">
      <h2 class="text-3xl md:text-4xl font-bold text-text-primary mb-4 tracking-tight">
        {{ t("newSession.title") }}
      </h2>
      <p class="text-text-secondary text-lg">
        {{ t("newSession.subtitle") }}
      </p>
    </div>

    <div class="card p-6 md:p-8 animate-[fadeIn_0.5s_ease_0.1s] text-left">
      <form @submit.prevent="createSession" class="space-y-6">
        <div>
          <label for="name" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.sessionTitle")
          }}</label>
          <input
            type="text"
            id="name"
            v-model="sessionData.name"
            :placeholder="t('newSession.sessionTitlePlaceholder')"
            required
            maxlength="300"
            class="field"
          />
        </div>

        <div>
          <label for="description" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.sessionDescription")
          }}</label>
          <textarea
            id="description"
            v-model="sessionData.description"
            :placeholder="t('newSession.sessionDescriptionPlaceholder')"
            required
            maxlength="5000"
            class="field resize-y"
            rows="4"
          ></textarea>
        </div>

        <div>
          <label for="type" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.textType")
          }}</label>
          <!-- Le champ obligatoire l'est côté code (createSession refuse un
               type vide) : la liste n'est plus un <select>, elle n'a donc plus
               la validation du navigateur. -->
          <AppSelect
            id="type"
            v-model="typeValue"
            :options="typeOptions"
            :placeholder="t('newSession.selectType')"
          />
          <!-- Tehilim : la chaîne perpétuelle, en une ligne discrète sous le
               type. Elle ne promet pas de chiffre de lecteurs. -->
          <p
            v-if="showPerpetualHint"
            class="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-text-secondary animate-[fadeIn_0.3s_ease]"
          >
            <AppIcon name="rotate" :size="13" class="mt-0.5 shrink-0 text-primary" />
            <span>
              {{ t("perpetual.creation.text") }}
              <RouterLink
                :to="perpetualLink"
                class="font-semibold text-primary hover:underline"
                @click="trackPerpetualHint"
              >
                {{ t("perpetual.creation.link") }}
              </RouterLink>
            </span>
          </p>
        </div>

        <!-- Sélection des parties/livres (s'affiche uniquement si des livres sont disponibles) -->
        <div v-if="isBookSelectionEnabled" class="animate-[fadeIn_0.3s_ease]">
          <label class="block text-sm font-semibold text-text-secondary mb-3">
            {{ t("newSession.selectParts") }}
            <span class="text-xs font-normal text-text-secondary/70 ml-2">
              ({{ selectedBooks.length }}/{{ availableBooks.length }})
            </span>
          </label>

          <div
            class="rounded-lg bg-black/[0.03] p-4 max-h-60 overflow-y-auto custom-scrollbar dark:bg-white/5"
          >
            <div class="flex items-center mb-3">
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="w-5 h-5 rounded accent-primary cursor-pointer"
                  :checked="selectedBooks.length === availableBooks.length"
                  :indeterminate="
                    selectedBooks.length > 0 && selectedBooks.length < availableBooks.length
                  "
                  @change="toggleAllBooks"
                />
                <span class="ml-2 text-sm font-semibold text-text-primary">{{
                  t("newSession.selectAll")
                }}</span>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <label
                v-for="book in availableBooks"
                :key="book"
                class="inline-flex items-center cursor-pointer hover:bg-black/[0.04] px-1.5 py-1 rounded-sm transition-colors dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded accent-primary cursor-pointer"
                  :value="book"
                  v-model="selectedBooks"
                />
                <span class="ml-2 text-sm text-text-secondary">{{ formatBookName(book) }}</span>
              </label>
            </div>
          </div>
          <p
            v-if="selectedBooks.length === 0"
            class="text-xs text-red-600 mt-1.5 flex items-center gap-1 dark:text-red-400"
          >
            <AppIcon name="alert-triangle" :size="13" />
            {{ t("newSession.selectAtLeastOne") }}
          </p>
        </div>

        <div>
          <label for="dateLimit" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("common.dateLimit")
          }}</label>
          <AppDateField
            id="dateLimit"
            v-model="sessionData.dateLimit"
            :min="todayKey"
            :label="t('common.dateLimit')"
          />
        </div>

        <div>
          <label class="inline-flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="sessionData.guestEmailRequired"
              class="w-5 h-5 mt-0.5 rounded accent-primary cursor-pointer shrink-0"
            />
            <span>
              <span class="block text-sm font-semibold text-text-primary">
                {{ t("newSession.requireGuestEmail") }}
              </span>
              <span class="block text-xs text-text-secondary mt-0.5">
                {{ t("newSession.requireGuestEmailHint") }}
              </span>
            </span>
          </label>
        </div>

        <div class="flex flex-col-reverse sm:flex-row gap-4 pt-4">
          <button type="button" @click="goBack" class="btn btn-soft w-full sm:w-auto">
            {{ t("common.cancel") }}
          </button>
          <button type="submit" class="btn btn-primary w-full sm:flex-1" :disabled="isLoading">
            <AppIcon v-if="isLoading" name="spinner" :size="15" class="animate-spin" />
            {{ buttonText }}
          </button>
        </div>
      </form>
    </div>

    <!-- Seules les erreurs s'affichent ici : la réussite passe par un toast
         puis la redirection vers la session créée. -->
    <div
      v-if="message"
      class="mt-6 flex items-center justify-center gap-2 text-center font-medium text-red-600 animate-[fadeIn_0.3s_ease] dark:text-red-400"
      role="alert"
    >
      <AppIcon name="alert-circle" :size="15" />
      {{ message }}
    </div>

    <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
  </main>
</template>
