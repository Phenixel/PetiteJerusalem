<script setup lang="ts">
// Page « Ma lecture du jour » : la lecture quotidienne vit désormais dans la
// bibliothèque (elle était un onglet du profil), à côté des textes qu'elle
// fait lire. La garde requiresAuth de la route assure qu'un utilisateur est
// connecté avant le montage.
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { authService, type User } from "../../services/authService";
import { seoService } from "../../services/seoService";
import AppIcon from "../../components/icons/AppIcon.vue";
import DailyReading from "./DailyReading.vue";
import { SITE_URL } from "../../config/site";

const { t } = useI18n();
const currentUser = ref<User | null>(null);

onMounted(async () => {
  currentUser.value = await authService.getCurrentUser();
  const url = SITE_URL + "/bibliotheque/lecture-du-jour";
  seoService.setMeta({
    title: t("seo.dailyReadingTitle"),
    description: t("seo.dailyReadingDescription"),
    canonical: url,
    og: { url },
  });
});
</script>

<template>
  <main class="mx-auto w-full max-w-4xl px-6 py-10">
    <RouterLink to="/bibliotheque" class="back-link mb-6">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("study.title") }}
    </RouterLink>

    <div v-if="currentUser" class="animate-[fadeIn_0.4s_ease]">
      <DailyReading :user-id="currentUser.id" />
    </div>
    <div v-else class="flex flex-col items-center justify-center py-16 text-text-secondary">
      <div
        class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
      ></div>
      <p class="font-medium">{{ t("common.loading") }}</p>
    </div>
  </main>
</template>
