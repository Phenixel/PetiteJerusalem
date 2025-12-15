<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Session } from '../models/models'

interface Props {
  show: boolean
  session: Session | null
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'save', sessionData: { name: string; description: string; dateLimit: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const editForm = ref({
  name: '',
  description: '',
  dateLimit: '',
})

const isLoading = ref(false)

const closeModal = () => {
  emit('update:show', false)
}

const saveSession = async () => {
  if (!editForm.value.name.trim()) {
    alert('Le nom de la session est requis')
    return
  }

  if (!editForm.value.dateLimit) {
    alert('La date limite est requise')
    return
  }

  try {
    isLoading.value = true
    emit('save', {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
      dateLimit: editForm.value.dateLimit,
    })
    closeModal()
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
    alert('Erreur lors de la sauvegarde de la session')
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.session,
  (newSession) => {
    if (newSession) {
      editForm.value = {
        name: newSession.name,
        description: newSession.description || '',
        dateLimit:
          newSession.dateLimit instanceof Date
            ? newSession.dateLimit.toISOString().slice(0, 16)
            : newSession.dateLimit,
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.show,
  (newValue) => {
    if (!newValue && props.session) {
      editForm.value = {
        name: props.session.name,
        description: props.session.description || '',
        dateLimit:
          props.session.dateLimit instanceof Date
            ? props.session.dateLimit.toISOString().slice(0, 16)
            : props.session.dateLimit,
      }
    }
  },
)
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease]"
    @click="closeModal"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[scaleIn_0.3s_ease] border border-gray-100 dark:bg-gray-800 dark:border-gray-700"
      @click.stop
    >
      <div
        class="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700"
      >
        <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">Modifier la session</h3>
        <button
          @click="closeModal"
          class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        >
          ✕
        </button>
      </div>

      <div class="p-6">
        <form @submit.prevent="saveSession" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300"
              >Nom de la session *</label
            >
            <input
              v-model="editForm.name"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              type="text"
              required
              placeholder="Entrez le nom de la session"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300"
              >Description</label
            >
            <textarea
              v-model="editForm.description"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-y dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              placeholder="Décrivez la session (optionnel)"
              rows="3"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300"
              >Date limite *</label
            >
            <input
              v-model="editForm.dateLimit"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
              type="datetime-local"
              required
            />
          </div>

          <div
            class="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-100 dark:border-gray-700"
          >
            <button
              type="button"
              @click="closeModal"
              class="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              :disabled="isLoading"
            >
              Annuler
            </button>
            <button
              type="submit"
              class="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-bold hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              :disabled="isLoading"
            >
              {{ isLoading ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
