<script setup lang="ts">
import { ref } from "vue";
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

// Onglet dont l'icône rebondit. Remis à null d'abord pour que l'animation
// reparte même en retouchant l'onglet déjà actif.
const poppedTab = ref<string | null>(null);
function popIcon(to: string) {
  poppedTab.value = null;
  requestAnimationFrame(() => {
    poppedTab.value = to;
  });
}
</script>

<!-- Barre de navigation basse de l'app native (remplace le menu hamburger du
     site). Fixée au-dessus de la barre de gestes Android (safe-area). -->
<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-black/5 dark:border-white/10 pb-[var(--safe-bottom)]"
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
        @click="popIcon(tab.to)"
      >
        <span
          class="tab-icon"
          :class="{ 'tab-icon-pop': poppedTab === tab.to }"
          @animationend="poppedTab = null"
        >
          <AppIcon :name="tab.icon" :size="21" />
        </span>
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
.tab-icon {
  display: inline-flex;
}
.tab-icon-pop {
  animation: tab-icon-pop 0.35s ease;
}
@keyframes tab-icon-pop {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(0.75);
  }
  70% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
</style>
