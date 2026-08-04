<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import { sessionService } from "../services/sessionService";
import { reservationService, type ReservationForm } from "../services/reservationService";
import { authService } from "../services/authService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../services/hebrewNumerals";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import type { User } from "../services/authService";
import { seoService } from "../services/seoService";

import BatchSelectionBar from "../components/BatchSelectionBar.vue";
import EditSessionModal from "../components/EditSessionModal.vue";
import AppIcon from "../components/icons/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const currentUser = ref<User | null>(null);
const session = ref<Session | null>(null);
const textStudies = ref<TextStudy[]>([]);
const searchTerm = ref("");
const selectedBook = ref<string>("");
const showGuestForm = ref(false);

// Les cases à cocher sont la seule mécanique de la page : les sections libres
// cochées partent en réservation, les réservations cochées en suppression.
// Un bouton d'action par ligne (réserver / supprimer) doublonnait avec elles et
// rendait la sélection multiple confuse.
const selectedItems = ref<Set<string>>(new Set());
const selectedReservations = ref<Set<string>>(new Set());
const isSubmittingBatch = ref(false);
const isDeletingBatch = ref(false);

// Gestion de la session depuis la page qui sert à la piloter.
const showEditModal = ref(false);

// Correction du nom d'un invité inscrit depuis cette page.
const renameTarget = ref<TextStudyReservation | null>(null);
const renameName = ref("");
const isRenaming = ref(false);

const guestForm = ref<ReservationForm>({
  name: "",
  email: "",
});

// Invité repris dans la liste des participants existants : son identifiant
// prime sur l'email saisi, les nouvelles réservations lui sont rattachées.
const selectedGuestId = ref<string | null>(null);
const guestNameInput = ref<HTMLInputElement | null>(null);
const showGuestSuggestions = ref(false);
const activeSuggestion = ref(-1);

const loadData = async () => {
  try {
    isLoading.value = true;

    currentUser.value = await authService.getCurrentUser();
    if (!currentUser.value) {
      router.push("/");
      return;
    }

    const sessionId = router.currentRoute.value.params.id as string;
    session.value = await sessionService.getSessionById(sessionId);

    if (!session.value) {
      router.push("/share-reading");
      return;
    }

    if (!sessionService.canManageSession(session.value, currentUser.value)) {
      router.push("/share-reading");
      return;
    }

    textStudies.value = await sessionService.getTextStudiesByType(session.value.type);

    const url = window.location.origin + `/session-management/${sessionId}`;
    seoService.setMeta({
      title: `Gestion de session - ${session.value.name} | Petite Jerusalem`,
      description: `Gérez les réservations et le suivi de la session "${session.value.name}".`,
      canonical: url,
      og: { url },
    });
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    router.push("/share-reading");
  } finally {
    isLoading.value = false;
  }
};

const filteredTextStudies = computed(() => {
  let filtered = textStudies.value;

  if (searchTerm.value) {
    filtered = sessionService.filterTextStudiesBySearch(filtered, searchTerm.value);
  }

  if (selectedBook.value) {
    filtered = filtered.filter((text) => text.livre === selectedBook.value);
  }

  return filtered;
});

const groupedTextStudies = computed(() => {
  return sessionService.groupTextStudiesByBook(filteredTextStudies.value);
});

const availableBooks = computed(() => {
  const books = new Set(textStudies.value.map((text) => text.livre));
  return Array.from(books).sort();
});

const getTextStatus = (textStudy: TextStudy) => {
  return reservationService.getTextDisplayStatus(textStudy.id, textStudy, session.value!);
};

const getTextReservations = (textStudyId: string) => {
  return session.value?.reservations?.filter((r) => r.textStudyId === textStudyId) || [];
};

const isSectionReserved = (textStudyId: string, section: number) => {
  return (
    session.value?.reservations?.some(
      (r) => r.textStudyId === textStudyId && r.section === section,
    ) || false
  );
};

const getSectionReservation = (textStudyId: string, section: number) => {
  return session.value?.reservations?.find(
    (r) => r.textStudyId === textStudyId && r.section === section,
  );
};

