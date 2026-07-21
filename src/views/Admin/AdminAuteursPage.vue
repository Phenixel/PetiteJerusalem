<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId } from "../../services/adminService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const auteurs = ref<AuteurWithId[]>([]);
const chiourim = ref<ChiourDoc[]>([]);

const newName = ref("");
const isCreating = ref(false);
// Lien studio affiché UNE seule fois, à la création (le token n'est plus
// montré ensuite : il reste lisible dans Firestore par l'admin si besoin).
const freshLink = ref<{ auteurName: string; url: string } | null>(null);

const countByAuteur = computed(() => {
  const map = new Map<string, number>();
  chiourim.value.forEach((c) => {
    if (c.auteurId) map.set(c.auteurId, (map.get(c.auteurId) ?? 0) + 1);
  });
  return map;
});

async function refresh() {
  [auteurs.value, chiourim.value] = await Promise.all([
    adminService.listAuteurs(),
    adminService.listAllChiourim(),
  ]);
}

onMounted(async () => {
  try {
    await refresh();
  } finally {
    isLoading.value = false;
  }
});

async function create() {
  const name = newName.value.trim();
  if (!name) return;
  isCreating.value = true;
  try {
    const { token } = await adminService.createAuteur(name);
    freshLink.value = { auteurName: name, url: adminService.studioLinkFor(token) };
    newName.value = "";
    toast.success(t("admin.auteurs.created"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la création de l'auteur:", error);
    toast.error(
      error instanceof Error && error.message === "already-exists"
        ? t("admin.auteurs.alreadyExists")
        : t("admin.error"),
    );
  } finally {
    isCreating.value = false;
  }
}

async function copyLink() {
  if (!freshLink.value) return;
  try {
    await navigator.clipboard.writeText(freshLink.value.url);
    toast.success(t("admin.auteurs.linkCopied"));
  } catch {
    toast.error(t("admin.error"));
  }
}
</script>

<template>
  <div v-if="isLoading" class="text-center py-24 text-text-secondary">
    <AppIcon name="spinner" :size="24" class="animate-spin mx-auto mb-4" />
    {{ t("common.loading") }}
  </div>

  <div v-else class="space-y-6 animate-[fadeIn_0.3s_ease]">
    <!-- Création d'un auteur -->
    <div class="card p-5 md:p-6">
      <h2 class="text-lg font-bold text-text-primary mb-4">{{ t("admin.auteurs.addTitle") }}</h2>
      <form @submit.prevent="create" class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="newName"
          type="text"
          :placeholder="t('admin.auteurs.namePlaceholder')"
          required
          class="field flex-1"
        />
        <button type="submit" class="btn btn-primary" :disabled="isCreating">
          <AppIcon v-if="isCreating" name="spinner" :size="15" class="animate-spin" />
          <AppIcon v-else name="circle-plus" :size="15" />
          {{ t("admin.auteurs.add") }}
        </button>
      </form>

      <!-- Lien studio du nouvel auteur, montré une seule fois -->
      <div
        v-if="freshLink"
        class="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2"
      >
        <p class="font-semibold text-text-primary">
          {{ t("admin.auteurs.linkReady", { name: freshLink.auteurName }) }}
        </p>
        <p class="text-xs text-text-secondary">{{ t("admin.auteurs.linkOnce") }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <code class="text-xs bg-black/[0.05] rounded px-2 py-1.5 break-all flex-1 min-w-0 dark:bg-white/10">
            {{ freshLink.url }}
          </code>
          <button class="btn btn-soft shrink-0" @click="copyLink">
            <AppIcon name="copy" :size="14" />
            {{ t("admin.auteurs.copy") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Liste des auteurs -->
    <p v-if="auteurs.length === 0" class="card p-8 text-center text-text-secondary">
      {{ t("admin.auteurs.empty") }}
    </p>
    <ul v-else class="space-y-2">
      <li v-for="auteur in auteurs" :key="auteur.id">
        <router-link
          :to="`/admin/auteurs/${auteur.id}`"
          class="card card-hover p-4 flex items-center gap-3"
        >
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
            <AppIcon name="teacher" :size="18" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-text-primary truncate">{{ auteur.name }}</p>
            <p class="text-sm text-text-secondary">
              {{ t("admin.auteurs.chiourimCount", { count: countByAuteur.get(auteur.id) ?? 0 }) }}
            </p>
          </div>
          <AppIcon name="chevron-right" :size="16" class="text-text-secondary shrink-0" />
        </router-link>
      </li>
    </ul>
  </div>
</template>
