<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ProgressBar from "./ProgressBar.vue";
import AppModal from "./AppModal.vue";
import AppIcon from "./icons/AppIcon.vue";
import type { SessionParticipant } from "../services/sessionService";

const { t } = useI18n();

const props = defineProps<{
  total: number;
  /** Ceux qui ont pris des places : leur nombre s'affiche, leurs noms s'ouvrent. */
  participants: SessionParticipant[];
  reserved: number;
  read: number;
}>();

const stats = computed(() => {
  const { total, reserved, read } = props;
  return {
    reservedPercentage: total > 0 ? (reserved / total) * 100 : 0,
    readPercentage: total > 0 ? (read / total) * 100 : 0,
    remaining: total - reserved,
  };
});

/** Le nom donné en réservant, ou « quelqu'un » quand la place est anonyme. */
const nameOf = (participant: SessionParticipant): string =>
  participant.name || t("detailSession.textList.someone");

const showParticipants = ref(false);
</script>

<template>
  <div class="mb-12 max-w-3xl mx-auto animate-[fadeIn_0.5s_ease_0.2s_backwards]">
    <!-- L'avancement se lit d'un coup d'œil ; qui le fait avancer demande un
         geste. Le bloc entier ouvre donc la liste des participants : le
         chiffre dit combien ils sont, la fenêtre dit qui. Le bouton est posé
         par-dessus plutôt qu'autour : enveloppés dans un bouton, les chiffres
         et les deux barres cessaient d'exister pour un lecteur d'écran, qui
         n'entendait plus que le nom du bouton. -->
    <div class="group relative rounded-card" :class="participants.length ? '-mx-3 px-3 py-2' : ''">
      <div class="flex items-end justify-between mb-2">
        <div
          class="flex items-center gap-2 group-hover:underline decoration-green-600/40 underline-offset-4"
        >
          <span class="text-3xl font-bold text-green-500 dark:text-green-400">
            {{ participants.length }}
          </span>
          <span
            class="text-sm font-medium text-green-600 dark:text-green-300 transform translate-y-[-2px]"
            >{{ t("progressBar.participants") }}</span
          >
        </div>
        <div class="flex items-center gap-1 text-text-secondary">
          <span class="text-sm">{{ t("progressBar.total") }}</span>
          <span class="text-xl font-bold text-text-primary">{{ total }}</span>
        </div>
      </div>

      <!-- Deux bandes superposées : les places lues (vert) par-dessus les places
           réservées (bleu). La bande du dessus perd son fond pour laisser voir
           celle du dessous ; les couleurs sont fixes quel que soit le thème. -->
      <div class="relative mb-3">
        <ProgressBar
          :value="stats.reservedPercentage"
          tone="info"
          size="md"
          :label="t('progressBar.reserved')"
        />
        <div class="absolute inset-0 [&>div]:!bg-transparent">
          <ProgressBar
            :value="stats.readPercentage"
            tone="success"
            size="md"
            :label="t('progressBar.read')"
          />
        </div>
      </div>

      <div class="flex items-center justify-start gap-6 text-xs font-medium">
        <div class="flex items-center gap-1.5 text-green-600 dark:text-green-400">
          <div class="w-2 h-2 rounded-full bg-green-500"></div>
          <span>{{ read }} {{ t("progressBar.read") }}</span>
        </div>
        <div class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <div class="w-2 h-2 rounded-full bg-blue-500"></div>
          <span>{{ reserved }} {{ t("progressBar.reserved") }}</span>
        </div>
        <div class="flex items-center gap-1.5 text-text-secondary">
          <div class="w-2 h-2 rounded-full bg-text-secondary/60"></div>
          <span>{{ stats.remaining }} {{ t("progressBar.remaining") }}</span>
        </div>
      </div>

      <button
        v-if="participants.length"
        type="button"
        class="absolute inset-0 rounded-card transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        :aria-label="t('progressBar.seeParticipants')"
        @click="showParticipants = true"
      ></button>
    </div>

    <AppModal
      :open="showParticipants"
      :label="t('progressBar.participantsTitle')"
      panel-class="modal-panel flex flex-col max-h-[80vh] animate-[scaleIn_0.3s_ease]"
      @close="showParticipants = false"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-lg font-bold text-text-primary">
          {{ t("progressBar.participantsTitle") }}
        </h3>
        <button
          type="button"
          class="icon-btn -me-1.5"
          :aria-label="t('common.close')"
          @click="showParticipants = false"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- Du plus engagé au moins engagé, avec ce qu'il lui reste à lire :
           c'est ce qu'on vient chercher en ouvrant la liste. -->
      <ul class="-mx-1.5 overflow-y-auto">
        <li
          v-for="participant in participants"
          :key="participant.key"
          class="flex items-center justify-between gap-3 px-1.5 py-2.5"
        >
          <span class="min-w-0 truncate text-sm font-medium text-text-primary">
            {{ nameOf(participant) }}
          </span>
          <span
            class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold"
            :class="
              participant.read === participant.reserved
                ? 'text-green-600 dark:text-green-400'
                : 'text-text-secondary'
            "
          >
            <AppIcon
              v-if="participant.read === participant.reserved"
              name="circle-check"
              :size="13"
            />
            {{
              t("shareReading.readCount", { done: participant.read, total: participant.reserved })
            }}
          </span>
        </li>
      </ul>
    </AppModal>
  </div>
</template>
