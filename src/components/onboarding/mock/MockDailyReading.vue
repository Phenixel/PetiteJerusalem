<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";

/**
 * La lecture du jour : les textes choisis, remis ensemble, et le suivi qui se
 * coche. Le dernier texte se coche tout seul dans la boucle, la barre finit sa
 * course : c'est ce que fait la page quand la lecture est terminée.
 */

const { t } = useI18n();

const rows = [
  { label: `${t("study.types.tehilim")} 20`, done: true },
  { label: `${t("study.types.mishna")} · Berakhot 1`, done: true },
  { label: `${t("study.types.tehilim")} 121`, done: false },
] as const;
</script>

<template>
  <MockScreen height="7.75rem">
    <div class="sheet">
      <div class="progress">
        <span class="progress-fill"></span>
      </div>
      <ul class="rows">
        <li v-for="row in rows" :key="row.label" class="row" :class="{ pending: !row.done }">
          <span class="tick" :class="{ 'tick-late': !row.done }">
            <AppIcon name="check" :size="9" />
          </span>
          <span class="label">{{ row.label }}</span>
        </li>
      </ul>
    </div>
  </MockScreen>
</template>

<style scoped>
.sheet {
  position: absolute;
  inset: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.progress {
  height: 0.28rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background-color: var(--color-primary);
  width: 66%;
  animation: fill 6s ease-in-out infinite;
}

@keyframes fill {
  0%,
  45% {
    width: 66%;
  }
  62%,
  88% {
    width: 100%;
  }
  100% {
    width: 66%;
  }
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.32rem 0.45rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 0.55rem;
  color: var(--color-text-primary);
}

.tick {
  display: flex;
  width: 0.8rem;
  height: 0.8rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--color-primary);
  color: #fff;
}

/* Le dernier texte se coche au milieu du tour. */
.tick-late {
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  color: transparent;
  animation: tick 6s ease-in-out infinite;
}

@keyframes tick {
  0%,
  45% {
    background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
    color: transparent;
  }
  62%,
  88% {
    background-color: var(--color-primary);
    color: #fff;
  }
  100% {
    background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
    color: transparent;
  }
}

.pending .label {
  color: var(--color-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .tick-late {
    animation: none;
  }
}
</style>
