<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
        <label
          for="guest-name"
          class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
          >{{ t('common.name') }}</label
        >
        <input
          type="text"
          id="guest-name"
          :value="reservationForm.name"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
          :placeholder="t('common.yourName')"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
        />
      </div>
      <div>
        <label
          for="guest-email"
          class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
          >{{ t('common.email') }}</label
        >
        <input
          type="email"
          id="guest-email"
          :value="reservationForm.email"
          @input="updateField('email', ($event.target as HTMLInputElement).value)"
          placeholder="email@example.com"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-700"
        />
      </div>
    </div>
  </div>
</template>
