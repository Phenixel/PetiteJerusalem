<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Réserver : on coche les chapitres qu'on prend, un ou plusieurs, et la barre
 * du bas les retient d'un coup.
 *
 * Deux appuis cochent les chapitres 2 et 3, un troisième confirme ; les deux
 * lignes passent alors à l'ambre des places prises.
 */

const { t } = useI18n();

const chapters = [1, 2, 3];
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <p class="title">Berakhot</p>
      <ul class="rows">
        <li
          v-for="chapter in chapters"
          :key="chapter"
          class="row"
          :class="chapter === 2 ? 'row-a' : chapter === 3 ? 'row-b' : ''"
        >
          <span class="box" :class="chapter === 2 ? 'box-a' : chapter === 3 ? 'box-b' : ''">
            <AppIcon name="check" :size="7" />
          </span>
          <span class="name">{{ t("common.chapter") }} {{ chapter }}</span>
          <span v-if="chapter === 2 || chapter === 3" class="chip">
            {{ t("detailSession.textList.reserved") }}
          </span>
          <!-- Le doigt vit dans la ligne qu'il coche : sa place ne dépend pas
               de la largeur de la fenêtre. -->
          <MockTouch v-if="chapter === 2" class="finger finger-row" duration="7s" delay="1.1s" />
          <MockTouch
            v-else-if="chapter === 3"
            class="finger finger-row"
            duration="7s"
            delay="2.5s"
          />
        </li>
      </ul>

      <!-- La barre de confirmation, qui monte dès qu'une place est cochée. -->
      <div class="bar">
        <!-- Le compte suit les cases : un texte au premier appui, deux au
             second. -->
        <span class="count">
          <span class="count-1">{{ t("batchSelection.textsSelected", 1) }}</span>
          <span class="count-2">{{ t("batchSelection.textsSelected", 2) }}</span>
        </span>
        <span class="confirm">
          {{ t("common.confirm") }}
          <MockTouch class="finger finger-c" duration="7s" delay="4.3s" />
        </span>
      </div>
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
  position: relative;
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

/* Cochée puis retenue : l'anneau de la sélection, l'ambre de la place prise. */
.row-a {
  animation: row-state 7s ease-in-out 1.1s infinite;
}

.row-b {
  animation: row-state 7s ease-in-out 2.5s infinite;
}

@keyframes row-state {
  0% {
    box-shadow: var(--shadow-card);
    background-color: var(--color-surface);
  }
  2%,
  46% {
    box-shadow:
      var(--shadow-card),
      inset 0 0 0 1.5px color-mix(in srgb, var(--color-primary) 55%, transparent);
    background-color: var(--color-surface);
  }
  50%,
  93% {
    box-shadow: var(--shadow-card);
    background-color: color-mix(in srgb, #f59e0b 14%, var(--color-surface));
  }
  97%,
  100% {
    box-shadow: var(--shadow-card);
    background-color: var(--color-surface);
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

.box-a {
  animation: box-check 7s ease-in-out 1.1s infinite;
}

.box-b {
  animation: box-check 7s ease-in-out 2.5s infinite;
}

@keyframes box-check {
  0% {
    background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
    color: transparent;
  }
  2%,
  93% {
    background-color: var(--color-primary);
    color: #fff;
  }
  97%,
  100% {
    background-color: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
    color: transparent;
  }
}

.name {
  flex: 1;
}

/* La puce « réservé » n'apparaît qu'une fois la sélection confirmée. */
.chip {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  font-size: 0.45rem;
  font-weight: 600;
  background-color: color-mix(in srgb, #f59e0b 16%, transparent);
  color: #b45309;
  opacity: 0;
  animation: chip-in 7s ease-in-out infinite;
}

:root.dark .chip {
  color: #fcd34d;
}

@keyframes chip-in {
  0%,
  63% {
    opacity: 0;
  }
  67%,
  93% {
    opacity: 1;
  }
  97%,
  100% {
    opacity: 0;
  }
}

.bar {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.3rem 0.35rem 0.3rem 0.5rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop, 0 0.4rem 1rem rgb(0 0 0 / 0.14));
  transform: translateY(140%);
  animation: bar 7s ease-in-out infinite;
}

.count {
  position: relative;
  font-weight: 700;
  color: var(--color-text-primary);
}

.count-2 {
  position: absolute;
  inset: 0 auto 0 0;
  white-space: nowrap;
}

/* Le second appui tombe à 2,5 s, soit 36 % du tour. */
.count-1 {
  animation: count-1 7s ease-in-out infinite;
}

.count-2 {
  animation: count-2 7s ease-in-out infinite;
}

@keyframes count-1 {
  0%,
  35% {
    opacity: 1;
  }
  38%,
  100% {
    opacity: 0;
  }
}

@keyframes count-2 {
  0%,
  35% {
    opacity: 0;
  }
  38%,
  100% {
    opacity: 1;
  }
}

.confirm {
  position: relative;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background-color: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

@keyframes bar {
  0%,
  17% {
    transform: translateY(140%);
  }
  23%,
  66% {
    transform: translateY(0);
  }
  72%,
  100% {
    transform: translateY(140%);
  }
}

/* Trois appuis, trois doigts : chacun ne paraît qu'à son tour. */
.finger {
  opacity: 0;
}

/* Posé au bord de sa cible plutôt qu'en plein dessus : la case et le bouton
   doivent rester lisibles pendant qu'on les touche. */
.finger-row {
  top: 62%;
  left: 2.5rem;
}

.finger-c {
  top: 105%;
  left: 72%;
}

.row-a .finger-row {
  animation: finger-a 7s ease-in-out infinite;
}

.row-b .finger-row {
  animation: finger-b 7s ease-in-out infinite;
}

.finger-c {
  animation: finger-c 7s ease-in-out infinite;
}

@keyframes finger-a {
  0%,
  9% {
    opacity: 0;
  }
  13%,
  24% {
    opacity: 1;
  }
  30%,
  100% {
    opacity: 0;
  }
}

@keyframes finger-b {
  0%,
  29% {
    opacity: 0;
  }
  33%,
  44% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@keyframes finger-c {
  0%,
  55% {
    opacity: 0;
  }
  59%,
  69% {
    opacity: 1;
  }
  75%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .count-1,
  .count-2,
  .row-a,
  .row-b,
  .box-a,
  .box-b,
  .chip,
  .bar,
  .row-a .finger-row,
  .row-b .finger-row,
  .finger-c {
    animation: none;
  }
  .box-a,
  .box-b {
    background-color: var(--color-primary);
    color: #fff;
  }
  .chip,
  .row-a .finger-row {
    opacity: 1;
  }
  /* Les deux comptes se superposent : sans animation, seul le dernier reste. */
  .count-1 {
    opacity: 0;
  }
  .bar {
    transform: translateY(0);
  }
}
</style>
