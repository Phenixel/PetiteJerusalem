<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import textStudiesJson from "../../datas/textStudies.json";
import type {
  Session,
  TextStudyReservation,
  TextStudiesJson,
  TextStudyJsonEntry,
} from "../../models/models";
import type { User } from "../../services/authService";
import { loadText, MissingTextFileError } from "../../services/textService";
import type { TextContent, TextSection } from "../../services/textService";
import { transliterate, hasNiqqud } from "../../services/hebrewTransliteration";
import { appendHebrewNumeral } from "../../services/hebrewNumerals";
import { sessionService } from "../../services/sessionService";
import { seoService } from "../../services/seoService";
import {
  hubPath,
  sectionPath,
  entryByCorpusSlug,
  sectionTitle,
  hubTitle,
  sectionDescription,
  hubDescription,
  READING_LEAD,
  SITE_URL,
} from "../../content/etudeTexts";
import GuestForm from "../../components/GuestForm.vue";
import ReadingNav from "../../components/ReadingNav.vue";
import AppIcon from "../../components/icons/AppIcon.vue";
import { useToast } from "../../composables/useToast";
import { useReadingSize } from "../../composables/useReadingSize";
import { isNativeApp } from "../../composables/useNativeApp";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const toast = useToast();
const readingSize = useReadingSize();

// This view serves two URL shapes with the SAME UI: the in-session reader
// (/lire/:textId, numeric id) and the public, indexable reading pages
// (/bibliotheque/:corpus/:slug[/:section], keyword URLs). `isEtudeRoute` switches
// navigation + metadata between the two.
const isEtudeRoute = computed(() => route.params.corpus !== undefined);
const etudeEntry = computed<TextStudyJsonEntry | null>(() =>
  isEtudeRoute.value
    ? entryByCorpusSlug(String(route.params.corpus), String(route.params.slug))
    : null,
);

const textId = computed(() =>
  isEtudeRoute.value ? String(etudeEntry.value?.id ?? "") : String(route.params.textId),
);
const sectionParam = computed(() => (route.params.section ? Number(route.params.section) : undefined));
const sessionSlug = computed(() => (route.query.session ? String(route.query.session) : null));

/** Reading lead is shown on the public /bibliotheque pages (not in the session reader). */
const readingLead = READING_LEAD;
const isTehilimEtude = computed(
  () => isEtudeRoute.value && String(route.params.corpus) === "tehilim",
);

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const textEntry = computed(() => allTexts.find((t) => String(t.id) === textId.value) ?? null);

const loading = ref(false);
const missingFile = ref(false);
const error = ref(false);
const content = ref<TextContent | null>(null);
const showPhonetic = ref(false);

// --- Reading ---
const isSingleSection = computed(() => content.value?.sections.length === 1);

// Texts reserved as a whole (Tehilim, full parasha) don't need verse numbers.
const showVerseNumbers = computed(() => (textEntry.value?.totalSections ?? 1) > 1);

const showSectionList = computed(() => !isSingleSection.value && sectionParam.value === undefined);

const currentSection = computed<TextSection | null>(() => {
  if (!content.value) return null;
  if (isSingleSection.value) return content.value.sections[0];
  if (sectionParam.value !== undefined) {
    return content.value.sections.find((s) => s.index === sectionParam.value) ?? null;
  }
  return null;
});

const canTransliterate = computed(() => currentSection.value?.he.some((line) => hasNiqqud(line)) ?? false);

const sectionIndexInList = computed(() => {
  if (!content.value || !currentSection.value) return -1;
  return content.value.sections.indexOf(currentSection.value);
});
const hasPrev = computed(() => sectionIndexInList.value > 0);
const hasNext = computed(
  () => content.value !== null && sectionIndexInList.value < content.value.sections.length - 1,
);

async function loadContent() {
  if (!textEntry.value) return;
  loading.value = true;
  error.value = false;
  missingFile.value = false;
  content.value = null;
  try {
    content.value = await loadText(textEntry.value);
  } catch (e) {
    if (e instanceof MissingTextFileError) missingFile.value = true;
    else error.value = true;
  } finally {
    loading.value = false;
  }
}

