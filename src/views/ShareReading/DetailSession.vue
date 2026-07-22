<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { sessionService } from "../../services/sessionService";
import type { Session, TextStudy, TextStudyReservation } from "../../models/models";
import type { User } from "../../services/authService";
import GuestForm from "../../components/GuestForm.vue";
import ShareModal from "../../components/ShareModal.vue";
import SessionProgressBar from "../../components/SessionProgressBar.vue";
import BatchSelectionBar from "../../components/BatchSelectionBar.vue";
import SignupPromptModal from "../../components/SignupPromptModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { seoService } from "../../services/seoService";
import { SITE_URL } from "../../content/seoPages";
import SessionHeader from "./detailSession/SessionHeader.vue";
import SessionInstructions from "./detailSession/SessionInstructions.vue";
import TextStudiesList from "./detailSession/TextStudiesList.vue";
import { useToast } from "../../composables/useToast";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const session = ref<Session | null>(null);
const textStudies = ref<TextStudy[]>([]);
const reservations = ref<TextStudyReservation[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const currentUser = ref<User | null>(null);

const reservationForm = ref({
  name: "",
  email: "",
});

const isReserving = ref<string | null>(null);

const searchTerm = ref("");
// Filtre : ne montrer que les textes ayant encore des sections disponibles.
const showOnlyAvailable = ref(false);

const showShareModal = ref(false);
const shareUrl = ref("");

const selectedItems = ref<Set<string>>(new Set());
const isSubmittingBatch = ref(false);
const showSignupPrompt = ref(false);

const groupedTextStudies = computed(() => {
  if (!textStudies.value.length) return {};

  let filtered = textStudies.value;
  if (searchTerm.value.trim()) {
    filtered = sessionService.filterTextStudiesBySearch(filtered, searchTerm.value);
  }

  if (showOnlyAvailable.value && session.value) {
    const currentSession = session.value;
    filtered = filtered.filter((text) => !sessionService.isTextFullyReserved(text, currentSession));
  }

  if (currentUser.value) {
    const myReservedTextIds = new Set<string>();

    reservations.value.forEach((r) => {
      if (sessionService.canUserDeleteReservation(r, currentUser.value, "")) {
        myReservedTextIds.add(r.textStudyId);
      }
    });

    const myTexts: TextStudy[] = [];
    const otherTexts: TextStudy[] = [];

    filtered.forEach((text) => {
      if (myReservedTextIds.has(text.id)) {
        myTexts.push(text);
      } else {
        otherTexts.push(text);
      }
    });

    const groupedOthers = sessionService.groupTextStudiesByBook(otherTexts);

    if (myTexts.length > 0) {
      return {
        [t("detailSession.myReservations")]: myTexts,
        ...groupedOthers,
      };
    }

    return groupedOthers;
  }

  return sessionService.groupTextStudiesByBook(filtered);
});

const progressStats = computed(() => {
  if (!textStudies.value.length)
    return {
      total: 0,
      reserved: 0,
      read: 0,
      participants: 0,
      reservedPercentage: 0,
      readPercentage: 0,
    };

  const total = textStudies.value.reduce((acc, textStudy) => acc + textStudy.totalSections, 0);

  const reserved = reservations.value.length;

  const read = reservations.value.filter((r) => r.isCompleted).length;

  const uniqueParticipants = new Set<string>();
  reservations.value.forEach((r) => {
    if (r.chosenById) {
      uniqueParticipants.add(`user:${r.chosenById}`);
    } else if (r.chosenByGuestId) {
      uniqueParticipants.add(`guest:${r.chosenByGuestId}`);
    }
  });
  const participants = uniqueParticipants.size;

  return {
    total,
    reserved,
    read,
    participants,
    reservedPercentage: total > 0 ? (reserved / total) * 100 : 0,
    readPercentage: total > 0 ? (read / total) * 100 : 0,
  };
});

const hasSelectedItems = computed(() => selectedItems.value.size > 0);

const confirmButtonLabel = computed(() => {
  return !currentUser.value
    ? t("detailSession.confirmAsGuest")
    : t("detailSession.confirmReservation");
});

// Absent sur les sessions créées avant l'introduction du réglage : l'email
// des invités y est optionnel.
const guestEmailRequired = computed(() => session.value?.guestEmailRequired === true);

const loadSessionData = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    const slugOrId = route.params.slug as string;
    if (!slugOrId) {
      throw new Error("Session introuvable");
    }

    const sessionData = await sessionService.resolveSession(slugOrId);
    if (!sessionData) {
      throw new Error("Session introuvable");
    }

    // Redirect to clean slug URL if accessed via old ID-based URL
    if (sessionData.slug && sessionData.slug !== slugOrId) {
      router.replace(`/share-reading/session/${sessionData.slug}`);
    }

    const [textStudiesData] = await Promise.all([
      sessionService.getTextStudiesByType(sessionData.type),
    ]);

    const filteredTextStudies =
      sessionData.selectedBooks && sessionData.selectedBooks.length > 0
        ? textStudiesData.filter((text) => sessionData.selectedBooks!.includes(text.livre))
        : textStudiesData;

    // `reservations` et `session.reservations` doivent pointer sur LE MÊME
    // tableau : si le doc n'a pas encore de champ reservations, on le crée,
    // sinon les réservations ajoutées localement seraient invisibles pour
    // isReserved()/getTextDisplayStatus() qui lisent session.value.
    if (!Array.isArray(sessionData.reservations)) {
      sessionData.reservations = [];
    }
    session.value = sessionData;
    textStudies.value = filteredTextStudies;
    reservations.value = sessionData.reservations;
  } catch (err) {
    console.error("Erreur lors du chargement des données:", err);
    error.value = err instanceof Error ? err.message : "Erreur lors du chargement";
  } finally {
    isLoading.value = false;
  }
};

