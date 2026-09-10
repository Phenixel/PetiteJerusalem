<script setup lang="ts">
/**
 * Deux pages voisines, un jeu d'onglets en tête, dans l'app native.
 *
 * La barre du bas ne tient que quatre onglets : des pages qui vont ensemble
 * n'y ont pas toutes leur place, et elles finissaient introuvables (le partage
 * de lectures n'était atteignable que par l'accueil, le calendrier des fêtes
 * par un petit lien perdu sous le titre des horaires). Elles se rangent donc
 * deux par deux, là où l'on est déjà : lire ou partager un texte, les horaires
 * du jour ou le calendrier de l'année.
 *
 * Sur le site, ce composant ne sert pas : le bandeau et le menu mènent partout
 * d'un clic.
 *
 * Ce sont de vraies pages, pas des panneaux : chacune garde son adresse (lien
 * partagé, retour Android, reprise de défilement), l'onglet ne fait que les
 * relier. L'onglet actif est celui dont l'adresse ouvre celle qu'on lit, la
 * plus précise l'emportant : /share-reading/session/x est bien au partage.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { analyticsService } from "../services/analyticsService";

export interface PageTab {
  /** Sert aussi de valeur dans la mesure d'audience. */
  id: string;
  to: string;
  labelKey: string;
}

const props = defineProps<{
  tabs: PageTab[];
  /** Nom de l'événement d'audience posé au changement d'onglet. */
  event: string;
  /** Ce que le groupe annonce aux lecteurs d'écran. */
  label: string;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeId = computed(() => {
  const matching = props.tabs.filter((tab) => route.path.startsWith(tab.to));
  const best = matching.sort((a, b) => b.to.length - a.to.length)[0];
  return best?.id ?? props.tabs[0]?.id;
});

function go(tab: PageTab): void {
  if (tab.id === activeId.value) return;
  analyticsService.capture(props.event, { tab: tab.id });
  void router.push(tab.to);
}
</script>

<template>
  <div class="mb-6 flex justify-center animate-[fadeIn_0.4s_ease]">
    <div
      class="inline-flex p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
      role="group"
      :aria-label="label"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="rounded-control px-6 py-2 text-sm font-semibold transition-colors"
        :class="activeId === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary'"
        :aria-pressed="activeId === tab.id"
        @click="go(tab)"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>
  </div>
</template>
