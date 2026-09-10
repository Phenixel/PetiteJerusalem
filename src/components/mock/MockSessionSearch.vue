<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Trouver un texte dans une chaîne, de deux façons : en tapant son nom, ou en
 * ne gardant que ce qui reste à prendre.
 *
 * Le tour montre les deux l'une après l'autre : le nom s'écrit et la liste se
 * réduit à ce qu'il désigne, puis la recherche s'efface et c'est
 * l'interrupteur qui écarte le texte déjà réservé.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <div class="field">
        <AppIcon name="search" :size="9" class="glass" />
        <span class="typed">Chabbat</span>
        <span class="caret"></span>
      </div>

      <div class="filter">
        <span class="switch"><span class="knob"></span></span>
        <span class="filter-label">{{ t("detailSession.availableOnly") }}</span>
        <!-- Le doigt vit dans la pastille qu'il touche : sa place ne dépend
             ni de la largeur de la fenêtre, ni de la longueur du libellé. -->
        <MockTouch class="finger" duration="8s" delay="4.6s" />
      </div>

      <ul class="rows">
        <li class="row row-off-search">
          <span class="name">Berakhot</span>
          <span class="chip free">{{ t("detailSession.textList.available") }}</span>
        </li>
        <li class="row row-off-filter">
          <span class="name">Chabbat</span>
          <span class="chip taken">{{ t("detailSession.textList.reserved") }}</span>
        </li>
        <li class="row row-off-search">
          <span class="name">Erouvin</span>
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
  gap: 0.45rem;
  font-size: 0.55rem;
}

.field {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.55rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

.glass {
  color: var(--color-text-secondary);
}

/* Le nom s'écrit lettre à lettre : la largeur avance par crans. */
.typed {
  overflow: hidden;
  white-space: nowrap;
  max-width: 0;
  animation: type 8s steps(7, end) infinite;
}

.caret {
  width: 1px;
  height: 0.6rem;
  background-color: var(--color-primary);
  animation: caret 8s linear infinite;
}

@keyframes type {
  0%,
  5% {
    max-width: 0;
  }
  17%,
  40% {
    max-width: 3rem;
  }
  44%,
  100% {
    max-width: 0;
  }
}

@keyframes caret {
  0%,
  44% {
    opacity: 1;
  }
  45%,
  100% {
    opacity: 0;
  }
}

.filter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  align-self: center;
  padding: 0.22rem 0.5rem 0.22rem 0.3rem;
  border-radius: 999px;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.switch {
  position: relative;
  display: block;
  width: 1.05rem;
  height: 0.6rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  animation: switch-on 8s ease-in-out infinite;
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
  animation: knob 8s ease-in-out infinite;
}

.filter-label {
  color: var(--color-text-secondary);
}

@keyframes switch-on {
  0%,
  57% {
    background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  }
  60%,
  94% {
    background-color: var(--color-primary);
  }
  97%,
  100% {
    background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  }
}

@keyframes knob {
  0%,
  57% {
    transform: translateX(0);
  }
  60%,
  94% {
    transform: translateX(0.45rem);
  }
  97%,
  100% {
    transform: translateX(0);
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
  justify-content: space-between;
  gap: 0.4rem;
  overflow: hidden;
  height: 1.15rem;
  padding: 0 0.45rem;
  border-radius: 0.45rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

/* Écartés par la recherche : le nom tapé ne les désigne pas. */
.row-off-search {
  animation: off-search 8s ease-in-out infinite;
}

/* Écarté par l'interrupteur : ce texte est déjà pris. */
.row-off-filter {
  animation: off-filter 8s ease-in-out infinite;
}

@keyframes off-search {
  0%,
  16% {
    height: 1.15rem;
    opacity: 1;
  }
  22%,
  40% {
    height: 0;
    opacity: 0;
  }
  46%,
  100% {
    height: 1.15rem;
    opacity: 1;
  }
}

@keyframes off-filter {
  0%,
  61% {
    height: 1.15rem;
    opacity: 1;
  }
  67%,
  94% {
    height: 0;
    opacity: 0;
  }
  99%,
  100% {
    height: 1.15rem;
    opacity: 1;
  }
}

.chip {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  font-size: 0.45rem;
  font-weight: 600;
  white-space: nowrap;
}

.free {
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
}

.taken {
  background-color: color-mix(in srgb, #dc2626 12%, transparent);
  color: #b91c1c;
}

:root.dark .taken {
  color: #fca5a5;
}

/* Le doigt ne paraît que pour l'appui sur l'interrupteur. */
.finger {
  top: 50%;
  left: 0.85rem;
  opacity: 0;
  animation: finger 8s ease-in-out infinite;
}

@keyframes finger {
  0%,
  52% {
    opacity: 0;
  }
  56%,
  70% {
    opacity: 1;
  }
  74%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typed,
  .caret,
  .switch,
  .knob,
  .row-off-search,
  .row-off-filter,
  .finger {
    animation: none;
  }
  .typed {
    max-width: 3rem;
  }
  .caret {
    opacity: 0;
  }
  .finger {
    opacity: 1;
  }
}
</style>
