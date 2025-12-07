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

// Initialiser le formulaire quand la session change
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

// Réinitialiser le formulaire quand le modal se ferme
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
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Modifier la session</h3>
        <button @click="closeModal" class="close-button">✕</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="saveSession" class="edit-form">
          <div class="form-group">
            <label class="form-label">Nom de la session *</label>
            <input
              v-model="editForm.name"
              class="form-input"
              type="text"
              required
              placeholder="Entrez le nom de la session"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              v-model="editForm.description"
              class="form-input form-textarea"
              placeholder="Décrivez la session (optionnel)"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Date limite *</label>
            <input v-model="editForm.dateLimit" class="form-input" type="datetime-local" required />
          </div>

          <div class="form-actions">
            <button
              type="button"
              @click="closeModal"
              class="btn btn--secondary btn-md"
              :disabled="isLoading"
            >
              Annuler
            </button>
            <button type="submit" class="btn btn--gradient btn-md" :disabled="isLoading">
              {{ isLoading ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-form {
  max-width: 100%;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

/* Utiliser le même style que le modal de partage */
.modal-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-2xl);
  max-width: 500px;
  width: 100%;
  box-shadow: var(--shadow-xl);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-xl);
}

.modal-body {
  color: var(--text-primary);
}

.form-label {
  color: var(--text-primary);
  opacity: 0.9;
}

.form-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: var(--text-primary);
}

.form-input::placeholder {
  color: rgba(0, 0, 0, 0.6);
}

.form-input:focus {
  border-color: rgba(0, 0, 0, 0.3);
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }
}
</style>
