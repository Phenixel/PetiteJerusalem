<script setup lang="ts">
/**
 * Les trois portes du site (Partage, Chiourim, Bibliothèque), posées à même
 * le fond : sans cadre. Elles ne sont pas une donnée à consulter mais un
 * endroit où aller, et le cadre les mettait au même rang que les cartes du
 * tableau de bord. Sans lui, les seules surfaces blanches de la page sont
 * celles qui répondent à une question (ma lecture, l'heure), et l'accueil se
 * lit en deux temps au lieu d'un empilement de boîtes. Ce qui remplace le
 * cadre : rien, qu'un écart entre elles, et au survol le titre qui prend la
 * couleur pendant que le dessin s'anime.
 *
 * Deux mises en page. Dans l'app, l'écran est étroit et la barre du bas
 * attend juste en dessous : les trois tiennent sur une seule ligne, un dessin
 * et un titre, sans la phrase de présentation. On sait ce qu'est la
 * bibliothèque quand on a installé l'app ; la phrase servait au visiteur du
 * site. Sur le web, elles s'empilent en lignes sur un téléphone (texte à
 * gauche, dessin à droite, la place y est en largeur) et se rangent côte à
 * côte, centrées sous leur dessin, dès qu'il y a trois colonnes.
 *
 * Un bloc de l'accueil, qu'on peut déplacer ou masquer (useHomeLayout).
 */
import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { isNativeApp } from "../composables/useNativeApp";
import IllustrationBibliotheque from "./illustrations/IllustrationBibliotheque.vue";
import IllustrationChiourim from "./illustrations/IllustrationChiourim.vue";
import IllustrationPartage from "./illustrations/IllustrationPartage.vue";

const emit = defineEmits<{ (e: "open", card: string): void }>();

const { t } = useI18n();
const router = useRouter();

const features = computed<
  { illustration: Component; title: string; description: string; route: string }[]
>(() => [
  {
    illustration: IllustrationPartage,
    title: t("home.features.shareReading.title"),
    description: t("home.features.shareReading.description"),
    route: "share-reading",
  },
  {
    illustration: IllustrationChiourim,
    title: t("home.features.chiourim.title"),
    description: t("home.features.chiourim.description"),
    route: "chiourim",
  },
  {
    illustration: IllustrationBibliotheque,
    title: t("home.features.study.title"),
    description: t("home.features.study.description"),
    route: "bibliotheque",
  },
]);

const doorsClass = isNativeApp
  ? "grid grid-cols-3 gap-2"
  : "grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-8";
const doorClass = isNativeApp
  ? "flex flex-col items-center gap-2 px-1 py-3 text-center"
  : "flex items-center gap-5 py-4 text-left md:flex-col md:items-center md:gap-4 md:py-2 md:text-center";
const doorIllustrationClass = isNativeApp
  ? "h-14 w-14"
  : "order-2 h-24 w-24 sm:h-28 sm:w-28 md:order-1 md:h-24 md:w-24";
const doorTitleClass = isNativeApp ? "text-base leading-snug" : "text-2xl md:text-3xl";

function open(route: string): void {
  emit("open", `feature_${route}`);
  void router.push(route);
}
</script>

<template>
  <div class="items-stretch" :class="doorsClass">
    <button
      v-for="(feature, index) in features"
      :key="feature.title"
      class="feature-link group cursor-pointer"
      :class="doorClass"
      :style="{ '--enter-delay': `${index * 0.12}s` }"
      @click="open(feature.route)"
    >
      <div class="shrink-0 text-primary" :class="doorIllustrationClass">
        <component :is="feature.illustration" />
      </div>
      <div class="order-1 min-w-0 flex-1 md:order-2">
        <h3
          class="font-display font-bold tracking-tight text-text-primary transition-colors group-hover:text-primary"
          :class="doorTitleClass"
        >
          {{ feature.title }}
        </h3>
        <p
          v-if="!isNativeApp"
          class="mt-1.5 text-sm leading-relaxed text-text-secondary md:text-base"
        >
          {{ feature.description }}
        </p>
      </div>
    </button>
  </div>
</template>

<style scoped>
/* Les portes entrent l'une après l'autre, comme les cartes de l'accueil. */
.feature-link {
  opacity: 0;
  transform: translateY(14px);
  animation: door-enter 0.55s ease-out forwards;
  animation-delay: var(--enter-delay, 0s);
}
@keyframes door-enter {
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .feature-link {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
