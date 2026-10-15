<script lang="ts">
import { devicePreference } from "../../services/devicePreference";

/**
 * Le dernier record fêté, sur cet appareil. Partagé par toutes les feuilles
 * montées (l'accueil, Mon parcours) : une lumière ne se fête qu'une fois.
 */
const seenStore = devicePreference<number>(
  "pj_parcours_light_seen",
  (raw) => {
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  },
  String,
);
let seen: number | null = null;
</script>

<script setup lang="ts">
/**
 * Une nouvelle lumière (services/parcours/lights.ts) : quand le record
 * franchit un palier, une feuille monte un instant après le geste qui l'a
 * fait, la lumière s'y allume (elle grandit, son halo s'ouvre deux fois),
 * avec son nom, sa phrase, et « Voir mes lumières ».
 *
 * Une fois par palier, sur cet appareil. La première fois qu'on la monte,
 * le record se note sans rien fêter (ce qu'on avait déjà n'est pas
 * nouveau) ; un record qui saute d'un coup (le compte relu sur un nouvel
 * appareil) ne fête rien non plus. Un record plus bas (un autre compte)
 * n'efface pas ce qui a été fêté.
 */
import { onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { lightsToCelebrate, type Light } from "../../services/parcours/lights";
import BottomSheet from "./BottomSheet.vue";
import LightsSheet from "./LightsSheet.vue";
import StreakLight from "./StreakLight.vue";

const { t } = useI18n();
const store = useParcours();

const celebrated = ref<Light | null>(null);
const showAll = ref(false);

/** Le temps que le geste finisse (la carte qui s'envole) avant que la feuille monte. */
const AFTER_GESTURE_MS = 900;
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => store.streak.value.best,
  (best) => {
    seen ??= seenStore.read();
    if (seen === null || best > seen) {
      const lights = seen === null ? [] : lightsToCelebrate(seen, best);
      seen = best;
      seenStore.write(best);
      const light = lights[lights.length - 1];
      if (!light) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        celebrated.value = light;
        haptic("done");
        analyticsService.capture("parcours_light_unlocked", {
          light: light.id,
          days: light.from,
          streak: store.streak.value.current,
        });
      }, AFTER_GESTURE_MS);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));

function seeAll(): void {
  celebrated.value = null;
  showAll.value = true;
  analyticsService.capture("parcours_lights_opened", { source: "celebration" });
}
</script>

<template>
  <BottomSheet
    :open="celebrated !== null"
    :label="t('parcours.lights.unlocked')"
    @close="celebrated = null"
  >
    <div v-if="celebrated" class="flex flex-col items-center pb-1 text-center">
      <p class="text-[13px] font-semibold text-text-secondary">
        {{ t("parcours.lights.unlocked") }}
      </p>
      <div class="light-stage" aria-hidden="true">
        <span class="light-ring" />
        <span class="light-ring light-ring-late" />
        <StreakLight class="light-lit" :light="celebrated.id" level="high" :width="190" />
      </div>
      <p class="font-display text-[28px] font-bold leading-tight">
        {{ t(`parcours.lights.names.${celebrated.id}`) }}
      </p>
      <p class="mt-2 max-w-sm text-[15px] leading-normal text-text-secondary">
        {{ t(`parcours.lights.captions.${celebrated.id}`) }}
      </p>
      <button type="button" class="btn btn-primary mt-6 min-h-12 w-full" @click="seeAll">
        {{ t("parcours.lights.see") }}
      </button>
      <button type="button" class="btn btn-soft mt-2 min-h-11 w-full" @click="celebrated = null">
        {{ t("parcours.lights.keep") }}
      </button>
    </div>
  </BottomSheet>
  <LightsSheet :open="showAll" @close="showAll = false" />
</template>

<style scoped>
.light-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 220px;
  height: 172px;
  margin: 8px 0 6px;
}
/* La lumière s'allume : elle grandit depuis sa base, et dépasse un peu. */
.light-lit {
  position: relative;
  transform-origin: 50% 80%;
  animation: light-kindles 0.75s cubic-bezier(0.2, 0.8, 0.3, 1.25) 0.15s backwards;
}
/* Son halo s'ouvre, deux fois, et s'efface. */
.light-ring {
  position: absolute;
  inset: 18px 38px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-brand) 30%, transparent);
  opacity: 0;
  animation: ring-opens 1.3s ease-out 0.35s;
}
.light-ring-late {
  animation-delay: 0.75s;
}
@keyframes light-kindles {
  from {
    opacity: 0;
    transform: scale(0.45);
  }
}
@keyframes ring-opens {
  from {
    opacity: 0.9;
    transform: scale(0.35);
  }
  to {
    opacity: 0;
    transform: scale(1.35);
  }
}
@media (prefers-reduced-motion: reduce) {
  .light-lit,
  .light-ring {
    animation: none;
  }
}
</style>
