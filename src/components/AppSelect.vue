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
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
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
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
/** Ligne survolée ou atteinte au clavier, pas encore choisie. */
const activeIndex = ref(-1);

/**
 * Identifiants des lignes : ils ne servent qu'à `aria-activedescendant`, qui
 * dit au lecteur d'écran quelle ligne le clavier a atteinte. Sans eux, les
 * flèches déplaçaient une surbrillance dont il n'annonçait rien. C'est aussi
 * pourquoi le champ porte `role="combobox"` : sur un simple bouton, l'attribut
 * n'a pas cours et rien n'est annoncé.
 */
const listId = `select-${Math.random().toString(36).slice(2, 9)}`;
const optionId = (index: number) => `${listId}-${index}`;

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
  // Le garde-fou `alive` évite d'accrocher l'écouteur à un composant démonté
  // entre-temps (une barre qui disparaît sous le panneau ouvert) : personne ne
  // le retirerait plus.
  void nextTick(() => {
    if (alive) document.addEventListener("pointerdown", onPointerDown, true);
  });
}

function close({ keepFocus = false } = {}): void {
  if (!open.value) return;
  open.value = false;
  // Remise à zéro : sans elle, rouvrir sur la même ligne ne déclenchait plus
  // la surveillance qui la fait défiler dans le panneau, et une liste longue
  // rouvrait en haut, le choix courant hors de vue.
  activeIndex.value = -1;
  document.removeEventListener("pointerdown", onPointerDown, true);
  // Le clavier revient au champ : la ligne choisie vient de disparaître avec
  // le panneau, et sans cela le focus retombait sur <body>, d'où la
  // tabulation suivante repartait du haut de la page.
  if (keepFocus) trigger.value?.focus();
}

function toggle(): void {
  if (open.value) close();
  else show();
}

function pick(option: SelectOption): void {
  model.value = option.value;
  close({ keepFocus: true });
}

function onPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

/**
 * Le clavier quitte la commande (Tab) : le panneau se referme avec lui.
 *
 * Seulement si le focus va quelque part : Safari et le WebView d'iOS ne
 * donnent pas le focus au clic, si bien qu'appuyer sur une ligne produit un
 * `focusout` sans destination. Fermer là-dessus escamotait la ligne avant que
 * le clic ne l'atteigne. Le clic à côté, lui, est déjà couvert.
 */
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && !root.value?.contains(next)) close();
}

/**
 * La ligne atteinte au clavier reste visible : le panneau s'arrête à 16 rem
 * et une liste de trente livres passe dessous sans cela, on validait une
 * ligne qu'on ne voyait pas.
 */
watch(activeIndex, async (index) => {
  if (!open.value || index < 0) return;
  await nextTick();
  panel.value?.children[index]?.scrollIntoView({ block: "nearest" });
});

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

/**
 * Échap referme le panneau, et s'arrête là : sans quoi la touche continuait sa
 * route jusqu'à la fenêtre modale qui héberge le formulaire, et la refermait
 * avec ce qu'on venait d'y écrire.
 */
function onEscape(event: KeyboardEvent): void {
  if (!open.value) return;
  event.stopPropagation();
  close({ keepFocus: true });
}

/** Faux dès le démontage : voir l'écouteur différé de `show`. */
let alive = true;

useOverlay(open, close);
onBeforeUnmount(() => {
  alive = false;
  document.removeEventListener("pointerdown", onPointerDown, true);
});
</script>

<template>
  <div ref="root" class="relative" @focusout="onFocusOut">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="field flex w-full items-center justify-between gap-3 text-start"
      :class="[
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        model === '' ? 'text-text-secondary' : '',
      ]"
      :disabled="disabled"
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="open ? listId : undefined"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      @click="toggle"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="onEscape"
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
        :id="listId"
        ref="panel"
        role="listbox"
        class="absolute inset-x-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface py-1 shadow-pop"
      >
        <!-- La ligne est la ligne : un bouton à l'intérieur d'un `option` se
             présente comme un bouton aux lecteurs d'écran, et le clavier reste
             de toute façon sur le champ (aria-activedescendant). -->
        <li
          v-for="(option, index) in rows"
          :id="optionId(index)"
          :key="option.value"
          role="option"
          :aria-selected="option.value === model"
          class="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors"
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