// Invités déjà présents dans la session, dédoublonnés par identifiant. Sans
// cette liste, réattribuer un chapitre à quelqu'un qui a déjà réservé créait un
// invité de plus : même nom, identifiant différent, réservations dispersées.
const sessionGuests = computed(() => {
  const byGuestId = new Map<string, { guestId: string; name: string; count: number }>();

  for (const reservation of session.value?.reservations ?? []) {
    if (reservation.chosenById || !reservation.chosenByGuestId) continue;
    const existing = byGuestId.get(reservation.chosenByGuestId);
    if (existing) {
      existing.count++;
    } else {
      byGuestId.set(reservation.chosenByGuestId, {
        guestId: reservation.chosenByGuestId,
        name: reservation.chosenByName || "",
        count: 1,
      });
    }
  }

  return Array.from(byGuestId.values()).sort((a, b) => a.name.localeCompare(b.name));
});

const guestSuggestions = computed(() => {
  const term = guestForm.value.name.trim().toLowerCase();
  const matches = term
    ? sessionGuests.value.filter((guest) => guest.name.toLowerCase().includes(term))
    : sessionGuests.value;
  return matches.slice(0, 6);
});

const selectGuest = (guest: { guestId: string; name: string }) => {
  guestForm.value.name = guest.name;
  selectedGuestId.value = guest.guestId;
  showGuestSuggestions.value = false;
  activeSuggestion.value = -1;
};

const clearSelectedGuest = () => {
  selectedGuestId.value = null;
  activeSuggestion.value = -1;
  // Le champ reprend la main : « Changer » sert à taper un autre nom, et c'est
  // le focus qui rouvre la liste, plutôt qu'elle flotte sous un champ inactif.
  guestNameInput.value?.focus();
};

const onGuestNameInput = () => {
  // Un nom retouché à la main ne désigne plus l'invité choisi dans la liste.
  selectedGuestId.value = null;
  showGuestSuggestions.value = true;
  activeSuggestion.value = -1;
};

const moveSuggestion = (delta: number) => {
  const count = guestSuggestions.value.length;
  if (count === 0) return;
  showGuestSuggestions.value = true;
  const next = activeSuggestion.value + delta;
  activeSuggestion.value = next < 0 ? count - 1 : next >= count ? 0 : next;
};

// Entrée valide la suggestion mise en avant à la flèche, sinon crée directement :
// le gérant qui tape un nom neuf n'a pas à viser le bouton.
const onGuestNameEnter = () => {
  if (showGuestSuggestions.value && activeSuggestion.value >= 0) {
    selectGuest(guestSuggestions.value[activeSuggestion.value]);
    return;
  }
  createGuestReservation();
};

const createGuestReservation = async () => {
  if (!guestForm.value.name || !session.value || selectedItems.value.size === 0) {
    return;
  }

  // Invité repris dans la liste : on réutilise son identifiant pour que toutes
  // ses réservations restent celles d'une seule et même personne. Sinon l'email
  // sert d'identifiant quand il est fourni (il pourra récupérer ses
  // réservations en créant un compte), et à défaut un UUID jetable : seule la
  // page de gestion pourra alors les annuler.
  const guestId =
    selectedGuestId.value || guestForm.value.email.trim() || `guest-${crypto.randomUUID()}`;

  try {
    isLoading.value = true;
    isSubmittingBatch.value = true;

    const itemsToReserve = Array.from(selectedItems.value).map((key) => {
      const [textId, sectionStr] = key.split("#");
      return {
        textStudyId: textId,
        section: sectionStr === "full" ? undefined : parseInt(sectionStr),
      };
    });

    const unreservedItems = itemsToReserve.filter(
      (item) => item.section === undefined || !isSectionReserved(item.textStudyId, item.section),
    );

    // Une seule transaction atomique : soit tout passe, soit rien
    // (la boucle précédente pouvait laisser un état partiel en cas d'échec).
    if (unreservedItems.length > 0) {
      await reservationService.createBatchReservations(
        session.value.id,
        unreservedItems,
        undefined, // userId
        guestId, // email si fourni, sinon UUID jetable
        undefined, // userName
        guestForm.value.name, // guestName
      );
    }

    selectedItems.value.clear();

    await reloadSession();
    showGuestForm.value = false;
    if (unreservedItems.length > 0) {
      toast.success(t("sessionManagement.reservationCreatedSuccess", unreservedItems.length));
    }
  } catch (error) {
    console.error("Erreur lors de la création de la réservation:", error);
    toast.errorFromException(error, t("sessionManagement.reservationCreateError"));
  } finally {
    isLoading.value = false;
    isSubmittingBatch.value = false;
  }
};

