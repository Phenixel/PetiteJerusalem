<script setup lang="ts">
/**
 * La liste déroulante de la maison, à la place de `<select>`.
 *
 * Un `<select>` ouvre la roue du système : feuille grise sur iOS, boîte
 * carrée sur Android, une fenêtre qui n'a ni les couleurs, ni les rayons, ni
 * la police du formulaire dans lequel elle s'ouvre. Celle-ci est faite des
 * mêmes pièces que le reste de l'app : le champ (`.field`) pour la commande,
 * l'ombre `shadow-pop` pour le panneau, la couleur du thème sur le choix
 * courant.
 *
 * Elle reste une vraie commande : rôles ARIA de liste, clavier (flèches,
 * Entrée, Échap), fermeture au clic à côté, et le bouton retour d'Android la
 * referme avant de naviguer (useOverlay).
 */
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import AppIcon from "./icons/AppIcon.vue";
import { useOverlay } from "../composables/useOverlayStack";

export interface SelectOption {
  value: string;
  label: string;
}

const props = defineProps<{
  options: SelectOption[];
  /**
   * La ligne montrée quand rien n'est choisi. Elle est aussi la première de la
   * liste, de valeur vide : c'est ainsi qu'un `<select>` se déchoisit
   * (« Tous les livres », « Choisir un type… »).
   */
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}>();

const model = defineModel<string>({ required: true });

const open = ref(false);
const root = ref<HTMLElement | null>(null);
/** Ligne survolée ou atteinte au clavier, pas encore choisie. */
const activeIndex = ref(-1);

const rows = computed<SelectOption[]>(() =>
  props.placeholder ? [{ value: "", label: props.placeholder }, ...props.options] : props.options,
);

const currentLabel = computed(
  () => rows.value.find((option) => option.value === model.value)?.label ?? props.placeholder ?? "",
);

function show(): void {
  if (props.disabled) return;
  open.value = true;
  const index = rows.value.findIndex((option) => option.value === model.value);
  activeIndex.value = index === -1 ? 0 : index;
  // Après le rendu du panneau : sans cela, le clic qui vient de l'ouvrir
  // serait lui-même pris pour un clic « à côté » et le refermerait aussitôt.
  void nextTick(() => document.addEventListener("pointerdown", onPointerDown, true));
}

function close(): void {
  open.value = false;
  document.removeEventListener("pointerdown", onPointerDown, true);
}

function toggle(): void {
  if (open.value) close();
  else show();
}

function pick(option: SelectOption): void {
  model.value = option.value;
  close();
}

function onPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

function move(delta: number): void {
  if (!open.value) {
    show();
    return;
  }
  const count = rows.value.length;
  activeIndex.value = (activeIndex.value + delta + count) % count;
}

function onEnter(): void {
  if (!open.value) {
    show();
    return;
  }
  const option = rows.value[activeIndex.value];
  if (option) pick(option);
}

useOverlay(open, close);
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown, true));
</script>

<template>
  <div ref="root" class="relative">
    <button
      :id="id"
      type="button"
      class="field flex w-full items-center justify-between gap-3 text-start"
      :class="[
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        model === '' ? 'text-text-secondary' : '',
      ]"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="close"
    >
      <span>{{ currentLabel }}</span>
      <AppIcon
        name="chevron-down"
        :size="14"
        class="shrink-0 text-text-secondary transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <Transition name="select-panel">
      <ul
        v-if="open"
        role="listbox"
        class="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface py-1 shadow-pop"
      >
        <li
          v-for="(option, index) in rows"
          :key="option.value"
          role="option"
          :aria-selected="option.value === model"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors"
            :class="
              option.value === model
                ? 'font-semibold text-primary'
                : index === activeIndex
                  ? 'bg-black/[0.04] text-text-primary dark:bg-white/[0.06]'
                  : 'text-text-primary'
            "
            @click="pick(option)"
            @mouseenter="activeIndex = index"
          >
            <span>{{ option.label }}</span>
            <AppIcon
              v-if="option.value === model"
              name="check"
              :size="14"
              class="shrink-0 text-primary"
            />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
/* Le panneau se déplie depuis le champ, court : une liste déroulante répond
   au doigt, elle ne se donne pas en spectacle. */
.select-panel-enter-active,
.select-panel-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  transform-origin: top center;
}
.select-panel-enter-from,
.select-panel-leave-to {
  opacity: 0;
  transform: scaleY(0.96) translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .select-panel-enter-active,
  .select-panel-leave-active {
    transition: none;
  }
}
</style>
