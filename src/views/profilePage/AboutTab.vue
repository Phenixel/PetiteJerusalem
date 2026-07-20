<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";

/**
 * App native uniquement : reprend l'essentiel du footer du site (retiré de
 * l'app) — pages d'info, signalement de problème, crédits et réseaux.
 */

const { t } = useI18n();

const pages = [
  { to: "/a-propos", labelKey: "footer.about", icon: "info" },
  { to: "/mentions-legales", labelKey: "footer.legal", icon: "align-left" },
  { to: "/confidentialite", labelKey: "footer.privacy", icon: "eye" },
] as const;
</script>

<template>
  <section class="card p-6 animate-[fadeIn_0.5s_ease]">
    <h2 class="text-2xl font-bold text-text-primary mb-6">
      {{ t("profile.tabs.about") }}
    </h2>

    <ul class="flex flex-col divide-y divide-line">
      <li v-for="page in pages" :key="page.to">
        <RouterLink
          :to="page.to"
          class="flex items-center justify-between gap-3 py-3.5 text-text-primary hover:text-primary transition-colors"
        >
          <span class="flex items-center gap-3">
            <AppIcon :name="page.icon" :size="17" class="text-text-secondary/70" />
            {{ t(page.labelKey) }}
          </span>
          <AppIcon name="chevron-right" :size="15" class="text-text-secondary/50 rtl:rotate-180" />
        </RouterLink>
      </li>
      <li>
        <a
          href="https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4?pvs=105"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between gap-3 py-3.5 text-text-primary hover:text-primary transition-colors"
        >
          <span class="flex items-center gap-3">
            <AppIcon name="alert-circle" :size="17" class="text-text-secondary/70" />
            {{ t("footer.reportIssue") }}
          </span>
          <AppIcon name="external-link" :size="15" class="text-text-secondary/50" />
        </a>
      </li>
    </ul>

    <div class="mt-6 pt-5 border-t border-line flex flex-wrap items-center justify-between gap-4">
      <a
        class="text-sm text-text-secondary hover:text-primary transition-colors font-medium"
        href="https://phenixel.fr"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("footer.madeBy") }} <strong>Phenixel</strong> 🐦‍🔥
      </a>
      <div class="flex gap-4 items-center">
        <a
          class="flex items-center justify-center w-6 h-6 opacity-80 hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary"
          href="https://github.com/Phenixel/PetiteJerusalem"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <AppIcon name="github" :size="20" />
        </a>
        <a
          class="flex items-center justify-center w-6 h-6 opacity-80 hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary"
          href="https://x.com/Real_Phenixel"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X"
          title="X"
        >
          <AppIcon name="x-twitter" :size="18" />
        </a>
      </div>
    </div>
  </section>
</template>
