<script setup lang="ts">
/**
 * Les horaires, vus depuis les réglages : quel avis on suit pour les calculer.
 *
 * Le choix déplace toutes les heures de l'app d'un coup, la page des horaires
 * comme la carte de l'accueil, le sidour du moment et les rappels : la note du
 * bas le dit, et rappelle que la pratique se règle avec un rav.
 */
import { useI18n } from "vue-i18n";
import ZmanimOpinionPicker from "./ZmanimOpinionPicker.vue";

const { t } = useI18n();
</script>

<template>
  <section>
    <h2 class="mb-2 text-2xl font-bold text-text-primary">{{ t("zmanim.opinions.title") }}</h2>
    <p class="mb-6 text-text-secondary">{{ t("zmanim.opinions.description") }}</p>

    <div class="rounded-card bg-surface p-5 shadow-card">
      <ZmanimOpinionPicker source="settings" />
    </div>

    <p class="mt-3 text-sm text-text-secondary leading-relaxed">{{ t("zmanim.opinions.note") }}</p>
  </section>
</template>
