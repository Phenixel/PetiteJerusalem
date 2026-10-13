<script setup lang="ts">
/**
 * Une rangée qui défile de côté : les séries, les rabbanim, les cours à
 * reprendre. Le titre à gauche, « Tout voir » au bout quand la rangée ne
 * montre qu'une partie. Sur ordinateur, deux flèches font défiler la rangée
 * d'une page (la molette ne défile pas de côté) ; sur un téléphone, le doigt
 * suffit, et la rangée déborde jusqu'au bord de l'écran pour le dire.
 *
 * Une rangée qui défile de côté rogne aussi ce qui dépasse en haut et en
 * bas : la pochette qui se soulève au survol y perdait son bord haut, et
 * semblait ne bouger que de l'intérieur. La piste a donc de la marge
 * au-dessus et au-dessous (reprise en marges négatives, la mise en page ne
 * change pas), assez pour la pochette soulevée et son ombre.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";

defineProps<{ title: string; seeAllTo?: string | null }>();

const { t } = useI18n();
const track = ref<HTMLElement | null>(null);
const canBack = ref(false);
const canForward = ref(false);

function update() {
  const el = track.value;
  if (!el) return;
  // scrollLeft est négatif en hébreu (sens de lecture inversé) : on raisonne
  // sur sa valeur absolue.
  const pos = Math.abs(el.scrollLeft);
  canBack.value = pos > 4;
  canForward.value = pos + el.clientWidth < el.scrollWidth - 4;
}

function page(direction: 1 | -1) {
  const el = track.value;
  if (!el) return;
  const rtl = getComputedStyle(el).direction === "rtl";
  el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: "smooth" });
}

// La largeur de la rangée change avec l'écran, son contenu avec le catalogue
// (une tuile de plus à reprendre) : les deux décident des flèches.
let resize: ResizeObserver | null = null;
let content: MutationObserver | null = null;
onMounted(() => {
  update();
  if (!track.value) return;
  if ("ResizeObserver" in window) {
    resize = new ResizeObserver(update);
    resize.observe(track.value);
  }
  content = new MutationObserver(update);
  content.observe(track.value, { childList: true });
});
onBeforeUnmount(() => {
  resize?.disconnect();
  content?.disconnect();
});
</script>

<template>
  <section class="rail">
    <div class="mb-3 flex items-end justify-between gap-4">
      <h2 class="font-display text-2xl font-bold tracking-tight text-text-primary">{{ title }}</h2>
      <div class="flex shrink-0 items-center gap-2">
        <router-link
          v-if="seeAllTo"
          :to="seeAllTo"
          class="text-sm font-semibold text-text-secondary hover:text-primary"
          >{{ t("chiourim.seeAll") }}</router-link
        >
        <button
          type="button"
          class="hidden h-8 w-8 items-center justify-center rounded-full bg-black/5 text-text-primary transition-opacity disabled:opacity-30 md:flex dark:bg-white/10"
          :disabled="!canBack"
          :aria-label="t('chiourim.railBack')"
          @click="page(-1)"
        >
          <AppIcon name="chevron-left" :size="16" class="rtl:rotate-180" />
        </button>
        <button
          type="button"
          class="hidden h-8 w-8 items-center justify-center rounded-full bg-black/5 text-text-primary transition-opacity disabled:opacity-30 md:flex dark:bg-white/10"
          :disabled="!canForward"
          :aria-label="t('chiourim.railForward')"
          @click="page(1)"
        >
          <AppIcon name="chevron-right" :size="16" class="rtl:rotate-180" />
        </button>
      </div>
    </div>
    <div
      ref="track"
      class="rail-track -mx-6 -mb-3 -mt-3 flex items-start snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-5 pt-3"
      @scroll.passive="update"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
.rail-track {
  scrollbar-width: none;
  scroll-padding-inline: 1.5rem;
}
.rail-track::-webkit-scrollbar {
  display: none;
}
.rail-track > :deep(*) {
  scroll-snap-align: start;
}
</style>
