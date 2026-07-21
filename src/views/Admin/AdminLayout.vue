<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { seoService } from "../../services/seoService";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t } = useI18n();

onMounted(() => {
  // Backoffice : jamais indexé.
  seoService.setMeta({ title: t("admin.title"), robots: "noindex, nofollow" });
});
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-10 min-h-screen">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <h1 class="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
        {{ t("admin.title") }}
      </h1>
      <nav class="flex gap-2">
        <router-link
          to="/admin/chiourim"
          class="btn btn-soft"
          active-class="btn-primary"
        >
          <AppIcon name="headphones" :size="15" />
          {{ t("admin.nav.chiourim") }}
        </router-link>
        <router-link
          to="/admin/auteurs"
          class="btn btn-soft"
          active-class="btn-primary"
        >
          <AppIcon name="users" :size="15" />
          {{ t("admin.nav.auteurs") }}
        </router-link>
      </nav>
    </div>

    <router-view />
  </main>
</template>
