<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Rendre une place : on décoche sa propre réservation, et le chapitre
 * redevient libre pour les autres.
 *
 * Seules ses propres réservations se décochent ; celles des autres restent
 * telles quelles, c'est pourquoi la ligne du dessus ne bouge pas.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <p class="title">Berakhot</p>
      <ul class="rows">
        <li class="row">
          <span class="box box-other"><AppIcon name="check" :size="7" /></span>
          <span class="name">{{ t("common.chapter") }} 1</span>
          <span class="chip amber">David</span>
        </li>
        <li class="row row-mine">
          <span class="box box-mine"><AppIcon name="check" :size="7" /></span>
          <span class="name">{{ t("common.chapter") }} 2</span>
          <span class="chip amber chip-mine">{{ t("detailSession.textList.reserved") }}</span>
          <span class="chip free chip-back">{{ t("detailSession.textList.available") }}</span>
          <!-- Le doigt vit dans la ligne qu'il décoche. -->
          <MockTouch class="finger" duration="5.5s" delay="1.2s" />
        </li>
        <li class="row">
          <span class="box"></span>
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
  inset: 0.85rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  justify-content: center;
  font-size: 0.55rem;
}

.title {
  font-weight: 700;
  color: var(--color-text-primary);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  height: 1.15rem;
  padding: 0 0.45rem;
  border-radius: 0.45rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

/* Ma place, rendue au milieu du tour : l'ambre s'en va avec elle. La position
   relative tient la puce « disponible », qui prend le relais au même endroit. */
.row-mine {
  position: relative;
  background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  animation: row-free 5.5s ease-in-out 1.2s infinite;
}

@keyframes row-free {
  0% {
    background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  }
  3%,
  88% {
    background-color: var(--color-surface);
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
  background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
  color: transparent;
}

.box-other {
  background-color: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  color: #fff;
}

.box-mine {
  background-color: var(--color-primary);
  color: #fff;
  animation: box-free 5.5s ease-in-out 1.2s infinite;
}

@keyframes box-free {
  0% {
    background-color: var(--color-primary);
    color: #fff;
  }
  3%,
  88% {
    background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
    color: transparent;
  }
  95%,
  100% {
    background-color: var(--color-primary);
    color: #fff;
  }
}

.name {
  flex: 1;
}

.chip {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  font-size: 0.45rem;
  font-weight: 600;
  white-space: nowrap;
}

.amber {
  background-color: color-mix(in srgb, #f59e0b 16%, transparent);
  color: #b45309;
}

:root.dark .amber {
  color: #fcd34d;
}

.free {
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
}

/* Les deux puces de ma ligne se relaient : réservée, puis de nouveau libre. */
.chip-mine {
  animation: chip-out 5.5s ease-in-out 1.2s infinite;
}

.chip-back {
  position: absolute;
  right: 0.45rem;
  opacity: 0;
  animation: chip-in 5.5s ease-in-out 1.2s infinite;
}

@keyframes chip-out {
  0% {
    opacity: 1;
  }
  3%,
  88% {
    opacity: 0;
  }
  95%,
  100% {
    opacity: 1;
  }
}

@keyframes chip-in {
  0% {
    opacity: 0;
  }
  3%,
  88% {
    opacity: 1;
  }
  95%,
  100% {
    opacity: 0;
  }
}

/* Au bord de la case, pas dessus : on doit la voir se décocher. */
.finger {
  top: 62%;
  left: 2.5rem;
  opacity: 0;
  animation: finger 5.5s ease-in-out infinite;
}

@keyframes finger {
  0%,
  12% {
    opacity: 0;
  }
  17%,
  36% {
    opacity: 1;
  }
  44%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .row-mine,
  .box-mine,
  .chip-mine,
  .chip-back,
  .finger {
    animation: none;
  }
  .chip-back {
    opacity: 0;
  }
  .finger {
    opacity: 1;
  }
}
</style>
