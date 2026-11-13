<script setup lang="ts">
/** Le moment de la journée d'un objectif : le paquet de l'accueil s'y range. */
import { useI18n } from "vue-i18n";
import { MOMENTS, type MomentId } from "../../../services/parcours/model";
import ChoicePill from "./ChoicePill.vue";

const model = defineModel<MomentId>({ required: true });
const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap gap-2" role="group" :aria-label="t('parcours.form.moment')">
    <ChoicePill
      v-for="moment in MOMENTS"
      :key="moment"
      :on="model === moment"
      @click="model = moment"
    >
      {{ t(`parcours.moments.${moment}`) }}
    </ChoicePill>
  </div>
</template>
