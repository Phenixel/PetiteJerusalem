<script setup lang="ts">
// Sélecteur de ville de la page Horaires : une barre de recherche et la liste
// des villes où l'application est lue (voir scripts/generate-cities.mjs).
//
// La liste (~240 villes) est importée ici et nulle part ailleurs : le
// composant étant chargé à la demande, elle ne pèse sur personne tant que le
// sélecteur n'est pas ouvert. Rien ne part sur le réseau, ici non plus.
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import citiesJson from "../../datas/cities.json";
import { CITY_ALIASES } from "../../datas/cityAliases";
import type { City } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";
import AppModal from "../../components/AppModal.vue";
import { liveValue } from "../../composables/liveInput";
import { searchItems } from "../../services/fuzzySearch";

const props = defineProps<{ show: boolean; current: string | null }>();
const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "select", city: City): void;
}>();

const { t } = useI18n();

const cities = citiesJson as City[];

const query = ref("");

// La recherche commune (voir fuzzySearch) : sans accents ni ponctuation,
// « st etienne » pour Saint-Étienne, une faute de frappe pardonnée, et les
// autres noms de la ville (« London », « ירושלים », voir cityAliases). Les
// villes dont le nom *commence* par la recherche passent devant : « lon »
// donne Londres avant Toulon.
const results = computed(() =>
  searchItems(cities, query.value, (city) => [city.name, ...(CITY_ALIASES[city.name] ?? [])]),
);

// Chaque ouverture repart d'une recherche vide ; le clavier arrive dans le
// champ par AppModal (data-autofocus).
watch(
  () => props.show,
  (shown) => {
    if (shown) query.value = "";
  },
);

const close = () => emit("update:show", false);

function choose(city: City) {
  emit("select", city);
  close();
}
</script>

<template>
  <AppModal
    :open="show"
    :label="t('zmanim.place.chooseCity')"
    panel-class="modal-panel flex flex-col max-h-full animate-[scaleIn_0.3s_ease]"
    @close="close"
  >
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3 class="text-lg font-bold text-text-primary">
        {{ t("zmanim.place.chooseCity") }}
      </h3>
      <button type="button" class="icon-btn -mr-1.5" :aria-label="t('common.close')" @click="close">
        <AppIcon name="x" :size="18" />
      </button>
    </div>

    <label class="relative block">
      <span class="sr-only">{{ t("zmanim.place.searchCity") }}</span>
      <AppIcon
        name="search"
        :size="16"
        class="absolute top-1/2 -translate-y-1/2 start-3 text-text-secondary"
      />
      <input
        data-autofocus
        :value="query"
        @input="query = liveValue($event)"
        type="search"
        class="field ps-9"
        :placeholder="t('zmanim.place.searchCity')"
      />
    </label>

    <ul v-if="results.length" class="mt-3 -mx-1.5 overflow-y-auto flex flex-col">
      <li v-for="city in results" :key="`${city.country}-${city.name}`">
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 px-1.5 py-2.5 rounded-lg text-start hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="choose(city)"
        >
          <span class="flex items-center gap-2 min-w-0">
            <AppIcon
              v-if="city.name === current"
              name="check"
              :size="15"
              class="text-primary shrink-0"
            />
            <span
              class="truncate"
              :class="city.name === current ? 'font-semibold text-primary' : 'text-text-primary'"
            >
              {{ city.name }}
            </span>
          </span>
          <span class="shrink-0 text-xs text-text-secondary">{{ city.country }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="mt-4 text-sm text-text-secondary">
      {{ t("zmanim.place.noCity", { query }) }}
    </p>
  </AppModal>
</template>
