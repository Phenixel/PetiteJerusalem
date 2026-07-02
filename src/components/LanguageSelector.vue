<script setup lang="ts">
import { ref } from "vue";
import { useLocale } from "../composables/useLocale";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

defineProps<{
  variant?: "default" | "compact";
  dropup?: boolean;
}>();

const { currentLocaleOption, availableLocales, setLocale } = useLocale();
const { t } = useI18n();

const isOpen = ref(false);

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function selectLocale(code: "fr" | "en" | "he") {
  setLocale(code);
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".language-selector")) {
    isOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    isOpen.value = false;
  }
}
</script>

<template>
  <div
    class="language-selector relative"
    @keydown="handleKeydown"
    v-click-outside="handleClickOutside"
  >
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors cursor-pointer dark:bg-white/10 dark:hover:bg-white/15"
      :aria-expanded="isOpen"
      :aria-label="t('common.language')"
    >
      <span class="text-lg">{{ currentLocaleOption.flag }}</span>
      <span v-if="variant !== 'compact'" class="text-sm font-medium text-text-primary">
        {{ currentLocaleOption.label }}
      </span>
      <AppIcon
        name="chevron-down"
        :size="12"
        class="text-text-secondary transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Transition :name="dropup ? 'dropup' : 'dropdown'">
      <div
        v-if="isOpen"
        class="absolute min-w-[140px] bg-surface rounded-lg shadow-pop overflow-hidden z-50"
        :class="[
          dropup ? 'bottom-full mb-2' : 'top-full mt-2',
          { 'right-0': true, 'left-0 right-auto': $attrs.class?.toString().includes('rtl') },
        ]"
      >
        <button
          v-for="locale in availableLocales"
          :key="locale.code"
          @click="selectLocale(locale.code)"
          class="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-black/5 transition-colors text-left dark:hover:bg-white/10"
          :class="{
            'bg-primary/10 dark:bg-primary/20': locale.code === currentLocaleOption.code,
          }"
        >
          <span class="text-lg">{{ locale.flag }}</span>
          <span class="text-sm font-medium text-text-primary">
            {{ locale.label }}
          </span>
          <AppIcon
            v-if="locale.code === currentLocaleOption.code"
            name="check"
            :size="12"
            class="text-primary ml-auto"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.dropup-enter-active,
.dropup-leave-active {
  transition: all 0.2s ease;
}

.dropup-enter-from,
.dropup-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
