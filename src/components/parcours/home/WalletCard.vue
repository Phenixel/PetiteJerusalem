<script setup lang="ts">
/**
 * Une carte du portefeuille, la journée étalée : compacte, à côté de sa case.
 * Toucher la carte ouvre sa page ; la glisser à droite la coche (ou la
 * décoche) ; l'appui long ouvre sa fiche. La carte du dessus du paquet garde
 * sa couleur pleine ; une carte faite s'éteint ; les autres attendent, sur
 * fond clair.
 */
import { computed } from "vue";
import type { TaskView } from "../../../composables/useParcoursViews";
import { dragStyle, useSwipe } from "../../../composables/useSwipe";
import TaskCard from "../TaskCard.vue";
import TaskCheck from "../TaskCheck.vue";

const props = defineProps<{ view: TaskView; current: boolean }>();
const emit = defineEmits<{
  (e: "toggle", done: boolean, source: string): void;
  (e: "sheet"): void;
  (e: "opened"): void;
}>();

const done = computed(() => props.view.progress === "done");
const tone = computed(() => (done.value ? "done" : props.current ? "color" : "plain"));

const gesture = useSwipe({
  x: true,
  onSwipe(direction) {
    if (direction === "right") emit("toggle", !done.value, "home_wallet_swipe");
  },
  onLongPress: () => emit("sheet"),
});
const cardStyle = computed(() => dragStyle(gesture, { right: true }));

function activate(): void {
  if (props.view.route) emit("opened");
  else emit("sheet");
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="wallet-card min-w-0 flex-1 select-none"
      :class="{ 'is-skipped': view.skipped }"
      :style="cardStyle"
      style="touch-action: pan-y"
      v-bind="gesture.listeners"
    >
      <TaskCard :view="view" :tone="tone" compact @activate="activate" />
    </div>
    <TaskCheck :view="view" @toggle="(next) => emit('toggle', next, 'home_wallet_check')" />
  </div>
</template>

<style scoped>
.wallet-card {
  -webkit-touch-callout: none;
}
.wallet-card.is-skipped {
  opacity: 0.55;
}
</style>
