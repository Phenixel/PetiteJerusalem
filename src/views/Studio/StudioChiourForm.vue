<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ChiourDoc, SerieDoc } from "../../models/models";
import { studioService, type StudioChiourPayload } from "../../services/studioService";
import AppIcon from "../../components/icons/AppIcon.vue";

const props = defineProps<{
  token: string;
  series: (SerieDoc & { id: string })[];
  categorySuggestions: string[];
  /** Chiour en cours d'édition (brouillon), ou null pour un ajout. */
  chiour: ChiourDoc | null;
}>();

const emit = defineEmits<{
  saved: [];
  cancel: [];
  serieCreated: [];
}>();

const { t } = useI18n();

const NEW_SERIE = "__new__";

const name = ref(props.chiour?.name ?? "");
const description = ref(props.chiour?.description ?? "");
const niveau = ref(props.chiour?.niveau ?? "");
const selectedCategories = ref<string[]>([...(props.chiour?.categories ?? [])]);
const newCategory = ref("");
const serieChoice = ref<string>(props.chiour?.serieId ?? "");
const newSerieName = ref("");
const episode = ref<number | null>(props.chiour?.episode ?? null);

const audioFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const isSaving = ref(false);
const uploadPercent = ref<number | null>(null);
const errorMessage = ref("");

const isEditing = computed(() => props.chiour !== null);

const allCategories = computed(() => {
  const set = new Set([...props.categorySuggestions, ...selectedCategories.value]);
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
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
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) {
    audioFile.value = null;
    return;
  }
  const problem = studioService.validateAudioFile(file);
  if (problem) {
    errorMessage.value = t(`studio.form.${problem}`);
    audioFile.value = null;
    if (fileInput.value) fileInput.value.value = "";
    return;
  }
  audioFile.value = file;
}

async function save() {
  errorMessage.value = "";
  if (!name.value.trim()) {
    errorMessage.value = t("studio.form.missingTitle");
    return;
  }
  if (!isEditing.value && !audioFile.value) {
    errorMessage.value = t("studio.form.missingAudio");
    return;
  }

  isSaving.value = true;
  try {
    let stagingPath: string | null = null;
    let duration: number | null = props.chiour?.duration ?? null;

    if (audioFile.value) {
      duration = await studioService.computeDuration(audioFile.value);
      uploadPercent.value = 0;
      const upload = studioService.uploadAudio(props.token, audioFile.value, (p) => {
        uploadPercent.value = p;
      });
      stagingPath = await upload.promise;
      uploadPercent.value = null;
    }

    const payload: StudioChiourPayload = {
      name: name.value.trim(),
      description: description.value.trim(),
      categories: selectedCategories.value,
      niveau: niveau.value.trim() || null,
      serieId: serieChoice.value && serieChoice.value !== NEW_SERIE ? serieChoice.value : null,
      newSerieName: serieChoice.value === NEW_SERIE ? newSerieName.value.trim() || null : null,
      episode: episode.value,
      duration,
    };

    if (isEditing.value) {
      await studioService.updateChiour(props.token, props.chiour!.slug, payload, stagingPath);
    } else {
      await studioService.submitChiour(props.token, stagingPath!, payload);
    }
    if (payload.newSerieName) emit("serieCreated");
    emit("saved");
  } catch (error) {
    console.error("Erreur lors de l'envoi du chiour:", error);
    errorMessage.value = t("studio.form.error");
  } finally {
    isSaving.value = false;
    uploadPercent.value = null;
  }
}
</script>

<template>
  <form @submit.prevent="save" class="space-y-6 text-left">
    <div>
      <label for="studio-name" class="block text-sm font-semibold text-text-secondary mb-2">
        {{ t("studio.form.title") }}
      </label>
      <input
        id="studio-name"
        v-model="name"
        type="text"
        :placeholder="t('studio.form.titlePlaceholder')"
        required
        class="field"
      />
    </div>

    <div>
      <label for="studio-description" class="block text-sm font-semibold text-text-secondary mb-2">
        {{ t("studio.form.description") }}
      </label>
      <textarea
        id="studio-description"
        v-model="description"
        :placeholder="t('studio.form.descriptionPlaceholder')"
        rows="4"
        class="field resize-y"
      ></textarea>
    </div>

    <div>
      <label class="block text-sm font-semibold text-text-secondary mb-2">
        {{ t("studio.form.categories") }}
      </label>
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

    <div>
      <label for="studio-niveau" class="block text-sm font-semibold text-text-secondary mb-2">
        {{ t("studio.form.niveau") }}
      </label>
      <input
        id="studio-niveau"
        v-model="niveau"
        type="text"
        :placeholder="t('studio.form.niveauPlaceholder')"
        class="field"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="studio-serie" class="block text-sm font-semibold text-text-secondary mb-2">
          {{ t("studio.form.serie") }}
        </label>
        <div class="relative">
          <select id="studio-serie" v-model="serieChoice" class="field appearance-none cursor-pointer">
            <option value="">{{ t("studio.form.noSerie") }}</option>
            <option v-for="serie in series" :key="serie.id" :value="serie.id">
              {{ serie.name }}
            </option>
            <option :value="NEW_SERIE">{{ t("studio.form.newSerie") }}</option>
          </select>
          <AppIcon
            name="chevron-down"
            :size="14"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
        </div>
      </div>
      <div>
        <label for="studio-episode" class="block text-sm font-semibold text-text-secondary mb-2">
          {{ t("studio.form.episode") }}
        </label>
        <input
          id="studio-episode"
          v-model.number="episode"
          type="number"
          min="1"
          step="1"
          class="field"
        />
        <p class="text-xs text-text-secondary/70 mt-1.5">{{ t("studio.form.episodeHint") }}</p>
      </div>
    </div>

    <div v-if="serieChoice === NEW_SERIE">
      <label for="studio-new-serie" class="block text-sm font-semibold text-text-secondary mb-2">
        {{ t("studio.form.newSerieName") }}
      </label>
      <input id="studio-new-serie" v-model="newSerieName" type="text" class="field" required />
    </div>

    <div>
      <label for="studio-audio" class="block text-sm font-semibold text-text-secondary mb-2">
        {{ isEditing ? t("studio.form.replaceAudio") : t("studio.form.audio") }}
      </label>
      <p v-if="isEditing && !audioFile" class="text-xs text-text-secondary/70 mb-2">
        {{ t("studio.form.audioKeep") }}
      </p>
      <input
        id="studio-audio"
        ref="fileInput"
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
        class="field cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-primary"
        @change="onFileChange"
      />
      <p class="text-xs text-text-secondary/70 mt-1.5">{{ t("studio.form.audioHint") }}</p>
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

    <p
      v-if="errorMessage"
      class="text-sm text-red-600 flex items-center gap-1.5 dark:text-red-400"
    >
      <AppIcon name="alert-circle" :size="14" />
      {{ errorMessage }}
    </p>

    <div class="flex flex-col-reverse sm:flex-row gap-4 pt-2">
      <button type="button" class="btn btn-soft w-full sm:w-auto" :disabled="isSaving" @click="emit('cancel')">
        {{ t("common.cancel") }}
      </button>
      <button type="submit" class="btn btn-primary w-full sm:flex-1" :disabled="isSaving">
        <AppIcon v-if="isSaving" name="spinner" :size="15" class="animate-spin" />
        {{
          isSaving
            ? t("studio.form.submitting")
            : isEditing
              ? t("studio.form.update")
              : t("studio.form.submit")
        }}
      </button>
    </div>
  </form>
</template>
