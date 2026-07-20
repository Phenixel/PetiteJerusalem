<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

// Le Partage de lectures reste accessible depuis l'accueil et le footer.
const tabs = [
  { to: "/", icon: "home", labelKey: "common.home", exact: true },
  { to: "/bibliotheque", icon: "book-open", labelKey: "study.title", exact: false },
  { to: "/chiourim", icon: "headphones", labelKey: "common.chiourim", exact: false },
  { to: "/profile", icon: "user", labelKey: "common.profile", exact: false },
] as const;
</script>

<!-- Barre de navigation basse de l'app native (remplace le menu hamburger du
     site). Fixée au-dessus de la barre de gestes Android (safe-area). -->
<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-black/5 dark:border-white/10 pb-[env(safe-area-inset-bottom)]"
    :aria-label="t('navbar.mainMenu')"
  >
    <div class="flex items-stretch justify-around h-14">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="tab-item"
        :exact-active-class="tab.exact ? 'tab-item-active' : 'tab-item-noop'"
        :active-class="tab.exact ? 'tab-item-noop' : 'tab-item-active'"
      >
        <AppIcon :name="tab.icon" :size="21" />
        <span class="text-[11px] font-medium leading-none">{{ t(tab.labelKey) }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
}
.tab-item-active {
  color: var(--color-primary);
}
</style>
