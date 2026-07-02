<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "./icons/AppIcon.vue";

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
        <label for="guest-name" class="block text-sm font-semibold text-text-primary mb-2">{{
          t("common.name")
        }}</label>
        <input
          type="text"
          id="guest-name"
          :value="reservationForm.name"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
          :placeholder="t('common.yourName')"
          class="field"
        />
      </div>
      <div>
        <label for="guest-email" class="block text-sm font-semibold text-text-primary mb-2">{{
          t("common.email")
        }}</label>
        <input
          type="email"
          id="guest-email"
          :value="reservationForm.email"
          @input="updateField('email', ($event.target as HTMLInputElement).value)"
          placeholder="email@example.com"
          class="field"
        />
      </div>
    </div>

    <!-- Hint pour inciter à la création de compte -->
    <div class="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-primary/5 dark:bg-primary/10">
      <AppIcon name="lightbulb" :size="14" class="text-primary mt-0.5 shrink-0" />
      <p class="text-sm text-text-secondary">
        <span class="font-semibold text-primary">{{ t("signupPrompt.tip") }}</span>
        {{ " " }}
        {{ t("signupPrompt.guestHint") }}
        {{ " " }}
        <router-link
          :to="{ path: '/login', query: { redirect: route.fullPath, mode: 'signup' } }"
          class="font-semibold text-primary hover:underline"
        >
          {{ t("signupPrompt.guestHintLink") }} <AppIcon name="chevron-right" :size="12" />
        </router-link>
      </p>
    </div>
  </div>
</template>
