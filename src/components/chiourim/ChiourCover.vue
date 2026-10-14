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

/**
 * La taille du titre, en part de la largeur de la pochette (cqw) : aussi
 * grand que possible, sans qu'un mot ne déborde du cadre, et plus petit pour
 * un titre long, qui doit tenir en quatre lignes.
 */
const titleSize = computed(() => {
  const longestWord = Math.max(...props.label.split(/\s+/).map((w) => w.length), 1);
  const byWord = 70 / (0.58 * longestWord);
  const length = props.label.length;
  const byLength = length <= 12 ? 16 : length <= 20 ? 13.5 : length <= 30 ? 11 : 9;
  return Math.max(7, Math.min(byWord, byLength));
});
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
    <!-- La face : le titre au centre, aussi grand que la pochette le permet ;
         le rav en bas, sous un fleuron, en petites capitales. -->
    <div v-else class="cover-face" :class="{ 'cover-face--foot': sub }">
      <span dir="auto" class="cover-title font-display" :style="{ fontSize: `${titleSize}cqw` }">{{
        label
      }}</span>
      <span v-if="sub" class="cover-foot">
        <span class="cover-ornament" aria-hidden="true">
          <span class="cover-rule"></span>
          <span class="cover-diamond"></span>
          <span class="cover-rule"></span>
        </span>
        <span dir="auto" class="cover-sub">{{ sub }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* La pochette se mesure elle-même : ses textes suivent sa largeur (cqw), du
   catalogue au plein écran. */
.chiour-cover {
  container-type: inline-size;
}
.cover-face {
  position: absolute;
  inset: 6%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6cqw;
  padding: 8cqw 7cqw;
  border: 1px solid color-mix(in srgb, currentColor 38%, transparent);
  text-align: center;
}
/* Avec le rav en bas, le titre se centre dans ce qui reste au-dessus. */
.cover-face--foot {
  padding-bottom: 20cqw;
}
.cover-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.cover-foot {
  position: absolute;
  inset-inline: 7cqw;
  bottom: 6cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5cqw;
}
.cover-ornament {
  display: flex;
  align-items: center;
  gap: 2cqw;
  opacity: 0.7;
}
.cover-rule {
  height: 1px;
  width: 7cqw;
  background: currentColor;
}
.cover-diamond {
  height: 1.6cqw;
  width: 1.6cqw;
  transform: rotate(45deg);
  background: currentColor;
}
.cover-sub {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 4.2cqw;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.85;
}
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
