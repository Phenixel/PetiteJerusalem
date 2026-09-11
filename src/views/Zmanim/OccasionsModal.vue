<script setup lang="ts">
/**
 * Les dates personnelles du calendrier : les voir, en ajouter, les régler.
 *
 * Deux écrans dans une même fenêtre, comme le réglage des rappels de lecture :
 * la liste de ce qu'on a posé, et le formulaire d'une date. On y saisit une
 * date HÉBRAÏQUE (un jour, un mois), parce que c'est ainsi qu'un leilouy
 * nichmat ou un anniversaire hébraïque revient : à sa date, quelle que soit la
 * date civile de l'année.
 *
 * Les particularités du calendrier (Adar, le 30 d'un mois qui n'en a que 29)
 * sont tranchées dans hebrewOccasions ; la note du bas les dit, plutôt que de
 * laisser l'utilisateur découvrir un jour que sa date a bougé.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { HDate } from "@hebcal/core";
import { useOverlay } from "../../composables/useOverlayStack";
import { useConfirm } from "../../composables/useConfirm";
import { useHebrewOccasions, type OccasionDraft } from "../../composables/useHebrewOccasions";
import {
  MAX_OCCASION_DAY,
  MAX_OCCASION_NAME,
  nextOccurrence,
  OCCASION_KINDS,
  OCCASION_MONTHS,
  OCCASION_REMINDERS,
  type HebrewOccasion,
  type OccasionKind,
  type OccasionReminder,
} from "../../services/hebrewOccasions";
import { formatHebrewDate, hebrewMonthName } from "../../services/zmanimService";
import { dateTimeFormat } from "../../services/intlCache";
import { isNativeApp } from "../../composables/useNativeApp";
import AppIcon from "../../components/icons/AppIcon.vue";
import AppSelect from "../../components/AppSelect.vue";
import type { IconName } from "../../components/icons/registry";

const props = defineProps<{
  show: boolean;
  /** Le jour d'aujourd'hui, pour dire quand chaque date revient. */
  today: HDate;
}>();

const emit = defineEmits<{ (e: "update:show", value: boolean): void }>();

const { t, locale } = useI18n();
const { occasions, full, syncedToAccount, saveOccasion, removeOccasion } = useHebrewOccasions();
const { confirm } = useConfirm();

/**
 * Où vivent les dates, dit en une ligne : sur le compte, elles se retrouvent
 * partout ; sans compte, elles ne quittent pas cet appareil, et il vaut mieux
 * le savoir avant d'y inscrire un yahrzeit.
 */
const storageNote = computed(() =>
  syncedToAccount.value ? t("occasions.onAccount") : t("occasions.onDevice"),
);

/** Écran courant : la liste des dates, ou le formulaire de l'une d'elles. */
const view = ref<"list" | "form">("list");

const draft = ref<OccasionDraft>(blankDraft());
/** Vrai quand le formulaire modifie une date existante. */
const editing = computed(() => Boolean(draft.value.id));

function blankDraft(): OccasionDraft {
  return {
    name: "",
    kind: "yahrzeit",
    day: 1,
    month: OCCASION_MONTHS[0],
    reminder: "nightfall",
  };
}

// À chaque ouverture, on repart de la liste : la fenêtre ne rouvre pas sur le
// formulaire à moitié rempli d'une fois précédente.
watch(
  () => props.show,
  (shown) => {
    if (!shown) return;
    view.value = "list";
    draft.value = blankDraft();
  },
);

const KIND_ICONS: Record<OccasionKind, IconName> = {
  yahrzeit: "candle",
  birthday: "cake",
  other: "calendar",
};

/** « 12 Kislev », sans l'année : la date revient, elle n'appartient à aucune. */
function dayAndMonth(occasion: HebrewOccasion): string {
  const name = hebrewMonthName(occasion.month, props.today.getFullYear(), locale.value);
  return t("occasions.dayOfMonth", { day: occasion.day, month: name });
}

/** La prochaine fois que la date revient, en date civile et hébraïque. */
function nextLabel(occasion: HebrewOccasion): string {
  const date = nextOccurrence(occasion, props.today);
  const civil = dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date.greg());
  return t("occasions.nextOn", { civil, hebrew: formatHebrewDate(date, locale.value) });
}

