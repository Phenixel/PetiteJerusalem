<script setup lang="ts">
import { computed } from 'vue'
import type { TextStudy, TextStudyReservation } from '../models/models'

interface Props {
  text: TextStudy
  reservations: TextStudyReservation[]
  isExpanded: boolean
  isReserving: string | null
  currentUser: { id: string; name: string; email: string } | null
  reservationForm: { name: string; email: string }
}

interface Emits {
  (e: 'toggle-expansion', textId: string): void
  (e: 'reserve-text', textStudyId: string, section?: number): void
  (e: 'cancel-reservation', textStudyId: string, section?: number): void
  (e: 'reserve-all-chapters', textStudyId: string): void
  (e: 'cancel-all-reservations', textStudyId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Computed properties
const textDisplayStatus = computed(() => {
  const textReservations = props.reservations.filter((r) => r.textStudyId === props.text.id)
  const chapterReservations = textReservations.filter((r) => r.section !== undefined)

  if (chapterReservations.length === 0) {
    return { status: 'available', reservedBy: null }
  }

  // Si tous les chapitres sont réservés par la même personne
  if (chapterReservations.length === props.text.totalSections) {
    const firstReservation = chapterReservations[0]
    const allSamePerson = chapterReservations.every(
      (r) => r.chosenByName === firstReservation.chosenByName,
    )

    if (allSamePerson) {
      return { status: 'fully_reserved', reservedBy: firstReservation.chosenByName }
    }
  }

  // Si certains chapitres sont réservés mais pas tous
  if (chapterReservations.length > 0 && chapterReservations.length < props.text.totalSections) {
    return { status: 'partially_reserved', reservedBy: null }
  }

  // Si tous les chapitres sont réservés par des personnes différentes
  if (chapterReservations.length === props.text.totalSections) {
    const uniqueNames = [...new Set(chapterReservations.map((r) => r.chosenByName))]
    return { status: 'fully_reserved', reservedBy: uniqueNames.join(', ') }
  }

  return { status: 'available', reservedBy: null }
})

const isTextFullyReserved = computed(() => textDisplayStatus.value.status === 'fully_reserved')

// Methods
const isReserved = (section?: number) => {
  const reservation = props.reservations.find(
    (r) => r.textStudyId === props.text.id && r.section === section,
  )

  if (reservation) {
    return {
      isReserved: true,
      reservedBy: reservation.chosenByName || reservation.chosenById || reservation.chosenByGuestId,
    }
  }

  return { isReserved: false }
}

const generateChapters = (totalSections: number) => {
  return Array.from({ length: totalSections }, (_, i) => i + 1)
}
</script>

<template>
  <div
    class="bg-white/60 backdrop-blur-sm rounded-xl border border-white/40 overflow-hidden transition-all duration-300 hover:shadow-lg p-5 dark:bg-gray-800/60 dark:border-gray-700"
  >
    <!-- En-tête du texte -->
    <div class="flex justify-between items-center mb-3">
      <h4 class="text-xl font-semibold text-text-primary dark:text-gray-100">{{ text.name }}</h4>
      <div class="flex items-center gap-3">
        <a
          :href="text.link"
          target="_blank"
          class="text-xl opacity-70 hover:opacity-100 transition-opacity hover:-translate-y-0.5"
          title="Voir le texte sur Sefaria"
        >
          🔗
        </a>
        <button
          @click="emit('toggle-expansion', text.id)"
          class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 transition-colors text-xs text-text-secondary dark:text-gray-300 dark:hover:bg-gray-700"
          :class="{ 'rotate-180 bg-black/5 dark:bg-gray-700': isExpanded }"
        >
          {{ isExpanded ? '▼' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Statut global du texte -->
    <div class="mb-4">
      <span
        v-if="textDisplayStatus.status === 'fully_reserved'"
        class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary/10 text-secondary border border-secondary/20"
      >
        Réservé par {{ textDisplayStatus.reservedBy || "quelqu'un" }}
      </span>
      <span
        v-else-if="textDisplayStatus.status === 'partially_reserved'"
        class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/20"
      >
        En cours
      </span>
      <span
        v-else
        class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-600 border border-green-500/20"
        >Disponible</span
      >
    </div>

    <!-- Sections du texte (expandable) -->
    <div
      v-if="isExpanded"
      class="mt-4 pt-4 border-t border-black/5 animate-[fadeIn_0.3s_ease] dark:border-white/10"
    >
      <div class="mb-3">
        <h5
          class="text-sm font-semibold text-text-secondary uppercase tracking-wide dark:text-gray-400"
        >
          Sections disponibles ({{ text.totalSections }})
        </h5>
      </div>

      <div
        class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"
      >
        <div
          v-for="chapter in generateChapters(text.totalSections)"
          :key="chapter"
          class="flex items-center justify-between p-2 rounded-lg bg-white/40 border border-white/20 hover:bg-white/60 transition-colors dark:bg-gray-700/40 dark:border-gray-600 dark:hover:bg-gray-700/60"
        >
          <label class="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary dark:border-gray-500 dark:bg-gray-600"
              :checked="isReserved(chapter).isReserved"
              @change="
                isReserved(chapter).isReserved
                  ? emit('cancel-reservation', text.id, chapter)
                  : emit('reserve-text', text.id, chapter)
              "
              :disabled="isReserving === `${text.id}-${chapter}`"
            />
            <span class="text-sm font-medium text-text-primary dark:text-gray-200"
              >Chapitre {{ chapter }}</span
            >
          </label>

          <span
            v-if="isReserved(chapter).isReserved"
            class="text-xs font-bold text-secondary truncate max-w-[100px] text-right"
            :title="isReserved(chapter).reservedBy || 'quelqu\'un'"
          >
            {{ isReserved(chapter).reservedBy || "quelqu'un" }}
          </span>
          <span v-else class="text-xs font-bold text-green-600"> Disponible </span>
        </div>
      </div>

      <!-- Bouton de réservation du texte complet -->
      <div class="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
        <button
          @click="
            isTextFullyReserved
              ? emit('cancel-all-reservations', text.id)
              : emit('reserve-all-chapters', text.id)
          "
          :disabled="isReserving === `${text.id}-all`"
          class="w-full py-2 px-4 rounded-lg font-semibold text-sm transition-all border"
          :class="{
            'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20':
              isTextFullyReserved,
            'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20':
              !isTextFullyReserved && textDisplayStatus.status === 'available',
            'bg-gray-100 text-gray-400 cursor-not-allowed':
              !isTextFullyReserved && textDisplayStatus.status !== 'available',
          }"
        >
          {{ isTextFullyReserved ? 'Annuler la réservation' : 'Réserver le texte complet' }}
        </button>
      </div>
    </div>
  </div>
</template>
