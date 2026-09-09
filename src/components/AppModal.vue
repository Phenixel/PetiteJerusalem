<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, ref, toRef, watch } from "vue";
import { routeLocationKey } from "vue-router";
import { useOverlay } from "../composables/useOverlayStack";

/**
 * L'enveloppe commune des fenêtres modales.
 *
 * Chaque modale refaisait à sa façon ce qui doit être pareil partout : la
 * téléportation dans <body>, le fondu, le voile qui ferme au toucher, la
 * touche Échap, la fermeture quand la page change (une navigation laisserait
 * sinon la fenêtre par-dessus la page suivante), le défilement du document
 * bloqué derrière, et le retour Android qui doit fermer la fenêtre avant de
 * naviguer (useOverlayStack). Le clavier arrive dans la fenêtre à l'ouverture
 * (l'élément marqué `data-autofocus`, sinon le premier focalisable) et y
 * reste : Tab tourne dans la fenêtre.
 *
 * Le contenu reste au composant appelant, qui ne fournit que `open` et
 * répond à `close` en ramenant `open` à faux. Les classes du voile et du
 * cadre se remplacent pour les fenêtres qui ont leur propre habillage (le
 * miroir des téfilines) ; le slot `outside` pose du contenu sous le cadre,
 * dans le voile.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    role?: "dialog" | "alertdialog";
    label?: string;
    labelledby?: string;
    describedby?: string;
    overlayClass?: string;
    panelClass?: string;
  }>(),
  {
    role: "dialog",
    label: undefined,
    labelledby: undefined,
    describedby: undefined,
    overlayClass: "modal-overlay",
    panelClass: "modal-panel animate-[scaleIn_0.3s_ease]",
  },
);
const emit = defineEmits<{ close: [] }>();
const close = () => emit("close");

const panel = ref<HTMLElement | null>(null);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
}

/** Ce qui avait le clavier avant l'ouverture, pour le lui rendre après. */
let previouslyFocused: HTMLElement | null = null;

async function focusInitial(): Promise<void> {
  await nextTick();
  const root = panel.value;
  if (!root) return;
  const preferred = root.querySelector<HTMLElement>("[data-autofocus]");
  (preferred ?? focusables()[0] ?? root).focus();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusables();
  if (items.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = panel.value?.contains(active) ?? false;
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Verrou du défilement, compté : deux fenêtres ouvertes l'une sur l'autre ne
 * doivent pas rendre le défilement à la fermeture de la première, et ce qui
 * était posé avant (l'introduction bloque déjà le document) est rendu tel quel.
 */
let locked = false;
watch(
  () => props.open,
  (open) => {
    if (open && !locked) {
      locked = true;
      previouslyFocused = document.activeElement as HTMLElement | null;
      lockScroll();
      void focusInitial();
    } else if (!open && locked) {
      locked = false;
      unlockScroll();
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (locked) unlockScroll();
});

// Une navigation pendant que la fenêtre est ouverte (retour matériel, lien,
// notification) la referme. Hors routeur (tests unitaires), rien à suivre.
const route = inject(routeLocationKey, null);
if (route) {
  watch(
    () => route.fullPath,
    () => {
      if (props.open) close();
    },
  );
}

useOverlay(toRef(props, "open"), close);
</script>

<script lang="ts">
let scrollLocks = 0;
let overflowBefore = "";

function lockScroll(): void {
  if (scrollLocks++ === 0) {
    overflowBefore = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
}

function unlockScroll(): void {
  if (scrollLocks > 0 && --scrollLocks === 0) {
    document.documentElement.style.overflow = overflowBefore;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" :class="overlayClass" @click="close" @keydown="onKeydown">
        <div
          ref="panel"
          :class="[panelClass, 'outline-none']"
          :role="role"
          aria-modal="true"
          :aria-label="label"
          :aria-labelledby="labelledby"
          :aria-describedby="describedby"
          tabindex="-1"
          @click.stop
        >
          <slot />
        </div>
        <slot name="outside" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* fadeIn est défini globalement dans main.css */
.modal-enter-active {
  animation: fadeIn 0.2s ease;
}
.modal-leave-active {
  animation: fadeIn 0.2s ease reverse;
}
</style>
