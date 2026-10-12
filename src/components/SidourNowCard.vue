<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { currentTefilaWindow, tefilaPath } from "../services/sidourService";
import { formatZmanTime } from "../services/zmanimService";
import { useZmanimLocation } from "../composables/useZmanimLocation";
import { useNow } from "../composables/useNow";
import { analyticsService } from "../services/analyticsService";
import CardArt from "./CardArt.vue";

/**
 * Le raccourci du sidour sur l'accueil : pendant la plage horaire d'un office
 * (Cha'harit, Min'ha, Arvit), une ligne mène directement au texte, avec
 * l'heure jusqu'à laquelle il se dit. Entre deux offices, rien : la carte
 * n'occupe pas l'accueil quand elle n'a rien à proposer.
 *
 * Elle porte le sidour lui-même dans son coin (voir CardArt), comme la carte
 * du moment de la page du Sidour : pas d'icône à gauche qui le redise.
 *
 * Chargée à la demande (voir HomeView) : elle tire le moteur des horaires.
 */
const { t, locale } = useI18n();
const { place } = useZmanimLocation();

// La plage change avec l'heure (elle s'ouvre et se referme sous la page).
// Horloge partagée entre les cartes de l'accueil (un seul setInterval).
const now = useNow();

const window_ = computed(() => currentTefilaWindow(place.value, now.value));

const path = computed(() => (window_.value ? tefilaPath(window_.value.tefila) : null));
const tefilaName = computed(() =>
  window_.value ? t(`home.sidourNow.names.${window_.value.tefila}`) : "",
);
const untilTime = computed(() =>
  window_.value ? formatZmanTime(window_.value.end, place.value.tzid, locale.value) : "",
);

function trackOpen() {
  analyticsService.capture("home_card_clicked", {
    card: "sidour_now",
    tefila: window_.value?.tefila,
  });
}
</script>

<template>
  <RouterLink
    v-if="window_ && path"
    :to="path"
    class="card card-hover group relative mt-1 flex w-full items-center px-5 py-4 pe-20 sm:px-6 sm:pe-20"
    @click="trackOpen()"
  >
    <CardArt :art="{ kind: 'siddur' }" :scale="0.42" surface="plain" />
    <!-- Pas de troncature : si la ligne ne tient pas (écran étroit, texte
         agrandi), elle passe à la ligne. L'heure limite est le seul chiffre de
         la carte, elle ne se perd jamais dans les points de suspension. -->
    <span class="relative font-medium text-text-primary transition-colors group-hover:text-primary">
      {{ t("home.sidourNow.title", { tefila: tefilaName }) }}
      <span class="font-normal text-text-secondary">
        · {{ t("home.sidourNow.until", { time: untilTime }) }}
      </span>
    </span>
  </RouterLink>
</template>
