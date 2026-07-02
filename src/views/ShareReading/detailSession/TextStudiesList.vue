<script setup lang="ts">
import { sessionService } from "../../../services/sessionService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../../../services/hebrewNumerals";
import { ref } from "vue";
import type { Session, TextStudy, TextStudyReservation } from "../../../models/models";
import type { User } from "../../../services/authService";
import AppIcon from "../../../components/icons/AppIcon.vue";

const props = defineProps<{
  groupedTextStudies: Record<string, TextStudy[]>;
  session: Session;
  reservations: TextStudyReservation[];
  currentUser: User | null;
  guestEmail: string;
  selectedItems: Set<string>;
  isReserving: string | null;
}>();

const emit = defineEmits<{
  (e: "item-click", textId: string, section?: number): void;
  (e: "toggle-completion", textId: string, section: number): void;
}>();

const expandedTexts = ref<Set<string>>(new Set());

const toggleTextExpansion = (textId: string) => {
  if (expandedTexts.value.has(textId)) {
    expandedTexts.value.delete(textId);
  } else {
    expandedTexts.value.add(textId);
  }
};

const isTextExpanded = (textId: string) => {
  return expandedTexts.value.has(textId);
};

const formatBookName = (bookName: string) => {
  if (bookName === "Mes réservations") return bookName;
  return sessionService.formatBookName(bookName);
};

const generateChapters = (totalSections: number) => {
  return sessionService.generateChapters(totalSections);
};

const isReserved = (textStudyId: string, section?: number) => {
  return sessionService.isTextOrSectionReserved(textStudyId, section, props.session);
};

