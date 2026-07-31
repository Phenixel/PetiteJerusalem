<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { TextStudy, TextStudyReservation } from "../../../models/models";
import AppIcon from "../../../components/icons/AppIcon.vue";

defineProps<{
  drawn: { text: TextStudy; reservation: TextStudyReservation } | null;
  loading: boolean;
  availableCount: number;
  sessionSlug: string;
}>();

const emit = defineEmits<{
  (e: "draw"): void;
  (e: "cancel"): void;
  (e: "mark-read"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="card p-5 mb-8 max-w-3xl mx-auto text-center">
    <!-- Avant tirage : proposer de laisser le hasard choisir -->
    <template v-if="!drawn">
      <h3 class="font-bold text-lg text-text-primary">
        {{ t("detailSession.randomDraw.title") }}
      </h3>
      <p class="text-sm text-text-secondary mt-0.5 mb-4">
        {{ t("detailSession.randomDraw.subtitle") }}
      </p>
      <button
        @click="emit('draw')"
        class="btn btn-primary"
        :disabled="loading || availableCount === 0"
      >
        <AppIcon :name="loading ? 'spinner' : 'shuffle'" :size="16" :class="{ 'animate-spin': loading }" />
        {{ loading ? t("detailSession.randomDraw.drawing") : t("detailSession.randomDraw.button") }}
      </button>
      <p v-if="availableCount === 0" class="text-sm text-text-secondary mt-3">
        {{ t("detailSession.randomDraw.noneAvailable") }}
      </p>
    </template>

    <!-- Après tirage : le Téhilim attribué et ses actions -->
    <template v-else>
      <p class="text-sm text-text-secondary">{{ t("detailSession.randomDraw.yourDraw") }}</p>
      <h3 class="text-2xl font-bold text-text-primary mt-1 mb-2">{{ drawn.text.name }}</h3>
      <span
        class="chip"
        :class="
          drawn.reservation.isCompleted
            ? 'bg-green-600/10 text-green-700 dark:text-green-300'
            : 'bg-primary/10 text-primary'
        "
      >
        <AppIcon :name="drawn.reservation.isCompleted ? 'circle-check' : 'bookmark'" :size="12" />
        {{
          drawn.reservation.isCompleted
            ? t("detailSession.randomDraw.readThanks")
            : t("detailSession.randomDraw.reservedForYou")
        }}
      </span>

      <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
        <template v-if="!drawn.reservation.isCompleted">
          <router-link
            :to="{
              name: 'text-reading',
              params: { textId: drawn.text.id },
              query: { session: sessionSlug },
            }"
            class="btn btn-primary !px-3.5 !py-2 text-sm"
          >
            <AppIcon name="book-open" :size="15" />
            {{ t("detailSession.textList.read") }}
          </router-link>
          <button @click="emit('mark-read')" class="btn btn-soft !px-3.5 !py-2 text-sm">
            <AppIcon name="circle-check" :size="15" />
            {{ t("detailSession.randomDraw.markRead") }}
          </button>
          <button
            @click="emit('cancel')"
            class="btn btn-soft !px-3.5 !py-2 text-sm hover:!text-red-600 dark:hover:!text-red-400"
          >
            <AppIcon name="x" :size="15" />
            {{ t("detailSession.randomDraw.cancel") }}
          </button>
        </template>
        <button
          v-else
          @click="emit('draw')"
          class="btn btn-soft !px-3.5 !py-2 text-sm"
          :disabled="loading || availableCount === 0"
        >
          <AppIcon name="shuffle" :size="15" />
          {{ t("detailSession.randomDraw.drawAnother") }}
        </button>
      </div>
    </template>
  </div>
</template>
