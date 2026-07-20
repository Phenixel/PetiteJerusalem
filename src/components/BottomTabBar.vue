<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

// Le Partage de lectures reste accessible depuis l'accueil et le footer.
// `anim` : personnalité de l'icône au toucher, en écho aux illustrations de
// l'accueil (livre qui se redresse, casque qui hoche, personnage qui bondit).
const tabs = [
  { to: "/", icon: "home", labelKey: "common.home", exact: true, anim: "pop" },
  { to: "/bibliotheque", icon: "book-open", labelKey: "study.title", exact: false, anim: "sway" },
  { to: "/chiourim", icon: "headphones", labelKey: "common.chiourim", exact: false, anim: "nod" },
  { to: "/profile", icon: "user", labelKey: "common.profile", exact: false, anim: "hop" },
] as const;

// Onglet dont l'icône s'anime. Remis à null d'abord pour que l'animation
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
          :class="poppedTab === tab.to ? `tab-icon-${tab.anim}` : ''"
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
  transform-origin: center;
}

/* Accueil : la maison gonfle d'aise, on arrive chez soi. */
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

/* Bibliothèque : le livre penche puis se redresse (cf. tome-straighten). */
.tab-icon-sway {
  transform-origin: bottom center;
  animation: tab-icon-sway 0.45s ease-out;
}
@keyframes tab-icon-sway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  35% {
    transform: translateY(-1px) rotate(-12deg);
  }
  70% {
    transform: rotate(5deg);
  }
}

/* Chiourim : le casque hoche en rythme (cf. phones-nod). */
.tab-icon-nod {
  transform-origin: center 65%;
  animation: tab-icon-nod 0.5s ease-in-out;
}
@keyframes tab-icon-nod {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-8deg);
  }
  50% {
    transform: rotate(7deg);
  }
  80% {
    transform: rotate(-4deg);
  }
}

/* Profil : petit bond amical avec réception en douceur (cf. person-hop). */
.tab-icon-hop {
  animation: tab-icon-hop 0.4s ease;
}
@keyframes tab-icon-hop {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  20% {
    transform: translateY(0) scale(1.1, 0.85);
  }
  55% {
    transform: translateY(-4px) scale(0.95, 1.05);
  }
  85% {
    transform: translateY(0) scale(1.05, 0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab-icon-pop,
  .tab-icon-sway,
  .tab-icon-nod,
  .tab-icon-hop {
    animation: none;
  }
}
</style>
