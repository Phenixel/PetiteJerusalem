<script setup lang="ts">
/**
 * Le portefeuille : la journée entière, étalée en cartes compactes, du matin
 * au coucher. On y retrouve ce qu'on a fait, grisé, et ce qu'on a laissé
 * passer, à sa place ; on y coche après coup. « Replier » rend le paquet.
 */
import { useI18n } from "vue-i18n";
import type { TaskView } from "../../../composables/useParcoursViews";
import WalletCard from "./WalletCard.vue";

defineProps<{ views: TaskView[]; current: string | null }>();
const emit = defineEmits<{
  (e: "toggle", view: TaskView, done: boolean, source: string): void;
  (e: "sheet", view: TaskView): void;
  (e: "opened", view: TaskView): void;
  (e: "fold"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div>
    <div class="flex flex-col gap-2">
      <WalletCard
        v-for="view in views"
        :key="view.key"
        :view="view"
        :current="view.key === current"
        @toggle="(done, source) => emit('toggle', view, done, source)"
        @sheet="emit('sheet', view)"
        @opened="emit('opened', view)"
      />
    </div>
    <button type="button" class="btn btn-soft btn-sm mt-3" @click="emit('fold')">
      {{ t("parcours.hub.fold") }}
    </button>
  </div>
</template>
