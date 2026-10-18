<script setup lang="ts">
/**
 * At the end of a service's text (Cha'harit, Min'ha, Arvit), opened from
 * anywhere but a goal's card: « Fin de l'office », and the ring pulled upward
 * to mark it done, as at the end of the day's portion (PullToMark). With the
 * « trois tefilot » habit, it checks the habit's task; without it, the
 * device remembers it (useOfficesDone). Either way, the home deck and the
 * Sidour page then move on to what comes next.
 *
 * Loaded on demand (see TextReadingPage): it pulls the times engine.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { officeWindow, useOfficesDone } from "../../composables/useOfficesDone";
import { useNow } from "../../composables/useNow";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { haptic } from "../../services/haptics";
import type { TefilaKey } from "../../services/sidourService";
import PullToMark from "./PullToMark.vue";

const props = defineProps<{ tefila: TefilaKey }>();

const { t } = useI18n();
const now = useNow();
const { place } = useZmanimLocation();
const offices = useOfficesDone();

const window = computed(() => officeWindow(place.value, props.tefila, now.value));
const done = computed(() => (window.value ? offices.isOfficeDone(window.value) : false));
const name = computed(() => t(`home.sidourNow.names.${props.tefila}`));

const label = computed(() => ({
  pull: t("parcours.reader.pull"),
  release: t("parcours.reader.release"),
  done: t("sidour.said.done", { name: name.value }),
}));
const sub = computed(() => ({
  pull: t("sidour.said.pullSub"),
  release: t("sidour.said.releaseSub"),
  done: t("sidour.said.doneSub"),
}));

function mark(done: boolean): void {
  if (!window.value) return;
  haptic(done ? "done" : "undo");
  offices.markOffice(window.value, done, "reader");
}
</script>

<template>
  <PullToMark
    v-if="window"
    :done="done"
    :heading="t('sidour.said.end')"
    :aria="t('sidour.said.aria')"
    :label="label"
    :sub="sub"
    @mark="mark(true)"
  >
    <RouterLink to="/sidour" class="p-2.5 text-[15px] font-bold text-primary">
      {{ t("sidour.said.back") }}
    </RouterLink>
    <button
      type="button"
      class="p-2.5 text-[15px] font-bold text-text-secondary"
      @click="mark(false)"
    >
      {{ t("sidour.said.undo") }}
    </button>
  </PullToMark>
</template>
