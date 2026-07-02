<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { seoService } from "../services/seoService";
import AppIcon from "../components/icons/AppIcon.vue";

const { t } = useI18n();

onMounted(() => {
  const url = window.location.origin + window.location.pathname;
  seoService.setMeta({
    title: t("seo.notFoundTitle"),
    description: t("seo.notFoundDescription"),
    canonical: url,
    robots: "noindex, follow",
    og: { url },
  });
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 text-center">
    <main class="max-w-md w-full">
      <div class="mb-8">
        <h2 class="text-8xl font-black text-primary/20 mb-4 select-none">404</h2>
        <h3 class="text-2xl font-bold text-text-primary mb-4">
          {{ t("notFound.title") }}
        </h3>
        <p class="text-text-secondary">{{ t("notFound.message") }}</p>
      </div>

      <div>
        <RouterLink to="/" class="btn btn-primary">
          <AppIcon name="home" :size="16" />
          {{ t("notFound.backToHome") }}
        </RouterLink>
      </div>
    </main>
  </div>
</template>
