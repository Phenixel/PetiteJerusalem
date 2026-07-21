<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { EnumTypeTextStudy } from "../../models/typeTextStudy";
import { sessionService } from "../../services/sessionService";
import { TextTypeService } from "../../services/textTypeService";
import { authService } from "../../services/authService";
import type { User } from "../../services/authService";
import { seoService } from "../../services/seoService";
import SignupPromptModal from "../../components/SignupPromptModal.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";

const router = useRouter();
const { t } = useI18n();
const toast = useToast();

const isLoading = ref(false);
const message = ref("");
const messageType = ref<"success" | "error">("success");
const currentUser = ref<User | null>(null);
// Visitors who aren't signed in get the sign-in prompt (like the share home
// page) instead of being redirected away.
const showAuthPrompt = ref(false);

const textStudyTypes = TextTypeService.getAllTypes();

const sessionData = reactive({
  name: "",
  description: "",
  type: "" as EnumTypeTextStudy | "",
  dateLimit: "",
  isPrivate: false,
});

const availableBooks = ref<string[]>([]);
const selectedBooks = ref<string[]>([]);
const isBookSelectionEnabled = ref(false);

const buttonText = computed(() => {
  return isLoading.value ? t("newSession.creating") : t("newSession.create");
});

watch(
  () => sessionData.type,
  async (newType) => {
    selectedBooks.value = [];
    availableBooks.value = [];
    isBookSelectionEnabled.value = false;

    if (newType) {
      try {
        const books = await sessionService.getBooksByType(newType as EnumTypeTextStudy);
        if (books.length > 0) {
          availableBooks.value = books;
          selectedBooks.value = [...books];
          isBookSelectionEnabled.value = true;
        }
      } catch (error) {
        console.error("Erreur lors du chargement des livres:", error);
      }
    }
  },
);

const toggleAllBooks = () => {
  if (selectedBooks.value.length === availableBooks.value.length) {
    selectedBooks.value = [];
  } else {
    selectedBooks.value = [...availableBooks.value];
  }
};

const formatBookName = (bookName: string) => {
  return sessionService.formatBookName(bookName);
};

onMounted(async () => {
  currentUser.value = await authService.getCurrentUser();
  if (!currentUser.value) {
    showAuthPrompt.value = true;
  }
  const url = window.location.origin + "/share-reading/new-session";
  seoService.setMeta({
    title: t("seo.newSessionTitle"),
    description: t("seo.newSessionDescription"),
    canonical: url,
    og: { url },
  });
});