const toggleSelection = (textId: string, section?: number) => {
  const key = section ? `${textId}#${section}` : `${textId}#full`;
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key);
  } else {
    selectedItems.value.add(key);
  }
};

const isSelected = (textId: string, section: number) => {
  const key = `${textId}#${section}`;
  return selectedItems.value.has(key);
};

// Sections encore libres d'un texte : cibles du « Tout sélectionner », qui
// évite de cocher 150 chapitres un par un pour un même lecteur.
const availableSections = (textStudy: TextStudy) =>
  sessionService
    .generateChapters(textStudy.totalSections)
    .filter((section) => !isSectionReserved(textStudy.id, section));

const areAllAvailableSelected = (textStudy: TextStudy) => {
  const sections = availableSections(textStudy);
  return sections.length > 0 && sections.every((section) => isSelected(textStudy.id, section));
};

const toggleSelectAll = (textStudy: TextStudy) => {
  const keys = availableSections(textStudy).map((section) => `${textStudy.id}#${section}`);
  if (keys.length === 0) return;

  if (keys.every((key) => selectedItems.value.has(key))) {
    keys.forEach((key) => selectedItems.value.delete(key));
  } else {
    keys.forEach((key) => selectedItems.value.add(key));
  }
};

const openBatchGuestForm = () => {
  guestForm.value = { name: "", email: "" };
  selectedGuestId.value = null;
  showGuestSuggestions.value = false;
  activeSuggestion.value = -1;
  showGuestForm.value = true;
};

const toggleReservationSelection = (reservationId: string) => {
  if (selectedReservations.value.has(reservationId)) {
    selectedReservations.value.delete(reservationId);
  } else {
    selectedReservations.value.add(reservationId);
  }
};

const isReservationSelected = (reservationId: string) =>
  selectedReservations.value.has(reservationId);

const deleteSelectedReservations = async () => {
  if (!session.value || selectedReservations.value.size === 0) return;

  const count = selectedReservations.value.size;
  if (!confirm(t("sessionManagement.deleteReservationsConfirm", count))) {
    return;
  }

  try {
    isDeletingBatch.value = true;
    await sessionService.deleteReservations(
      session.value.id,
      Array.from(selectedReservations.value),
    );
    selectedReservations.value.clear();
    await reloadSession();
    toast.success(t("sessionManagement.reservationsDeletedSuccess", count));
  } catch (error) {
    console.error("Erreur lors de la suppression des réservations:", error);
    toast.errorFromException(error, t("sessionManagement.reservationDeleteError"));
  } finally {
    isDeletingBatch.value = false;
  }
};

const batchLabel = computed(() => {
  if (selectedItems.value.size > 0 && selectedReservations.value.size > 0) {
    return t("sessionManagement.batchMixedLabel");
  }
  if (selectedReservations.value.size > 0) {
    return t("sessionManagement.batchDeleteLabel");
  }
  return t("sessionManagement.batchLabel");
});

// Le nom d'un invité vient de ce que le créateur a tapé : une faute de frappe
// se corrige ici, et sur toutes ses réservations à la fois.
const openRenameModal = (reservation: TextStudyReservation) => {
  renameTarget.value = reservation;
  renameName.value = reservation.chosenByName || "";
};

const submitRename = async () => {
  const target = renameTarget.value;
  if (!session.value || !target || !renameName.value.trim()) return;

  try {
    isRenaming.value = true;
    await sessionService.renameGuest(session.value.id, target.id, renameName.value);
    await reloadSession();
    renameTarget.value = null;
    toast.success(t("sessionManagement.guestRenamedSuccess"));
  } catch (error) {
    console.error("Erreur lors du renommage de l'invité:", error);
    toast.errorFromException(error, t("sessionManagement.guestRenameError"));
  } finally {
    isRenaming.value = false;
  }
};