const isReserved = (textStudyId: string, section?: number) => {
  if (!session.value) return { isReserved: false };
  return sessionService.isTextOrSectionReserved(textStudyId, section, session.value);
};

// Sélectionne d'un coup toutes les sections encore disponibles d'un texte
// (ou les désélectionne si elles le sont déjà toutes). Les sections réservées
// ne sont jamais touchées.
const handleToggleSelectAll = (textStudyId: string) => {
  const text = textStudies.value.find((t) => t.id === textStudyId);
  if (!text) return;

  const availableKeys = sessionService
    .generateChapters(text.totalSections)
    .filter((chapter) => !isReserved(textStudyId, chapter).isReserved)
    .map((chapter) => `${textStudyId}#${chapter}`);

  const allSelected =
    availableKeys.length > 0 && availableKeys.every((key) => selectedItems.value.has(key));

  if (allSelected) {
    availableKeys.forEach((key) => selectedItems.value.delete(key));
  } else {
    availableKeys.forEach((key) => selectedItems.value.add(key));
  }
};

const handleItemClick = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`;

  if (isReserved(textStudyId, section).isReserved) {
    if (selectedItems.value.has(key)) {
      selectedItems.value.delete(key);
    }

    if (confirm(t("detailSession.cancelReservationConfirm"))) {
      cancelReservation(textStudyId, section);
    }
    return;
  }

  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key);
  } else {
    selectedItems.value.add(key);
  }
};

const confirmReservations = async () => {
  if (!session.value || selectedItems.value.size === 0) return;

  if (
    !currentUser.value &&
    (!reservationForm.value.name || (guestEmailRequired.value && !reservationForm.value.email))
  ) {
    toast.info(
      guestEmailRequired.value ? t("detailSession.fillNameAndEmail") : t("detailSession.fillName"),
    );
    const formElement = document.getElementById("guest-form");
    if (formElement) {
      const offset = 120;
      const elementPosition = formElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
    return;
  }

  try {
    isSubmittingBatch.value = true;
    const itemsToReserve = Array.from(selectedItems.value).map((key) => {
      const [textId, sectionStr] = key.split("#");
      return {
        textStudyId: textId,
        section: sectionStr === "full" ? undefined : parseInt(sectionStr),
      };
    });

    const unreservedItems = itemsToReserve.filter(
      (item) => !isReserved(item.textStudyId, item.section).isReserved,
    );

    if (unreservedItems.length === 0) {
      selectedItems.value.clear();
      return;
    }

    const reservationIds = await sessionService.createBatchReservationsForUser(
      session.value.id,
      unreservedItems,
      currentUser.value,
      reservationForm.value,
      guestEmailRequired.value,
    );

    const newReservations = sessionService.createLocalReservations(
      unreservedItems,
      reservationIds,
      currentUser.value,
      reservationForm.value,
    );

    reservations.value.push(...newReservations);
    selectedItems.value.clear();

    if (!currentUser.value) {
      // Les invités voient la modale d'inscription, qui confirme déjà la réservation.
      showSignupPrompt.value = true;
    } else {
      toast.success(t("detailSession.reservationsConfirmed", newReservations.length));
    }
  } catch (err) {
    console.error("Erreur lors de la confirmation globale:", err);
    toast.errorFromException(
      err,
      err instanceof Error && err.message ? err.message : t("detailSession.reservationError"),
    );
  } finally {
    isSubmittingBatch.value = false;
  }
};

const cancelReservation = async (textStudyId: string, section?: number) => {
  if (!session.value) return;

  try {
    const reservation = reservations.value.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    );

    if (reservation) {
      const canDelete = sessionService.canUserDeleteReservation(
        reservation,
        currentUser.value,
        reservationForm.value.email,
      );

      if (!canDelete) {
        toast.error(t("detailSession.canOnlyCancelOwn"));
        return;
      }

      await sessionService.deleteReservation(session.value.id, reservation.id);

      const index = reservations.value.findIndex((r) => r.id === reservation.id);
      if (index > -1) {
        reservations.value.splice(index, 1);
      }

      if (session.value) {
        session.value.reservations = reservations.value;
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'annulation:", err);
    toast.errorFromException(err, t("detailSession.cancelError"));
  }
};

const toggleReservationCompletion = async (textStudyId: string, section: number) => {
  if (!session.value) return;

  try {
    const reservation = reservations.value.find(
      (r) => r.textStudyId === textStudyId && r.section === section,
    );

    if (!reservation) return;

    const newCompletionStatus = !reservation.isCompleted;
    await sessionService.markReservationAsCompleted(
      session.value.id,
      reservation.id,
      newCompletionStatus,
    );

    reservation.isCompleted = newCompletionStatus;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la réservation:", error);
    toast.errorFromException(error, t("detailSession.updateError"));
  }
};

const clearSearch = () => {
  searchTerm.value = "";
};

const openShareModal = () => {
  // Domaine canonique plutôt que window.location.href : ce dernier vaut
  // localhost (ou capacitor://localhost) en dev et dans l'app native, ce qui
  // produirait un lien de partage inutilisable.
  const s = session.value;
  shareUrl.value = s ? `${SITE_URL}/share-reading/session/${s.slug || s.id}` : SITE_URL;
  showShareModal.value = true;
};

const isOwner = computed(() => {
  if (!currentUser.value || !session.value) return false;
  return currentUser.value.id === session.value.personId;
});

const goToManagement = () => {
  if (session.value) {
    router.push(`/session-management/${session.value.id}`);
  }
};

const applySessionSeo = (s: typeof session.value) => {
  if (!s) return;
  const slug = s.slug || s.id;
  const url = `${window.location.origin}/share-reading/session/${slug}`;
  const description = s.description || t("seo.sessionDefaultDescription");
  seoService.setMeta({
    title: `${s.name} | ${t("seo.sessionTitle")}`,
    description,
    canonical: url,
    og: {
      type: "article",
      url,
      title: s.name,
      description,
      image: `${window.location.origin}/og-image.jpg`,
      site_name: "Petite Jérusalem",
    },
    twitter: {
      card: "summary_large_image",
      title: s.name,
      description,
      image: `${window.location.origin}/og-image.jpg`,
    },
  });
};

onMounted(async () => {
  currentUser.value = await sessionService.getCurrentUser();
  await loadSessionData();
  applySessionSeo(session.value);
});

watch(session, (s) => applySessionSeo(s));
</script>

<template>
  <main class="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
    <!-- État de chargement -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium animate-pulse">{{ t("detailSession.loadingSession") }}</p>
    </div>

    <!-- État d'erreur -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ error }}</p>
      <button @click="loadSessionData" class="btn btn-soft">
        {{ t("common.retry") }}
      </button>
    </div>

    <!-- Contenu de la session -->
    <div v-else-if="session" class="animate-[fadeIn_0.5s_ease]">
      <SessionHeader
        :session="session"
        :is-owner="isOwner"
        @share="openShareModal"
        @manage="goToManagement"
      />

      <!-- Barre de progression -->
      <SessionProgressBar
        :total="progressStats.total"
        :reserved="progressStats.reserved"
        :read="progressStats.read"
        :participants="progressStats.participants"
      />

      <SessionInstructions />

      <!-- Formulaire de réservation pour invités (composant unifié) -->
      <div id="guest-form" v-if="!currentUser" class="card p-5 mb-8">
        <h3 class="font-bold text-lg text-text-primary">
          {{ t("detailSession.guestTitle") }}
        </h3>
        <p class="text-sm text-text-secondary mt-0.5 mb-4">
          {{
            guestEmailRequired
              ? t("detailSession.guestSubtitleWithEmail")
              : t("detailSession.guestSubtitle")
          }}
        </p>
        <GuestForm v-model:reservationForm="reservationForm" :email-required="guestEmailRequired" />
      </div>

      <!-- Barre de recherche -->
      <div class="sticky top-4 z-20 mb-8">
        <div class="relative max-w-xl mx-auto">
          <AppIcon
            name="search"
            :size="16"
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
          />
          <input
            type="text"
            v-model="searchTerm"
            :placeholder="t('detailSession.searchPlaceholder')"
            class="field !pl-11 !pr-10 shadow-card"
          />
          <button
            v-if="searchTerm"
            @click="clearSearch"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
            :title="t('detailSession.clearSearch')"
          >
            <AppIcon name="x" :size="14" />
          </button>
        </div>
        <div v-if="searchTerm" class="text-center mt-2 text-sm text-text-secondary">
          {{ t("detailSession.searchFor") }} : "{{ searchTerm }}"
        </div>
      </div>

      <!-- Filtre : masquer les textes entièrement réservés (non sticky) -->
      <div class="flex justify-center mb-8 -mt-4">
        <label class="inline-flex items-center gap-2.5 cursor-pointer">
          <span class="relative inline-flex items-center">
            <input type="checkbox" v-model="showOnlyAvailable" class="sr-only peer" />
            <span
              class="w-9 h-5 bg-black/15 rounded-full peer peer-checked:bg-primary transition-colors dark:bg-white/20"
            ></span>
            <span
              class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"
            ></span>
          </span>
          <span class="text-sm font-medium text-text-secondary">
            {{ t("detailSession.availableOnly") }}
          </span>
        </label>
      </div>

      <!-- Liste des textes groupés par livre -->
      <TextStudiesList
        :grouped-text-studies="groupedTextStudies"
        :session="session"
        :reservations="reservations"
        :current-user="currentUser"
        :guest-email="reservationForm.email"
        :selected-items="selectedItems"
        :is-reserving="isReserving"
        @item-click="handleItemClick"
        @toggle-completion="toggleReservationCompletion"
        @toggle-select-all="handleToggleSelectAll"
      />

      <!-- CTA : inviter le visiteur à créer sa propre session -->
      <section class="mt-14 mb-2">
        <div class="card p-6 max-w-3xl mx-auto text-center">
          <h3 class="text-xl md:text-2xl font-bold text-text-primary mb-2">
            {{ t("detailSession.createYourOwnTitle") }}
          </h3>
          <p class="text-text-secondary max-w-xl mx-auto mb-6 leading-relaxed">
            {{ t("detailSession.createYourOwnText") }}
          </p>
          <button @click="router.push('/share-reading')" class="btn btn-primary">
            <AppIcon name="plus" :size="16" />
            {{ t("detailSession.createYourOwnButton") }}
          </button>
        </div>
      </section>
    </div>

    <!-- Sticky Bottom Bar pour Confirmation -->
    <BatchSelectionBar
      v-if="hasSelectedItems"
      :count="selectedItems.size"
      :loading="isSubmittingBatch"
      :label="confirmButtonLabel"
      :button-text="t('common.confirm')"
      :button-loading-text="t('detailSession.reserving')"
      @confirm="confirmReservations"
    />

    <!-- Modal d'incitation à la création de compte -->
    <SignupPromptModal v-model:show="showSignupPrompt" :guest-email="reservationForm.email" />

    <!-- Modal de partage -->
    <ShareModal
      v-model:show="showShareModal"
      :session-name="session?.name || ''"
      :share-url="shareUrl"
      :session-type="session?.type"
    />
  </main>
</template>