const dayOptions = computed(() =>
  Array.from({ length: MAX_OCCASION_DAY }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  })),
);

const monthOptions = computed(() =>
  OCCASION_MONTHS.map((month) => ({
    value: String(month),
    // Le nom du mois est celui d'une année ORDINAIRE : « Adar », et non
    // « Adar I ». C'est la date qu'on pose, pas l'année en cours.
    label: hebrewMonthName(month, 5786, locale.value),
  })),
);

const dayModel = computed({
  get: () => String(draft.value.day),
  set: (value: string) => {
    draft.value.day = Number(value);
  },
});

const monthModel = computed({
  get: () => String(draft.value.month),
  set: (value: string) => {
    draft.value.month = Number(value);
  },
});

function openForm(occasion?: HebrewOccasion): void {
  draft.value = occasion ? { ...occasion } : blankDraft();
  view.value = "form";
}

const canSave = computed(() => draft.value.name.trim().length > 0);

function save(): void {
  if (!canSave.value) return;
  saveOccasion(draft.value);
  view.value = "list";
}

/**
 * Supprime la date, une fois la question posée.
 *
 * Une date qu'on a pris la peine d'inscrire ne s'efface pas d'un doigt qui
 * glisse sur la corbeille : rien ne permettrait de la retrouver, et un
 * leilouy nichmat se saisit une fois pour toutes. Le nom vient de la liste et
 * non du formulaire, qui peut être en cours de modification.
 */
async function remove(id: string): Promise<void> {
  const name = occasions.value.find((occasion) => occasion.id === id)?.name ?? "";
  const accepted = await confirm({
    title: t("occasions.removeConfirm", { name }),
    message: t("occasions.removeConfirmHint"),
    confirmLabel: t("occasions.remove"),
    danger: true,
  });
  if (!accepted) return;
  removeOccasion(id);
  view.value = "list";
}

function close(): void {
  emit("update:show", false);
}