// Entering a chapter from the list pushes a new entry; paging between chapters
// (next/previous) replaces it, since moving along is lateral navigation within
// the same text rather than a new page to step back through.
function goToSection(index: number, replace = false) {
  const to =
    isEtudeRoute.value && textEntry.value
      ? sectionPath(textEntry.value, index)
      : { name: "text-reading-section", params: { textId: textId.value, section: index }, query: route.query };
  if (replace) router.replace(to);
  else router.push(to);
  window.scrollTo({ top: 0 });
}

function backToSectionList() {
  const to =
    isEtudeRoute.value && textEntry.value
      ? hubPath(textEntry.value)
      : { name: "text-reading", params: { textId: textId.value }, query: route.query };
  router.push(to);
  window.scrollTo({ top: 0 });
}

function exitReading() {
  if (sessionSlug.value) {
    router.push(`/share-reading/session/${sessionSlug.value}`);
    return;
  }
  // While reading a chapter, "back" returns to this text's chapter list rather
  // than the previously read chapter — readers paging through next/previous
  // expect to land back on the list to pick another passage.
  if (!isSingleSection.value && sectionParam.value !== undefined) {
    backToSectionList();
    return;
  }
  router.back();
}

function prevSection() {
  if (content.value && hasPrev.value)
    goToSection(content.value.sections[sectionIndexInList.value - 1].index, true);
}
function nextSection() {
  if (content.value && hasNext.value)
    goToSection(content.value.sections[sectionIndexInList.value + 1].index, true);
}

// Sibling texts of the same type (all Tehilim, all tractates…), in catalog order.
const siblings = computed(() =>
  textEntry.value ? allTexts.filter((s) => s.type === textEntry.value!.type) : [],
);
const siblingIndex = computed(() => siblings.value.findIndex((s) => String(s.id) === textId.value));
const prevText = computed<TextStudyJsonEntry | null>(() =>
  siblingIndex.value > 0 ? siblings.value[siblingIndex.value - 1] : null,
);
const nextText = computed<TextStudyJsonEntry | null>(() =>
  siblingIndex.value >= 0 && siblingIndex.value < siblings.value.length - 1
    ? siblings.value[siblingIndex.value + 1]
    : null,
);

// Paging to the previous/next sibling text (e.g. Tehilim 5 → Tehilim 6) is
// lateral navigation, so it replaces the history entry rather than pushing.
// That way "Retour" (and the browser back button) returns to the list the
// reader came from instead of stepping back through every text already read.
function goToText(target: TextStudyJsonEntry) {
  const to = isEtudeRoute.value
    ? hubPath(target)
    : { name: "text-reading", params: { textId: String(target.id) }, query: route.query };
  router.replace(to);
  window.scrollTo({ top: 0 });
}

// --- Reservation (session mode) ---
const session = ref<Session | null>(null);
const currentUser = ref<User | null>(null);
const reservationForm = ref({ name: "", email: "" });
const isReserving = ref(false);

const isSessionMode = computed(() => sessionSlug.value !== null && session.value !== null);

// Reservation unit: the current chapter, or 1 for a single-section text.
const reservationUnit = computed(() => (isSingleSection.value ? 1 : sectionParam.value));

const showReservationBar = computed(() => isSessionMode.value && reservationUnit.value !== undefined);

function findReservation(unit: number | undefined): TextStudyReservation | null {
  if (!session.value || unit === undefined) return null;
  return (
    session.value.reservations.find((r) => r.textStudyId === textId.value && r.section === unit) ?? null
  );
}

const currentReservation = computed(() => findReservation(reservationUnit.value));

const reservedStatus = computed(() => {
  if (!session.value || reservationUnit.value === undefined) return { isReserved: false } as const;
  return sessionService.isTextOrSectionReserved(textId.value, reservationUnit.value, session.value);
});

const isMine = computed(() => {
  const r = currentReservation.value;
  return !!r && sessionService.canUserDeleteReservation(r, currentUser.value, reservationForm.value.email);
});