const createSession = async () => {
  if (!currentUser.value) {
    showAuthPrompt.value = true;
    return;
  }

  if (
    !sessionData.name ||
    !sessionData.description ||
    !sessionData.type ||
    !sessionData.dateLimit
  ) {
    message.value = t("newSession.fillAllFields");
    messageType.value = "error";
    return;
  }

  if (isBookSelectionEnabled.value && selectedBooks.value.length === 0) {
    message.value = t("newSession.selectAtLeastOne");
    messageType.value = "error";
    return;
  }

  isLoading.value = true;
  message.value = "";

  try {
    const sessionId = await sessionService.createSessionWithValidation(
      sessionData.name,
      sessionData.description,
      sessionData.type as EnumTypeTextStudy,
      sessionData.dateLimit,
      currentUser.value!.id,
      currentUser.value!.name,
      selectedBooks.value.length > 0 ? selectedBooks.value : undefined,
      sessionData.isPrivate,
    );

    // Le toast est monté au niveau de l'app : il survit à la redirection et
    // reste visible sur la page de la session nouvellement créée.
    toast.success(t("newSession.createdSuccess"));
    router.push(`/share-reading/session/${sessionId}`);
  } catch (error) {
    console.error("Erreur lors de la création de la session:", error);
    message.value = t("newSession.createError");
    messageType.value = "error";
    isLoading.value = false;
  } finally {
    if (messageType.value === "error") {
      isLoading.value = false;
    }
  }
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <main class="mx-auto px-6 py-12 min-h-screen">
    <div class="text-center mb-12 animate-[fadeIn_0.5s_ease]">
      <h2 class="text-3xl md:text-4xl font-bold text-text-primary mb-4 tracking-tight">
        {{ t("newSession.title") }}
      </h2>
      <p class="text-text-secondary text-lg">
        {{ t("newSession.subtitle") }}
      </p>
    </div>

    <div class="card p-6 md:p-8 animate-[fadeIn_0.5s_ease_0.1s] text-left">
      <form @submit.prevent="createSession" class="space-y-6">
        <div>
          <label for="name" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.sessionTitle")
          }}</label>
          <input
            type="text"
            id="name"
            v-model="sessionData.name"
            :placeholder="t('newSession.sessionTitlePlaceholder')"
            required
            class="field"
          />
        </div>

        <div>
          <label for="description" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.sessionDescription")
          }}</label>
          <textarea
            id="description"
            v-model="sessionData.description"
            :placeholder="t('newSession.sessionDescriptionPlaceholder')"
            required
            class="field resize-y"
            rows="4"
          ></textarea>
        </div>

        <div>
          <label for="type" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("newSession.textType")
          }}</label>
          <div class="relative">
            <select
              name="type"
              id="type"
              v-model="sessionData.type"
              required
              class="field appearance-none cursor-pointer"
            >
              <option value="">{{ t("newSession.selectType") }}</option>
              <option v-for="type in textStudyTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
            <AppIcon
              name="chevron-down"
              :size="14"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            />
          </div>
        </div>

        <!-- Sélection des parties/livres (s'affiche uniquement si des livres sont disponibles) -->
        <div v-if="isBookSelectionEnabled" class="animate-[fadeIn_0.3s_ease]">
          <label class="block text-sm font-semibold text-text-secondary mb-3">
            {{ t("newSession.selectParts") }}
            <span class="text-xs font-normal text-text-secondary/70 ml-2">
              ({{ selectedBooks.length }}/{{ availableBooks.length }})
            </span>
          </label>

          <div
            class="rounded-lg bg-black/[0.03] p-4 max-h-60 overflow-y-auto custom-scrollbar dark:bg-white/5"
          >
            <div class="flex items-center mb-3">
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="w-5 h-5 rounded accent-primary cursor-pointer"
                  :checked="selectedBooks.length === availableBooks.length"
                  :indeterminate="
                    selectedBooks.length > 0 && selectedBooks.length < availableBooks.length
                  "
                  @change="toggleAllBooks"
                />
                <span class="ml-2 text-sm font-semibold text-text-primary">{{
                  t("newSession.selectAll")
                }}</span>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <label
                v-for="book in availableBooks"
                :key="book"
                class="inline-flex items-center cursor-pointer hover:bg-black/[0.04] px-1.5 py-1 rounded-lg transition-colors dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded accent-primary cursor-pointer"
                  :value="book"
                  v-model="selectedBooks"
                />
                <span class="ml-2 text-sm text-text-secondary">{{ formatBookName(book) }}</span>
              </label>
            </div>
          </div>
          <p
            v-if="selectedBooks.length === 0"
            class="text-xs text-red-600 mt-1.5 flex items-center gap-1 dark:text-red-400"
          >
            <AppIcon name="alert-triangle" :size="13" />
            {{ t("newSession.selectAtLeastOne") }}
          </p>
        </div>

        <div>
          <label for="dateLimit" class="block text-sm font-semibold text-text-secondary mb-2">{{
            t("common.dateLimit")
          }}</label>
          <input
            type="date"
            id="dateLimit"
            v-model="sessionData.dateLimit"
            required
            class="field cursor-pointer dark:[color-scheme:dark]"
          />
        </div>

        <!-- Session privée -->
        <div
          class="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-white/50 dark:bg-gray-700/50 dark:border-gray-600"
        >
          <button
            type="button"
            @click="sessionData.isPrivate = !sessionData.isPrivate"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 mt-0.5"
            :class="sessionData.isPrivate ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'"
            role="switch"
            :aria-checked="sessionData.isPrivate"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="sessionData.isPrivate ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
          <div>
            <p class="text-sm font-semibold text-text-primary dark:text-gray-200 flex items-center gap-2">
              <i class="fa-solid fa-lock text-primary text-xs"></i>
              {{ t("newSession.privateSession") }}
            </p>
            <p class="text-xs text-text-secondary dark:text-gray-400 mt-0.5">
              {{ t("newSession.privateSessionDescription") }}
            </p>
          </div>
        </div>

        <div class="flex flex-col-reverse sm:flex-row gap-4 pt-4">
          <button type="button" @click="goBack" class="btn btn-soft w-full sm:w-auto">
            {{ t("common.cancel") }}
          </button>
          <button type="submit" class="btn btn-primary w-full sm:flex-1" :disabled="isLoading">
            <AppIcon v-if="isLoading" name="spinner" :size="15" class="animate-spin" />
            {{ buttonText }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="message"
      class="mt-6 flex items-center justify-center gap-2 text-center font-medium animate-[fadeIn_0.3s_ease]"
      :class="
        messageType === 'success'
          ? 'text-green-700 dark:text-green-300'
          : 'text-red-600 dark:text-red-400'
      "
    >
      <AppIcon v-if="messageType === 'success'" name="circle-check" :size="15" />
      <AppIcon v-if="messageType === 'error'" name="alert-circle" :size="15" />
      {{ message }}
    </div>

    <SignupPromptModal v-model:show="showAuthPrompt" variant="auth" />
  </main>
</template>
