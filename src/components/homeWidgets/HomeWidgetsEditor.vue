<script setup lang="ts">
/**
 * La fenêtre « Personnaliser l'accueil » : ce que l'accueil montre, et dans
 * quel ordre (voir services/homeWidgets et docs/design.md, « L'accueil se
 * compose »).
 *
 * Deux listes : ce qui est sur l'accueil, dans son ordre, avec de quoi monter,
 * descendre et retirer chaque widget ; puis ce qu'on peut ajouter, chacun avec
 * une phrase qui dit ce qu'il montre. Des flèches plutôt qu'un glisser-déposer :
 * elles se touchent au pouce sans viser, se lisent au lecteur d'écran et ne
 * se disputent pas le défilement de la fenêtre.
 *
 * Rien ne change sur l'accueil tant qu'on n'a pas enregistré : on peut essayer
 * un ordre, puis renoncer.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  availableHomeWidgets,
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGET_ICONS,
  moveHomeWidget,
  sameHomeWidgets,
  type HomeWidgetKey,
} from "../../services/homeWidgets";
import AppModal from "../AppModal.vue";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{
  open: boolean;
  widgets: HomeWidgetKey[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [widgets: HomeWidgetKey[]];
}>();

const { t } = useI18n();

const draft = ref<HomeWidgetKey[]>([]);

// Chaque ouverture repart de l'accueil tel qu'il est.
watch(
  () => props.open,
  (open) => {
    if (open) draft.value = [...props.widgets];
  },
  { immediate: true },
);

const available = computed(() => availableHomeWidgets(draft.value));
const isDefault = computed(() => sameHomeWidgets(draft.value, DEFAULT_HOME_WIDGETS));
const changed = computed(() => !sameHomeWidgets(draft.value, props.widgets));

const name = (key: HomeWidgetKey) => t(`home.widgets.catalog.${key}.name`);
const description = (key: HomeWidgetKey) => t(`home.widgets.catalog.${key}.description`);

function move(index: number, delta: -1 | 1) {
  draft.value = moveHomeWidget(draft.value, index, delta);
}

function remove(key: HomeWidgetKey) {
  draft.value = draft.value.filter((k) => k !== key);
}

function add(key: HomeWidgetKey) {
  draft.value = [...draft.value, key];
}

function reset() {
  draft.value = [...DEFAULT_HOME_WIDGETS];
}

function save() {
  if (!changed.value) {
    emit("close");
    return;
  }
  emit("save", [...draft.value]);
}
</script>

<template>
  <AppModal :open="open" labelledby="home-widgets-title" @close="emit('close')">
    <div class="mb-1 flex items-center justify-between gap-3">
      <h2
        id="home-widgets-title"
        class="flex items-center gap-2 text-lg font-bold text-text-primary"
      >
        <AppIcon name="layout-grid" :size="18" class="text-primary" />
        {{ t("home.widgets.customize") }}
      </h2>
      <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="emit('close')">
        <AppIcon name="x" :size="18" />
      </button>
    </div>
    <p class="text-sm leading-relaxed text-text-secondary">
      {{ t("home.widgets.editorIntro") }}
    </p>

    <h3 class="mt-5 text-sm font-semibold text-text-secondary">{{ t("home.widgets.shown") }}</h3>
    <ol v-if="draft.length" class="mt-1 divide-y divide-line">
      <li v-for="(key, index) in draft" :key="key" class="flex items-center gap-3 py-2">
        <AppIcon :name="HOME_WIDGET_ICONS[key]" :size="17" class="shrink-0 text-primary" />
        <span class="min-w-0 flex-1 font-medium text-text-primary">{{ name(key) }}</span>
        <span class="flex shrink-0 items-center">
          <button
            type="button"
            class="icon-btn disabled:opacity-30 disabled:pointer-events-none"
            :disabled="index === 0"
            :aria-label="t('home.widgets.moveUp', { name: name(key) })"
            @click="move(index, -1)"
          >
            <AppIcon name="chevron-up" :size="18" />
          </button>
          <button
            type="button"
            class="icon-btn disabled:opacity-30 disabled:pointer-events-none"
            :disabled="index === draft.length - 1"
            :aria-label="t('home.widgets.moveDown', { name: name(key) })"
            @click="move(index, 1)"
          >
            <AppIcon name="chevron-down" :size="18" />
          </button>
          <button
            type="button"
            class="icon-btn hover:!text-red-600"
            :aria-label="t('home.widgets.remove', { name: name(key) })"
            @click="remove(key)"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </span>
      </li>
    </ol>
    <p v-else class="mt-2 text-sm text-text-secondary">{{ t("home.widgets.noneShown") }}</p>

    <h3 class="mt-6 text-sm font-semibold text-text-secondary">
      {{ t("home.widgets.available") }}
    </h3>
    <ul v-if="available.length" class="mt-1 divide-y divide-line">
      <li v-for="key in available" :key="key" class="flex items-center gap-3 py-3">
        <AppIcon :name="HOME_WIDGET_ICONS[key]" :size="17" class="shrink-0 text-primary" />
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-text-primary">{{ name(key) }}</span>
          <span class="block text-sm leading-snug text-text-secondary">{{ description(key) }}</span>
        </span>
        <button
          type="button"
          class="btn btn-soft btn-sm shrink-0"
          :aria-label="t('home.widgets.addNamed', { name: name(key) })"
          @click="add(key)"
        >
          <AppIcon name="plus" :size="14" />
          {{ t("home.widgets.add") }}
        </button>
      </li>
    </ul>
    <p v-else class="mt-2 text-sm text-text-secondary">{{ t("home.widgets.allShown") }}</p>

    <div class="mt-6 flex flex-wrap items-center justify-end gap-3">
      <button
        v-if="!isDefault"
        type="button"
        class="me-auto py-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
        @click="reset"
      >
        {{ t("home.widgets.reset") }}
      </button>
      <button type="button" class="btn btn-soft" @click="emit('close')">
        {{ t("common.cancel") }}
      </button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? t("common.saving") : t("common.save") }}
      </button>
    </div>
  </AppModal>
</template>
