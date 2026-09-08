<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import { sessionService } from "../services/sessionService";
import {
  reservationService,
  ReservationGoneError,
  type ReservationForm,
} from "../services/reservationService";
import { SearchService } from "../services/searchService";
import { TextTypeService } from "../services/textTypeService";
import { DateService } from "../services/dateService";
import { authService } from "../services/authService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../services/hebrewNumerals";
import type { Session, TextStudy, TextStudyReservation } from "../models/models";
import type { User } from "../services/authService";
import { seoService, pageTitle } from "../services/seoService";
import { analyticsService } from "../services/analyticsService";

import BatchSelectionBar from "../components/BatchSelectionBar.vue";
import EditSessionModal from "../components/EditSessionModal.vue";
import AppIcon from "../components/icons/AppIcon.vue";
import { liveValue } from "../composables/liveInput";
import { useConfirm } from "../composables/useConfirm";
import { useOverlay } from "../composables/useOverlayStack";
import {
  chaptersOf,
  parseSlotKey,
  slotKey,
  useReservationIndex,
  type TextDisplayStatus,
} from "../composables/useReservationIndex";
import { useSessionEditing, type SessionEditData } from "../composables/useSessionEditing";
import { SITE_URL } from "../config/site";

const router = useRouter();
const { t } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();
const sessionEditing = useSessionEditing("session_management");

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
const showRenameModal = computed(() => renameTarget.value !== null);

