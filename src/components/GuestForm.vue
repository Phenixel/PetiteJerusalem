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
  <div class="w-full">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="guest-name" class="block text-sm font-semibold text-text-primary mb-2"
          >Nom</label
        >
        <input
          type="text"
          id="guest-name"
          :value="reservationForm.name"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
          placeholder="Votre nom"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
        />
      </div>
      <div>
        <label for="guest-email" class="block text-sm font-semibold text-text-primary mb-2"
          >Email</label
        >
        <input
          type="email"
          id="guest-email"
          :value="reservationForm.email"
          @input="updateField('email', ($event.target as HTMLInputElement).value)"
          placeholder="votre@email.com"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
        />
      </div>
    </div>
  </div>
</template>
