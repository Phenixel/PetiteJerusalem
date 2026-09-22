<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { detectStores, type StoreKey } from "../composables/useAppDownload";
import { isNativeApp } from "../composables/useNativeApp";
import { analyticsService } from "../services/analyticsService";
import AppIcon from "./icons/AppIcon.vue";

/**
 * Le téléchargement de l'app, proposé par le site web.
 *
 * Rien à afficher dans l'app native : elle est déjà installée, un bouton
 * « Télécharger l'app » y renverrait le lecteur sur sa propre fiche.
 *
 * La plateforme est lue une fois, au montage : l'agent utilisateur ne change
 * pas en cours de visite (voir composables/useAppDownload.ts).
 */

const { t } = useI18n();
const stores = detectStores();

/**
 * D'où part le clic. Le bouton vit à plusieurs endroits (menu de lecture,
 * pied de page, page d'une fête) : sans cela, `app_download_clicked` ne dit
 * pas lequel rapporte.
 */
const props = defineProps<{ source?: string }>();

/**
 * L'appelant peut vouloir compter le clic dans son propre entonnoir, en plus
 * du suivi commun (la page d'une fête, avec `calendar_cta_clicked`).
 */
const emit = defineEmits<{ download: [store: StoreKey] }>();

// Quel store est réellement suivi, et depuis quel appareil : de quoi voir si
// les visiteurs iPhone trouvent bien leur lien, et ce que rapporte le bouton.
function trackDownload(store: StoreKey) {
  analyticsService.capture("app_download_clicked", {
    store,
    offered: stores.length,
    source: props.source ?? null,
  });
  emit("download", store);
}
</script>

<template>
  <div v-if="!isNativeApp" class="flex flex-col items-center gap-3">
    <p class="text-sm font-medium">{{ t("appDownload.title") }}</p>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <a
        v-for="store in stores"
        :key="store.key"
        class="btn btn-soft gap-2"
        :href="store.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t(store.ariaKey)"
        @click="trackDownload(store.key)"
      >
        <AppIcon :name="store.icon" :size="18" />
        <span>{{ t(store.labelKey) }}</span>
      </a>
    </div>
  </div>
</template>
