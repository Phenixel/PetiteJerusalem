<script setup lang="ts">
import type { Session } from '../models/models'
import { EnumTypeTextStudy } from '../models/typeTextStudy'
import { TextTypeService } from '../services/textTypeService'
import { DateService } from '../services/dateService'

interface Props {
  session: Session
}

defineProps<Props>()
defineEmits<{
  click: [session: Session]
}>()

// Formater le type de texte pour l'affichage
const formatTextType = (type: EnumTypeTextStudy): string => {
  return TextTypeService.formatType(type)
}

// Formater la date pour l'affichage
const formatDate = (date: Date): string => {
  return DateService.formatDate(date)
}
</script>

<template>
  <div class="card" @click="$emit('click', session)">
    <div class="card-header">
      <h4 class="card-title">{{ session.name }}</h4>
      <span class="card-badge">{{ formatTextType(session.type) }}</span>
    </div>
    <div class="card-info">
      <div class="card-creator"><strong>Créé par :</strong> {{ session.creatorName }}</div>
    </div>
    <div class="card-meta">
      <span class="card-date">
        <strong>Date limite :</strong> {{ formatDate(session.dateLimit) }}
      </span>
    </div>
  </div>
</template>
