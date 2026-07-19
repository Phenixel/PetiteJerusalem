<template>
  <footer
    class="mt-auto px-6 py-8 text-text-secondary transition-colors"
    role="contentinfo"
  >
    <nav
      class="mx-auto mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
      :aria-label="t('footer.discover')"
    >
      <RouterLink class="hover:text-primary transition-colors" to="/share-reading">{{
        t("common.shareReading")
      }}</RouterLink>
      <RouterLink class="hover:text-primary transition-colors" to="/bibliotheque">{{
        t("study.title")
      }}</RouterLink>
      <RouterLink class="hover:text-primary transition-colors" to="/chiourim">{{
        t("common.chiourim")
      }}</RouterLink>
      <RouterLink class="hover:text-primary transition-colors" to="/finir-le-chass">{{
        t("footer.finishChass")
      }}</RouterLink>
      <RouterLink class="hover:text-primary transition-colors" to="/partage-tehilim">{{
        t("footer.shareTehilim")
      }}</RouterLink>
      <RouterLink class="hover:text-primary transition-colors" to="/tehilim">{{
        t("footer.tehilimIntentions")
      }}</RouterLink>
    </nav>

    <div
      class="mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center text-center md:text-left"
    >
      <div class="justify-self-center md:justify-self-start">
        <a
          class="hover:text-primary transition-colors font-medium"
          href="https://phenixel.fr"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('footer.madeBy') + ' Phenixel (' + t('footer.about') + ')'"
        >
          {{ t("footer.madeBy") }} <strong>Phenixel</strong> 🐦‍🔥
        </a>
      </div>

      <nav
        class="flex flex-col md:flex-row gap-2 md:gap-4 items-center justify-center"
        :aria-label="t('footer.about')"
      >
        <RouterLink class="hover:text-primary transition-colors" to="/a-propos">
          {{ t("footer.about") }}
        </RouterLink>
        <RouterLink class="hover:text-primary transition-colors" to="/mentions-legales">
          {{ t("footer.legal") }}
        </RouterLink>
        <RouterLink class="hover:text-primary transition-colors" to="/confidentialite">
          {{ t("footer.privacy") }}
        </RouterLink>
        <a
          class="hover:text-primary transition-colors"
          href="https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4?pvs=105"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t("footer.reportIssue") }}
        </a>
      </nav>

      <div
        class="justify-self-center md:justify-self-end flex gap-4 items-center"
        aria-label="Social media"
      >
        <LanguageSelector variant="compact" dropup />
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
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import LanguageSelector from "./LanguageSelector.vue";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
</script>
