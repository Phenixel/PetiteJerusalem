<script setup lang="ts">
import { ref, watch } from 'vue'
import type { User } from '../../services/authService'

const props = defineProps<{
  user: User
}>()

const emit = defineEmits<{
  (e: 'update', data: { name: string; email: string }): void
}>()

const isEditing = ref(false)
const form = ref({
  name: props.user?.name || '',
  email: props.user?.email || '',
})

watch(
  () => props.user,
  (newUser) => {
    if (newUser) {
      form.value = {
        name: newUser.name,
        email: newUser.email,
      }
    }
  },
  { immediate: true },
)

const startEdit = () => {
  form.value = {
    name: props.user?.name || '',
    email: props.user?.email || '',
  }
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  form.value = {
    name: props.user?.name || '',
    email: props.user?.email || '',
  }
}

const save = () => {
  emit('update', form.value)
  isEditing.value = false
}
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary dark:text-gray-100">Mes informations</h2>
      <button
        v-if="!isEditing"
        @click="startEdit"
        class="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-text-secondary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        <i class="fa-solid fa-edit mr-2"></i> Modifier
      </button>
      <div v-else class="flex gap-2">
        <button
          @click="save"
          class="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Sauvegarder
        </button>
        <button
          @click="cancelEdit"
          class="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-text-secondary transition-colors dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Annuler
        </button>
      </div>
    </div>

    <div
      class="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 p-8 max-w-2xl dark:bg-gray-800/60 dark:border-gray-700"
    >
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
            >Nom d'affichage</label
          >
          <input
            v-model="form.name"
            :disabled="!isEditing"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-60 disabled:bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700 dark:disabled:bg-gray-900/50"
            type="text"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
            >Adresse e-mail</label
          >
          <input
            v-model="form.email"
            :disabled="!isEditing"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-60 disabled:bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700 dark:disabled:bg-gray-900/50"
            type="email"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2 dark:text-gray-400"
            >ID utilisateur</label
          >
          <div
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-text-secondary font-mono text-sm dark:bg-gray-900/50 dark:border-gray-600 dark:text-gray-400"
          >
            {{ user.id }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
