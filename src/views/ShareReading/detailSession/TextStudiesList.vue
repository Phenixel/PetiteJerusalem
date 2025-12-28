<script setup lang="ts">
import { sessionService } from '../../../services/sessionService'
import { ref } from 'vue'
import type { Session, TextStudy, TextStudyReservation } from '../../../models/models'
import type { User } from '../../../services/authService'

const props = defineProps<{
  groupedTextStudies: Record<string, TextStudy[]>
  session: Session
  reservations: TextStudyReservation[]
  currentUser: User | null
  guestEmail: string
  selectedItems: Set<string>
  isReserving: string | null
}>()

const emit = defineEmits<{
  (e: 'item-click', textId: string, section?: number): void
  (e: 'toggle-completion', textId: string, section: number): void
}>()

const expandedTexts = ref<Set<string>>(new Set())

const toggleTextExpansion = (textId: string) => {
  if (expandedTexts.value.has(textId)) {
    expandedTexts.value.delete(textId)
  } else {
    expandedTexts.value.add(textId)
  }
}

const isTextExpanded = (textId: string) => {
  return expandedTexts.value.has(textId)
}

const formatBookName = (bookName: string) => {
  if (bookName === 'Mes réservations') return bookName
  return sessionService.formatBookName(bookName)
}

const generateChapters = (totalSections: number) => {
  return sessionService.generateChapters(totalSections)
}

const isReserved = (textStudyId: string, section?: number) => {
  return sessionService.isTextOrSectionReserved(textStudyId, section, props.session)
}

const isSelected = (textStudyId: string, section?: number) => {
  const key = section ? `${textStudyId}#${section}` : `${textStudyId}#full`
  return props.selectedItems.has(key)
}

const getReservation = (textStudyId: string, section?: number) => {
  return props.reservations.find((r) => r.textStudyId === textStudyId && r.section === section)
}

const canCancelReservation = (textStudyId: string, section?: number) => {
  const reservation = getReservation(textStudyId, section)
  if (!reservation) return false

  return sessionService.canUserDeleteReservation(reservation, props.currentUser, props.guestEmail)
}

const getTextDisplayStatus = (textStudyId: string, text: TextStudy) => {
  // We need to pass text object as well
  return sessionService.getTextDisplayStatus(textStudyId, text, props.session)
}
</script>

