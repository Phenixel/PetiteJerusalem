<script setup lang="ts">
/**
 * Le paquet de l'accueil : la carte de ce qu'il y a à faire maintenant, en
 * couleur pleine, aux mesures de la carte du moment du Sidour, et deux bords
 * dessous qui disent qu'il y en a d'autres.
 *
 * Toucher la carte ouvre sa page, directement. Glisser à droite : c'est fait ;
 * à gauche : plus tard (elle passe sous le paquet) ; tirer vers le bas, ou
 * toucher les bords : toute la journée. Un appui long ouvre sa fiche ; une
 * carte sans page l'ouvre au toucher. Chaque geste a aussi son bouton, sous
 * le paquet sur le site, lu seulement par le lecteur d'écran dans l'app.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../../../composables/useNativeApp";
import type { TaskView } from "../../../composables/useParcoursViews";
import { dragStyle, useSwipe } from "../../../composables/useSwipe";
import TaskCard from "../TaskCard.vue";

const props = defineProps<{
  top: TaskView | null;
  /** La journée a des cartes : le portefeuille a quelque chose à montrer. */
  hasTasks: boolean;
}>();

const emit = defineEmits<{
  (e: "done", source: string): void;
  (e: "later", source: string): void;
  (e: "wallet", source: string): void;
  (e: "sheet"): void;
  (e: "opened"): void;
}>();

const { t } = useI18n();

/** Comment la carte du dessus s'en va : à droite faite, à gauche remise. */
const leaving = ref<"deck-done" | "deck-later" | "deck-fade">("deck-fade");

function done(source: string): void {
  leaving.value = "deck-done";
  emit("done", source);
}
function later(source: string): void {
  leaving.value = "deck-later";
  emit("later", source);
}

const gesture = useSwipe({
  x: true,
  y: "down",
  threshold: 80,
  onSwipe(direction) {
    if (direction === "right") done("home_deck_swipe");
    else if (direction === "left") later("swipe");
    else if (direction === "down") emit("wallet", "swipe");
  },
  onLongPress: () => emit("sheet"),
});
const cardStyle = computed(() => dragStyle(gesture, { left: true, right: true, down: true }));

/** Le toucher : la page de la carte, ou sa fiche quand elle n'en a pas. */
function activate(): void {
  if (props.top?.route) emit("opened");
  else emit("sheet");
}
</script>

<template>
  <div>
    <div class="relative pb-3">
      <Transition :name="leaving" mode="out-in" @after-leave="leaving = 'deck-fade'">
        <div
          v-if="top"
          :key="top.key"
          class="deck-card relative z-10 select-none"
          :style="cardStyle"
          style="touch-action: pan-y"
          v-bind="gesture.listeners"
        >
          <TaskCard :view="top" tone="color" @activate="activate" />
        </div>
        <div v-else key="rest" class="card relative z-10 px-5 py-5">
          <p class="font-display text-2xl font-bold leading-tight">
            {{ hasTasks ? t("parcours.hub.allDone") : t("parcours.today.nothing") }}
          </p>
          <p v-if="hasTasks" class="mt-1 text-sm text-text-secondary">
            {{ t("parcours.hub.allDoneHint") }}
          </p>
        </div>
      </Transition>
      <!-- Les bords du paquet : la journée continue dessous. Les toucher l'étale. -->
      <button
        v-if="hasTasks"
        type="button"
        class="deck-edges"
        :aria-label="t('parcours.hub.wallet')"
        @click="emit('wallet', 'edge')"
      >
        <span class="deck-edge deck-edge-1" />
        <span class="deck-edge deck-edge-2" />
      </button>
    </div>

    <div :class="isNativeApp ? 'sr-only' : 'mt-2 flex flex-wrap gap-2'">
      <template v-if="top">
        <button type="button" class="btn btn-primary btn-sm" @click="done('home_deck_button')">
          {{ t("parcours.hub.done") }}
        </button>
        <button type="button" class="btn btn-soft btn-sm" @click="later('button')">
          {{ t("parcours.hub.later") }}
        </button>
      </template>
      <button
        v-if="hasTasks"
        type="button"
        class="btn btn-soft btn-sm"
        @click="emit('wallet', 'button')"
      >
        {{ t("parcours.hub.wallet") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* L'appui long ouvre la fiche : pas l'aperçu du lien que le système proposerait. */
.deck-card {
  -webkit-touch-callout: none;
}
/* Les deux bords, sous la carte : la même teinte, de plus en plus pâle. */
.deck-edges {
  position: absolute;
  inset-inline: 0;
  bottom: -6px;
  height: 22px;
  display: block;
}
.deck-edge {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
.deck-edge-1 {
  bottom: 10px;
  width: 94%;
  height: 12px;
  background: color-mix(in srgb, var(--color-brand) 45%, var(--color-surface));
}
.deck-edge-2 {
  bottom: 4px;
  width: 86%;
  height: 12px;
  background: color-mix(in srgb, var(--color-brand) 22%, var(--color-surface));
}
.deck-done-leave-active,
.deck-later-leave-active {
  transition:
    transform 0.28s ease-in,
    opacity 0.28s ease-in;
}
.deck-done-leave-to {
  transform: translateX(110%) rotate(8deg);
  opacity: 0;
}
.deck-later-leave-to {
  transform: translateX(-110%) rotate(-8deg);
  opacity: 0;
}
.deck-done-enter-active,
.deck-later-enter-active,
.deck-fade-enter-active {
  transition: opacity 0.2s ease-out;
}
.deck-done-enter-from,
.deck-later-enter-from,
.deck-fade-enter-from {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .deck-done-leave-active,
  .deck-later-leave-active,
  .deck-done-enter-active,
  .deck-later-enter-active,
  .deck-fade-enter-active {
    transition: none;
  }
}
</style>
