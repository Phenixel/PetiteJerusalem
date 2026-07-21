<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import {
  adminService,
  type AuteurWithId,
  type SerieWithId,
  type TokenWithId,
} from "../../services/adminService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const auteurId = computed(() => String(route.params.auteurId ?? ""));

const isLoading = ref(true);
const auteur = ref<AuteurWithId | null>(null);
const tokens = ref<TokenWithId[]>([]);
const series = ref<SerieWithId[]>([]);
const chiourim = ref<ChiourDoc[]>([]);

const editedName = ref("");
const isRenaming = ref(false);
const isWorkingToken = ref(false);
const freshLink = ref<string | null>(null);
const newSerieName = ref("");
const isCreatingSerie = ref(false);
const isDeleting = ref(false);

const activeToken = computed(() => tokens.value.find((tok) => tok.active) ?? null);
const serieNameById = computed(() => new Map(series.value.map((s) => [s.id, s.name])));

async function refresh() {
  const id = auteurId.value;
  const [a, toks, ser, allChiourim] = await Promise.all([
    adminService.getAuteur(id),
    adminService.listTokens(id),
    adminService.listSeries(id),
    adminService.listAllChiourim(),
  ]);
  auteur.value = a;
  tokens.value = toks;
  series.value = ser;
  chiourim.value = allChiourim.filter((c) => c.auteurId === id);
  if (a) editedName.value = a.name;
}

onMounted(async () => {
  try {
    await refresh();
  } finally {
    isLoading.value = false;
  }
});

