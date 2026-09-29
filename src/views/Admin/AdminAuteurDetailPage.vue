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
import { useConfirm } from "../../composables/useConfirm";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import { formatCount } from "../../services/adminFormat";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import AdminStudioLink from "../../components/admin/AdminStudioLink.vue";
import AdminChiourRow from "../../components/admin/AdminChiourRow.vue";

/**
 * La fiche d'un auteur : son nom, son lien studio, ses séries et ses
 * chiourim (brouillons en tête, à relire). La suppression, rare et sans
 * retour, est reléguée en bas.
 */

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { confirm } = useConfirm();
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
  // Remplacer un lien actif coupe celui que l'auteur a déjà : on le confirme.
  // Sans lien actif, il n'y a rien à perdre.
  if (
    activeToken.value &&
    !(await confirm({ title: t("admin.auteurDetail.regenerateConfirm"), danger: true }))
  )
    return;
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
  if (!(await confirm({ title: t("admin.auteurDetail.revokeConfirm"), danger: true }))) return;
  isWorkingToken.value = true;
  try {
    await adminService.revokeToken(activeToken.value.id);
    freshLink.value = null;
    void refreshAdminSummary(true);
    toast.success(t("admin.auteurDetail.revoked"));
    await refresh();
  } catch (error) {
    console.error("Erreur lors de la révocation du lien:", error);
    toast.error(t("admin.error"));
  } finally {
    isWorkingToken.value = false;
  }
}

const drafts = computed(() => chiourim.value.filter((c) => !c.published));
const sortedChiourim = computed(() =>
  [...chiourim.value].sort(
    (a, b) =>
      Number(a.published) - Number(b.published) ||
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  ),
);
const totalViews = computed(() =>
  chiourim.value.reduce((sum, c) => sum + (c.published ? (c.views ?? 0) : 0), 0),
);
const busySlug = ref<string | null>(null);

