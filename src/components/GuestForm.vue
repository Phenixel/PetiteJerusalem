<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

const { t } = useI18n();
const route = useRoute();

interface Props {
  reservationForm: {
    name: string;
    email: string;
  };
}

interface Emits {
  (e: "update:reservationForm", value: { name: string; email: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateField = (field: "name" | "email", value: string) => {
  emit("update:reservationForm", {
    ...props.reservationForm,
    [field]: value,
  });
};
</script>

<template>
  <div class="w-full">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label
          for="guest-name"
          class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-300"
          >{{ t("common.name") }}</label
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
          >{{ t("common.email") }}</label
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

    <!-- Hint pour inciter à la création de compte -->
    <div
      class="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 dark:bg-primary/10 dark:border-primary/20"
    >
      <i class="fa-solid fa-lightbulb text-primary mt-0.5 text-sm flex-shrink-0"></i>
      <p class="text-sm text-text-secondary dark:text-gray-400">
        <span class="font-semibold text-primary">{{ t("signupPrompt.tip") }}</span>
        {{ " " }}
        {{ t("signupPrompt.guestHint") }}
        {{ " " }}
        <router-link
          :to="{ path: '/login', query: { redirect: route.fullPath, mode: 'signup' } }"
          class="font-semibold text-primary hover:underline"
        >
          {{ t("signupPrompt.guestHintLink") }} →
        </router-link>
      </p>
    </div>
  </div>
</template>