// Le bouton retour d'Android ferme ces modales avant de quitter la page.
useOverlay(showGuestForm, () => (showGuestForm.value = false));
useOverlay(showRenameModal, () => (renameTarget.value = null));

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

    // Les textes de la chaîne (livres retenus à la création), comme sur la
    // page publique : gérer un livre qui n'en fait pas partie n'a pas de sens.
    textStudies.value = sessionService.getSessionTextStudies(session.value);

    // Toute cette page était hors du suivi : les actions de tenue d'une chaîne
    // (attribuer des sections à un invité, en supprimer, renommer quelqu'un,
    // clore la chaîne) ne se lisaient nulle part. `session_management_opened`
    // en est le dénominateur commun.
    analyticsService.capture("session_management_opened", {
      session_id: session.value.id,
      text_type: session.value.type,
      reservations_count: session.value.reservations?.length ?? 0,
      is_ended: session.value.isEnded === true,
    });

    const url = SITE_URL + `/session-management/${sessionId}`;
    seoService.setMeta({
      title: pageTitle(session.value.name, t("seo.sessionManagementTitle")),
      description: t("seo.sessionManagementDescription", { name: session.value.name }),
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
    filtered = SearchService.filterTextStudiesBySearch(filtered, searchTerm.value);
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

// Les index partagés avec la page publique : réservations actives (les
// tirages expirés s'affichent « disponible » partout, la gestion doit dire la
// même chose), emplacement → réservation, texte → statut.
const {
  activeReservations,
  reservationAt,
  statusOf,
  statusIndex,
  availableSections,
  selectAllAvailable,
} = useReservationIndex(session, textStudies);

// Nombre de réservations actives par texte, pour l'en-tête des cartes.
const reservationsCountByText = computed(() => {
  const counts = new Map<string, number>();
  for (const r of activeReservations.value) {
    counts.set(r.textStudyId, (counts.get(r.textStudyId) ?? 0) + 1);
  }
  return counts;
});

/*
 * Tout ce que le gabarit affiche est préparé ici, une fois par changement de
 * réservations ou de sélection : une carte par texte, une ligne par chapitre,
 * avec sa réservation et son état coché. Avant, le gabarit appelait jusqu'à
 * quinze fonctions par ligne, réévaluées à chaque rendu pour chaque carte.
 */
interface SectionRow {
  section: number;
  reservation: TextStudyReservation | undefined;
  /** Case cochée : la réservation à supprimer, ou la section libre à réserver. */
  checked: boolean;
}

interface TextCard {
  text: TextStudy;
  status: TextDisplayStatus;
  reservationsCount: number;
  availableCount: number;
  allAvailableSelected: boolean;
  rows: SectionRow[];
}

const cardOf = (text: TextStudy): TextCard => {
  const available = availableSections(text);
  const availableKeys = available.map((section) => slotKey(text.id, section));
  return {
    text,
    status: statusOf(text),
    reservationsCount: reservationsCountByText.value.get(text.id) ?? 0,
    availableCount: available.length,
    allAvailableSelected:
      availableKeys.length > 0 && availableKeys.every((key) => selectedItems.value.has(key)),
    rows: chaptersOf(text.totalSections).map((section) => {
      const reservation = reservationAt(text.id, section);
      return {
        section,
        reservation,
        checked: reservation
          ? selectedReservations.value.has(reservation.id)
          : selectedItems.value.has(slotKey(text.id, section)),
      };
    }),
  };
};

const groupedCards = computed(() => {
  const groups: Record<string, TextCard[]> = {};
  for (const [bookName, texts] of Object.entries(groupedTextStudies.value)) {
    groups[bookName] = texts.map(cardOf);
  }
  return groups;
});

// Invités déjà présents dans la session, dédoublonnés par identifiant. Sans
// cette liste, réattribuer un chapitre à quelqu'un qui a déjà réservé créait un
// invité de plus : même nom, identifiant différent, réservations dispersées.
const sessionGuests = computed(() => {
  const byGuestId = new Map<string, { guestId: string; name: string; count: number }>();

  for (const reservation of activeReservations.value) {
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
    // Pas de isLoading ici : il remplace toute la page par un spinner, ce qui
    // démonte la liste, perd le défilement et la carte en cours. Le bouton de
    // la modale a son propre état (isSubmittingBatch).
    isSubmittingBatch.value = true;

    const itemsToReserve = Array.from(selectedItems.value).map(parseSlotKey);

    const unreservedItems = itemsToReserve.filter(
      (item) => reservationAt(item.textStudyId, item.section) === undefined,
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
      // Le créateur inscrit lui-même quelqu'un qui a réservé hors ligne (au
      // téléphone, à la synagogue). Ces réservations n'ont jamais de
      // `reservation_completed` : sans cet événement, elles gonflaient les
      // compteurs de la chaîne sans que rien n'explique d'où elles venaient.
      analyticsService.capture("guest_reservation_created", {
        session_id: session.value.id,
        text_type: session.value.type,
        sections_count: unreservedItems.length,
        // Invité déjà connu de la chaîne, ou nouveau nom saisi de zéro.
        is_existing_guest: selectedGuestId.value != null,
        guest_has_email: guestForm.value.email.trim() !== "",
        source: "session_management",
      });
      toast.success(t("sessionManagement.reservationCreatedSuccess", unreservedItems.length));
    }
  } catch (error) {
    console.error("Erreur lors de la création de la réservation:", error);
    analyticsService.capture("guest_reservation_failed", {
      session_id: session.value?.id,
      sections_count: selectedItems.value.size,
      error_message: error instanceof Error ? error.message : String(error),
      source: "session_management",
    });
    toast.errorFromException(error, t("sessionManagement.reservationCreateError"));
  } finally {
    isSubmittingBatch.value = false;
  }
};

const toggleSelection = (textId: string, section: number) => {
  const key = slotKey(textId, section);
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key);
  } else {
    selectedItems.value.add(key);
  }
};

// Cocher les 150 chapitres d'un livre un par un n'était pas tenable pour
// attribuer un texte entier à un lecteur.
const toggleSelectAll = (text: TextStudy) => {
  selectAllAvailable(text, selectedItems.value);
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

/** La case d'une ligne : la réservation à supprimer, ou la section à réserver. */
const toggleRow = (text: TextStudy, row: SectionRow) => {
  if (row.reservation) toggleReservationSelection(row.reservation.id);
  else toggleSelection(text.id, row.section);
};

const deleteSelectedReservations = async () => {
  if (!session.value || selectedReservations.value.size === 0) return;

  const count = selectedReservations.value.size;
  const accepted = await confirm({
    title: t("sessionManagement.deleteReservationsConfirm", count),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) {
    return;
  }

  try {
    isDeletingBatch.value = true;
    await reservationService.deleteReservations(
      session.value.id,
      Array.from(selectedReservations.value),
    );
    selectedReservations.value.clear();
    await reloadSession();
    // Distinct de `reservation_cancelled` : ici c'est le créateur qui libère
    // les sections de quelqu'un d'autre (participant injoignable, doublon),
    // pas le participant qui rend les siennes.
    analyticsService.capture("session_reservations_deleted", {
      session_id: session.value.id,
      text_type: session.value.type,
      reservations_count: count,
      source: "session_management",
    });
    toast.success(t("sessionManagement.reservationsDeletedSuccess", count));
  } catch (error) {
    console.error("Erreur lors de la suppression des réservations:", error);
    analyticsService.capture("session_reservations_delete_failed", {
      session_id: session.value?.id,
      reservations_count: count,
      error_message: error instanceof Error ? error.message : String(error),
      source: "session_management",
    });
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
    await reservationService.renameGuest(session.value.id, target.id, renameName.value);
    await reloadSession();
    renameTarget.value = null;
    // Pas de nom dans les propriétés : ce sont des noms de personnes. Le
    // volume suffit à dire si la correction de coquille sert vraiment.
    analyticsService.capture("session_guest_renamed", {
      session_id: session.value.id,
      source: "session_management",
    });
    toast.success(t("sessionManagement.guestRenamedSuccess"));
  } catch (error) {
    console.error("Erreur lors du renommage de l'invité:", error);
    analyticsService.capture("session_guest_rename_failed", {
      session_id: session.value?.id,
      error_message: error instanceof Error ? error.message : String(error),
      source: "session_management",
    });
    toast.errorFromException(error, t("sessionManagement.guestRenameError"));
  } finally {
    isRenaming.value = false;
  }
};

const saveSessionChanges = async (sessionData: SessionEditData): Promise<boolean> => {
  const current = session.value;
  if (!current) return false;

  const saved = await sessionEditing.saveSession(current, sessionData);
  if (saved) session.value = sessionEditing.edited(current, sessionData);
  return saved;
};

const endCurrentSession = async () => {
  const current = session.value;
  if (!current) return;
  if (await sessionEditing.endSession(current, textStudies.value)) {
    session.value = sessionEditing.ended(current);
  }
};

const removeLocalReservation = (reservationId: string) => {
  const current = session.value;
  if (!current?.reservations) return;
  const index = current.reservations.findIndex((r) => r.id === reservationId);
  if (index > -1) current.reservations.splice(index, 1);
  selectedReservations.value.delete(reservationId);
};

const toggleReservationCompletion = async (
  reservation: TextStudyReservation,
  isCompleted: boolean,
) => {
  if (!session.value) return;

  // Optimiste : l'interrupteur bascule tout de suite, et revient en arrière
  // si l'écriture échoue. Relire toute la session pour une bascule
  // redessinait la page entière.
  const previous = reservation.isCompleted;
  reservation.isCompleted = isCompleted;

  try {
    await reservationService.markReservationAsCompleted(
      session.value.id,
      reservation.id,
      isCompleted,
    );
    analyticsService.capture("section_marked_read", {
      session_id: session.value.id,
      marked: isCompleted,
      // Le créateur coche pour quelqu'un d'autre : jamais un invité ici.
      is_guest: false,
      source: "session_management",
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    reservation.isCompleted = previous;
    analyticsService.capture("section_mark_read_failed", {
      session_id: session.value?.id,
      marked: isCompleted,
      is_guest: false,
      error_message: error instanceof Error ? error.message : String(error),
      source: "session_management",
    });
    // La place a été reprise entre-temps : elle disparaît de la liste, et le
    // message le dit (errors.reservationGone).
    if (error instanceof ReservationGoneError) removeLocalReservation(reservation.id);
    toast.errorFromException(error, t("sessionManagement.reservationUpdateError"));
  }
};

const reloadSession = async () => {
  if (!session.value) return;

  try {
    const updatedSession = await sessionService.getSessionById(session.value.id);
    if (updatedSession) {
      session.value = updatedSession;
      // Une réservation cochée qui n'existe plus (supprimée, reprise) ne doit
      // pas rester dans la sélection : la barre compterait un fantôme.
      const ids = new Set((updatedSession.reservations ?? []).map((r) => r.id));
      selectedReservations.value = new Set(
        Array.from(selectedReservations.value).filter((id) => ids.has(id)),
      );
    }
  } catch (error) {
    console.error("Erreur lors du rechargement de la session:", error);
  }
};

const sessionStats = computed(() => {
  const current = session.value;
  if (!current) {
    return {
      totalReservations: 0,
      completedReservations: 0,
      completionRate: 0,
      totalTexts: 0,
      reservedTexts: 0,
      reservationRate: 0,
    };
  }

  // Le même calcul que la page publique et la carte d'aperçu.
  const stats = sessionService.getSessionReservationStats(current, textStudies.value);
  const totalTexts = textStudies.value.length;
  let reservedTexts = 0;
  for (const status of statusIndex.value.values()) {
    if (status.status !== "available") reservedTexts++;
  }

  return {
    totalReservations: stats.reserved,
    completedReservations: stats.read,
    completionRate: stats.reserved > 0 ? Math.round((stats.read / stats.reserved) * 100) : 0,
    totalTexts,
    reservedTexts,
    reservationRate: totalTexts > 0 ? Math.round((reservedTexts / totalTexts) * 100) : 0,
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
                TextTypeService.formatType(session.type)
              }}</span>
              <span class="chip bg-black/5 text-text-secondary dark:bg-white/10">{{
                t("common.dateLimitValue", { date: DateService.formatDate(session.dateLimit) })
              }}</span>
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
            :value="searchTerm"
            @input="searchTerm = liveValue($event)"
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
          v-for="(cards, bookName) in groupedCards"
          :key="bookName"
          class="animate-[fadeIn_0.5s_ease]"
        >
          <h3 class="text-2xl font-bold text-text-primary mb-6">
            {{ sessionService.formatBookName(String(bookName)) }}
          </h3>

          <!-- items-start : sans hauteur imposée, chaque carte s'arrête après
               son dernier chapitre au lieu de s'étirer sur la plus longue. -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            <div v-for="card in cards" :key="card.text.id" class="card p-5 flex flex-col">
              <!-- En-tête du texte -->
              <div class="mb-4">
                <div class="flex justify-between items-start gap-4 mb-1.5">
                  <!-- Nom complet, hébreu compris, comme partout ailleurs :
                       formatBookName ne gardait que la translittération. -->
                  <h4 class="font-bold text-lg text-text-primary leading-tight">
                    {{ appendHebrewNumeral(card.text.name) }}
                  </h4>
                  <!-- « Disponible » sans couleur, comme sur la page publique :
                       le vert est réservé à ce qui est lu. -->
                  <span
                    class="chip"
                    :class="{
                      'bg-black/5 text-text-secondary dark:bg-white/10':
                        card.status.status === 'available',
                      'bg-red-600/10 text-red-700 dark:text-red-300':
                        card.status.status === 'fully_reserved',
                      'bg-amber-500/10 text-amber-700 dark:text-amber-200':
                        card.status.status === 'partially_reserved',
                    }"
                  >
                    {{
                      card.status.status === "available"
                        ? t("sessionManagement.status.available")
                        : card.status.status === "fully_reserved"
                          ? t("sessionManagement.status.fullyReserved")
                          : t("sessionManagement.status.partiallyReserved")
                    }}
                  </span>
                </div>

                <div class="flex items-center justify-between text-xs text-text-secondary">
                  <span>{{
                    t("sessionManagement.reservationsCount", { count: card.reservationsCount })
                  }}</span>
                  <span
                    v-if="card.status.reservedBy"
                    class="truncate max-w-[120px]"
                    :title="card.status.reservedBy"
                  >
                    {{ t("sessionManagement.reservedBy", { name: card.status.reservedBy }) }}
                  </span>
                </div>
              </div>

              <!-- Gestion des réservations -->
              <div class="flex-1 flex flex-col">
                <div v-if="card.availableCount > 1" class="flex justify-end mb-1">
                  <button
                    @click="toggleSelectAll(card.text)"
                    class="text-xs font-semibold text-primary hover:underline"
                  >
                    {{
                      card.allAvailableSelected
                        ? t("sessionManagement.deselectAll")
                        : t("sessionManagement.selectAll")
                    }}
                  </button>
                </div>

                <!-- Pas de hauteur maximale : un scroll par carte, à l'intérieur
                     du scroll de la page, faisait perdre les chapitres du bas. -->
                <div class="space-y-1">
                  <div
                    v-for="row in card.rows"
                    :key="row.section"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
                    :class="{
                      'bg-primary/5 dark:bg-primary/10':
                        row.reservation && !row.reservation.isCompleted,
                      'bg-green-600/5 dark:bg-green-500/10': row.reservation?.isCompleted,
                      'hover:bg-black/[0.03] dark:hover:bg-white/5': !row.reservation,
                    }"
                  >
                    <!-- Une seule case par ligne : elle réserve la section
                         libre, ou sélectionne la réservation à supprimer. -->
                    <input
                      type="checkbox"
                      class="w-4.5 h-4.5 rounded cursor-pointer shrink-0"
                      :class="row.reservation ? 'accent-red-600' : 'accent-primary'"
                      :checked="row.checked"
                      :aria-label="
                        row.reservation
                          ? t('sessionManagement.selectReservation')
                          : t('sessionManagement.selectSection')
                      "
                      @change="toggleRow(card.text, row)"
                    />

                    <div class="flex flex-col min-w-0 flex-1">
                      <span class="font-medium text-text-primary">
                        {{
                          card.text.totalSections > 1
                            ? `${t("common.chapter")} ${formatNumberWithHebrew(row.section)}`
                            : t("sessionManagement.fullText")
                        }}
                      </span>
                      <span
                        v-if="row.reservation"
                        class="text-xs text-text-secondary truncate mt-0.5"
                      >
                        {{ row.reservation.chosenByName || t("detailSession.textList.someone") }}
                      </span>
                    </div>

                    <div v-if="row.reservation" class="flex items-center gap-1.5">
                      <label
                        class="relative inline-flex items-center cursor-pointer"
                        :title="t('sessionManagement.markCompleted')"
                      >
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          :checked="row.reservation.isCompleted"
                          @change="
                            toggleReservationCompletion(
                              row.reservation,
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
                        v-if="!row.reservation.chosenById"
                        @click="openRenameModal(row.reservation)"
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
    <BatchSelectionBar :count="selectedItems.size + selectedReservations.size" :label="batchLabel">
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
            {{ t("sessionManagement.reserveCountTitle", selectedItems.size) }}
          </h3>
          <button @click="showGuestForm = false" class="icon-btn" :aria-label="t('common.close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <form @submit.prevent="createGuestReservation" class="space-y-4">
          <div>
            <label for="guest-name" class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("sessionManagement.guestName")
            }}</label>
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
              :disabled="!guestForm.name || isSubmittingBatch"
            >
              <AppIcon v-if="isSubmittingBatch" name="spinner" :size="15" class="animate-spin" />
              {{
                isSubmittingBatch ? t("sessionManagement.creating") : t("sessionManagement.create")
              }}
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

    <EditSessionModal v-model:show="showEditModal" :session="session" :save="saveSessionChanges" />
  </main>
</template>