async function reserve() {
  if (!session.value || reservationUnit.value === undefined) return;
  if (!currentUser.value && (!reservationForm.value.name || !reservationForm.value.email)) {
    toast.info(t("textReading.guestIntro"));
    return;
  }
  isReserving.value = true;
  try {
    const id = await sessionService.createReservationForUser(
      session.value.id,
      textId.value,
      reservationUnit.value,
      currentUser.value,
      reservationForm.value,
    );
    const local = sessionService.createLocalReservation(
      id,
      textId.value,
      reservationUnit.value,
      currentUser.value,
      reservationForm.value,
    );
    session.value.reservations = [...session.value.reservations, local];
    toast.success(t("textReading.reserveSuccess"));
  } catch (e) {
    toast.errorFromException(
      e,
      e instanceof Error && e.message ? e.message : t("textReading.reserveError"),
    );
  } finally {
    isReserving.value = false;
  }
}

async function cancelReservation() {
  const r = currentReservation.value;
  if (!session.value || !r || !isMine.value) return;
  if (!confirm(t("textReading.cancelConfirm"))) return;
  isReserving.value = true;
  try {
    await sessionService.deleteReservation(session.value.id, r.id);
    session.value.reservations = session.value.reservations.filter((x) => x.id !== r.id);
  } catch (e) {
    toast.errorFromException(e, t("textReading.cancelError"));
  } finally {
    isReserving.value = false;
  }
}

async function toggleRead() {
  const r = currentReservation.value;
  if (!session.value || !r) return;
  const next = !r.isCompleted;
  isReserving.value = true;
  try {
    await sessionService.markReservationAsCompleted(session.value.id, r.id, next);
    r.isCompleted = next;
    session.value.reservations = [...session.value.reservations];
  } catch (e) {
    toast.errorFromException(e, t("textReading.updateError"));
  } finally {
    isReserving.value = false;
  }
}

// --- SEO ---
// On /bibliotheque (the public, indexable pages) use the keyword title/description and
// index the page. On /lire (the in-session reader) keep the reader title and
// noindex, pointing the canonical at the /bibliotheque equivalent.
const pageTitle = computed(() => {
  const e = textEntry.value;
  if (!e) return "Lecture | Petite Jérusalem";
  if (isEtudeRoute.value) {
    return currentSection.value ? sectionTitle(e, currentSection.value) : hubTitle(e);
  }
  const sec = currentSection.value && !isSingleSection.value ? ` · ${currentSection.value.label}` : "";
  return `${appendHebrewNumeral(e.name)}${sec} | Petite Jérusalem`;
});
const pageDescription = computed(() => {
  const e = textEntry.value;
  if (!e || !isEtudeRoute.value) return undefined;
  return currentSection.value ? sectionDescription(e, currentSection.value) : hubDescription(e);
});
const canonicalUrl = computed(() => {
  const e = textEntry.value;
  if (!e) return undefined;
  if (currentSection.value) return `${SITE_URL}${sectionPath(e, currentSection.value.index)}`;
  return `${SITE_URL}${hubPath(e)}`;
});
watch(
  [pageTitle, pageDescription, canonicalUrl],
  ([title, description, canonical]) =>
    seoService.setMeta({
      title,
      description,
      canonical,
      og: canonical ? { url: canonical, type: "article" } : undefined,
      robots: isEtudeRoute.value ? "index, follow" : "noindex, follow",
    }),
  { immediate: true },
);

// --- Lifecycle ---
onMounted(async () => {
  // A public /lire link (no session) is redirected to the canonical /bibliotheque page,
  // so there is a single indexable URL. /bibliotheque pages render here directly.
  if (!isEtudeRoute.value && !sessionSlug.value && textEntry.value) {
    const target =
      sectionParam.value !== undefined
        ? sectionPath(textEntry.value, sectionParam.value)
        : hubPath(textEntry.value);
    router.replace(target);
    return;
  }
  await loadContent();
  if (sessionSlug.value) {
    currentUser.value = await sessionService.getCurrentUser();
    session.value = await sessionService.resolveSession(sessionSlug.value);
  }
});
watch(textId, loadContent);
</script>