<template>
  <div class="space-y-12">
    <div
      v-for="(texts, bookName) in groupedTextStudies"
      :key="bookName"
      class="animate-[fadeIn_0.5s_ease]"
    >
      <h3
        class="text-2xl font-bold text-text-primary mb-6 pl-4 border-l-4 border-primary dark:text-gray-100"
      >
        {{ formatBookName(String(bookName)) }}
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div
          v-for="text in texts"
          :key="text.id"
          class="flex flex-col bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 hover:shadow-lg transition-all duration-300 dark:bg-gray-800/60 dark:border-gray-700 dark:hover:bg-gray-800/80"
          :class="{
            'ring-2 ring-primary/50 dark:ring-primary/40':
              isSelected(text.id, 1) ||
              (text.totalSections > 1 &&
                generateChapters(text.totalSections).some((c) => isSelected(text.id, c))),
          }"
        >
          <!-- En-tête du texte -->
          <div
            class="p-5 border-b border-black/5 bg-white/40 rounded-t-2xl dark:bg-gray-800/40 dark:border-white/5"
          >
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="flex-1 min-w-0">
                <h4
                  class="font-bold text-lg text-text-primary leading-tight truncate mb-1 dark:text-gray-100"
                  :title="text.name"
                >
                  {{ text.name }}
                </h4>
                <!-- Case à cocher directe pour les textes à un seul chapitre -->
                <label
                  v-if="text.totalSections === 1"
                  class="inline-flex items-center gap-2 cursor-pointer mt-1"
                  :class="{
                    'opacity-60 cursor-not-allowed':
                      isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1),
                  }"
                >
                  <input
                    type="checkbox"
                    class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary"
                    :checked="isReserved(text.id, 1).isReserved || isSelected(text.id, 1)"
                    @change="emit('item-click', text.id, 1)"
                    :disabled="
                      isReserving === `${text.id}-1` ||
                      (isReserved(text.id, 1).isReserved && !canCancelReservation(text.id, 1))
                    "
                  />
                  <span class="text-sm font-medium text-text-secondary dark:text-gray-400">
                    {{ isSelected(text.id, 1) ? 'Sélectionné' : 'Réserver' }}
                  </span>
                </label>
              </div>

              <div class="flex items-center gap-2 self-start">
                <a
                  v-if="text.link"
                  :href="text.link"
                  target="_blank"
                  class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-text-secondary hover:text-primary hover:border-primary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary"
                  title="Voir le texte sur Sefaria"
                >
                  <i class="fa-solid fa-book-open text-xs"></i>
                </a>
                <button
                  v-if="text.totalSections > 1"
                  @click="toggleTextExpansion(text.id)"
                  class="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-text-secondary hover:bg-gray-50 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                  :class="{
                    'bg-gray-100 ring-2 ring-gray-200 dark:bg-gray-600 dark:ring-gray-500':
                      isTextExpanded(text.id),
                  }"
                >
                  <i
                    class="fa-solid"
                    :class="isTextExpanded(text.id) ? 'fa-chevron-up' : 'fa-chevron-down'"
                  ></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Statut global du texte -->
          <div class="p-4 bg-white/20 dark:bg-gray-800/20">
            <!-- Pour les textes à un seul chapitre, vérifier le statut de complétion -->
            <div
              v-if="text.totalSections === 1 && isReserved(text.id, 1).isReserved"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <span
                class="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2"
                :class="{
                  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200':
                    !getReservation(text.id, 1)?.isCompleted,
                  'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300':
                    getReservation(text.id, 1)?.isCompleted,
                }"
              >
                <i
                  class="fa-solid"
                  :class="
                    getReservation(text.id, 1)?.isCompleted ? 'fa-check-circle' : 'fa-user-clock'
                  "
                ></i>
                {{
                  getReservation(text.id, 1)?.isCompleted
                    ? `Lu par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                    : `Réservé par ${isReserved(text.id, 1).reservedBy || "quelqu'un"}`
                }}
              </span>

              <!-- Switch pour marquer comme lu (seulement si c'est notre réservation) -->
              <div
                v-if="canCancelReservation(text.id, 1)"
                class="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-lg border border-white/50 dark:bg-white/10 dark:border-white/10"
              >
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    :checked="getReservation(text.id, 1)?.isCompleted || false"
                    @change="emit('toggle-completion', text.id, 1)"
                  />
                  <div
                    class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 dark:bg-gray-600 dark:after:border-gray-500"
                  ></div>
                </label>
                <span class="text-xs font-medium text-text-secondary dark:text-gray-400"
                  >Terminé</span
                >
              </div>
            </div>
            <!-- Pour les textes à plusieurs chapitres -->
            <div v-else-if="text.totalSections > 1">
              <div
                v-if="getTextDisplayStatus(text.id, text).status === 'fully_reserved'"
                class="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-semibold w-fit dark:bg-red-900/30 dark:text-red-300"
              >
                Réservé par {{ getTextDisplayStatus(text.id, text).reservedBy || "quelqu'un" }}
              </div>
              <div
                v-else-if="getTextDisplayStatus(text.id, text).status === 'partially_reserved'"
                class="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold w-fit dark:bg-amber-900/30 dark:text-amber-200"
              >
                Partiellement réservé
              </div>
              <div
                v-else
                class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold w-fit dark:bg-green-900/30 dark:text-green-300"
              >
                Disponible
              </div>
            </div>
            <div
              v-else
              class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold w-fit dark:bg-green-900/30 dark:text-green-300"
            >
              Disponible
            </div>
          </div>

          <!-- Sections du texte (expandable) - seulement si plus d'un chapitre -->
          <div
            v-if="text.totalSections > 1 && isTextExpanded(text.id)"
            class="bg-white/30 border-t border-black/5 animate-[fadeIn_0.3s_ease] dark:bg-gray-800/30 dark:border-white/5"
          >
            <div
              class="px-5 py-3 bg-gray-50/50 border-b border-gray-100 dark:bg-gray-700/30 dark:border-gray-700"
            >
              <h5
                class="text-xs font-bold text-text-secondary uppercase tracking-wider dark:text-gray-400"
              >
                Sections disponibles ({{ text.totalSections }})
              </h5>
            </div>

            <div class="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
              <div
                v-for="chapter in generateChapters(text.totalSections)"
                :key="chapter"
                class="flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer select-none"
                :class="{
                  'bg-green-500/10 dark:bg-green-500/5 hover:bg-green-500/15 dark:hover:bg-green-500/10':
                    getReservation(text.id, chapter)?.isCompleted,
                  'bg-amber-500/10 dark:bg-amber-500/5 hover:bg-amber-500/15 dark:hover:bg-amber-500/10':
                    isReserved(text.id, chapter).isReserved &&
                    !getReservation(text.id, chapter)?.isCompleted,
                  'hover:bg-white/60 dark:hover:bg-gray-700/50': !isReserved(text.id, chapter)
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
                    class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary accent-primary pointer-events-none"
                    :checked="
                      isReserved(text.id, chapter).isReserved || isSelected(text.id, chapter)
                    "
                    :disabled="
                      isReserving === `${text.id}-${chapter}` ||
                      (isReserved(text.id, chapter).isReserved &&
                        !canCancelReservation(text.id, chapter))
                    "
                  />
                  <span class="font-medium text-sm text-text-primary dark:text-gray-200"
                    >Chapitre {{ chapter }}</span
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
                        class="text-xs text-text-secondary dark:text-gray-400 group-hover:text-text-primary dark:group-hover:text-gray-300 transition-colors"
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
                          class="w-8 h-4.5 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-2 peer-focus:ring-green-500/20 transition-colors dark:bg-gray-600"
                        ></div>
                        <div
                          class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5"
                        ></div>
                      </div>
                    </label>

                    <!-- Badge de statut compact -->
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                      :class="{
                        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300':
                          getReservation(text.id, chapter)?.isCompleted,
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300':
                          !getReservation(text.id, chapter)?.isCompleted,
                      }"
                    >
                      <i
                        class="fa-solid text-[10px]"
                        :class="
                          getReservation(text.id, chapter)?.isCompleted ? 'fa-check' : 'fa-user'
                        "
                      ></i>
                      {{ isReserved(text.id, chapter).reservedBy || 'Réservé' }}
                    </span>
                  </template>

                  <!-- Si sélectionné (en attente de confirmation) -->
                  <span
                    v-else-if="isSelected(text.id, chapter)"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 text-primary rounded-full text-xs font-medium dark:bg-primary/25 animate-pulse"
                  >
                    <i class="fa-solid fa-plus text-[10px]"></i>
                    Sélectionné
                  </span>

                  <!-- Si disponible -->
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium dark:bg-gray-700/50 dark:text-gray-400"
                  >
                    Disponible
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
