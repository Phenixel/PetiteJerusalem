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
  <div class="text-card">
    <!-- En-tête du texte -->
    <div class="text-header">
      <h4 class="text-title">{{ text.name }}</h4>
      <div class="text-actions">
        <a :href="text.link" target="_blank" class="text-link" title="Voir le texte sur Sefaria">
          🔗
        </a>
        <button
          @click="emit('toggle-expansion', text.id)"
          class="expand-button"
          :class="{ expanded: isExpanded }"
        >
          {{ isExpanded ? '▼' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Statut global du texte -->
    <div class="text-status">
      <span v-if="textDisplayStatus.status === 'fully_reserved'" class="status-reserved">
        Réservé par {{ textDisplayStatus.reservedBy || "quelqu'un" }}
      </span>
      <span
        v-else-if="textDisplayStatus.status === 'partially_reserved'"
        class="status-partially-reserved"
      >
        En cours
      </span>
      <span v-else class="status-available">Disponible</span>
    </div>

    <!-- Sections du texte (expandable) -->
    <div v-if="isExpanded" class="text-sections">
      <div class="sections-header">
        <h5>Sections disponibles ({{ text.totalSections }})</h5>
      </div>

      <div class="sections-list">
        <div
          v-for="chapter in generateChapters(text.totalSections)"
          :key="chapter"
          class="section-item"
        >
          <label class="section-checkbox">
            <input
              type="checkbox"
              :checked="isReserved(chapter).isReserved"
              @change="
                isReserved(chapter).isReserved
                  ? emit('cancel-reservation', text.id, chapter)
                  : emit('reserve-text', text.id, chapter)
              "
              :disabled="isReserving === `${text.id}-${chapter}`"
            />
            <span class="section-label">Chapitre {{ chapter }}</span>
          </label>

          <span v-if="isReserved(chapter).isReserved" class="section-status reserved">
            Réservé par {{ isReserved(chapter).reservedBy || "quelqu'un" }}
          </span>
          <span v-else class="section-status available"> Disponible </span>
        </div>
      </div>

      <!-- Bouton de réservation du texte complet -->
      <div class="full-text-reservation">
        <button
          @click="
            isTextFullyReserved
              ? emit('cancel-all-reservations', text.id)
              : emit('reserve-all-chapters', text.id)
          "
          :disabled="isReserving === `${text.id}-all`"
          class="btn-reserve-full"
          :class="{
            reserved: isTextFullyReserved,
            available: textDisplayStatus.status === 'available',
          }"
        >
          {{ isTextFullyReserved ? 'Annuler la réservation' : 'Réserver le texte complet' }}
        </button>
      </div>
    </div>
  </div>
</template>
