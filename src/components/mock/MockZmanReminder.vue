<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * A reminder in one swipe (ZmanRow.vue): a times row pulled toward the
 * start uncovers its bell, which takes the theme color once far enough; let
 * go, the row springs back and keeps a small bell by its time.
 *
 * The row is pulled toward the start of the line, as in the app: to the
 * left, and to the right in Hebrew (`--way`).
 */

const { t, locale } = useI18n();
/** Toward the start of the line: -1 to the left, 1 to the right (Hebrew). */
const way = computed(() => (locale.value === "he" ? 1 : -1));
</script>

<template>
  <MockScreen height="9.5rem">
    <ul class="rows" :style="{ '--way': way }">
      <li class="row">
        <span class="face">
          <span class="name">{{ t("zmanim.names.sunrise") }}</span>
          <span class="time">07:12</span>
        </span>
      </li>
      <li class="row row-pulled">
        <span class="action"><AppIcon name="bell" :size="12" class="bell" /></span>
        <span class="face face-pulled">
          <span class="name">{{ t("zmanim.names.sofZmanShma") }}</span>
          <AppIcon name="bell" :size="9" class="set" />
          <span class="time">09:54</span>
          <MockTouch class="finger" duration="6s" delay="0.7s" :taps="0" />
        </span>
      </li>
      <li class="row">
        <span class="face">
          <span class="name">{{ t("zmanim.names.tzeit") }}</span>
          <span class="time">18:41</span>
        </span>
      </li>
    </ul>
  </MockScreen>
</template>

<style scoped>
.rows {
  position: absolute;
  inset: 0.9rem 0.9rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
}

.row {
  position: relative;
  height: 2rem;
  overflow: hidden;
  border-radius: 0.55rem;
}

.face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.7rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* What the pull uncovers, at the end of the row: the bell. */
.action {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 0.75rem;
  background-color: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));
  color: var(--color-text-secondary);
  animation: action 6s ease-in-out infinite;
}

.bell {
  animation: ring 6s ease-in-out infinite;
}

.face-pulled {
  animation: pull 6s ease-in-out infinite;
}

/* The reminder set: a small bell by the time. */
.set {
  flex: none;
  color: var(--color-primary);
  opacity: 0;
  animation: set 6s ease-in-out infinite;
}

.finger {
  top: 55%;
  left: 62%;
  opacity: 0;
  animation: finger 6s ease-in-out infinite;
}

@keyframes pull {
  0%,
  12% {
    transform: none;
  }
  36%,
  42% {
    transform: translateX(calc(var(--way) * 3.2rem));
  }
  48% {
    transform: translateX(calc(var(--way) * -0.25rem));
  }
  52%,
  100% {
    transform: none;
  }
}

@keyframes action {
  0%,
  10% {
    opacity: 0;
  }
  14%,
  28% {
    opacity: 1;
    background-color: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));
    color: var(--color-text-secondary);
  }
  32%,
  44% {
    background-color: var(--color-brand);
    color: var(--color-on-brand);
  }
  50% {
    opacity: 1;
    background-color: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));
    color: var(--color-text-secondary);
  }
  54%,
  100% {
    opacity: 0;
  }
}

/* The bell rings once, at the threshold. */
@keyframes ring {
  0%,
  31% {
    transform: none;
  }
  33% {
    transform: rotate(-16deg);
  }
  35% {
    transform: rotate(14deg);
  }
  37% {
    transform: rotate(-8deg);
  }
  39%,
  100% {
    transform: none;
  }
}

@keyframes set {
  0%,
  46% {
    opacity: 0;
  }
  52%,
  90% {
    opacity: 1;
  }
  96%,
  100% {
    opacity: 0;
  }
}

@keyframes finger {
  0%,
  6% {
    opacity: 0;
  }
  10%,
  42% {
    opacity: 1;
  }
  47%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action,
  .bell,
  .face-pulled,
  .set,
  .finger {
    animation: none;
  }
  /* Pulled to the threshold, the bell in color. */
  .face-pulled {
    transform: translateX(calc(var(--way) * 3.2rem));
  }
  .action {
    background-color: var(--color-brand);
    color: var(--color-on-brand);
  }
  .finger {
    opacity: 1;
  }
}
</style>
