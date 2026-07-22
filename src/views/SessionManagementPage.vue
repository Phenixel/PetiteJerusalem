<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import { sessionService } from "../services/sessionService";
import { reservationService, type ReservationForm } from "../services/reservationService";
import { authService } from "../services/authService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../services/hebrewNumerals";
import type { Session, TextStudy } from "../models/models";
import type { User } from "../services/authService";
import { seoService } from "../services/seoService";

import BatchSelectionBar from "../components/BatchSelectionBar.vue";
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
const selectedTextStudy = ref<TextStudy | null>(null);
const selectedSection = ref<number | undefined>(undefined);

const selectedItems = ref<Set<string>>(new Set());
const isSubmittingBatch = ref(false);

const guestForm = ref<ReservationForm>({
  name: "",
  email: "",
});

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
      router.push("/profile");
      return;
    }

    if (!sessionService.canManageSession(session.value, currentUser.value)) {
      router.push("/profile");
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
    router.push("/profile");
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

const openGuestForm = (textStudy: TextStudy, section?: number) => {
  selectedTextStudy.value = textStudy;
  selectedSection.value = section;
  showGuestForm.value = true;
  guestForm.value = { name: "", email: "" };
};

const createGuestReservation = async () => {
  if (!guestForm.value.name || !session.value) {
    return;
  }

  // L'email reste l'identifiant de l'invité quand il est fourni (il pourra
  // récupérer ses réservations en créant un compte). Sans email, un UUID
  // jetable sert d'identifiant : seule la page de gestion pourra l'annuler.
  const guestId = guestForm.value.email.trim() || `guest-${crypto.randomUUID()}`;

  try {
    isLoading.value = true;
    let createdCount = 0;

    if (selectedItems.value.size > 0) {
      isSubmittingBatch.value = true;
      const itemsToReserve = Array.from(selectedItems.value).map((key) => {
        const [textId, sectionStr] = key.split("#");
        return {
          textId,
          section: sectionStr === "full" ? undefined : parseInt(sectionStr),
        };
      });

      const unreservedItems = itemsToReserve.filter(
        (item) => item.section === undefined || !isSectionReserved(item.textId, item.section),
      );

      // Une seule transaction atomique : soit tout passe, soit rien
      // (la boucle précédente pouvait laisser un état partiel en cas d'échec).
      if (unreservedItems.length > 0) {
        await reservationService.createBatchReservations(
          session.value.id,
          unreservedItems.map((item) => ({ textStudyId: item.textId, section: item.section })),
          undefined, // userId
          guestId, // email si fourni, sinon UUID jetable
          undefined, // userName
          guestForm.value.name, // guestName
        );
        createdCount++;
      }

      selectedItems.value.clear();
    } else if (selectedTextStudy.value) {
      await reservationService.createReservation(
        session.value.id,
        selectedTextStudy.value.id,
        selectedSection.value,
        undefined, // userId
        guestId, // email si fourni, sinon UUID jetable
        undefined, // userName
        guestForm.value.name, // guestName
      );
      createdCount++;
    }

    await reloadSession();
    showGuestForm.value = false;
    if (createdCount > 0) {
      toast.success(t("sessionManagement.reservationCreatedSuccess", createdCount));
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

const openBatchGuestForm = () => {
  selectedTextStudy.value = null;
  selectedSection.value = undefined;
  showGuestForm.value = true;
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

const deleteReservation = async (reservationId: string) => {
  if (!confirm(t("sessionManagement.deleteReservationConfirm"))) {
    return;
  }

  if (!session.value) return;

  try {
    await sessionService.deleteReservation(session.value.id, reservationId);
    await reloadSession();
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    toast.errorFromException(error, t("sessionManagement.reservationDeleteError"));
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

const goBackToProfile = () => {
  router.push("/profile");
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
        <button @click="goBackToProfile" class="back-link mb-6">
          <AppIcon name="chevron-left" :size="14" />
          {{ t("sessionManagement.backToProfile") }}
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
          <div class="flex gap-2">
            <span class="chip bg-primary/10 text-primary">{{
              sessionService.formatTextType(session.type)
            }}</span>
            <span class="chip bg-black/5 text-text-secondary dark:bg-white/10"
              >{{ t("common.dateLimit") }} :
              {{ sessionService.formatDate(session.dateLimit) }}</span
            >
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

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="textStudy in texts"
              :key="textStudy.id"
              class="card p-5 flex flex-col h-full"
            >
              <!-- En-tête du texte -->
              <div class="mb-4">
                <div class="flex justify-between items-start gap-4 mb-1.5">
                  <h4 class="font-bold text-lg text-text-primary leading-tight">
                    {{ appendHebrewNumeral(sessionService.formatBookName(textStudy.name)) }}
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
                <div class="space-y-1 max-h-[240px] overflow-y-auto pr-2">
                  <div
                    v-for="section in sessionService.generateChapters(textStudy.totalSections)"
                    :key="section"
                    class="flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm"
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
                    <div class="flex flex-col min-w-0">
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

                    <div class="flex items-center gap-2 ml-2">
                      <input
                        v-if="!isSectionReserved(textStudy.id, section)"
                        type="checkbox"
                        class="w-4.5 h-4.5 rounded accent-primary cursor-pointer"
                        :checked="isSelected(textStudy.id, section)"
                        @change="toggleSelection(textStudy.id, section)"
                      />

                      <button
                        v-if="!isSectionReserved(textStudy.id, section)"
                        @click="openGuestForm(textStudy, section)"
                        class="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:bg-primary hover:text-white transition-colors focus:outline-none"
                        :title="t('sessionManagement.reserveForGuest')"
                      >
                        <AppIcon name="plus" :size="14" />
                      </button>

                      <div v-else class="flex items-center gap-2">
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

                        <button
                          @click="
                            deleteReservation(getSectionReservation(textStudy.id, section)!.id)
                          "
                          class="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:bg-red-600/10 hover:text-red-600 transition-colors focus:outline-none dark:hover:text-red-400"
                          :title="t('sessionManagement.deleteReservation')"
                        >
                          <AppIcon name="trash" :size="14" />
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
    </div>

    <!-- Sticky Bottom Bar pour Batch -->
    <BatchSelectionBar
      :count="selectedItems.size"
      :loading="isSubmittingBatch"
      :label="t('sessionManagement.batchLabel')"
      :button-text="t('sessionManagement.batchButton')"
      :button-loading-text="t('sessionManagement.batchLoading')"
      @confirm="openBatchGuestForm"
    />

    <!-- Modal pour les invités -->
    <div
      v-if="showGuestForm"
      class="modal-overlay animate-[fadeIn_0.3s_ease]"
      @click="showGuestForm = false"
    >
      <div class="modal-panel animate-[scaleIn_0.3s_ease]" @click.stop>
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-text-primary">
            {{
              selectedItems.size > 0
                ? t("sessionManagement.reserveCountTitle", { count: selectedItems.size })
                : t("sessionManagement.reserveForGuest")
            }}
          </h3>
          <button @click="showGuestForm = false" class="icon-btn" :aria-label="t('common.close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <div class="space-y-4">
          <div
            v-if="selectedTextStudy"
            class="p-3 bg-primary/10 rounded-lg text-sm text-text-primary mb-2"
          >
            <span class="font-semibold">{{
              appendHebrewNumeral(sessionService.formatBookName(selectedTextStudy?.name || ""))
            }}</span>
            <span v-if="selectedSection">
              – {{ t("common.chapter") }} {{ formatNumberWithHebrew(selectedSection) }}</span
            >
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">{{
              t("sessionManagement.guestName")
            }}</label>
            <input
              v-model="guestForm.name"
              type="text"
              class="field"
              :placeholder="t('sessionManagement.guestNamePlaceholder')"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-text-secondary mb-2">
              {{ t("sessionManagement.guestEmail") }}
              <span class="font-normal text-text-secondary/70">
                ({{ t("guestForm.optional") }})
              </span>
            </label>
            <input
              v-model="guestForm.email"
              type="email"
              class="field"
              placeholder="email@example.com"
            />
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="showGuestForm = false" class="btn btn-soft flex-1">
              {{ t("common.cancel") }}
            </button>
            <button
              @click="createGuestReservation"
              class="btn btn-primary flex-1"
              :disabled="!guestForm.name || isLoading"
            >
              <AppIcon v-if="isLoading" name="spinner" :size="15" class="animate-spin" />
              {{ isLoading ? t("sessionManagement.creating") : t("sessionManagement.create") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