<template>
  <main class="mx-auto px-6 py-12 max-w-3xl w-full">
    <button @click="exitReading" class="back-link mb-8">
      <AppIcon name="chevron-left" :size="14" />
      {{ sessionSlug ? t("textReading.backToSession") : t("textReading.back") }}
    </button>

    <!-- Text not in catalog -->
    <div v-if="!textEntry" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="help" :size="32" class="text-text-secondary/40 mb-4" />
      <p class="text-text-secondary">{{ t("textReading.notFound") }}</p>
    </div>

    <div v-else-if="loading" class="animate-pulse">
      <div class="h-4 w-24 bg-primary/10 rounded-full mb-3"></div>
      <div class="h-9 bg-black/10 rounded-lg w-2/3 mb-8 dark:bg-white/10"></div>
      <div class="space-y-4">
        <div v-for="n in 6" :key="n" class="h-5 bg-black/10 rounded w-full dark:bg-white/10"></div>
      </div>
    </div>

    <!-- Text file unavailable -->
    <div
      v-else-if="missingFile"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <AppIcon name="book-open" :size="32" class="text-primary/60 mb-4" />
      <h2 class="text-xl font-semibold text-text-primary mb-2">
        {{ t("textReading.missingTitle") }}
      </h2>
      <p class="text-text-secondary mb-1 max-w-sm">
        {{ t("textReading.missingDescription") }}
      </p>
      <p class="text-xs text-text-secondary/60">{{ appendHebrewNumeral(textEntry.name) }}</p>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 text-center">
      <AppIcon name="alert-triangle" :size="32" class="text-red-500 mb-4" />
      <p class="text-text-primary font-medium mb-6">{{ t("textReading.loadError") }}</p>
      <button @click="loadContent" class="btn btn-soft">
        {{ t("textReading.retry") }}
      </button>
    </div>

    <template v-else-if="content">
      <header class="mb-8">
        <p class="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
          {{ textEntry.livre }}
        </p>
        <h1 class="text-3xl md:text-4xl font-bold text-text-primary">
          {{ appendHebrewNumeral(textEntry.name) }}
        </h1>
        <p
          v-if="currentSection && !isSingleSection"
          class="mt-2 text-text-secondary"
        >
          {{ currentSection.label }}
        </p>
      </header>

      <!-- SEO intro (public /bibliotheque reading pages only ; masquée dans
           l'app native où elle n'apporte rien au lecteur) -->
      <p v-if="isEtudeRoute && !isNativeApp" class="-mt-4 mb-8 text-text-secondary leading-relaxed">
        {{ readingLead }}
      </p>

      <!-- Passage list (multi-section texts) -->
      <div v-if="showSectionList">
        <ReadingNav
          v-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mb-8"
        />
        <p class="text-sm text-text-secondary mb-4">
          {{ t("textReading.sectionsCount", { count: content.sections.length }) }}
        </p>
        <div class="space-y-2">
          <button
            v-for="section in content.sections"
            :key="section.index"
            @click="goToSection(section.index)"
            class="card card-hover w-full flex items-center justify-between gap-3 p-4 transition-all text-left group"
          >
            <span class="flex items-center gap-3 min-w-0">
              <span
                class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm"
              >
                {{ section.index }}
              </span>
              <span class="font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                {{ section.label }}
              </span>
            </span>
            <span class="flex items-center gap-2 flex-shrink-0">
              <AppIcon
                v-if="isSessionMode && findReservation(section.index)?.isCompleted"
                name="circle-check"
                :size="16"
                class="text-green-500"
                :title="t('textReading.read')"
              />
              <AppIcon
                v-else-if="isSessionMode && findReservation(section.index)"
                name="user-clock"
                :size="16"
                class="text-amber-500"
              />
              <AppIcon
                name="chevron-right"
                :size="15"
                class="text-text-secondary/40 group-hover:text-primary transition-colors"
              />
            </span>
          </button>
        </div>
        <ReadingNav
          v-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mt-10"
        />
      </div>

      <!-- Reading a passage -->
      <div v-else-if="currentSection">
        <!-- Reservation bar (session mode) -->
        <div v-if="showReservationBar" class="mb-8 p-4 card">
          <!-- Current session -->
          <router-link
            :to="`/share-reading/session/${sessionSlug}`"
            class="flex items-center gap-2 mb-3 text-sm font-semibold text-text-primary hover:text-primary transition-colors"
          >
            <AppIcon name="users" :size="16" class="text-primary flex-shrink-0" />
            <span class="truncate">{{ session?.name }}</span>
          </router-link>

          <!-- Reserved by me -->
          <div v-if="isMine" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span
              class="chip !text-sm w-fit"
              :class="
                currentReservation?.isCompleted
                  ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
              "
            >
              <AppIcon
                :name="currentReservation?.isCompleted ? 'circle-check' : 'user-clock'"
                :size="14"
              />
              {{
                currentReservation?.isCompleted
                  ? t("textReading.readByYou")
                  : t("textReading.reservedByYou")
              }}
            </span>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                @click="toggleRead"
                :disabled="isReserving"
                class="btn !px-3 !py-1.5 text-sm"
                :class="
                  currentReservation?.isCompleted
                    ? 'btn-soft'
                    : 'bg-green-600/10 text-green-700 hover:bg-green-600/20 dark:text-green-300'
                "
              >
                <AppIcon name="check" :size="13" />
                {{ currentReservation?.isCompleted ? t("textReading.unmarkRead") : t("textReading.markRead") }}
              </button>
              <button
                @click="cancelReservation"
                :disabled="isReserving"
                class="icon-btn hover:!text-red-600 disabled:opacity-50"
                :title="t('textReading.cancel')"
              >
                <AppIcon name="x" :size="16" />
              </button>
            </div>
          </div>

          <!-- Reserved by someone else -->
          <div v-else-if="reservedStatus.isReserved" class="flex items-center gap-2">
            <span
              class="chip !text-sm w-fit"
              :class="
                currentReservation?.isCompleted
                  ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
              "
            >
              <AppIcon
                :name="currentReservation?.isCompleted ? 'circle-check' : 'user'"
                :size="14"
              />
              {{
                currentReservation?.isCompleted
                  ? t("textReading.readBy", { name: reservedStatus.reservedBy || t("textReading.someone") })
                  : t("textReading.reservedBy", { name: reservedStatus.reservedBy || t("textReading.someone") })
              }}
            </span>
          </div>

          <!-- Available -->
          <div v-else>
            <div v-if="!currentUser" class="mb-4">
              <p class="text-sm text-text-secondary mb-3">
                {{ t("textReading.guestIntro") }}
              </p>
              <GuestForm v-model:reservation-form="reservationForm" />
            </div>
            <button @click="reserve" :disabled="isReserving" class="btn btn-primary text-sm">
              <AppIcon name="bookmark" :size="13" />
              {{ t("textReading.reserve") }}
            </button>
          </div>
        </div>

        <!-- Top navigation -->
        <ReadingNav
          v-if="!isSingleSection"
          :prev-label="hasPrev ? t('textReading.previous') : null"
          :next-label="hasNext ? t('textReading.next') : null"
          :middle-label="t('textReading.allSections')"
          @prev="prevSection"
          @next="nextSection"
          @middle="backToSectionList"
          class="mb-8"
        />
        <ReadingNav
          v-else-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mb-8"
        />

        <!-- Reading toolbar: text size + Hebrew / phonetic toggle -->
        <div class="flex items-center justify-end gap-3 mb-5">
          <div
            class="inline-flex items-center rounded-lg bg-black/5 dark:bg-white/10"
            role="group"
            :aria-label="t('textReading.textSize')"
          >
            <button
              @click="readingSize.decrease()"
              :disabled="!readingSize.canDecrease.value"
              class="px-3 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
              :aria-label="t('textReading.textSizeDecrease')"
              :title="t('textReading.textSizeDecrease')"
            >
              A−
            </button>
            <button
              @click="readingSize.increase()"
              :disabled="!readingSize.canIncrease.value"
              class="px-3 py-1.5 text-base font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-35"
              :aria-label="t('textReading.textSizeIncrease')"
              :title="t('textReading.textSizeIncrease')"
            >
              A+
            </button>
          </div>

          <div v-if="canTransliterate" class="inline-flex p-0.5 rounded-lg bg-black/5 dark:bg-white/10">
            <button
              @click="showPhonetic = false"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="
                !showPhonetic
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
            >
              {{ t("textReading.hebrew") }}
            </button>
            <button
              @click="showPhonetic = true"
              class="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :class="
                showPhonetic
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-secondary'
              "
            >
              {{ t("textReading.phonetic") }}
            </button>
          </div>
        </div>

        <!-- Talmud: continuous text with a marker at each daf change -->
        <div
          v-if="content.type === 'Talmud Bavli'"
          :style="{ '--reading-scale': readingSize.scale.value }"
        >
          <template v-for="block in currentSection.dafBlocks ?? []" :key="block.daf">
            <p class="mt-6 mb-2 text-sm font-semibold text-primary">Daf {{ block.daf }}</p>
            <p
              v-if="!showPhonetic"
              dir="rtl"
              class="font-hebrew leading-loose text-text-primary reading-he"
            >
              {{ block.lines.join(" ") }}
            </p>
            <p v-else dir="ltr" class="leading-relaxed italic text-text-secondary reading-tl">
              {{ block.lines.map(transliterate).join(" ") }}
            </p>
          </template>
        </div>

        <!-- Verses / mishnayot (numbered for reference texts) -->
        <div v-else class="space-y-6" :style="{ '--reading-scale': readingSize.scale.value }">
          <div v-for="(line, index) in currentSection.he" :key="index" class="flex items-start gap-3">
            <span
              v-if="showVerseNumbers"
              class="mt-2 flex-shrink-0 w-6 text-right text-xs text-primary font-semibold select-none"
            >
              {{ index + 1 }}
            </span>
            <p
              v-if="!showPhonetic"
              dir="rtl"
              class="flex-1 min-w-0 font-hebrew leading-loose text-text-primary reading-he"
            >
              {{ line }}
            </p>
            <p
              v-else
              dir="ltr"
              class="flex-1 min-w-0 leading-relaxed italic text-text-secondary reading-tl"
            >
              {{ transliterate(line) }}
            </p>
          </div>
        </div>

        <!-- Bottom navigation -->
        <ReadingNav
          v-if="!isSingleSection"
          :prev-label="hasPrev ? t('textReading.previous') : null"
          :next-label="hasNext ? t('textReading.next') : null"
          :middle-label="t('textReading.allSections')"
          @prev="prevSection"
          @next="nextSection"
          @middle="backToSectionList"
          class="mt-12"
        />
        <ReadingNav
          v-else-if="prevText || nextText"
          :prev-label="prevText ? appendHebrewNumeral(prevText.name) : null"
          :next-label="nextText ? appendHebrewNumeral(nextText.name) : null"
          @prev="prevText && goToText(prevText)"
          @next="nextText && goToText(nextText)"
          class="mt-12"
        />
      </div>

      <!-- Internal links (public /bibliotheque reading pages only) -->
      <section
        v-if="isEtudeRoute"
        class="mt-14 text-sm text-text-secondary"
      >
        <nav class="flex flex-wrap gap-x-5 gap-y-2">
          <RouterLink to="/bibliotheque" class="hover:text-primary transition-colors">Bibliothèque</RouterLink>
          <RouterLink
            v-if="isTehilimEtude"
            to="/tehilim"
            class="hover:text-primary transition-colors"
            >Tehilim par intention</RouterLink
          >
          <RouterLink to="/partage-tehilim" class="hover:text-primary transition-colors"
            >Partage de Tehilim</RouterLink
          >
        </nav>
      </section>
    </template>
  </main>
</template>

<style scoped>
/* Reader text sizes follow the A− / A+ control (useReadingSize). */
.reading-he {
  font-size: calc(1.5rem * var(--reading-scale, 1));
}
.reading-tl {
  font-size: calc(1.125rem * var(--reading-scale, 1));
}
</style>
