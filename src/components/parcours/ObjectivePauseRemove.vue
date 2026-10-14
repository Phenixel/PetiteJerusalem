<script setup lang="ts">
/**
 * Le bas des réglages d'un objectif : la pause, qui garde tout, et le
 * retrait, qui se confirme avec le nom de ce qu'on retire (docs/design.md,
 * « Ce qui est à soi se range avec le reste »).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfirm } from "../../composables/useConfirm";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import type { Objective } from "../../services/parcours/model";
import ToggleSwitch from "../ToggleSwitch.vue";

const props = defineProps<{ objective: Objective }>();

const { t } = useI18n();
const router = useRouter();
const { confirm } = useConfirm();
const store = useParcours();
const views = useParcoursViews();

const paused = computed({
  get: () => props.objective.pausedFrom !== undefined,
  set: (value: boolean) => {
    store.setPaused(props.objective.id, value);
    analyticsService.capture("parcours_objective_paused", {
      paused: value,
      kind: props.objective.kind,
    });
  },
});

async function remove(): Promise<void> {
  const accepted = await confirm({
    title: t("parcours.settings.removeTitle", { name: views.objectiveTitle(props.objective) }),
    message: t("parcours.settings.removeText"),
    confirmLabel: t("parcours.settings.remove"),
    danger: true,
  });
  if (!accepted) return;
  store.removeObjective(props.objective.id);
  analyticsService.capture("parcours_objective_removed", { kind: props.objective.kind });
  void router.replace("/parcours");
}
</script>

<template>
  <div class="space-y-8">
    <div class="card flex items-center gap-3 px-4 py-3">
      <span class="flex-1">
        <span class="block text-[15px] font-bold">{{ t("parcours.settings.pause") }}</span>
        <span class="block text-[13px] text-text-secondary">{{
          t("parcours.settings.pauseHint")
        }}</span>
      </span>
      <ToggleSwitch v-model="paused" :label="t('parcours.settings.pause')" />
    </div>
    <button type="button" class="btn btn-danger w-full" @click="remove">
      {{ t("parcours.settings.remove") }}
    </button>
  </div>
</template>
