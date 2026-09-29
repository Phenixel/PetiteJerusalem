<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId, type SerieWithId } from "../../services/adminService";
import { chiourService } from "../../services/chiourService";
import { studioService } from "../../services/studioService";
import { formatAgo, formatDay, formatDuration, formatSize } from "../../services/adminFormat";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { refreshAdminSummary } from "../../composables/useAdminSummary";
import AppSelect from "../../components/AppSelect.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import ProgressBar from "../../components/ProgressBar.vue";
import ToggleSwitch from "../../components/ToggleSwitch.vue";
import AdminStatus from "../../components/admin/AdminStatus.vue";
import AdminSkeleton from "../../components/admin/AdminSkeleton.vue";

/**
 * La fiche d'un chiour. Un brouillon arrive d'un auteur : on l'écoute ici
 * (le lecteur est en tête), on corrige titre, catégories et rattachement, et
 * on publie. Le contenu à gauche, le rangement et la publication à droite.
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { confirm } = useConfirm();
const toast = useToast();

const slug = computed(() => String(route.params.slug ?? ""));

const isLoading = ref(true);
const chiour = ref<ChiourDoc | null>(null);
const auteurs = ref<AuteurWithId[]>([]);
const series = ref<SerieWithId[]>([]);
const categorySuggestions = ref<string[]>([]);

const name = ref("");
const description = ref("");
const auteurId = ref("");
const selectedCategories = ref<string[]>([]);
const newCategory = ref("");
const niveau = ref("");
const serieId = ref("");
const episode = ref<number | null>(null);
const published = ref(false);

const audioFile = ref<File | null>(null);
const uploadPercent = ref<number | null>(null);
const isSaving = ref(false);
const isDeleting = ref(false);
const errorMessage = ref("");

const seriesForAuteur = computed(() =>
  auteurId.value ? series.value.filter((s) => s.auteurId === auteurId.value) : series.value,
);

// Les lignes des listes déroulantes : en `.map()` dans le gabarit, le tableau
// changeait d'identité à chaque rendu de la page et rouvrait tout le calcul
// d'AppSelect au passage.
const auteurOptions = computed(() => auteurs.value.map((a) => ({ value: a.id, label: a.name })));
const serieOptions = computed(() =>
  seriesForAuteur.value.map((serie) => ({ value: serie.id, label: serie.name })),
);

const allCategories = computed(() => {
  const set = new Set([...categorySuggestions.value, ...selectedCategories.value]);
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
});

/** Ce qu'on sait du fichier et de sa vie, sur une ligne. */
const facts = computed(() => {
  const c = chiour.value;
  if (!c) return [];
  return [
    c.duration ? formatDuration(c.duration) : null,
    c.fileSize ? formatSize(c.fileSize) : null,
    c.createdAt ? t("admin.chiourEdit.addedOn", { date: formatDay(c.createdAt) }) : null,
    c.updatedAt ? t("admin.chiourEdit.updatedAgo", { ago: formatAgo(c.updatedAt, t) }) : null,
    c.published ? t("common.viewsCount", { count: c.views ?? 0 }) : null,
  ].filter((fact): fact is string => !!fact);
});

onMounted(async () => {
  try {
    const [doc, auteursList, seriesList, cats] = await Promise.all([
      adminService.getChiour(slug.value),
      adminService.listAuteurs(),
      adminService.listSeries(),
      chiourService.getCategories(),
    ]);
    chiour.value = doc;
    auteurs.value = auteursList;
    series.value = seriesList;
    categorySuggestions.value = cats;

    if (doc) {
      name.value = doc.name;
      description.value = doc.description;
      auteurId.value = doc.auteurId ?? "";
      selectedCategories.value = [...doc.categories];
      niveau.value = doc.niveau ?? "";
      serieId.value = doc.serieId ?? "";
      episode.value = doc.episode ?? null;
      published.value = doc.published;
    }
  } finally {
    isLoading.value = false;
  }
});

function toggleCategory(cat: string) {
  const i = selectedCategories.value.indexOf(cat);
  if (i >= 0) selectedCategories.value.splice(i, 1);
  else selectedCategories.value.push(cat);
}

function addNewCategory() {
  const cat = newCategory.value.trim();
  if (cat && !selectedCategories.value.includes(cat)) selectedCategories.value.push(cat);
  newCategory.value = "";
}