async function publish(chiour: ChiourDoc) {
  busySlug.value = chiour.slug;
  try {
    await adminService.setPublished(chiour.slug, true);
    chiour.published = true;
    toast.success(t("admin.chiourim.publishedOk"));
    void refreshAdminSummary(true);
  } catch (error) {
    console.error("Erreur lors de la publication:", error);
    toast.error(t("admin.error"));
  } finally {
    busySlug.value = null;
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
  const accepted = await confirm({
    title: t("admin.auteurDetail.serieDeleteConfirm", { name: serie.name }),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;
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
  const accepted = await confirm({
    title: t("admin.auteurDetail.deleteConfirm"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;
  isDeleting.value = true;
  try {
    await adminService.deleteAuteur(auteur.value.id);
    toast.success(t("admin.auteurDetail.deleted"));
    void refreshAdminSummary(true);
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
  <AdminSkeleton v-if="isLoading" :rows="3" />

  <p v-else-if="!auteur" class="card p-8 text-center text-text-secondary">
    {{ t("admin.auteurDetail.notFound") }}
  </p>

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <router-link
      to="/admin/auteurs"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
    >
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("admin.auteurDetail.back") }}
    </router-link>

    <!-- Identité et chiffres -->
    <section class="card mb-6 p-5 md:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            {{ auteur.name }}
          </h2>
          <p class="mt-1 text-sm text-text-secondary">
            {{ t("admin.auteurs.chiourimCount", { count: chiourim.length - drafts.length }) }}
            · {{ t("common.viewsCount", { count: totalViews }) }} ·
            {{ t("admin.auteurDetail.serieCountTotal", { n: series.length }, series.length) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <AdminStatus
            v-if="drafts.length"
            tone="warning"
            :label="t('admin.auteurs.draftsCount', { n: drafts.length }, drafts.length)"
          />
          <a
            :href="`/chiourim/auteur/${auteur.slug}`"
            target="_blank"
            rel="noopener"
            class="btn btn-soft btn-sm"
          >
            <AppIcon name="external-link" :size="13" />
            {{ t("admin.chiourEdit.viewPage") }}
          </a>
        </div>
      </div>
      <form class="mt-5 flex flex-col gap-3 sm:flex-row" @submit.prevent="rename">
        <label for="auteur-name" class="sr-only">{{ t("admin.auteurDetail.rename") }}</label>
        <input id="auteur-name" v-model="editedName" type="text" class="field flex-1" required />
        <button
          type="submit"
          class="btn btn-soft"
          :disabled="isRenaming || editedName.trim() === auteur.name"
        >
          <AppIcon v-if="isRenaming" name="spinner" :size="14" class="animate-spin" />
          <AppIcon v-else name="pencil" :size="14" />
          {{ t("admin.auteurDetail.rename") }}
        </button>
      </form>
      <p class="mt-2 text-xs text-text-secondary">{{ t("admin.auteurDetail.renameHint") }}</p>
    </section>

    <div class="mb-6 grid gap-6 lg:grid-cols-2">
      <!-- Lien studio -->
      <section class="card space-y-4 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-bold text-text-primary">{{ t("admin.auteurDetail.linkTitle") }}</h3>
          <AdminStatus
            :tone="activeToken ? 'success' : 'danger'"
            :label="
              activeToken
                ? t('admin.auteurDetail.linkActive')
                : t('admin.auteurDetail.linkInactive')
            "
          />
        </div>
        <p class="text-sm text-text-secondary">{{ t("admin.auteurDetail.linkHint") }}</p>

        <AdminStudioLink v-if="freshLink" :url="freshLink" />

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-soft btn-sm"
            :disabled="isWorkingToken"
            @click="regenerate"
          >
            <AppIcon v-if="isWorkingToken" name="spinner" :size="13" class="animate-spin" />
            <AppIcon v-else name="rotate" :size="13" />
            {{ activeToken ? t("admin.auteurDetail.regenerate") : t("admin.auteurDetail.create") }}
          </button>
          <button
            v-if="activeToken"
            type="button"
            class="btn btn-danger btn-sm"
            :disabled="isWorkingToken"
            @click="revoke"
          >
            <AppIcon name="x" :size="13" />
            {{ t("admin.auteurDetail.revoke") }}
          </button>
        </div>
      </section>

      <!-- Séries -->
      <section class="card space-y-4 p-5">
        <h3 class="font-bold text-text-primary">{{ t("admin.auteurDetail.seriesTitle") }}</h3>
        <ul v-if="series.length" class="divide-y divide-line">
          <li v-for="serie in series" :key="serie.id" class="flex items-center gap-3 py-2">
            <span class="min-w-0 flex-1 truncate font-medium text-text-primary">{{
              serie.name
            }}</span>
            <span class="text-xs text-text-secondary">
              {{
                t("admin.auteurDetail.serieCount", {
                  count: chiourim.filter((c) => c.serieId === serie.id).length,
                })
              }}
            </span>
            <button
              type="button"
              class="icon-btn hover:!bg-red-600/10 hover:!text-red-600 dark:hover:!text-red-400"
              :title="t('common.delete')"
              :aria-label="t('common.delete')"
              @click="removeSerie(serie)"
            >
              <AppIcon name="trash" :size="14" />
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-text-secondary">{{ t("admin.auteurDetail.seriesEmpty") }}</p>
        <form class="flex gap-2" @submit.prevent="createSerie">
          <input
            v-model="newSerieName"
            type="text"
            :placeholder="t('admin.auteurDetail.seriePlaceholder')"
            :aria-label="t('admin.auteurDetail.seriePlaceholder')"
            required
            class="field flex-1"
          />
          <button type="submit" class="btn btn-soft" :disabled="isCreatingSerie">
            <AppIcon v-if="isCreatingSerie" name="spinner" :size="14" class="animate-spin" />
            <AppIcon v-else name="plus" :size="14" />
            {{ t("admin.auteurDetail.serieAdd") }}
          </button>
        </form>
      </section>
    </div>

    <!-- Chiourim de l'auteur, brouillons en tête -->
    <section class="mb-8">
      <h3 class="mb-3 text-lg font-bold text-text-primary">
        {{ t("admin.auteurDetail.chiourimTitle") }}
        <span class="font-normal text-text-secondary">({{ formatCount(chiourim.length) }})</span>
      </h3>
      <ul v-if="chiourim.length" class="card divide-y divide-line overflow-hidden">
        <li v-for="chiour in sortedChiourim" :key="chiour.slug">
          <AdminChiourRow
            :chiour="chiour"
            :serie-name="chiour.serieId ? serieNameById.get(chiour.serieId) : null"
            :busy="busySlug === chiour.slug"
            @toggle-published="publish(chiour)"
          />
        </li>
      </ul>
      <p v-else class="card p-5 text-sm text-text-secondary">
        {{ t("admin.auteurDetail.chiourimEmpty") }}
      </p>
    </section>

    <!-- Zone sensible -->
    <section class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <p class="text-sm text-text-secondary">{{ t("admin.auteurDetail.deleteHint") }}</p>
      <button
        type="button"
        class="btn btn-danger btn-sm"
        :disabled="isDeleting"
        @click="removeAuteur"
      >
        <AppIcon v-if="isDeleting" name="spinner" :size="13" class="animate-spin" />
        <AppIcon v-else name="trash" :size="13" />
        {{ t("admin.auteurDetail.delete") }}
      </button>
    </section>
  </div>
</template>
