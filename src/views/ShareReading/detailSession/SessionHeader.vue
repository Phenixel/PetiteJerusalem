<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { sessionService } from '../../../services/sessionService'
import type { Session } from '../../../models/models'

const { t } = useI18n()

defineProps<{
  session: Session
  isOwner?: boolean
}>()

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'manage'): void
}>()
</script>

<template>
  <div class="mb-12 text-center max-w-3xl mx-auto">
    <h2
      class="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight dark:text-gray-100"
    >
      {{ session.name }}
    </h2>
    <p class="text-text-secondary text-lg mb-6 dark:text-gray-300">{{ session.description }}</p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <span
        class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold dark:bg-primary/20 dark:text-primary-light"
        >{{ sessionService.formatTextType(session.type) }}</span
      >
      <span
        class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-300"
        >{{ t('common.dateLimit') }} : {{ sessionService.formatDate(session.dateLimit) }}</span
      >
      <span
        class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium dark:bg-gray-800 dark:text-gray-300"
        >{{ t('common.createdBy') }} : {{ session.creatorName }}</span
      >
      <button
        v-if="isOwner"
        @click="emit('manage')"
        class="px-3 py-1 bg-primary text-white hover:bg-primary-dark rounded-full text-sm font-medium transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
        :title="t('detailSession.manageSession')"
      >
        <i class="fa-solid fa-cog"></i> {{ t('common.manage') }}
      </button>
      <button
        @click="emit('share')"
        class="px-3 py-1 bg-white border border-gray-200 hover:border-primary hover:text-primary rounded-full text-sm font-medium transition-colors flex items-center gap-1 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-primary dark:hover:border-primary cursor-pointer"
        :title="t('common.share')"
      >
        <i class="fa-solid fa-share-nodes"></i> {{ t('common.share') }}
      </button>
    </div>
  </div>
</template>
