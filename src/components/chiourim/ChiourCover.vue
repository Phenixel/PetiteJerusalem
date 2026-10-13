<script setup lang="ts">
/**
 * La pochette d'une série, d'un rav ou d'un cours.
 *
 * Les cours n'ont pas d'image, et une liste de lecture sans pochettes se lit
 * comme une liste de fichiers. Chaque série reçoit donc une reliure, à la
 * manière des livres de l'étagère de la bibliothèque (LibraryShelf) : une
 * teinte chaude et mate tirée de son identifiant (la même partout, d'une
 * visite à l'autre), son titre en Playfair dans un cadre estampé. En petit,
 * le titre cède la place à ses initiales. Un rav a la même reliure, ronde.
 *
 * Comme les livres de l'étagère, la pochette échappe au thème : c'est un
 * objet, il garde ses couleurs en mode sombre. Des aplats, jamais de dégradé.
 */
import { computed } from "vue";
import { COVER_INK, coverInitials, coverTone } from "./cover";

const props = withDefaults(
  defineProps<{
    /** Ce qui choisit la teinte : l'identifiant de la série, du rav, du cours. */
    seed: string;
    /** Le titre écrit sur la pochette. */
    label: string;
    /** La ligne du bas (le rav d'une série), en grand seulement. */
    sub?: string | null;
    /**
     * avatar : 28 px (le rav à côté de son nom), xs : 40 px, sm : 56 px,
     * md : la largeur de son parent, lg : la pochette d'en-tête.
     */
    size?: "avatar" | "xs" | "sm" | "md" | "lg";
    round?: boolean;
  }>(),
  { sub: null, size: "md", round: false },
);

const tone = computed(() => coverTone(props.seed));
const initials = computed(() => coverInitials(props.label));
const compact = computed(
  () => props.size === "avatar" || props.size === "xs" || props.size === "sm",
);
</script>

<template>
  <div
    class="chiour-cover relative shrink-0 overflow-hidden select-none"
    :class="[
      `chiour-cover--${size}`,
      round ? 'rounded-full' : compact ? 'rounded-md' : 'rounded-card',
    ]"
    :style="{ backgroundColor: tone, color: COVER_INK }"
    aria-hidden="true"
  >
    <span
      v-if="compact || round"
      class="absolute inset-0 flex items-center justify-center font-display font-bold"
      :class="
        size === 'avatar'
          ? 'text-[10px]'
          : size === 'xs'
            ? 'text-sm'
            : size === 'sm'
              ? 'text-lg'
              : 'text-4xl md:text-5xl'
      "
      >{{ initials }}</span
    >
    <div
      v-else
      class="absolute inset-[7%] flex flex-col justify-between border border-current/35 p-[8%]"
    >
      <span
        class="font-display font-bold leading-tight line-clamp-4"
        :class="size === 'lg' ? 'text-2xl md:text-3xl' : 'text-base sm:text-lg'"
        >{{ label }}</span
      >
      <span v-if="sub" class="truncate opacity-80" :class="size === 'lg' ? 'text-sm' : 'text-xs'">{{
        sub
      }}</span>
    </div>
  </div>
</template>

<style scoped>
.chiour-cover--avatar {
  width: 1.75rem;
  height: 1.75rem;
}
.chiour-cover--xs {
  width: 2.5rem;
  height: 2.5rem;
}
.chiour-cover--sm {
  width: 3.5rem;
  height: 3.5rem;
}
.chiour-cover--md {
  width: 100%;
  aspect-ratio: 1;
}
.chiour-cover--lg {
  width: 11rem;
  height: 11rem;
}
@media (min-width: 768px) {
  .chiour-cover--lg {
    width: 14rem;
    height: 14rem;
  }
}
</style>
