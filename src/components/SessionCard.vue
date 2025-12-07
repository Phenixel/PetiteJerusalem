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
  <div
    class="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-white/80 group"
    @click="$emit('click', session)"
  >
    <div class="flex justify-between items-start mb-4">
      <h4 class="text-xl font-bold text-text-primary group-hover:text-primary transition-colors">
        {{ session.name }}
      </h4>
      <span
        class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
        >{{ formatTextType(session.type) }}</span
      >
    </div>
    <div class="mb-4">
      <div class="text-text-secondary">
        <strong class="text-text-primary font-semibold">Créé par :</strong>
        {{ session.creatorName }}
      </div>
    </div>
    <div class="pt-4 border-t border-black/5">
      <span class="text-sm text-text-secondary flex items-center gap-2">
        <i class="far fa-calendar-alt"></i>
        <strong>Date limite :</strong> {{ formatDate(session.dateLimit) }}
      </span>
    </div>
  </div>
</template>
