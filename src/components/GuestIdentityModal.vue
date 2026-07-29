<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

interface Props {
  show: boolean;
  // Défini par le créateur de la session : lorsque true, l'email est demandé
  // en même temps que le nom.
  emailRequired?: boolean;
  // Nombre de sections sélectionnées, rappelé dans la modale.
  count?: number;
  // Ce que l'invité a éventuellement déjà saisi en haut de page.
  name?: string;
  email?: string;
  loading?: boolean;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "confirm", value: { name: string; email: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  emailRequired: false,
  count: 0,
  name: "",
  email: "",
  loading: false,
});
const emit = defineEmits<Emits>();

const nameValue = ref("");
const emailValue = ref("");
const error = ref<string | null>(null);
// Email facultatif : masqué par défaut pour que la dernière étape reste un
// seul champ, révélé si l'invité veut le renseigner (ou l'avait déjà fait).
const emailFieldRevealed = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const showEmailField = computed(() => props.emailRequired || emailFieldRevealed.value);

const subtitle = computed(() =>
  props.emailRequired
    ? t("guestIdentity.subtitleWithEmail", { count: props.count })
    : t("guestIdentity.subtitle", { count: props.count }),
);

// À l'ouverture : reprendre la saisie partielle du formulaire de la page
// (souvent l'email seul) et donner le focus au nom.
watch(
  () => props.show,
  async (shown) => {
    if (!shown) return;
    nameValue.value = props.name;
    emailValue.value = props.email;
    emailFieldRevealed.value = props.email.trim() !== "";
    error.value = null;
    await nextTick();
    nameInput.value?.focus();
  },
  { immediate: true },
);

const close = () => {
  if (props.loading) return;
  emit("update:show", false);
};

const submit = () => {
  const name = nameValue.value.trim();
  const email = emailValue.value.trim();

  if (!name) {
    error.value = t("guestIdentity.nameRequired");
    return;
  }
  if (props.emailRequired && !email) {
    error.value = t("guestIdentity.emailRequired");
    return;
  }
  // Format vérifié seulement si un email est fourni : c'est le seul moyen de
  // retrouver ses réservations ailleurs, une faute de frappe le perdrait.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.value = t("guestIdentity.emailInvalid");
    return;
  }

  error.value = null;
  emit("confirm", { name, email });
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="close">
        <div class="modal-panel animate-[scaleIn_0.3s_ease]" @click.stop>
          <div class="text-center">
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/10 text-primary"
            >
              <AppIcon name="user" :size="24" />
            </div>
            <h3 class="text-xl font-bold text-text-primary mb-1">
              {{ t("guestIdentity.title") }}
            </h3>
            <p class="text-sm text-text-secondary">
              {{ subtitle }}
            </p>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="submit">
            <div>
              <label
                for="guest-identity-name"
                class="block text-sm font-semibold text-text-primary mb-2"
              >
                {{ t("common.name") }}
              </label>
              <input
                ref="nameInput"
                id="guest-identity-name"
                type="text"
                v-model="nameValue"
                :placeholder="t('common.yourName')"
                autocomplete="name"
                class="field"
              />
            </div>

            <div v-if="showEmailField">
              <label
                for="guest-identity-email"
                class="block text-sm font-semibold text-text-primary mb-2"
              >
                {{ t("common.email") }}
                <span v-if="!emailRequired" class="font-normal text-text-secondary/70">
                  ({{ t("guestForm.optional") }})
                </span>
              </label>
              <input
                id="guest-identity-email"
                type="email"
                v-model="emailValue"
                placeholder="email@example.com"
                autocomplete="email"
                class="field"
              />
            </div>

            <div v-else>
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

            <p v-if="error" class="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AppIcon name="alert-circle" :size="14" />
              {{ error }}
            </p>

            <div class="flex gap-3 pt-2">
              <button type="button" @click="close" :disabled="loading" class="btn btn-soft flex-1">
                {{ t("common.cancel") }}
              </button>
              <button type="submit" :disabled="loading" class="btn btn-primary flex-1">
                <AppIcon v-if="loading" name="spinner" :size="15" class="animate-spin" />
                {{ loading ? t("guestIdentity.confirming") : t("guestIdentity.confirm") }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* fadeIn is defined globally in main.css */
.modal-enter-active {
  animation: fadeIn 0.3s ease;
}
.modal-leave-active {
  animation: fadeIn 0.3s ease reverse;
}
</style>
