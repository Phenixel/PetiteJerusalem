<script setup lang="ts">
// Sélecteur de ville de la page Horaires : une barre de recherche et la liste
// des villes où l'application est lue (voir scripts/generate-cities.mjs).
//
// La liste (~240 villes) est importée ici et nulle part ailleurs : le
// composant étant chargé à la demande, elle ne pèse sur personne tant que le
// sélecteur n'est pas ouvert. Rien ne part sur le réseau, ici non plus.
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import citiesJson from "../../datas/cities.json";
import type { City } from "../../services/zmanimService";
import AppIcon from "../../components/icons/AppIcon.vue";
import { liveValue } from "../../composables/liveInput";

const props = defineProps<{ show: boolean; current: string | null }>();
const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "select", city: City): void;
}>();

const { t } = useI18n();

const cities = citiesJson as City[];

/**
 * Clé de comparaison : sans accents ni ponctuation, et « st » ramené à
 * « saint ». On tape « st etienne » ou « ste foy » aussi souvent que la forme
 * longue, et « Saint-Étienne » doit sortir dans les deux cas.
 */
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bst(e?)\b\.?/g, "saint$1")
    .replace(/[^a-z0-9]/g, "");

const searchIndex = cities.map((city) => normalize(city.name));

const query = ref("");
const input = ref<HTMLInputElement | null>(null);

const results = computed(() => {
  const needle = normalize(query.value);
  if (!needle) return cities;
  // Les villes dont le nom *commence* par la recherche d'abord : taper
  // « par » doit donner Paris avant Sarreguemines.
  const starts: City[] = [];
  const contains: City[] = [];
  for (let i = 0; i < cities.length; i++) {
    const name = searchIndex[i];
    if (name.startsWith(needle)) starts.push(cities[i]);
    else if (name.includes(needle)) contains.push(cities[i]);
  }
  return [...starts, ...contains];
});

watch(
  () => props.show,
  async (shown) => {
    if (!shown) return;
    query.value = "";
    await nextTick();
    input.value?.focus();
  },
);

const close = () => emit("update:show", false);

function choose(city: City) {
  emit("select", city);
  close();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="close">
        <div
          class="modal-panel flex flex-col max-h-[80vh] animate-[scaleIn_0.3s_ease]"
          role="dialog"
          aria-modal="true"
          :aria-label="t('zmanim.place.chooseCity')"
          @click.stop
        >
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-lg font-bold text-text-primary">
              {{ t("zmanim.place.chooseCity") }}
            </h3>
            <button
              type="button"
              class="icon-btn -mr-1.5"
              :aria-label="t('common.close')"
              @click="close"
            >
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
              ref="input"
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
                    :class="
                      city.name === current ? 'font-semibold text-primary' : 'text-text-primary'
                    "
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
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
