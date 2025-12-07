<script setup lang="ts">
interface Props {
  reservationForm: {
    name: string
    email: string
  }
}

interface Emits {
  (e: 'update:reservationForm', value: { name: string; email: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const updateField = (field: 'name' | 'email', value: string) => {
  emit('update:reservationForm', {
    ...props.reservationForm,
    [field]: value,
  })
}
</script>

<template>
  <div class="guest-form-section">
    <div class="form-container">
      <div class="form-group">
        <label for="guest-name" class="form-label">Nom</label>
        <input
          type="text"
          id="guest-name"
          :value="reservationForm.name"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
          placeholder="Votre nom"
          class="form-input"
        />
      </div>
      <div class="form-group">
        <label for="guest-email" class="form-label">Email</label>
        <input
          type="email"
          id="guest-email"
          :value="reservationForm.email"
          @input="updateField('email', ($event.target as HTMLInputElement).value)"
          placeholder="votre@email.com"
          class="form-input"
        />
      </div>
    </div>
  </div>
</template>
