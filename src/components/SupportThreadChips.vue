<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { SupportThreadView } from "../services/support";

/**
 * Les pastilles d'un message, vues par la personne : sa nature, où il en est,
 * et « Nouvelle réponse » sur la teinte pleine, la seule qui réclame. La
 * liste de « Nous écrire » et la page d'un fil les partagent.
 */
defineProps<{ thread: Pick<SupportThreadView, "kind" | "status" | "unread"> }>();

const { t } = useI18n();

const STATUS_TONES: Record<SupportThreadView["status"], string> = {
  new: "bg-black/5 text-text-secondary dark:bg-white/10",
  in_progress: "bg-primary/10 text-primary",
  answered: "bg-green-600/10 text-green-700 dark:text-green-300",
  done: "bg-black/5 text-text-secondary dark:bg-white/10",
};
</script>

<template>
  <span class="flex flex-wrap items-center gap-1.5">
    <span class="chip bg-black/5 text-text-secondary dark:bg-white/10">
      {{ t(`support.kinds.${thread.kind}`) }}
    </span>
    <!-- « Nouvelle réponse » already says it was answered. -->
    <span v-if="!thread.unread" class="chip" :class="STATUS_TONES[thread.status]">
      {{ t(`support.statuses.${thread.status}`) }}
    </span>
    <span v-if="thread.unread" class="chip bg-brand text-on-brand">
      {{ t("support.newReply") }}
    </span>
  </span>
</template>
