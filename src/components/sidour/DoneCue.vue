<script setup lang="ts">
/**
 * What a swipe to the right will do, on the Sidour page: the home stack's
 * pill (TaskDeck, `.dk-cue`), the check mark and « C'est fait », outside the
 * left edge of the card being swiped, at mid-height. Light while the gesture
 * looks for itself, in the theme color once the threshold is passed.
 *
 * Placed inside the card (which is `position: relative`), it follows it.
 */
import { useI18n } from "vue-i18n";

defineProps<{
  /** From 0 to 1: how far toward the threshold. */
  strength: number;
  armed: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <span
    class="done-cue"
    :class="{ 'done-cue-armed': armed }"
    :style="{ opacity: strength }"
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" class="done-cue-icon"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    {{ t("parcours.hub.done") }}
  </span>
</template>

<style scoped>
.done-cue {
  position: absolute;
  top: 50%;
  right: calc(100% + 10px);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px 7px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: none;
  transform: translateY(-50%);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
[dir="rtl"] .done-cue {
  right: auto;
  left: calc(100% + 10px);
}
.done-cue-armed {
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow:
    var(--shadow-pop),
    0 0 0 1px var(--color-on-brand);
}
.done-cue-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
