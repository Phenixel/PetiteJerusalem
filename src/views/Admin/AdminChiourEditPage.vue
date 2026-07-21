<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ChiourDoc } from "../../models/models";
import { adminService, type AuteurWithId, type SerieWithId } from "../../services/adminService";
import { chiourService } from "../../services/chiourService";
import { studioService } from "../../services/studioService";
import { useToast } from "../../composables/useToast";
import AppIcon from "../../components/icons/AppIcon.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
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
const order = ref<number | null>(null);
const published = ref(false);

const audioFile = ref<File | null>(null);
const uploadPercent = ref<number | null>(null);
const isSaving = ref(false);
const isDeleting = ref(false);
const errorMessage = ref("");

const seriesForAuteur = computed(() =>
  auteurId.value ? series.value.filter((s) => s.auteurId === auteurId.value) : series.value,
);

const allCategories = computed(() => {
  const set = new Set([...categorySuggestions.value, ...selectedCategories.value]);
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
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
      order.value = doc.order ?? null;
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
      order: order.value,
      published: published.value,
    });
    toast.success(t("admin.chiourEdit.saved"));
    router.push("/admin/chiourim");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du chiour:", error);
    errorMessage.value = t("admin.error");
  } finally {
    isSaving.value = false;
    uploadPercent.value = null;
  }
}

async function remove() {
  if (!chiour.value) return;
  if (!window.confirm(t("admin.chiourEdit.deleteConfirm"))) return;
  isDeleting.value = true;
  try {
    await adminService.deleteChiour(chiour.value);
    toast.success(t("admin.chiourEdit.deleted"));
    router.push("/admin/chiourim");
  } catch (error) {
    console.error("Erreur lors de la suppression du chiour:", error);
    toast.error(t("admin.error"));
    isDeleting.value = false;
  }
}
</script>

<template>
  <div v-if="isLoading" class="text-center py-24 text-text-secondary">
    <AppIcon name="spinner" :size="24" class="animate-spin mx-auto mb-4" />
    {{ t("common.loading") }}
  </div>

  <p v-else-if="!chiour" class="card p-8 text-center text-text-secondary">
    {{ t("admin.chiourEdit.notFound") }}
  </p>

  <div v-else class="card p-6 md:p-8 animate-[fadeIn_0.3s_ease]">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-text-primary">{{ chiour.name }}</h2>
      <span
        class="chip"
        :class="
          published
            ? 'bg-green-600/10 text-green-700 dark:text-green-300'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        "
      >
        {{ published ? t("admin.chiourim.statusPublished") : t("admin.chiourim.statusDraft") }}
      </span>
    </div>

    <form @submit.prevent="save" class="space-y-6 text-left">
      <div>
        <label class="block text-sm font-semibold text-text-secondary mb-2">{{
          t("studio.form.title")
        }}</label>
        <input v-model="name" type="text" required class="field" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-text-secondary mb-2">{{
          t("studio.form.description")
        }}</label>
        <textarea v-model="description" rows="4" class="field resize-y"></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("admin.chiourEdit.auteur")
          }}</label>
          <select v-model="auteurId" class="field appearance-none cursor-pointer">
            <option value="">{{ t("admin.chiourEdit.noAuteur") }}</option>
            <option v-for="a in auteurs" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("studio.form.niveau")
          }}</label>
          <input v-model="niveau" type="text" class="field" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-text-secondary mb-2">{{
          t("studio.form.categories")
        }}</label>
        <div v-if="allCategories.length" class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="cat in allCategories"
            :key="cat"
            type="button"
            class="chip cursor-pointer transition-colors"
            :class="
              selectedCategories.includes(cat)
                ? 'bg-primary/15 text-primary font-semibold'
                : 'opacity-70 hover:opacity-100'
            "
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

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("studio.form.serie")
          }}</label>
          <select v-model="serieId" class="field appearance-none cursor-pointer">
            <option value="">{{ t("studio.form.noSerie") }}</option>
            <option v-for="s in seriesForAuteur" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("studio.form.episode")
          }}</label>
          <input v-model.number="episode" type="number" min="1" step="1" class="field" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("admin.chiourEdit.order")
          }}</label>
          <input v-model.number="order" type="number" min="0" step="1" class="field" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-text-secondary mb-2">{{
          t("studio.form.replaceAudio")
        }}</label>
        <p v-if="chiour.mediaUrl" class="text-xs text-text-secondary/70 mb-2 break-all">
          <a :href="chiour.mediaUrl" target="_blank" rel="noopener" class="hover:text-primary">
            {{ chiour.audioPath || chiour.mediaUrl }}
          </a>
        </p>
        <input
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
          class="field cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-primary"
          @change="onFileChange"
        />
      </div>

      <div v-if="uploadPercent !== null" class="space-y-1.5">
        <p class="text-sm text-text-secondary">
          {{ t("studio.form.uploading", { percent: uploadPercent }) }}
        </p>
        <div class="h-2 rounded-full bg-black/[0.06] overflow-hidden dark:bg-white/10">
          <div
            class="h-full rounded-full bg-primary transition-all duration-300"
            :style="{ width: `${uploadPercent}%` }"
          ></div>
        </div>
      </div>

      <label class="inline-flex items-center gap-2 cursor-pointer">
        <input v-model="published" type="checkbox" class="w-5 h-5 rounded accent-primary cursor-pointer" />
        <span class="font-semibold text-text-primary">{{ t("admin.chiourEdit.published") }}</span>
      </label>

      <p v-if="errorMessage" class="text-sm text-red-600 flex items-center gap-1.5 dark:text-red-400">
        <AppIcon name="alert-circle" :size="14" />
        {{ errorMessage }}
      </p>

      <div class="flex flex-col-reverse sm:flex-row gap-4 pt-2">
        <button
          type="button"
          class="btn btn-soft text-red-600 dark:text-red-400 w-full sm:w-auto"
          :disabled="isDeleting || isSaving"
          @click="remove"
        >
          <AppIcon v-if="isDeleting" name="spinner" :size="14" class="animate-spin" />
          <AppIcon v-else name="trash" :size="14" />
          {{ t("common.delete") }}
        </button>
        <router-link to="/admin/chiourim" class="btn btn-soft w-full sm:w-auto sm:ml-auto">
          {{ t("common.cancel") }}
        </router-link>
        <button type="submit" class="btn btn-primary w-full sm:w-auto" :disabled="isSaving">
          <AppIcon v-if="isSaving" name="spinner" :size="15" class="animate-spin" />
          {{ isSaving ? t("common.saving") : t("common.save") }}
        </button>
      </div>
    </form>
  </div>
</template>
