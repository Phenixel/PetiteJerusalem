<script setup lang="ts">
/**
 * Repli/dépli animé en hauteur, à utiliser autour d'un élément `v-show` :
 * au lieu de disparaître d'un coup (et de faire sauter le scroll de la page),
 * le contenu se replie sur ~300 ms.
 */
const DURATION_MS = 300;

function setTransition(el: HTMLElement) {
  el.style.transition = `height ${DURATION_MS}ms ease, opacity ${DURATION_MS}ms ease`;
  el.style.overflow = "hidden";
}

function cleanup(el: HTMLElement) {
  el.style.transition = "";
  el.style.overflow = "";
  el.style.height = "";
  el.style.opacity = "";
}

function onEnter(element: Element, done: () => void) {
  const el = element as HTMLElement;
  const target = el.scrollHeight;
  el.style.height = "0px";
  el.style.opacity = "0";
  setTransition(el);
  void el.offsetHeight; // reflow : le départ de l'animation doit être appliqué
  el.style.height = `${target}px`;
  el.style.opacity = "1";
  window.setTimeout(done, DURATION_MS + 20);
}

function onAfterEnter(element: Element) {
  cleanup(element as HTMLElement);
}

function onLeave(element: Element, done: () => void) {
  const el = element as HTMLElement;
  el.style.height = `${el.scrollHeight}px`;
  setTransition(el);
  void el.offsetHeight;
  el.style.height = "0px";
  el.style.opacity = "0";
  window.setTimeout(done, DURATION_MS + 20);
}

function onAfterLeave(element: Element) {
  cleanup(element as HTMLElement);
}
</script>

<template>
  <Transition
    :css="false"
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
    @after-leave="onAfterLeave"
  >
    <slot />
  </Transition>
</template>
