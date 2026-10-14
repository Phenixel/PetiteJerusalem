<script setup lang="ts">
/**
 * Une série dans une rangée, comme un album : sa pochette, son nom, son rav
 * et son nombre de cours. Toute la tuile mène à la série ; pas de cadre
 * autour (voir « Le cadre se mérite ») : la pochette est déjà une surface.
 */
import ChiourCover from "./ChiourCover.vue";

defineProps<{
  to: string;
  seed: string;
  name: string;
  /** La ligne sous le nom : le rav, le nombre de cours. */
  sub?: string | null;
  /** Le rav, écrit en bas de la pochette. */
  coverSub?: string | null;
  round?: boolean;
}>();
</script>

<template>
  <router-link :to="to" class="group block w-36 shrink-0 sm:w-44">
    <!-- Au survol, toute la pochette se soulève, son ombre avec elle -->
    <div class="transition-transform duration-200 group-hover:-translate-y-1">
      <ChiourCover
        v-if="round"
        :seed="seed"
        :label="name"
        size="md"
        round
        class="shadow-card transition-shadow duration-200 group-hover:shadow-card-hover"
      />
      <ChiourCover
        v-else
        :seed="seed"
        :label="name"
        :sub="coverSub"
        size="md"
        class="shadow-card transition-shadow duration-200 group-hover:shadow-card-hover"
      />
    </div>
    <p
      dir="auto"
      class="mt-2 line-clamp-2 font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary"
      :class="{ 'text-center': round }"
    >
      {{ name }}
    </p>
    <p
      v-if="sub"
      dir="auto"
      class="truncate text-sm text-text-secondary"
      :class="{ 'text-center': round }"
    >
      {{ sub }}
    </p>
  </router-link>
</template>
