<script setup lang="ts">
import { useRouter } from "vue-router";
import { onMounted, computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { seoService } from "../services/seoService";
import SiteFooter from "../components/SiteFooter.vue";
import IllustrationPartage from "../components/illustrations/IllustrationPartage.vue";
import IllustrationChiourim from "../components/illustrations/IllustrationChiourim.vue";
import IllustrationBibliotheque from "../components/illustrations/IllustrationBibliotheque.vue";

const router = useRouter();
const { t } = useI18n();

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

onMounted(() => {
  const url = window.location.origin + "/";
  seoService.setMeta({
    title: t("seo.homeTitle"),
    description: t("seo.homeDescription"),
    canonical: url,
    og: { url },
  });
});
</script>

<template>
  <main class="flex-1 container mx-auto px-4 py-4 flex flex-col justify-center">
    <div class="text-center mb-10 space-y-3">
      <h2 class="text-3xl md:text-5xl font-bold text-text-primary tracking-tight">
        {{ t("home.heroTitle") }}
      </h2>
      <p class="text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
        {{ t("home.heroDescription") }}
      </p>
    </div>

    <div class="w-full max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 items-stretch">
        <button
          v-for="(feature, index) in features"
          :key="feature.title"
          class="feature-card card card-hover group p-7 flex flex-col items-start text-left cursor-pointer"
          :style="{ '--enter-delay': `${index * 0.12}s` }"
          @click="router.push(feature.route)"
        >
          <div class="w-16 h-16 mb-5 text-primary">
            <component :is="feature.illustration" />
          </div>
          <h3
            class="text-xl font-bold mb-2 text-text-primary group-hover:text-primary transition-colors"
          >
            {{ feature.title }}
          </h3>
          <p class="text-text-secondary text-base leading-relaxed">
            {{ feature.description }}
          </p>
        </button>
      </div>

      <div class="text-center max-w-2xl mx-auto">
        <p class="font-serif italic text-text-secondary">{{ t("home.memorial.title") }}</p>
        <p class="mt-1 font-serif italic text-text-primary">
          {{ t("home.memorial.dedication") }}
        </p>
      </div>
    </div>
  </main>

  <SiteFooter />
</template>

<style scoped>
/* Staggered entrance for the three feature cards. */
.feature-card {
  opacity: 0;
  transform: translateY(14px);
  animation: card-enter 0.55s ease-out forwards;
  animation-delay: var(--enter-delay, 0s);
}

@keyframes card-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feature-card {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
