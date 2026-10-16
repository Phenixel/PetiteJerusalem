<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AdminStatus, { type AdminTone } from "./AdminStatus.vue";
import type { SupportStatus } from "../../services/support";

/**
 * Le statut d'un message, dans les tons du backoffice : ambre pour ce qui
 * attend l'équipe, la couleur du thème pour ce qui est en cours, vert pour
 * ce qui a reçu sa réponse, gris pour ce qui est terminé.
 */
defineProps<{ status: SupportStatus }>();

const { t } = useI18n();

const TONES: Record<SupportStatus, AdminTone> = {
  new: "warning",
  in_progress: "primary",
  answered: "success",
  done: "neutral",
};
</script>

<template>
  <AdminStatus :tone="TONES[status]" :label="t(`admin.support.statuses.${status}`)" />
</template>
