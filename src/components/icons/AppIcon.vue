<script setup lang="ts">
import { computed } from "vue";
import { ICONS, type IconDef, type IconName } from "./registry";

const props = withDefaults(
  defineProps<{
    name: IconName;
    /** Rendered size in px (width = height). Defaults to 1em so it follows font-size. */
    size?: number | string;
    strokeWidth?: number;
  }>(),
  { size: "1em", strokeWidth: 2 },
);

const icon = computed<IconDef>(() => ICONS[props.name]);
const dimension = computed(() => (typeof props.size === "number" ? `${props.size}px` : props.size));
</script>

<template>
  <svg
    :width="dimension"
    :height="dimension"
    viewBox="0 0 24 24"
    :fill="icon.filled ? 'currentColor' : 'none'"
    :stroke="icon.filled ? 'none' : 'currentColor'"
    :stroke-width="icon.filled ? 0 : strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="inline-block shrink-0 align-[-0.125em]"
    v-html="icon.body"
  ></svg>
</template>