// Le bouton retour d'Android ferme le formulaire, puis la fenêtre.
useOverlay(
  computed(() => props.show),
  () => {
    if (view.value === "form") view.value = "list";
    else close();
  },
);
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="close">
    <div class="modal-panel !max-w-sm animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="mb-1 flex items-center justify-between gap-2">
        <h3 class="flex min-w-0 items-center gap-2 text-lg font-bold text-text-primary">
          <!-- Le formulaire n'est qu'un détour : on en revient sans rien perdre. -->
          <button
            v-if="view === 'form'"
            type="button"
            class="icon-btn shrink-0"
            :aria-label="t('common.back')"
            @click="view = 'list'"
          >
            <AppIcon name="chevron-left" :size="18" class="rtl:rotate-180" />
          </button>
          <AppIcon v-else name="calendar" :size="17" class="shrink-0 text-primary" />
          <span class="truncate">
            {{ view === "form" ? t("occasions.formTitle") : t("occasions.title") }}
          </span>
        </h3>
        <button
          type="button"
          class="icon-btn shrink-0"
          :aria-label="t('common.close')"
          @click="close"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- ===== La liste des dates posées ===== -->
      <template v-if="view === 'list'">
        <p class="text-sm text-text-secondary">
          {{ t("occasions.description") }} {{ storageNote }}
        </p>

        <p v-if="occasions.length === 0" class="mt-5 text-sm text-text-secondary">
          {{ t("occasions.empty") }}
        </p>
        <ul v-else class="mt-3 flex flex-col divide-y divide-line">
          <li
            v-for="occasion in occasions"
            :key="occasion.id"
            class="flex items-start justify-between gap-3 py-3"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-2.5 text-start"
              :aria-label="t('occasions.editAria', { name: occasion.name })"
              @click="openForm(occasion)"
            >
              <AppIcon
                :name="KIND_ICONS[occasion.kind]"
                :size="16"
                class="mt-0.5 shrink-0 text-primary"
              />
              <span class="min-w-0">
                <span class="block truncate font-medium text-text-primary">
                  {{ occasion.name }}
                </span>
                <span class="block text-sm text-text-secondary">{{ dayAndMonth(occasion) }}</span>
                <span class="block text-xs text-text-secondary/80">{{ nextLabel(occasion) }}</span>
                <span
                  v-if="occasion.reminder !== 'none'"
                  class="mt-0.5 flex items-center gap-1 text-xs text-primary"
                >
                  <AppIcon name="bell" :size="11" class="shrink-0" />
                  {{ t(`occasions.reminders.${occasion.reminder}`) }}
                </span>
              </span>
            </button>
            <button
              type="button"
              class="icon-btn shrink-0"
              :aria-label="t('occasions.removeAria', { name: occasion.name })"
              @click="remove(occasion.id)"
            >
              <AppIcon name="trash" :size="16" />
            </button>
          </li>
        </ul>

        <p v-if="full" class="mt-4 flex items-center gap-1.5 text-sm text-text-secondary">
          <AppIcon name="alert-triangle" :size="14" class="shrink-0" />
          {{ t("occasions.full") }}
        </p>

        <div class="flex justify-end gap-3 pt-6">
          <button type="button" class="btn btn-soft" @click="close">
            {{ t("common.close") }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="full" @click="openForm()">
            <AppIcon name="plus" :size="14" />
            {{ t("occasions.add") }}
          </button>
        </div>
      </template>

      <!-- ===== Le formulaire d'une date ===== -->
      <template v-else>
        <label class="mt-3 block text-sm font-medium text-text-primary" for="occasion-name">
          {{ t("occasions.name") }}
        </label>
        <input
          id="occasion-name"
          v-model="draft.name"
          type="text"
          class="field mt-1"
          :maxlength="MAX_OCCASION_NAME"
          :placeholder="t('occasions.namePlaceholder')"
        />

        <p class="mt-4 text-sm font-medium text-text-primary">{{ t("occasions.kind") }}</p>
        <div class="mt-1.5 flex flex-wrap gap-2">
          <button
            v-for="kind in OCCASION_KINDS"
            :key="kind"
            type="button"
            :class="[
              'flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium transition-colors',
              draft.kind === kind
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15',
            ]"
            @click="draft.kind = kind"
          >
            <AppIcon :name="KIND_ICONS[kind]" :size="14" />
            {{ t(`occasions.kinds.${kind}`) }}
          </button>
        </div>

        <p class="mt-4 text-sm font-medium text-text-primary">{{ t("occasions.date") }}</p>
        <div class="mt-1.5 flex gap-3">
          <div class="w-24 shrink-0">
            <AppSelect v-model="dayModel" :options="dayOptions" />
          </div>
          <div class="min-w-0 flex-1">
            <AppSelect v-model="monthModel" :options="monthOptions" />
          </div>
        </div>

        <!-- Le rappel est programmé par le téléphone : un navigateur n'a rien
             à programmer, le réglage n'y paraît donc pas (voir
             zmanReminderService). -->
        <p v-if="isNativeApp" class="mt-4 text-sm font-medium text-text-primary">
          {{ t("occasions.reminder") }}
        </p>
        <div v-if="isNativeApp" class="mt-1.5 flex flex-wrap gap-2">
          <button
            v-for="reminder in OCCASION_REMINDERS"
            :key="reminder"
            type="button"
            :class="[
              'rounded-pill px-3 py-1 text-sm font-medium transition-colors',
              draft.reminder === reminder
                ? 'bg-primary text-white'
                : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15',
            ]"
            @click="draft.reminder = reminder as OccasionReminder"
          >
            {{ t(`occasions.reminders.${reminder}`) }}
          </button>
        </div>

        <p class="mt-4 text-sm leading-relaxed text-text-secondary">
          {{ t("occasions.note") }}
          <template v-if="!isNativeApp"> {{ t("occasions.remindersInApp") }}</template>
        </p>

        <div class="flex flex-col gap-3 pt-6">
          <button
            v-if="editing"
            type="button"
            class="btn btn-soft self-start text-primary"
            @click="remove(draft.id!)"
          >
            <AppIcon name="trash" :size="14" />
            {{ t("occasions.remove") }}
          </button>
          <div class="flex justify-end gap-3">
            <button type="button" class="btn btn-soft" @click="view = 'list'">
              {{ t("common.cancel") }}
            </button>
            <button
              type="button"
              class="btn btn-primary disabled:opacity-50"
              :disabled="!canSave"
              @click="save"
            >
              <AppIcon name="check" :size="14" />
              {{ t("common.confirm") }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
