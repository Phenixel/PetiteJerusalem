<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Marquer sa lecture : l'interrupteur « Lu » passe au vert, la ligne avec lui,
 * et la barre de la chaîne avance pour tout le monde.
 *
 * C'est ce dernier point qui compte : cocher n'est pas une note personnelle,
 * c'est ce qui fait avancer la chaîne.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <!-- L'avancement de la chaîne, qui gagne une place au passage. -->
      <div class="progress">
        <span class="progress-fill"></span>
      </div>

      <ul class="rows">
        <li class="row row-read">
          <span class="box"><AppIcon name="check" :size="7" /></span>
          <span class="name">{{ t("common.chapter") }} 2</span>
          <span class="toggle-label">{{ t("detailSession.textList.readToggle") }}</span>
          <span class="switch">
            <span class="knob"></span>
            <!-- Le doigt vit dans l'interrupteur qu'il bascule. -->
            <MockTouch class="finger" duration="5.5s" delay="1.2s" />
          </span>
        </li>
        <li class="row">
          <span class="box box-idle"></span>
          <span class="name">{{ t("common.chapter") }} 3</span>
          <span class="chip free">{{ t("detailSession.textList.available") }}</span>
        </li>
      </ul>
    </div>
  </MockScreen>
</template>

<style scoped>
.pane {
  position: absolute;
  inset: 0.9rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  justify-content: center;
  font-size: 0.55rem;
}

.progress {
  height: 0.3rem;
  border-radius: 999px;
  overflow: hidden;
  background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}

.progress-fill {
  display: block;
  height: 100%;
  width: 38%;
  border-radius: 999px;
  background-color: #16a34a;
  animation: fill 5.5s ease-in-out 1.2s infinite;
}

@keyframes fill {
  0% {
    width: 38%;
  }
  6%,
  88% {
    width: 55%;
  }
  95%,
  100% {
    width: 38%;
  }
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  height: 1.3rem;
  padding: 0 0.45rem;
  border-radius: 0.45rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

/* Ambre tant que la place est prise, verte une fois la lecture faite. */
.row-read {
  background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  animation: row-green 5.5s ease-in-out 1.2s infinite;
}

@keyframes row-green {
  0% {
    background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  }
  4%,
  88% {
    background-color: color-mix(in srgb, #16a34a 12%, var(--color-surface));
  }
  95%,
  100% {
    background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  }
}

.box {
  display: flex;
  width: 0.65rem;
  height: 0.65rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.15rem;
  background-color: var(--color-primary);
  color: #fff;
}

.box-idle {
  background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}

.name {
  flex: 1;
}

.toggle-label {
  color: var(--color-text-secondary);
}

.switch {
  position: relative;
  display: block;
  width: 1.05rem;
  height: 0.6rem;
  flex: none;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  animation: switch-on 5.5s ease-in-out 1.2s infinite;
}

.knob {
  position: absolute;
  top: 0.08rem;
  left: 0.08rem;
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 999px;
  background-color: #fff;
  box-shadow: 0 0.05rem 0.1rem rgb(0 0 0 / 0.2);
  animation: knob 5.5s ease-in-out 1.2s infinite;
}

@keyframes switch-on {
  0% {
    background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  }
  4%,
  88% {
    background-color: #16a34a;
  }
  95%,
  100% {
    background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  }
}

@keyframes knob {
  0% {
    transform: translateX(0);
  }
  4%,
  88% {
    transform: translateX(0.45rem);
  }
  95%,
  100% {
    transform: translateX(0);
  }
}

.chip {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  font-size: 0.45rem;
  font-weight: 600;
}

.free {
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
}

/* Sous l'interrupteur, qui reste visible pendant qu'il bascule. */
.finger {
  top: 105%;
  left: 75%;
  opacity: 0;
  animation: finger 5.5s ease-in-out infinite;
}

@keyframes finger {
  0%,
  12% {
    opacity: 0;
  }
  17%,
  38% {
    opacity: 1;
  }
  46%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .row-read,
  .switch,
  .knob,
  .finger {
    animation: none;
  }
  .finger {
    opacity: 1;
  }
}
</style>