const isSelected = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`;
  return props.selectedItems.has(key);
};

const getReservation = (textStudyId: string, section?: number) => {
  return props.reservations.find((r) => r.textStudyId === textStudyId && r.section === section);
};

const canCancelReservation = (textStudyId: string, section?: number) => {
  const reservation = getReservation(textStudyId, section);
  if (!reservation) return false;

  return sessionService.canUserDeleteReservation(reservation, props.currentUser, props.guestEmail);
};

const getTextDisplayStatus = (textStudyId: string, text: TextStudy) => {
  // We need to pass text object as well
  return sessionService.getTextDisplayStatus(textStudyId, text, props.session);
};

// Vrai lorsque toutes les sections d'un texte sont réservées ET marquées comme
// lues : on affiche alors « Lu par » plutôt que « Réservé par ».
const isTextFullyRead = (text: TextStudy) => {
  const chapterReservations = props.reservations.filter(
    (r) => r.textStudyId === text.id && r.section !== undefined,
  );
  return (
    chapterReservations.length === text.totalSections &&
    chapterReservations.every((r) => r.isCompleted)
  );
};

const handleCardClick = (text: TextStudy) => {
  if (text.totalSections === 1) {
    // Pour les textes à un seul chapitre, toggle la réservation
    const isDisabled =
      props.isReserving === `${text.id}-1` ||
      (isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1));
    if (!isDisabled) {
      emit("item-click", text.id, 1);
    }
  } else if (!isTextExpanded(text.id)) {
    // Pour les textes à plusieurs chapitres, ouvrir si fermé
    toggleTextExpansion(text.id);
  }
};
</script>

<template>
  <div class="space-y-12">
    <div
      v-for="(texts, bookName) in groupedTextStudies"
      :key="bookName"
      class="animate-[fadeIn_0.5s_ease]"
    >
      <h3 class="text-2xl font-bold text-text-primary mb-6">
        {{ formatBookName(String(bookName)) }}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="text in texts"
          :key="text.id"
          class="card flex flex-col"
          :class="{
            'ring-2 ring-primary/50':
              isSelected(text.id, 1) ||
              (text.totalSections > 1 &&
                generateChapters(text.totalSections).some((c) => isSelected(text.id, c))),
          }"
        >
          <!-- En-tête du texte -->
          <div
            class="p-5 rounded-t-2xl transition-colors"
            :class="{
              'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/5':
                (text.totalSections > 1 && !isTextExpanded(text.id)) ||
                (text.totalSections === 1 &&
                  !(isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1))),
              'cursor-not-allowed opacity-60':
                text.totalSections === 1 &&
                isReserved(text.id, 1).isReserved &&
                !canCancelReservation(text.id, 1),
            }"
            @click="handleCardClick(text)"
          >
            <div class="flex justify-between items-start gap-3">
              <div class="flex-1 min-w-0">
                <h4
                  class="font-bold text-lg text-text-primary leading-tight truncate mb-1"
                  :title="appendHebrewNumeral(text.name)"
                >
                  {{ appendHebrewNumeral(text.name) }}
                </h4>
                <!-- Case à cocher directe pour les textes à un seul chapitre -->
                <label
                  v-if="text.totalSections === 1"
                  class="inline-flex items-center gap-2 cursor-pointer mt-1"
                  @click.stop
                  :class="{
                    'opacity-60 cursor-not-allowed':
                      isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1),
                  }"
                >
                  <input
                    type="checkbox"
                    class="w-5 h-5 rounded accent-primary cursor-pointer"
                    :checked="isReserved(text.id, 1).isReserved || isSelected(text.id, 1)"
                    @change="emit('item-click', text.id, 1)"
                    :disabled="
                      isReserving === `${text.id}-1` ||
                      (isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1))
                    "
                  />
                  <span class="text-sm font-medium text-text-secondary">
                    {{ isSelected(text.id, 1) ? "Sélectionné" : "Réserver" }}
                  </span>
                </label>
              </div>

              <div class="flex items-center gap-1 self-start">
                <router-link
                  :to="{
                    name: 'text-reading',
                    params: { textId: text.id },
                    query: { session: session.slug ?? session.id },
                  }"
                  class="icon-btn !w-8 !h-8 hover:!text-primary"
                  title="Lire ce texte"
                  @click.stop
                >
                  <AppIcon name="book-open" :size="14" />
                </router-link>
                <button
                  v-if="text.totalSections > 1"
                  @click.stop="toggleTextExpansion(text.id)"
                  class="icon-btn !w-8 !h-8"
                  :class="{
                    'bg-black/5 text-text-primary dark:bg-white/10': isTextExpanded(text.id),
                  }"
                >
                  <AppIcon
                    :name="isTextExpanded(text.id) ? 'chevron-up' : 'chevron-down'"
                    :size="14"
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- Statut global du texte -->
          <div class="px-5 pb-4">
            <!-- Pour les textes à un seul chapitre, vérifier le statut de complétion -->
            <div
              v-if="text.totalSections === 1 && isReserved(text.id, 1).isReserved"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <span
                class="chip"
                :class="
                  getReservation(text.id, 1)?.isCompleted
                    ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                "
              >
                <AppIcon
                  :name="getReservation(text.id, 1)?.isCompleted ? 'circle-check' : 'user-clock'"
                  :size="12"
                />
                {{
                  getReservation(text.id, 1)?.isCompleted
                    ? `Lu par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                    : `Réservé par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                }}
              </span>

              <!-- Switch pour marquer comme lu (seulement si c'est notre réservation) -->
              <div v-if="canCancelReservation(text.id, 1)" class="flex items-center gap-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    :checked="getReservation(text.id, 1)?.isCompleted || false"
                    @change="emit('toggle-completion', text.id, 1)"
                  />
                  <span
                    class="block w-9 h-5 bg-black/15 rounded-full peer peer-checked:bg-green-500 transition-colors dark:bg-white/20 dark:peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
                  ></span>
                  <span
                    class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"
                  ></span>
                </label>
                <span class="text-xs font-medium text-text-secondary">Terminé</span>
              </div>
            </div>
            <!-- Pour les textes à plusieurs chapitres -->
            <div v-else-if="text.totalSections > 1">
              <span
                v-if="getTextDisplayStatus(text.id, text).status === 'fully_reserved'"
                class="chip"
                :class="
                  isTextFullyRead(text)
                    ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                    : 'bg-red-600/10 text-red-700 dark:text-red-300'
                "
              >
                <AppIcon v-if="isTextFullyRead(text)" name="circle-check" :size="12" />
                {{ isTextFullyRead(text) ? "Lu par" : "Réservé par" }}
                {{ getTextDisplayStatus(text.id, text).reservedBy || "quelqu'un" }}
              </span>
              <span
                v-else-if="getTextDisplayStatus(text.id, text).status === 'partially_reserved'"
                class="chip bg-amber-500/10 text-amber-700 dark:text-amber-200"
              >
                Partiellement réservé
              </span>
              <span v-else class="chip bg-green-600/10 text-green-700 dark:text-green-300">
                Disponible
              </span>
            </div>
            <span v-else class="chip bg-green-600/10 text-green-700 dark:text-green-300">
              Disponible
            </span>
          </div>

          <!-- Sections du texte (expandable) - seulement si plus d'un chapitre -->
          <div
            v-if="text.totalSections > 1 && isTextExpanded(text.id)"
            class="animate-[fadeIn_0.3s_ease]"
          >
            <h5 class="px-5 pb-1 text-xs font-semibold text-text-secondary">
              Sections disponibles ({{ text.totalSections }})
            </h5>

            <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
              <div
                v-for="chapter in generateChapters(text.totalSections)"
                :key="chapter"
                class="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors cursor-pointer select-none"
                :class="{
                  'bg-green-600/5 hover:bg-green-600/10 dark:bg-green-500/10 dark:hover:bg-green-500/15':
                    getReservation(text.id, chapter)?.isCompleted,
                  'bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/5 dark:hover:bg-amber-500/10':
                    isReserved(text.id, chapter).isReserved &&
                    !getReservation(text.id, chapter)?.isCompleted,
                  'hover:bg-black/[0.03] dark:hover:bg-white/5': !isReserved(text.id, chapter)
                    .isReserved,
                  'opacity-60 cursor-not-allowed':
                    isReserved(text.id, chapter).isReserved &&
                    !canCancelReservation(text.id, chapter),
                }"
                @click="
                  !(
                    isReserving === `${text.id}-${chapter}` ||
                    (isReserved(text.id, chapter).isReserved &&
                      !canCancelReservation(text.id, chapter))
                  ) && emit('item-click', text.id, chapter)
                "
              >
                <!-- Checkbox + Chapitre -->
                <div class="flex items-center gap-3 flex-shrink-0">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded accent-primary pointer-events-none"
                    :checked="
                      isReserved(text.id, chapter).isReserved || isSelected(text.id, chapter)
                    "
                    :disabled="
                      isReserving === `${text.id}-${chapter}` ||
                      (isReserved(text.id, chapter).isReserved &&
                        !canCancelReservation(text.id, chapter))
                    "
                  />
                  <span class="font-medium text-sm text-text-primary"
                    >Chapitre {{ formatNumberWithHebrew(chapter) }}</span
                  >
                </div>

                <!-- Statut à droite -->
                <div class="flex items-center gap-3">
                  <!-- Si réservé -->
                  <template v-if="isReserved(text.id, chapter).isReserved">
                    <!-- Switch "Lu" - seulement pour nos réservations -->
                    <label
                      v-if="canCancelReservation(text.id, chapter)"
                      class="flex items-center gap-2 cursor-pointer group"
                      @click.stop
                    >
                      <span
                        class="text-xs text-text-secondary group-hover:text-text-primary transition-colors"
                        >Lu</span
                      >
                      <div class="relative">
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          :checked="getReservation(text.id, chapter)?.isCompleted || false"
                          @change="emit('toggle-completion', text.id, chapter)"
                        />
                        <div
                          class="w-8 h-4.5 bg-black/15 rounded-full peer peer-checked:bg-green-500 transition-colors dark:bg-white/20 dark:peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
                        ></div>
                        <div
                          class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5"
                        ></div>
                      </div>
                    </label>

                    <!-- Badge de statut compact -->
                    <span
                      class="chip"
                      :class="
                        getReservation(text.id, chapter)?.isCompleted
                          ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                      "
                    >
                      <AppIcon
                        :name="getReservation(text.id, chapter)?.isCompleted ? 'check' : 'user'"
                        :size="11"
                      />
                      {{ isReserved(text.id, chapter).reservedBy || "Réservé" }}
                    </span>
                  </template>

                  <!-- Si sélectionné (en attente de confirmation) -->
                  <span
                    v-else-if="isSelected(text.id, chapter)"
                    class="chip bg-primary/10 text-primary"
                  >
                    <AppIcon name="plus" :size="11" />
                    Sélectionné
                  </span>

                  <!-- Si disponible -->
                  <span v-else class="chip bg-black/5 text-text-secondary dark:bg-white/10">
                    Disponible
                  </span>

                  <!-- Lien lecture interne -->
                  <router-link
                    :to="{
                      name: 'text-reading-section',
                      params: { textId: text.id, section: chapter },
                      query: { session: session.slug ?? session.id },
                    }"
                    class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Lire ce chapitre"
                    @click.stop
                  >
                    <AppIcon name="book-reader" :size="12" />
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
