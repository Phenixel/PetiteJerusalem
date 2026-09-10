<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Lire : le bouton « Lire » de la carte ouvre le texte, dans l'app comme sur
 * le site. Pas besoin d'avoir réservé pour le lire.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <div class="card">
        <span class="title">Berakhot</span>
        <span class="read">
          <AppIcon name="book-open" :size="8" />
          {{ t("detailSession.textList.read") }}
          <!-- Le doigt vit dans le bouton qu'il touche. -->
          <MockTouch class="finger" duration="6s" delay="1.2s" />
        </span>
      </div>
    </div>

    <!-- Le texte, qui monte par-dessus la liste. -->
    <div class="page">
      <p class="he">בְּרֵאשִׁית בָּרָא אֱלֹהִים</p>
      <p class="ph">Berechit bara Elohim</p>
      <p class="he">אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ</p>
      <p class="ph">et hachamayim vé'et haaretz</p>
    </div>
  </MockScreen>
</template>

<style scoped>
.pane {
  position: absolute;
  inset: 0.9rem 0.9rem;
  font-size: 0.55rem;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.title {
  font-weight: 700;
  color: var(--color-text-primary);
}

.read {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-primary);
  font-weight: 600;
}

.page {
  position: absolute;
  inset: 3.4rem 0 0 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  padding: 0 1rem;
  border-radius: 0.8rem 0.8rem 0 0;
  background-color: var(--color-surface);
  box-shadow: 0 -0.3rem 0.9rem rgb(0 0 0 / 0.12);
  font-size: 0.55rem;
  line-height: 1.4;
  text-align: center;
  transform: translateY(105%);
  animation: open 6s ease-in-out 1.2s infinite;
}

.he {
  font-family: var(--font-hebrew);
  color: var(--color-text-primary);
  direction: rtl;
}

.ph {
  font-size: 0.85em;
  color: var(--color-text-secondary);
}

@keyframes open {
  0% {
    transform: translateY(105%);
  }
  10%,
  85% {
    transform: translateY(0);
  }
  96%,
  100% {
    transform: translateY(105%);
  }
}

/* Au coin du bouton, qui reste lisible pendant l'appui. */
.finger {
  top: 105%;
  left: 72%;
  opacity: 0;
  animation: finger 6s ease-in-out infinite;
}

@keyframes finger {
  0%,
  11% {
    opacity: 0;
  }
  16%,
  32% {
    opacity: 1;
  }
  40%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .finger {
    animation: none;
  }
  .page {
    transform: translateY(0);
  }
}
</style>