async function rename() {
  if (!auteur.value || !editedName.value.trim() || editedName.value.trim() === auteur.value.name)
    return;
  isRenaming.value = true;
  try {
    await adminService.renameAuteur(auteur.value.id, editedName.value);
    toast.success(t("admin.auteurDetail.renamed"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors du renommage de l'auteur:", error);
    toast.error(t("admin.error"));
  } finally {
    isRenaming.value = false;
  }
}

async function regenerate() {
  if (!auteur.value) return;
  if (!window.confirm(t("admin.auteurDetail.regenerateConfirm"))) return;
  isWorkingToken.value = true;
  try {
    const token = await adminService.regenerateToken(auteur.value.id, auteur.value.name);
    freshLink.value = adminService.studioLinkFor(token);
    toast.success(t("admin.auteurDetail.regenerated"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la régénération du lien:", error);
    toast.error(t("admin.error"));
  } finally {
    isWorkingToken.value = false;
  }
}

async function revoke() {
  if (!activeToken.value) return;
  if (!window.confirm(t("admin.auteurDetail.revokeConfirm"))) return;
  isWorkingToken.value = true;
  try {
    await adminService.revokeToken(activeToken.value.id);
    freshLink.value = null;
    toast.success(t("admin.auteurDetail.revoked"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la révocation du lien:", error);
    toast.error(t("admin.error"));
  } finally {
    isWorkingToken.value = false;
  }
}

async function copyFreshLink() {
  if (!freshLink.value) return;
  try {
    await navigator.clipboard.writeText(freshLink.value);
    toast.success(t("admin.auteurs.linkCopied"));
  } catch {
    toast.error(t("admin.error"));
  }
}

async function createSerie() {
  if (!auteur.value || !newSerieName.value.trim()) return;
  isCreatingSerie.value = true;
  try {
    await adminService.createSerie(auteur.value.id, newSerieName.value);
    newSerieName.value = "";
    toast.success(t("admin.auteurDetail.serieCreated"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la création de la série:", error);
    toast.error(
      error instanceof Error && error.message === "already-exists"
        ? t("admin.auteurs.alreadyExists")
        : t("admin.error"),
    );
  } finally {
    isCreatingSerie.value = false;
  }
}

async function removeSerie(serie: SerieWithId) {
  if (!window.confirm(t("admin.auteurDetail.serieDeleteConfirm", { name: serie.name }))) return;
  try {
    await adminService.deleteSerie(serie.id);
    toast.success(t("admin.auteurDetail.serieDeleted"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la suppression de la série:", error);
    toast.error(t("admin.error"));
  }
}

async function removeAuteur() {
  if (!auteur.value) return;
  if (!window.confirm(t("admin.auteurDetail.deleteConfirm"))) return;
  isDeleting.value = true;
  try {
    await adminService.deleteAuteur(auteur.value.id);
    toast.success(t("admin.auteurDetail.deleted"));
    router.push("/admin/auteurs");
  } catch (error) {
    console.error("Erreur lors de la suppression de l'auteur:", error);
    toast.error(
      error instanceof Error && error.message === "has-chiourim"
        ? t("admin.auteurDetail.deleteHasChiourim")
        : t("admin.error"),
    );
    isDeleting.value = false;
  }
}
</script>

<template>
  <div v-if="isLoading" class="text-center py-24 text-text-secondary">
    <AppIcon name="spinner" :size="24" class="animate-spin mx-auto mb-4" />
    {{ t("common.loading") }}
  </div>

  <p v-else-if="!auteur" class="card p-8 text-center text-text-secondary">
    {{ t("admin.auteurDetail.notFound") }}
  </p>

  <div v-else class="space-y-6 animate-[fadeIn_0.3s_ease]">
    <router-link to="/admin/auteurs" class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary">
      <AppIcon name="arrow-left" :size="14" />
      {{ t("admin.auteurDetail.back") }}
    </router-link>

    <!-- Identité -->
    <div class="card p-5 md:p-6">
      <h2 class="text-lg font-bold text-text-primary mb-4">{{ auteur.name }}</h2>
      <form @submit.prevent="rename" class="flex flex-col sm:flex-row gap-3">
        <input v-model="editedName" type="text" class="field flex-1" required />
        <button
          type="submit"
          class="btn btn-soft"
          :disabled="isRenaming || editedName.trim() === auteur.name"
        >
          <AppIcon v-if="isRenaming" name="spinner" :size="14" class="animate-spin" />
          {{ t("admin.auteurDetail.rename") }}
        </button>
      </form>
      <p class="text-xs text-text-secondary/70 mt-2">{{ t("admin.auteurDetail.renameHint") }}</p>
    </div>

    <!-- Lien studio -->
    <div class="card p-5 md:p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-text-primary">{{ t("admin.auteurDetail.linkTitle") }}</h2>
        <span
          class="chip"
          :class="
            activeToken
              ? 'bg-green-600/10 text-green-700 dark:text-green-300'
              : 'bg-red-500/10 text-red-700 dark:text-red-300'
          "
        >
          {{ activeToken ? t("admin.auteurDetail.linkActive") : t("admin.auteurDetail.linkInactive") }}
        </span>
      </div>

      <div v-if="freshLink" class="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
        <p class="text-xs text-text-secondary">{{ t("admin.auteurs.linkOnce") }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <code class="text-xs bg-black/[0.05] rounded px-2 py-1.5 break-all flex-1 min-w-0 dark:bg-white/10">
            {{ freshLink }}
          </code>
          <button class="btn btn-soft shrink-0" @click="copyFreshLink">
            <AppIcon name="copy" :size="14" />
            {{ t("admin.auteurs.copy") }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button class="btn btn-soft" :disabled="isWorkingToken" @click="regenerate">
          <AppIcon v-if="isWorkingToken" name="spinner" :size="14" class="animate-spin" />
          <AppIcon v-else name="rotate" :size="14" />
          {{ t("admin.auteurDetail.regenerate") }}
        </button>
        <button
          v-if="activeToken"
          class="btn btn-soft text-red-600 dark:text-red-400"
          :disabled="isWorkingToken"
          @click="revoke"
        >
          <AppIcon name="x" :size="14" />
          {{ t("admin.auteurDetail.revoke") }}
        </button>
      </div>
    </div>

    <!-- Séries -->
    <div class="card p-5 md:p-6 space-y-4">
      <h2 class="text-lg font-bold text-text-primary">{{ t("admin.auteurDetail.seriesTitle") }}</h2>
      <form @submit.prevent="createSerie" class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="newSerieName"
          type="text"
          :placeholder="t('admin.auteurDetail.seriePlaceholder')"
          required
          class="field flex-1"
        />
        <button type="submit" class="btn btn-soft" :disabled="isCreatingSerie">
          <AppIcon v-if="isCreatingSerie" name="spinner" :size="14" class="animate-spin" />
          <AppIcon v-else name="circle-plus" :size="14" />
          {{ t("admin.auteurDetail.serieAdd") }}
        </button>
      </form>

      <ul v-if="series.length" class="space-y-2">
        <li
          v-for="serie in series"
          :key="serie.id"
          class="flex items-center gap-3 rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/5"
        >
          <span class="flex-1 font-medium text-text-primary truncate">{{ serie.name }}</span>
          <span class="text-xs text-text-secondary">
            {{
              t("admin.auteurDetail.serieCount", {
                count: chiourim.filter((c) => c.serieId === serie.id).length,
              })
            }}
          </span>
          <button
            class="btn btn-soft !px-2.5 text-red-600 dark:text-red-400"
            @click="removeSerie(serie)"
          >
            <AppIcon name="trash" :size="13" />
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-text-secondary">{{ t("admin.auteurDetail.seriesEmpty") }}</p>
    </div>

    <!-- Chiourim de l'auteur -->
    <div class="card p-5 md:p-6 space-y-4">
      <h2 class="text-lg font-bold text-text-primary">
        {{ t("admin.auteurs.chiourimCount", { count: chiourim.length }) }}
      </h2>
      <ul v-if="chiourim.length" class="space-y-2">
        <li
          v-for="chiour in chiourim"
          :key="chiour.slug"
          class="flex items-center gap-3 rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/5"
        >
          <router-link
            :to="`/admin/chiourim/${chiour.slug}`"
            class="flex-1 min-w-0 font-medium text-text-primary hover:text-primary truncate"
          >
            {{ chiour.name }}
          </router-link>
          <span v-if="chiour.serieId && serieNameById.get(chiour.serieId)" class="text-xs text-text-secondary truncate">
            {{ serieNameById.get(chiour.serieId) }}<template v-if="chiour.episode"> ({{ chiour.episode }})</template>
          </span>
          <span
            class="chip"
            :class="
              chiour.published
                ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            "
          >
            {{ chiour.published ? t("admin.chiourim.statusPublished") : t("admin.chiourim.statusDraft") }}
          </span>
        </li>
      </ul>
      <p v-else class="text-sm text-text-secondary">{{ t("admin.auteurDetail.chiourimEmpty") }}</p>
    </div>

    <!-- Danger -->
    <div class="text-right">
      <button
        class="btn btn-soft text-red-600 dark:text-red-400"
        :disabled="isDeleting"
        @click="removeAuteur"
      >
        <AppIcon v-if="isDeleting" name="spinner" :size="14" class="animate-spin" />
        <AppIcon v-else name="trash" :size="14" />
        {{ t("admin.auteurDetail.delete") }}
      </button>
    </div>
  </div>
</template>
