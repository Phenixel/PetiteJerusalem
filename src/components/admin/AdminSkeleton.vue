<script setup lang="ts">
/** Le chargement d'une liste du backoffice : sa forme, plutôt qu'un rond qui tourne. */
withDefaults(defineProps<{ rows?: number }>(), { rows: 5 });
</script>

<template>
  <div class="space-y-2" aria-busy="true">
    <div class="h-8 w-72 max-w-full animate-pulse rounded-pill bg-black/5 dark:bg-white/10"></div>
    <div v-for="n in rows" :key="n" class="card h-[4.5rem] animate-pulse"></div>
  </div>
</template>
