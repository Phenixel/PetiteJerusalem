<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";

/**
 * Les horaires du jour : quelques zmanim, le prochain mis en avant avec son
 * compte à rebours, et l'allumage du Chabbat. Les heures sont celles d'un jour
 * quelconque à Paris : une capture, pas un calcul.
 */

const { t } = useI18n();

const times = [
  { label: t("zmanim.names.alotHaShachar"), time: "05:12" },
  { label: t("zmanim.names.sunrise"), time: "06:34" },
  { label: t("zmanim.names.chatzot"), time: "13:41" },
] as const;
</script>

<template>
  <MockScreen height="10.5rem">
    <div class="sheet">
      <div class="place">
        <AppIcon name="map-pin" :size="9" />
        <span class="place-bar"></span>
      </div>

      <ul class="rows">
        <li v-for="row in times" :key="row.label" class="row">
          <span class="label">{{ row.label }}</span>
          <span class="time">{{ row.time }}</span>
        </li>
        <li class="row next">
          <span class="label">{{ t("zmanim.names.sunset") }}</span>
          <span class="countdown">{{ t("zmanim.nextIn", { duration: "2 h 14" }) }}</span>
          <span class="time">20:57</span>
        </li>
      </ul>

      <div class="shabbat">
        <AppIcon name="candle" :size="10" />
        <span class="shabbat-label">{{ t("zmanim.shabbat.candleLighting") }}</span>
        <span class="time">20:39</span>
      </div>
    </div>
  </MockScreen>
</template>

<style scoped>
.sheet {
  position: absolute;
  inset: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.55rem;
}

.place {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-secondary);
}

.place-bar {
  display: block;
  width: 3.2rem;
  height: 0.26rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.22rem 0.4rem;
  border-radius: 0.4rem;
  color: var(--color-text-secondary);
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Le prochain horaire : mis en avant, avec le temps qu'il reste. */
.next {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  animation: pulse 4s ease-in-out infinite;
}

.next .label,
.next .time {
  color: var(--color-primary);
}

.countdown {
  font-size: 0.5rem;
  font-weight: 600;
}

@keyframes pulse {
  0%,
  100% {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
  50% {
    background-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

.shabbat {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding: 0.3rem 0.45rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-secondary);
}

.shabbat-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .next {
    animation: none;
  }
}
</style>