function onFileChange(event: Event) {
  errorMessage.value = "";
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    audioFile.value = null;
    return;
  }
  const problem = studioService.validateAudioFile(file);
  if (problem) {
    errorMessage.value = t(`studio.form.${problem}`);
    input.value = "";
    audioFile.value = null;
    return;
  }
  audioFile.value = file;
}

async function save() {
  if (!chiour.value) return;
  errorMessage.value = "";
  if (!name.value.trim()) {
    errorMessage.value = t("studio.form.missingTitle");
    return;
  }
  isSaving.value = true;
  try {
    if (audioFile.value) {
      uploadPercent.value = 0;
      await adminService.replaceAudio(chiour.value, audioFile.value, (p) => {
        uploadPercent.value = p;
      });
      uploadPercent.value = null;
      audioFile.value = null;
    }

    const auteur = auteurs.value.find((a) => a.id === auteurId.value);
    await adminService.updateChiour(chiour.value.slug, {
      name: name.value.trim(),
      description: description.value.trim(),
      auteurId: auteurId.value || null,
      auteur: auteur?.name ?? (auteurId.value ? null : chiour.value.auteur),
      categories: selectedCategories.value,
      niveau: niveau.value.trim() || null,
      serieId: serieId.value || null,
      episode: episode.value,
      published: published.value,
    });
    toast.success(t("admin.chiourEdit.saved"));
    void refreshAdminSummary(true);
    router.push("/admin/chiourim");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du chiour:", error);
    errorMessage.value = t("admin.error");
  } finally {
    isSaving.value = false;
  }
}

