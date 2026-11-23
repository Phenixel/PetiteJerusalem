<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDafYomi } from "../composables/useTehilimDay";
import { dafYomiLabel, dafYomiRoute } from "../services/dafYomi";
import { analyticsService } from "../services/analyticsService";
import { bindingOf } from "../config/bindings";
import CardArt from "./CardArt.vue";

/**
 * Today's Daf Yomi, at the head of the Talmud in the library: the Talmud's
 * counterpart of the TehilimDayBanner and the ChneiMikraBanner.
 *
 * Only a link: the daf opens in the reader, on its chapter, and the reader
 * goes down to it (`?daf=`).
 */

const { t, locale } = useI18n();

const daf = useDafYomi();
const label = computed(() => (daf.value ? dafYomiLabel(daf.value, locale.value) : ""));
const to = computed(() => (daf.value ? dafYomiRoute(daf.value) : null));

function track() {
  analyticsService.capture("daf_yomi_opened", {
    source: "library_talmud",
    text_id: daf.value?.entry.id ?? null,
    daf: daf.value?.daf ?? null,
  });
}
</script>

<template>
  <RouterLink
    v-if="daf && to"
    :to="to"
    @click="track"
    class="card card-hover group relative flex items-center gap-3 p-4 pe-20 animate-[fadeIn_0.4s_ease]"
  >
    <!-- The volume of the shelf in the corner, as on the Tehilim banner. -->
    <CardArt
      :art="{ kind: 'volume', color: bindingOf('talmud'), label: 'Talmud' }"
      :scale="0.42"
      surface="plain"
    />
    <span class="relative min-w-0 flex-1">
      <span class="block text-xs font-semibold text-primary">
        {{ t("study.today.dafYomiKicker") }}
      </span>
      <span class="block font-medium text-text-primary transition-colors group-hover:text-primary">
        {{ label }}
      </span>
    </span>
  </RouterLink>
</template>
