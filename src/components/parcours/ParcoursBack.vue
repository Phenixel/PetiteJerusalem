<script setup lang="ts">
/**
 * Le retour en tête des pages de Mon parcours (P2-Journee, P2-Parcours,
 * P2-Programme…) : un chevron et le nom de la page d'où l'on vient, à
 * l'encre. Sans `to`, c'est « Retour » : la page d'avant, dans l'historique
 * (les étapes de « Nouvel objectif »).
 */
import { useRouter, type RouteLocationRaw } from "vue-router";

defineProps<{ to?: RouteLocationRaw; label: string }>();

const router = useRouter();
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    class="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"
    @click="to ? undefined : router.back()"
  >
    <svg class="h-[18px] w-[18px] rtl:rotate-180" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    {{ label }}
  </component>
</template>
