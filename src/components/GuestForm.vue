<script setup lang="ts">
import { ref, computed } from "vue";
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
  // Défini par le créateur de la session : lorsque false, l'invité peut
  // réserver avec son nom seul.
  emailRequired?: boolean;
}

interface Emits {
  (e: "update:reservationForm", value: { name: string; email: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  emailRequired: false,
});
const emit = defineEmits<Emits>();

// Email optionnel : le champ est masqué pour ne pas freiner la réservation,
// un bouton discret permet de l'ajouter (recommandé pour retrouver ses
// réservations ailleurs que sur ce navigateur).
const emailFieldRevealed = ref(false);
const showEmailField = computed(() => props.emailRequired || emailFieldRevealed.value);

const updateField = (field: "name" | "email", value: string) => {
  emit("update:reservationForm", {
    ...props.reservationForm,
    [field]: value,
  });
};
</script>

<template>
  <div class="w-full">
    <div class="grid grid-cols-1 gap-4" :class="{ 'md:grid-cols-2': showEmailField }">
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
      <div v-if="showEmailField">
        <label for="guest-email" class="block text-sm font-semibold text-text-primary mb-2">
          {{ t("common.email") }}
          <span v-if="!emailRequired" class="font-normal text-text-secondary/70">
            ({{ t("guestForm.optional") }})
          </span>
        </label>
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

    <!-- Email optionnel masqué : expliquer la limite et inciter à l'ajouter. -->
    <div v-if="!showEmailField" class="mt-3">
      <button
        type="button"
        @click="emailFieldRevealed = true"
        class="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
      >
        <AppIcon name="plus" :size="12" />
        {{ t("guestForm.addEmail") }}
      </button>
      <p class="mt-1 text-xs text-text-secondary/80">
        {{ t("guestForm.noEmailHint") }}
      </p>
    </div>

    <!-- Incitation discrète à la création de compte : une simple ligne,
         le formulaire invité doit rester le plus léger possible. -->
    <p class="mt-3 text-xs text-text-secondary/80">
      <AppIcon name="lightbulb" :size="11" class="text-primary" />
      {{ t("signupPrompt.guestHint") }}
      {{ " " }}
      <router-link
        :to="{ path: '/login', query: { redirect: route.fullPath, mode: 'signup' } }"
        class="font-semibold text-primary hover:underline"
      >
        {{ t("signupPrompt.guestHintLink") }} <AppIcon name="chevron-right" :size="10" />
      </router-link>
    </p>
  </div>
</template>