async function remove() {
  if (!chiour.value) return;
  const accepted = await confirm({
    title: t("admin.chiourEdit.deleteConfirm"),
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!accepted) return;
  isDeleting.value = true;
  try {
    await adminService.deleteChiour(chiour.value);
    toast.success(t("admin.chiourEdit.deleted"));
    void refreshAdminSummary(true);
    router.push("/admin/chiourim");
  } catch (error) {
    console.error("Erreur lors de la suppression du chiour:", error);
    toast.error(t("admin.error"));
    isDeleting.value = false;
  }
}
</script>

<template>
  <AdminSkeleton v-if="isLoading" :rows="3" />

  <p v-else-if="!chiour" class="card p-8 text-center text-text-secondary">
    {{ t("admin.chiourEdit.notFound") }}
  </p>

  <form v-else class="animate-[fadeIn_0.3s_ease]" @submit.prevent="save">
    <router-link
      to="/admin/chiourim"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
    >
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("admin.chiourEdit.back") }}
    </router-link>

    <!-- En-tête : le titre, l'état, les faits, et l'écoute -->
    <section class="card mb-6 p-5 md:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            {{ chiour.name }}
          </h2>
          <p class="mt-1 text-sm text-text-secondary">
            {{ chiour.auteur || t("admin.chiourim.noAuteur") }}
            <template v-for="fact in facts" :key="fact"> · {{ fact }}</template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <AdminStatus
            :tone="chiour.published ? 'success' : 'warning'"
            :label="
              chiour.published
                ? t('admin.chiourim.statusPublished')
                : t('admin.chiourim.statusDraft')
            "
          />
          <a
            v-if="chiour.published"
            :href="`/chiourim/${chiour.slug}`"
            target="_blank"
            rel="noopener"
            class="btn btn-soft btn-sm"
          >
            <AppIcon name="external-link" :size="13" />
            {{ t("admin.chiourEdit.viewPage") }}
          </a>
        </div>
      </div>
      <audio
        v-if="chiour.mediaUrl"
        :src="chiour.mediaUrl"
        controls
        preload="none"
        class="mt-4 w-full"
      ></audio>
      <p v-else class="mt-4 text-sm text-amber-700 dark:text-amber-300">
        {{ t("admin.chiourEdit.noAudio") }}
      </p>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Le contenu -->
      <section class="card space-y-5 p-5 md:p-6 lg:col-span-2">
        <div>
          <label for="chiour-name" class="mb-2 block text-sm font-semibold text-text-secondary">{{
            t("studio.form.title")
          }}</label>
          <input id="chiour-name" v-model="name" type="text" required class="field" />
        </div>

        <div>
          <label for="chiour-desc" class="mb-2 block text-sm font-semibold text-text-secondary">{{
            t("studio.form.description")
          }}</label>
          <textarea
            id="chiour-desc"
            v-model="description"
            rows="6"
            class="field resize-y"
          ></textarea>
        </div>

        <div>
          <span class="mb-2 block text-sm font-semibold text-text-secondary">{{
            t("studio.form.categories")
          }}</span>
          <div v-if="allCategories.length" class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="cat in allCategories"
              :key="cat"
              type="button"
              class="rounded-pill px-3 py-1 text-sm font-semibold transition-colors"
              :class="
                selectedCategories.includes(cat)
                  ? 'bg-primary text-white'
                  : 'bg-black/5 text-text-secondary hover:text-text-primary dark:bg-white/10'
              "
              :aria-pressed="selectedCategories.includes(cat)"
              @click="toggleCategory(cat)"
            >
              {{ cat }}
            </button>
          </div>
          <div class="flex gap-2">
            <input
              v-model="newCategory"
              type="text"
              :placeholder="t('studio.form.newCategoryPlaceholder')"
              class="field flex-1"
              @keydown.enter.prevent="addNewCategory"
            />
            <button type="button" class="btn btn-soft" @click="addNewCategory">
              {{ t("studio.form.addCategory") }}
            </button>
          </div>
        </div>
      </section>

      <!-- Le rangement et la publication -->
      <aside class="space-y-6">
        <section class="card space-y-4 p-5">
          <h3 class="font-bold text-text-primary">{{ t("admin.chiourEdit.filing") }}</h3>
          <div>
            <span class="mb-2 block text-sm font-semibold text-text-secondary">{{
              t("admin.chiourEdit.auteur")
            }}</span>
            <AppSelect
              v-model="auteurId"
              :options="auteurOptions"
              :placeholder="t('admin.chiourEdit.noAuteur')"
            />
          </div>
          <div>
            <span class="mb-2 block text-sm font-semibold text-text-secondary">{{
              t("studio.form.serie")
            }}</span>
            <AppSelect
              v-model="serieId"
              :options="serieOptions"
              :placeholder="t('studio.form.noSerie')"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="chiour-ep" class="mb-2 block text-sm font-semibold text-text-secondary">{{
                t("studio.form.episode")
              }}</label>
              <input
                id="chiour-ep"
                v-model.number="episode"
                type="number"
                min="1"
                step="1"
                class="field"
              />
            </div>
            <div>
              <label
                for="chiour-niveau"
                class="mb-2 block text-sm font-semibold text-text-secondary"
                >{{ t("studio.form.niveau") }}</label
              >
              <input id="chiour-niveau" v-model="niveau" type="text" class="field" />
            </div>
          </div>
        </section>

        <section class="card space-y-3 p-5">
          <h3 class="font-bold text-text-primary">{{ t("studio.form.replaceAudio") }}</h3>
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
            class="field cursor-pointer text-sm file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-primary"
            @change="onFileChange"
          />
          <div v-if="uploadPercent !== null" class="space-y-1.5">
            <p class="text-sm text-text-secondary">
              {{ t("studio.form.uploading", { percent: uploadPercent }) }}
            </p>
            <ProgressBar
              :value="uploadPercent"
              :label="t('studio.form.uploading', { percent: uploadPercent })"
            />
          </div>
        </section>

        <section class="card p-5">
          <label class="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span class="block font-bold text-text-primary">{{
                t("admin.chiourEdit.publishedTitle")
              }}</span>
              <span class="block text-sm text-text-secondary">{{
                t("admin.chiourEdit.publishedHint")
              }}</span>
            </span>
            <ToggleSwitch v-model="published" />
          </label>
        </section>
      </aside>
    </div>

    <p
      v-if="errorMessage"
      class="mt-4 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400"
    >
      <AppIcon name="alert-circle" :size="14" />
      {{ errorMessage }}
    </p>

    <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
      <button
        type="button"
        class="btn btn-danger w-full sm:w-auto"
        :disabled="isDeleting || isSaving"
        @click="remove"
      >
        <AppIcon v-if="isDeleting" name="spinner" :size="14" class="animate-spin" />
        <AppIcon v-else name="trash" :size="14" />
        {{ t("common.delete") }}
      </button>
      <router-link to="/admin/chiourim" class="btn btn-soft w-full sm:ml-auto sm:w-auto">
        {{ t("common.cancel") }}
      </router-link>
      <button type="submit" class="btn btn-primary w-full sm:w-auto" :disabled="isSaving">
        <AppIcon v-if="isSaving" name="spinner" :size="15" class="animate-spin" />
        {{ isSaving ? t("common.saving") : t("common.save") }}
      </button>
    </div>
  </form>
</template>
