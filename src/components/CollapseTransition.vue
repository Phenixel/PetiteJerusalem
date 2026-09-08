<script setup lang="ts">
/**
 * Repli/dépli animé en hauteur, à utiliser autour d'un élément `v-show` :
 * au lieu de disparaître d'un coup (et de faire sauter le scroll de la page),
 * le contenu se replie sur ~300 ms.
 *
 * La fin de l'animation est celle que le navigateur annonce (`transitionend`
 * sur la hauteur) ; un minuteur reste en filet, pour le cas où l'événement ne
 * vient pas (élément retiré du flux, transition coupée). Avec « réduire les
 * animations » réglé dans le système, le contenu change d'état sans transition.
 */
const DURATION_MS = 300;

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/** Appelle `done` une seule fois : à la fin de la transition de hauteur, ou au filet. */
function whenFinished(el: HTMLElement, done: () => void) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("transitionend", onEnd);
    window.clearTimeout(timer);
    done();
  };
  const onEnd = (event: TransitionEvent) => {
    if (event.target === el && event.propertyName === "height") finish();
  };
  el.addEventListener("transitionend", onEnd);
  const timer = window.setTimeout(finish, DURATION_MS + 50);
}

function onEnter(element: Element, done: () => void) {
  const el = element as HTMLElement;
  if (reducedMotion()) {
    done();
    return;
  }
  const target = el.scrollHeight;
  el.style.height = "0px";
  el.style.opacity = "0";
  setTransition(el);
  void el.offsetHeight; // reflow : le départ de l'animation doit être appliqué
  whenFinished(el, done);
  el.style.height = `${target}px`;
  el.style.opacity = "1";
}

function onAfterEnter(element: Element) {
  cleanup(element as HTMLElement);
}

function onLeave(element: Element, done: () => void) {
  const el = element as HTMLElement;
  if (reducedMotion()) {
    done();
    return;
  }
  el.style.height = `${el.scrollHeight}px`;
  setTransition(el);
  void el.offsetHeight;
  whenFinished(el, done);
  el.style.height = "0px";
  el.style.opacity = "0";
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
