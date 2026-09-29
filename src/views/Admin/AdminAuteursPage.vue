<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId, type TokenWithId } from "../../services/adminService";
import { useToast } from "../../composables/useToast";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import AppIcon from "../../components/icons/AppIcon.vue";
import AdminSectionHeader from "../../components/admin/AdminSectionHeader.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminEmpty from "../../components/admin/AdminEmpty.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";
import AdminStudioLink from "../../components/admin/AdminStudioLink.vue";
import { liveValue } from "../../composables/liveInput";
import { searchItems } from "../../services/fuzzySearch";

/**
 * Les auteurs de chiourim. Chacun dépose par un lien studio secret : la carte
 * dit s'il en a un actif, combien de ses chiourim sont en ligne et combien
 * attendent d'être relus.
 */
const { t } = useI18n();
const toast = useToast();

const isLoading = ref(true);
const auteurs = ref<AuteurWithId[]>([]);
const chiourim = ref<ChiourDoc[]>([]);
const tokens = ref<TokenWithId[]>([]);
const search = ref("");

const newName = ref("");
const isCreating = ref(false);
// Lien studio affiché UNE seule fois, à la création (le token n'est plus
// montré ensuite : il reste lisible dans Firestore par l'admin si besoin).
const freshLink = ref<{ auteurName: string; url: string } | null>(null);

const statsByAuteur = computed(() => {
  const map = new Map<string, { published: number; drafts: number }>();
  for (const c of chiourim.value) {
    if (!c.auteurId) continue;
    const entry = map.get(c.auteurId) ?? { published: 0, drafts: 0 };
    if (c.published) entry.published += 1;
    else entry.drafts += 1;
    map.set(c.auteurId, entry);
  }
  return map;
});

const linked = computed(
  () => new Set(tokens.value.filter((tok) => tok.active).map((tok) => tok.auteurId)),
);

const filtered = computed(() =>
  searchItems(auteurs.value, search.value, (a) => [a.name], { keepOrder: true }),
);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

async function refresh() {
  [auteurs.value, chiourim.value, tokens.value] = await Promise.all([
    adminService.listAuteurs(),
    adminService.listAllChiourim(),
    adminService.listAllTokens(),
  ]);
}

onMounted(async () => {
  try {
    await refresh();
  } catch (error) {
    console.error("Erreur lors du chargement des auteurs:", error);
    toast.error(t("admin.error"));
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
    void refreshAdminSummary(true);
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
</script>

<template>
  <AdminSkeleton v-if="isLoading" />

  <div v-else class="animate-[fadeIn_0.3s_ease]">
    <AdminSectionHeader
      :title="t('admin.nav.auteurs')"
      :description="t('admin.auteurs.summary', { n: auteurs.length }, auteurs.length)"
    />

    <!-- Ajouter un auteur : son lien studio est créé avec lui -->
    <section class="card mb-6 p-5">
      <form class="flex flex-col gap-3 sm:flex-row sm:items-center" @submit.prevent="create">
        <label for="new-auteur" class="font-semibold text-text-primary sm:shrink-0">
          {{ t("admin.auteurs.addTitle") }}
        </label>
        <input
          id="new-auteur"
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

      <AdminStudioLink
        v-if="freshLink"
        class="mt-4"
        :url="freshLink.url"
        :title="t('admin.auteurs.linkReady', { name: freshLink.auteurName })"
      />
    </section>

    <div class="relative mb-4 sm:w-72">
      <AppIcon
        name="search"
        :size="14"
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
      />
      <input
        :value="search"
        type="search"
        :placeholder="t('admin.chiourim.searchPlaceholder')"
        class="field pl-9"
        @input="search = liveValue($event)"
      />
    </div>

    <AdminEmpty
      v-if="filtered.length === 0"
      icon="users"
      :message="auteurs.length === 0 ? t('admin.auteurs.empty') : t('admin.auteurs.noMatch')"
    />

    <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="auteur in filtered" :key="auteur.id">
        <router-link
          :to="`/admin/auteurs/${auteur.id}`"
          class="card card-hover group flex h-full items-start gap-3 p-4"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/10 font-bold text-primary"
          >
            {{ initials(auteur.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-text-primary group-hover:text-primary">
              {{ auteur.name }}
            </span>
            <span class="block text-sm text-text-secondary">
              {{
                t("admin.auteurs.chiourimCount", {
                  count: statsByAuteur.get(auteur.id)?.published ?? 0,
                })
              }}
            </span>
            <span class="mt-2 flex flex-wrap gap-1.5">
              <AdminStatus
                v-if="statsByAuteur.get(auteur.id)?.drafts"
                tone="warning"
                :label="
                  t(
                    'admin.auteurs.draftsCount',
                    { n: statsByAuteur.get(auteur.id)?.drafts ?? 0 },
                    statsByAuteur.get(auteur.id)?.drafts ?? 0,
                  )
                "
              />
              <AdminStatus
                :tone="linked.has(auteur.id) ? 'neutral' : 'danger'"
                :label="
                  linked.has(auteur.id)
                    ? t('admin.auteurDetail.linkActive')
                    : t('admin.auteurDetail.linkInactive')
                "
              />
            </span>
          </span>
        </router-link>
      </li>
    </ul>
  </div>
</template>
