<script setup lang="ts">
/**
 * L'avis suivi pour les horaires, en fenêtre depuis la page des horaires.
 *
 * C'est la porte du site : la page de réglages y est réservée aux comptes, et
 * le choix de l'opinion, lui, doit rester à portée de tous. Dans l'app, il vit
 * dans l'onglet Horaires des réglages (voir ProfilePage).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useOverlay } from "../../composables/useOverlayStack";
import ZmanimOpinionPicker from "../../components/settings/ZmanimOpinionPicker.vue";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: "update:show", value: boolean): void }>();

const { t } = useI18n();

function close(): void {
  emit("update:show", false);
}

// Le bouton retour d'Android ferme la fenêtre avant de quitter la page.
useOverlay(
  computed(() => props.show),
  close,
);
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="mb-1 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-lg font-bold text-text-primary">
          <AppIcon name="clock" :size="17" class="text-primary" />
          {{ t("zmanim.opinions.title") }}
        </h3>
        <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="close">
          <AppIcon name="x" :size="18" />
        </button>
      </div>
      <p class="mb-3 text-sm text-text-secondary leading-relaxed">
        {{ t("zmanim.opinions.description") }}
      </p>

      <ZmanimOpinionPicker source="zmanim" @choose="close" />

      <p class="mt-3 text-sm text-text-secondary leading-relaxed">
        {{ t("zmanim.opinions.note") }}
      </p>
    </div>
  </div>
</template>
