<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { User } from "../../services/authService";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t } = useI18n();

const props = defineProps<{
  user: User;
}>();

const emit = defineEmits<{
  (e: "update", data: { name: string; email: string }): void;
}>();

const isEditing = ref(false);
const form = ref({
  name: props.user?.name || "",
  email: props.user?.email || "",
});

watch(
  () => props.user,
  (newUser) => {
    if (newUser) {
      form.value = {
        name: newUser.name,
        email: newUser.email,
      };
    }
  },
  { immediate: true },
);

const startEdit = () => {
  form.value = {
    name: props.user?.name || "",
    email: props.user?.email || "",
  };
  isEditing.value = true;
};

const cancelEdit = () => {
  isEditing.value = false;
  form.value = {
    name: props.user?.name || "",
    email: props.user?.email || "",
  };
};

const save = () => {
  emit("update", form.value);
  isEditing.value = false;
};
</script>

<template>
  <div class="animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-2xl font-bold text-text-primary">
        {{ t("profile.myInformation") }}
      </h2>
      <button v-if="!isEditing" @click="startEdit" class="btn btn-soft">
        <AppIcon name="pencil" :size="14" /> {{ t("common.edit") }}
      </button>
      <div v-else class="flex gap-2">
        <button @click="save" class="btn btn-primary">
          {{ t("common.save") }}
        </button>
        <button @click="cancelEdit" class="btn btn-soft">
          {{ t("common.cancel") }}
        </button>
      </div>
    </div>

    <div class="card p-8 max-w-2xl">
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("profile.displayName")
          }}</label>
          <input
            v-model="form.name"
            :disabled="!isEditing"
            class="field disabled:opacity-60"
            type="text"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("common.emailAddress")
          }}</label>
          <input
            v-model="form.email"
            :disabled="!isEditing"
            class="field disabled:opacity-60"
            type="email"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("profile.userId")
          }}</label>
          <div class="field font-mono text-sm text-text-secondary">
            {{ user.id }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