const saveSessionChanges = async (sessionData: {
  name: string;
  description: string;
  dateLimit: string;
  guestEmailRequired: boolean;
}) => {
  if (!session.value) return;

  try {
    await sessionService.updateSession(session.value.id, {
      ...sessionData,
      slug: session.value.slug,
    });
    await reloadSession();
    toast.success(t("profile.sessionUpdatedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    toast.errorFromException(error, t("profile.sessionUpdateError"));
  }
};

const endCurrentSession = async () => {
  if (!session.value || !confirm(t("profile.endSessionConfirm"))) return;

  try {
    await sessionService.endSession(session.value.id);
    await reloadSession();
    toast.success(t("profile.sessionEndedSuccess"));
  } catch (error) {
    console.error("Erreur lors de la fin de session:", error);
    toast.errorFromException(error, t("profile.sessionEndError"));
  }
};

const toggleReservationCompletion = async (reservationId: string, isCompleted: boolean) => {
  if (!session.value) return;

  try {
    await sessionService.markReservationAsCompleted(session.value.id, reservationId, isCompleted);
    await reloadSession();
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    toast.errorFromException(error, t("sessionManagement.reservationUpdateError"));
  }
};

const reloadSession = async () => {
  if (!session.value) return;

  try {
    const updatedSession = await sessionService.getSessionById(session.value.id);
    if (updatedSession) {
      session.value = updatedSession;
    }
  } catch (error) {
    console.error("Erreur lors du rechargement de la session:", error);
  }
};

const sessionStats = computed(() => {
  if (!session.value)
    return {
      totalReservations: 0,
      completedReservations: 0,
      completionRate: 0,
      totalTexts: 0,
      reservedTexts: 0,
      reservationRate: 0,
    };

  const reservations = session.value.reservations || [];
  const totalReservations = reservations.length;
  const completedReservations = reservations.filter((r) => r.isCompleted).length;
  const completionRate =
    totalReservations > 0 ? (completedReservations / totalReservations) * 100 : 0;

  const totalTexts = textStudies.value.length;
  const reservedTexts = textStudies.value.filter((textStudy) => {
    const status = getTextStatus(textStudy);
    return status.status === "fully_reserved" || status.status === "partially_reserved";
  }).length;
  const reservationRate = totalTexts > 0 ? (reservedTexts / totalTexts) * 100 : 0;

  return {
    totalReservations,
    completedReservations,
    completionRate: Math.round(completionRate),
    totalTexts,
    reservedTexts,
    reservationRate: Math.round(reservationRate),
  };
});

const goBackToSessions = () => {
  router.push("/share-reading");
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <main class="min-h-screen pb-20">
    <!-- Affichage de chargement -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium">{{ t("sessionManagement.loading") }}</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="session" class="max-w-7xl mx-auto px-6 pt-8 animate-[fadeIn_0.5s_ease]">
      <!-- En-tête -->
      <header class="mb-10">
        <button @click="goBackToSessions" class="back-link mb-6">
          <AppIcon name="chevron-left" :size="14" />
          {{ t("sessionManagement.backToSessions") }}
        </button>

        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2 tracking-tight">
              {{ session.name }}
            </h1>
            <p class="text-text-secondary text-lg max-w-2xl">
              {{ session.description }}
            </p>
          </div>
          <div class="flex flex-col items-start md:items-end gap-3">
            <div class="flex flex-wrap gap-2">
              <span class="chip bg-primary/10 text-primary">{{
                sessionService.formatTextType(session.type)
              }}</span>
              <span class="chip bg-black/5 text-text-secondary dark:bg-white/10"
                >{{ t("common.dateLimit") }} :
                {{ sessionService.formatDate(session.dateLimit) }}</span
              >
              <span
                v-if="session.isEnded"
                class="chip bg-black/5 text-text-secondary dark:bg-white/10"
              >
                {{ t("common.finished") }}
              </span>
            </div>

            <!-- Piloter la session sans repasser par « Partage de lectures » -->
            <div class="flex flex-wrap gap-2">
              <button
                v-if="sessionService.canEditSession(session)"
                @click="showEditModal = true"
                class="btn btn-soft !px-3.5 !py-2 !text-sm"
              >
                <AppIcon name="pencil" :size="14" />
                {{ t("common.edit") }}
              </button>
              <button
                v-if="sessionService.canEndSession(session)"
                @click="endCurrentSession"
                class="btn btn-danger !px-3.5 !py-2 !text-sm"
              >
                <AppIcon name="flag" :size="14" />
                {{ t("sessionManagement.endSession") }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Statistiques de la session -->
      <div class="card p-6 mb-12">
        <div class="flex flex-wrap gap-x-12 gap-y-5">
          <div>
            <span class="block text-2xl font-bold text-text-primary">{{
              sessionStats.totalReservations
            }}</span>
            <span class="text-sm text-text-secondary">{{
              t("sessionManagement.stats.reservations")
            }}</span>
          </div>
          <div>
            <span class="block text-2xl font-bold text-green-600 dark:text-green-400">{{
              sessionStats.completedReservations
            }}</span>
            <span class="text-sm text-text-secondary">{{
              t("sessionManagement.stats.completed")
            }}</span>
          </div>
          <div>
            <span class="block text-2xl font-bold text-text-primary"
              >{{ sessionStats.completionRate }}%</span
            >
            <span class="text-sm text-text-secondary">{{
              t("sessionManagement.stats.progress")
            }}</span>
          </div>
          <div>
            <span class="block text-2xl font-bold text-text-primary"
              >{{ sessionStats.reservedTexts }}/{{ sessionStats.totalTexts }}</span
            >
            <span class="text-sm text-text-secondary">{{
              t("sessionManagement.stats.reservedTexts")
            }}</span>
          </div>
          <div>
            <span class="block text-2xl font-bold text-text-primary"
              >{{ sessionStats.reservationRate }}%</span
            >
            <span class="text-sm text-text-secondary">{{
              t("sessionManagement.stats.reservationRate")
            }}</span>
          </div>
        </div>
      </div>

      <!-- Filtres et recherche -->
      <div class="flex flex-col md:flex-row gap-4 mb-8">
        <div class="relative flex-1">
          <AppIcon
            name="search"
            :size="16"
            class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
          />
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="t('sessionManagement.searchPlaceholder')"
            class="field !pl-11"
          />
        </div>

        <div class="w-full md:w-64">
          <select v-model="selectedBook" class="field appearance-none cursor-pointer">
            <option value="">{{ t("sessionManagement.allBooks") }}</option>
            <option v-for="book in availableBooks" :key="book" :value="book">
              {{ sessionService.formatBookName(book) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Liste des textes groupés par livre -->
      <div class="space-y-12">
        <div
          v-for="(texts, bookName) in groupedTextStudies"
          :key="bookName"
          class="animate-[fadeIn_0.5s_ease]"
        >
          <h3 class="text-2xl font-bold text-text-primary mb-6">
            {{ sessionService.formatBookName(bookName) }}
          </h3>

          <!-- items-start : sans hauteur imposée, chaque carte s'arrête après
               son dernier chapitre au lieu de s'étirer sur la plus longue. -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            <div v-for="textStudy in texts" :key="textStudy.id" class="card p-5 flex flex-col">
              <!-- En-tête du texte -->
              <div class="mb-4">
                <div class="flex justify-between items-start gap-4 mb-1.5">
                  <!-- Nom complet, hébreu compris, comme partout ailleurs :
                       formatBookName ne gardait que la translittération. -->
                  <h4 class="font-bold text-lg text-text-primary leading-tight">
                    {{ appendHebrewNumeral(textStudy.name) }}
                  </h4>
                  <span
                    class="chip"
                    :class="{
                      'bg-green-600/10 text-green-700 dark:text-green-300':
                        getTextStatus(textStudy).status === 'available',
                      'bg-red-600/10 text-red-700 dark:text-red-300':
                        getTextStatus(textStudy).status === 'fully_reserved',
                      'bg-amber-500/10 text-amber-700 dark:text-amber-200':
                        getTextStatus(textStudy).status === 'partially_reserved',
                    }"
                  >
                    {{
                      getTextStatus(textStudy).status === "available"
                        ? t("sessionManagement.status.available")
                        : getTextStatus(textStudy).status === "fully_reserved"
                          ? t("sessionManagement.status.fullyReserved")
                          : t("sessionManagement.status.partiallyReserved")
                    }}
                  </span>
                </div>

                <div class="flex items-center justify-between text-xs text-text-secondary">
                  <span>{{
                    t("sessionManagement.reservationsCount", {
                      count: getTextReservations(textStudy.id).length,
                    })
                  }}</span>
                  <span
                    v-if="getTextStatus(textStudy).reservedBy"
                    class="truncate max-w-[120px]"
                    :title="getTextStatus(textStudy).reservedBy || ''"
                  >
                    {{
                      t("sessionManagement.reservedBy", {
                        name: getTextStatus(textStudy).reservedBy,
                      })
                    }}
                  </span>
                </div>
              </div>

              <!-- Gestion des réservations -->
              <div class="flex-1 flex flex-col">
                <!-- Cocher les 150 chapitres d'un livre un par un n'était pas
                     tenable pour attribuer un texte entier à un lecteur. -->
                <div v-if="availableSections(textStudy).length > 1" class="flex justify-end mb-1">
                  <button
                    @click="toggleSelectAll(textStudy)"
                    class="text-xs font-semibold text-primary hover:underline"
                  >
                    {{
                      areAllAvailableSelected(textStudy)
                        ? t("sessionManagement.deselectAll")
                        : t("sessionManagement.selectAll")
                    }}
                  </button>
                </div>

                <!-- Pas de hauteur maximale : un scroll par carte, à l'intérieur
                     du scroll de la page, faisait perdre les chapitres du bas. -->
                <div class="space-y-1">
                  <div
                    v-for="section in sessionService.generateChapters(textStudy.totalSections)"
                    :key="section"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                    :class="{
                      'bg-primary/5 dark:bg-primary/10':
                        isSectionReserved(textStudy.id, section) &&
                        !getSectionReservation(textStudy.id, section)?.isCompleted,
                      'bg-green-600/5 dark:bg-green-500/10': getSectionReservation(
                        textStudy.id,
                        section,
                      )?.isCompleted,
                      'hover:bg-black/[0.03] dark:hover:bg-white/5': !isSectionReserved(
                        textStudy.id,
                        section,
                      ),
                    }"
                  >
                    <!-- Une seule case par ligne : elle réserve la section
                         libre, ou sélectionne la réservation à supprimer. -->
                    <input
                      type="checkbox"
                      class="w-4.5 h-4.5 rounded cursor-pointer shrink-0"
                      :class="
                        isSectionReserved(textStudy.id, section)
                          ? 'accent-red-600'
                          : 'accent-primary'
                      "
                      :checked="
                        isSectionReserved(textStudy.id, section)
                          ? isReservationSelected(getSectionReservation(textStudy.id, section)!.id)
                          : isSelected(textStudy.id, section)
                      "
                      :aria-label="
                        isSectionReserved(textStudy.id, section)
                          ? t('sessionManagement.selectReservation')
                          : t('sessionManagement.selectSection')
                      "
                      @change="
                        isSectionReserved(textStudy.id, section)
                          ? toggleReservationSelection(
                              getSectionReservation(textStudy.id, section)!.id,
                            )
                          : toggleSelection(textStudy.id, section)
                      "
                    />

                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-medium text-text-primary">
                        {{
                          textStudy.totalSections > 1
                            ? `${t("common.chapter")} ${formatNumberWithHebrew(section)}`
                            : t("sessionManagement.fullText")
                        }}
                      </span>
                      <span
                        v-if="isSectionReserved(textStudy.id, section)"
                        class="text-xs text-text-secondary truncate mt-0.5"
                      >
                        {{ getSectionReservation(textStudy.id, section)?.chosenByName }}
                      </span>
                    </div>

                    <div
                      v-if="isSectionReserved(textStudy.id, section)"
                      class="flex items-center gap-1.5"
                    >
                      <label
                        class="relative inline-flex items-center cursor-pointer"
                        :title="t('sessionManagement.markCompleted')"
                      >
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          :checked="getSectionReservation(textStudy.id, section)?.isCompleted"
                          @change="
                            toggleReservationCompletion(
                              getSectionReservation(textStudy.id, section)!.id,
                              ($event.target as HTMLInputElement).checked,
                            )
                          "
                        />
                        <div
                          class="w-8 h-4 bg-black/15 peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-all peer-checked:bg-green-500 dark:bg-white/20 dark:peer-checked:bg-green-600"
                        ></div>
                      </label>

                      <!-- Seuls les invités inscrits ici sont renommables :
                           le nom d'un compte vient de son profil. -->
                      <button
                        v-if="!getSectionReservation(textStudy.id, section)?.chosenById"
                        @click="openRenameModal(getSectionReservation(textStudy.id, section)!)"
                        class="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors focus:outline-none dark:hover:bg-white/10"
                        :title="t('sessionManagement.renameGuest')"
                      >
                        <AppIcon name="pencil" :size="13" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Bar pour Batch : réserver et supprimer partagent la même
         barre, chaque action n'apparaissant que si elle a une sélection. -->
    <BatchSelectionBar
      :count="selectedItems.size + selectedReservations.size"
      :label="batchLabel"
    >
      <template #actions>
        <button
          v-if="selectedItems.size > 0"
          @click="openBatchGuestForm"
          :disabled="isSubmittingBatch"
          class="btn btn-primary"
        >
          <AppIcon v-if="isSubmittingBatch" name="spinner" :size="15" class="animate-spin" />
          <AppIcon v-else name="check" :size="15" />
          {{
            isSubmittingBatch
              ? t("sessionManagement.batchLoading")
              : `${t("sessionManagement.batchButton")} (${selectedItems.size})`
          }}
        </button>
        <button
          v-if="selectedReservations.size > 0"
          @click="deleteSelectedReservations"
          :disabled="isDeletingBatch"
          class="btn btn-danger"
        >
          <AppIcon v-if="isDeletingBatch" name="spinner" :size="15" class="animate-spin" />
          <AppIcon v-else name="trash" :size="15" />
          {{
            isDeletingBatch
              ? t("common.deleting")
              : `${t("common.delete")} (${selectedReservations.size})`
          }}
        </button>
      </template>
    </BatchSelectionBar>

    <!-- Modal pour les invités -->
    <div
      v-if="showGuestForm"
      class="modal-overlay animate-[fadeIn_0.3s_ease]"
      @click="showGuestForm = false"
    >
      <div class="modal-panel animate-[scaleIn_0.3s_ease]" @click.stop>
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-text-primary">
            {{ t("sessionManagement.reserveCountTitle", { count: selectedItems.size }) }}
          </h3>
          <button @click="showGuestForm = false" class="icon-btn" :aria-label="t('common.close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <form @submit.prevent="createGuestReservation" class="space-y-4">
          <div>
            <label
              for="guest-name"
              class="block text-sm font-semibold text-text-secondary mb-2"
              >{{ t("sessionManagement.guestName") }}</label
            >
            <div class="relative">
              <input
                id="guest-name"
                ref="guestNameInput"
                v-model="guestForm.name"
                type="text"
                class="field"
                :placeholder="t('sessionManagement.guestNamePlaceholder')"
                required
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="guest-suggestions"
                :aria-expanded="showGuestSuggestions && guestSuggestions.length > 0"
                @input="onGuestNameInput"
                @focus="showGuestSuggestions = true"
                @blur="showGuestSuggestions = false"
                @keydown.down.prevent="moveSuggestion(1)"
                @keydown.up.prevent="moveSuggestion(-1)"
                @keydown.esc="showGuestSuggestions = false"
                @keydown.enter.prevent="onGuestNameEnter"
              />

              <!-- Les invités de la session, proposés dès la mise au point du
                   champ : réattribuer un chapitre à quelqu'un de déjà présent
                   ne doit pas demander de retaper son nom à l'identique. -->
              <ul
                v-if="showGuestSuggestions && guestSuggestions.length > 0"
                id="guest-suggestions"
                role="listbox"
                class="absolute z-10 left-0 right-0 mt-1 py-1 bg-surface rounded-lg shadow-pop max-h-56 overflow-y-auto"
              >
                <li
                  v-for="(guest, index) in guestSuggestions"
                  :key="guest.guestId"
                  role="option"
                  :aria-selected="index === activeSuggestion"
                  class="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-sm"
                  :class="
                    index === activeSuggestion
                      ? 'bg-primary/10 text-text-primary'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/5'
                  "
                  @mousedown.prevent="selectGuest(guest)"
                >
                  <span class="font-medium text-text-primary truncate">{{ guest.name }}</span>
                  <span class="text-xs text-text-secondary shrink-0">
                    {{ t("sessionManagement.reservationsCount", { count: guest.count }) }}
                  </span>
                </li>
              </ul>
            </div>

            <p
              v-if="selectedGuestId"
              class="flex items-center gap-2 text-xs text-text-secondary mt-2"
            >
              <AppIcon name="check" :size="12" class="text-primary shrink-0" />
              {{ t("sessionManagement.guestLinkedTo", { name: guestForm.name }) }}
              <button
                type="button"
                class="font-semibold text-primary hover:underline"
                @click="clearSelectedGuest"
              >
                {{ t("sessionManagement.guestLinkChange") }}
              </button>
            </p>
          </div>

          <!-- L'email ne sert qu'à identifier un NOUVEL invité : un invité repris
               dans la liste a déjà son identifiant. -->
          <div v-if="!selectedGuestId">
            <label for="guest-email" class="block text-sm font-semibold text-text-secondary mb-2">
              {{ t("sessionManagement.guestEmail") }}
              <span class="font-normal text-text-secondary/70">
                ({{ t("guestForm.optional") }})
              </span>
            </label>
            <input
              id="guest-email"
              v-model="guestForm.email"
              type="email"
              class="field"
              placeholder="email@example.com"
            />
          </div>

          <div class="flex gap-3 mt-6">
            <button type="button" @click="showGuestForm = false" class="btn btn-soft flex-1">
              {{ t("common.cancel") }}
            </button>
            <button
              type="submit"
              class="btn btn-primary flex-1"
              :disabled="!guestForm.name || isLoading"
            >
              <AppIcon v-if="isLoading" name="spinner" :size="15" class="animate-spin" />
              {{ isLoading ? t("sessionManagement.creating") : t("sessionManagement.create") }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Renommer un invité : le nouveau nom s'applique à toutes ses
         réservations dans cette session. -->
    <div
      v-if="renameTarget"
      class="modal-overlay animate-[fadeIn_0.3s_ease]"
      @click="renameTarget = null"
    >
      <div class="modal-panel !max-w-md animate-[scaleIn_0.3s_ease]" @click.stop>
        <div class="flex justify-between items-center mb-5">
          <h3 class="text-xl font-bold text-text-primary">
            {{ t("sessionManagement.renameGuest") }}
          </h3>
          <button @click="renameTarget = null" class="icon-btn" :aria-label="t('common.close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <form @submit.prevent="submitRename" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("sessionManagement.guestName")
            }}</label>
            <input
              v-model="renameName"
              type="text"
              class="field"
              :placeholder="t('sessionManagement.guestNamePlaceholder')"
              required
            />
            <p class="text-xs text-text-secondary mt-2">
              {{ t("sessionManagement.renameGuestHint") }}
            </p>
          </div>

          <div class="flex gap-3 mt-6">
            <button type="button" @click="renameTarget = null" class="btn btn-soft flex-1">
              {{ t("common.cancel") }}
            </button>
            <button
              type="submit"
              class="btn btn-primary flex-1"
              :disabled="!renameName.trim() || isRenaming"
            >
              <AppIcon v-if="isRenaming" name="spinner" :size="15" class="animate-spin" />
              {{ isRenaming ? t("common.saving") : t("common.save") }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <EditSessionModal v-model:show="showEditModal" :session="session" @save="saveSessionChanges" />
  </main>
</template>
