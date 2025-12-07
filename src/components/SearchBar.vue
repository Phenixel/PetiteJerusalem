<script setup lang="ts">
interface Props {
  searchTerm: string
  placeholder?: string
}

interface Emits {
  (e: 'update:searchTerm', value: string): void
  (e: 'clear-search'): void
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Rechercher...',
})

const emit = defineEmits<Emits>()

const clearSearch = () => {
  emit('update:searchTerm', '')
  emit('clear-search')
}
</script>

<template>
  <div class="search-section">
    <div class="search-container">
      <div class="search-input-wrapper">
        <input
          type="text"
          :value="searchTerm"
          @input="emit('update:searchTerm', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder"
          class="search-input"
        />
        <button
          v-if="searchTerm"
          @click="clearSearch"
          class="clear-search-btn"
          title="Effacer la recherche"
        >
          ✕
        </button>
      </div>
      <div v-if="searchTerm" class="search-info">Recherche : "{{ searchTerm }}"</div>
    </div>
  </div>
</template>
