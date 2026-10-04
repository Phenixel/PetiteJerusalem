<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PrayerName, PrayerNameGender, PrayerNameKind } from "../models/models";
import AppModal from "./AppModal.vue";
import AppSelect from "./AppSelect.vue";
import AppIcon from "./icons/AppIcon.vue";
import type { IconName } from "./icons/registry";
import { prayerNameService } from "../services/prayerNameService";
import { PrayerNameOfflineError, PrayerNamePendingError } from "../services/appError";
import {
  ANNIVERSARY_WINDOW_DAYS,
  connectorOf,
  daysBeforeExpiry,
  formatPrayerName,
  isDated,
  normalizeNamePart,
  PRAYER_NAME_MAX_LENGTH,
  PRAYER_NAME_TTL_DAYS,
  type PrayerNameInput,
} from "../services/perpetualChain";
import { daysUntilNext, MAX_OCCASION_DAY, OCCASION_MONTHS } from "../services/hebrewOccasions";
import { hebrewMonthName } from "../services/zmanimService";
import { DateService } from "../services/dateService";
import { analyticsService } from "../services/analyticsService";
import { useToast } from "../composables/useToast";
import { useConfirm } from "../composables/useConfirm";

/**
 * Proposer un nom à la chaîne perpétuelle, ou revenir sur le sien : le
 * corriger, le prolonger, le retirer (docs/chaine-perpetuelle.md).
 *
 * Le nom se compose comme on le dit, « David ben Sarah » : le mot du milieu
 * suit le choix homme ou femme, sous les yeux, entre les deux champs, et
 * l'aperçu montre la ligne telle qu'elle paraîtra. Un leilouy nichmat peut
 * porter la date hébraïque du décès : le nom revient alors chaque année, la
 * semaine qui précède l'anniversaire, au lieu d'être lu trente jours.
 *
 * Chargée à la demande (defineAsyncComponent) : le calendrier hébraïque
 * qu'elle emporte ne sert qu'ici.
 */
const props = defineProps<{
  open: boolean;
  sessionId: string;
  ownerId: string;
  /** Le nom à modifier ; null pour en proposer un. */
  name: PrayerName | null;
  /** Noms que le compte tient déjà (la limite par compte). */
  ownedCount: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved", name: PrayerName): void;
  (e: "removed", id: string): void;
}>();

const { t, locale } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const isEdit = computed(() => props.name !== null);

const gender = ref<PrayerNameGender>("male");
const firstName = ref("");
const motherName = ref("");
const kind = ref<PrayerNameKind>("refoua");
/** Jour et mois du décès, en chaînes pour AppSelect ; vides sans date. */
const deathDay = ref("");
const deathMonth = ref("");
const isSaving = ref(false);

watch(
  () => [props.open, props.name] as const,
  ([open, name]) => {
    if (!open) return;
    gender.value = name?.gender ?? "male";
    firstName.value = name?.firstName ?? "";
    motherName.value = name?.motherName ?? "";
    kind.value = name?.kind ?? "refoua";
    deathDay.value = name?.deathDay ? String(name.deathDay) : "";
    deathMonth.value = name?.deathMonth ? String(name.deathMonth) : "";
  },
  { immediate: true },
);

const GENDERS: { gender: PrayerNameGender; labelKey: string }[] = [
  { gender: "male", labelKey: "perpetual.form.male" },
  { gender: "female", labelKey: "perpetual.form.female" },
];
const KINDS: { kind: PrayerNameKind; icon: IconName; labelKey: string }[] = [
  { kind: "refoua", icon: "heart", labelKey: "perpetual.names.refoua" },
  { kind: "leilouy", icon: "candle", labelKey: "perpetual.names.leilouy" },
];

const input = computed<PrayerNameInput>(() => ({
  gender: gender.value,
  firstName: firstName.value,
  motherName: motherName.value,
  kind: kind.value,
  deathDay: deathDay.value ? Number(deathDay.value) : null,
  deathMonth: deathMonth.value ? Number(deathMonth.value) : null,
}));

const isComplete = computed(
  () => normalizeNamePart(firstName.value) !== "" && normalizeNamePart(motherName.value) !== "",
);

const connector = computed(() => connectorOf(gender.value));

const previewName = computed(() =>
  formatPrayerName({
    gender: gender.value,
    firstName: normalizeNamePart(firstName.value) || t("perpetual.form.previewFirstName"),
    motherName: normalizeNamePart(motherName.value) || t("perpetual.form.previewMotherName"),
  }),
);

// --- Date du décès (leilouy nichmat) ---

const dayOptions = Array.from({ length: MAX_OCCASION_DAY }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const monthOptions = computed(() =>
  OCCASION_MONTHS.map((month) => ({
    value: String(month),
    // Le nom d'une année ORDINAIRE : « Adar », et non « Adar I », comme dans
    // les dates du calendrier. C'est la date qu'on pose, pas l'année en cours.
    label: hebrewMonthName(month, 5786, locale.value),
  })),
);

const dated = computed(() => isDated(input.value));

const deathDateLabel = computed(() =>
  dated.value
    ? t("perpetual.form.dayOfMonth", {
        day: input.value.deathDay,
        month: hebrewMonthName(input.value.deathMonth!, 5786, locale.value),
      })
    : "",
);

const clearDate = () => {
  deathDay.value = "";
  deathMonth.value = "";
};

// --- État du nom (modification) ---

const status = computed(() => {
  const name = props.name;
  if (!name) return null;
  if (isDated(name)) {
    const label = t("perpetual.form.dayOfMonth", {
      day: name.deathDay,
      month: hebrewMonthName(name.deathMonth!, 5786, locale.value),
    });
    const inWindow =
      daysUntilNext({ day: name.deathDay!, month: name.deathMonth! }, new Date()) <=
      ANNIVERSARY_WINDOW_DAYS;
    return {
      title: t("perpetual.form.datedOn", { date: label }),
      text: inWindow
        ? t("perpetual.form.datedNow", { date: label })
        : t("perpetual.form.datedLater"),
      renewable: false,
    };
  }
  const days = daysBeforeExpiry(name, new Date());
  const date = name.expiresAt ? DateService.formatDate(name.expiresAt) : "";
  return days > 0
    ? {
        title: t("perpetual.form.expiresOn", { date }),
        text: t("perpetual.form.expiresIn", { n: days }, days),
        renewable: true,
      }
    : {
        title: t("perpetual.form.expired", { date }),
        text: t("perpetual.form.expiredHint"),
        renewable: true,
      };
});

// --- Actions ---

const track = (event: string, extra: Record<string, unknown> = {}) => {
  analyticsService.capture(event, {
    session_id: props.sessionId,
    kind: kind.value,
    ...extra,
  });
};

/** L'ajout resté en route qu'on attend déjà : un second essai ne le compte pas deux fois. */
let awaitedLanding: Promise<PrayerName> | null = null;

/**
 * Les ajouts déjà annoncés. Un ajout resté en route aboutit par deux chemins
 * quand on le réessaie avant son arrivée : l'attente posée au premier essai
 * et le second essai lui-même. Il ne s'annonce qu'une fois.
 */
const announcedAdds = new Set<string>();

/** Le nom enregistré : le suivi, le mot à l'écran, la liste. */
function announce(saved: PrayerName, action: "added" | "updated"): void {
  if (action === "added") {
    if (announcedAdds.has(saved.id)) return;
    announcedAdds.add(saved.id);
  }
  track("prayer_name_saved", { action, has_death_date: isDated(saved) });
  toast.success(
    action === "updated"
      ? t("perpetual.form.saved")
      : t("perpetual.form.added", { name: formatPrayerName(saved) }),
  );
  emit("saved", saved);
}

const isConnectionError = (err: unknown) =>
  err instanceof PrayerNameOfflineError || err instanceof PrayerNamePendingError;

async function save(): Promise<void> {
  if (!isComplete.value || isSaving.value) return;
  isSaving.value = true;
  try {
    const saved = props.name
      ? await prayerNameService.update(props.sessionId, props.name, input.value)
      : await prayerNameService.add(props.sessionId, props.ownerId, input.value, props.ownedCount);
    announce(saved, props.name ? "updated" : "added");
    emit("close");
  } catch (err) {
    // Le serveur se tait, mais l'ajout est en route : quand il arrive, le
    // nom rejoint la liste, comme un ajout ordinaire. Sans cela, la liste
    // l'ignorerait, et un second essai l'écrirait deux fois.
    if (err instanceof PrayerNamePendingError && err.landing && err.landing !== awaitedLanding) {
      awaitedLanding = err.landing;
      // La fenêtre ne se ferme à l'arrivée que si elle montre encore cette
      // saisie : rouverte entre-temps sur un autre nom, elle reste ouverte.
      const attempted = JSON.stringify(input.value);
      err.landing.then(
        (landed) => {
          announce(landed, "added");
          if (props.open && !props.name && JSON.stringify(input.value) === attempted) {
            emit("close");
          }
        },
        (late) => console.error("Erreur lors de l'enregistrement du nom:", late),
      );
    }
    // Hors ligne, ou le serveur muet : c'est attendu, cela se dit, sans se
    // journaliser comme une erreur.
    if (!isConnectionError(err)) console.error("Erreur lors de l'enregistrement du nom:", err);
    toast.errorFromException(err, t("perpetual.form.saveError"));
  } finally {
    isSaving.value = false;
  }
}

async function renew(): Promise<void> {
  const name = props.name;
  if (!name || isSaving.value) return;
  isSaving.value = true;
  try {
    const renewed = await prayerNameService.renew(props.sessionId, name);
    track("prayer_name_saved", { action: "renewed", has_death_date: false });
    toast.success(t("perpetual.form.renewed", { days: PRAYER_NAME_TTL_DAYS }));
    emit("saved", renewed);
  } catch (err) {
    if (!isConnectionError(err)) console.error("Erreur lors de la prolongation du nom:", err);
    toast.errorFromException(err, t("perpetual.form.saveError"));
  } finally {
    isSaving.value = false;
  }
}

async function remove(): Promise<void> {
  const name = props.name;
  if (!name || isSaving.value) return;
  // Ce qui part sans retour pose la question, avec le nom (docs/design.md).
  const accepted = await confirm({
    title: t("perpetual.form.removeConfirm", { name: formatPrayerName(name) }),
    message: t("perpetual.form.removeMessage"),
    confirmLabel: t("perpetual.form.remove"),
    danger: true,
  });
  if (!accepted) return;
  isSaving.value = true;
  try {
    await prayerNameService.remove(props.sessionId, name.id);
    track("prayer_name_removed", { kind: name.kind });
    toast.success(t("perpetual.form.removed"));
    emit("removed", name.id);
    emit("close");
  } catch (err) {
    if (!isConnectionError(err)) console.error("Erreur lors du retrait du nom:", err);
    toast.errorFromException(err, t("perpetual.form.removeError"));
  } finally {
    isSaving.value = false;
  }
}

const segmentClass = (active: boolean) =>
  active ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary";
</script>

<template>
  <AppModal
    :open="open"
    labelledby="prayer-name-title"
    panel-class="modal-panel flex flex-col gap-5 animate-[scaleIn_0.3s_ease]"
    @close="emit('close')"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 id="prayer-name-title" class="text-lg font-bold text-text-primary">
        {{ isEdit ? t("perpetual.form.editTitle") : t("perpetual.form.addTitle") }}
      </h3>
      <button
        type="button"
        class="icon-btn -me-1.5"
        :aria-label="t('perpetual.form.close')"
        @click="emit('close')"
      >
        <AppIcon name="x" :size="18" />
      </button>
    </div>

    <p v-if="!isEdit" class="-mt-3 text-sm leading-relaxed text-text-secondary">
      {{ t("perpetual.form.intro") }}
    </p>

    <!-- Où en est le nom : jusqu'à quand il est lu, et le geste qui le prolonge. -->
    <div v-if="status" class="rounded-card bg-surface-soft px-4 py-3.5 flex items-center gap-3">
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-sm font-semibold text-text-primary">{{ status.title }}</span>
        <span class="text-xs text-text-secondary">{{ status.text }}</span>
      </div>
      <button
        v-if="status.renewable"
        type="button"
        class="btn btn-soft btn-sm shrink-0"
        :disabled="isSaving"
        @click="renew"
      >
        <AppIcon name="rotate" :size="14" />
        {{ t("perpetual.form.renew") }}
      </button>
    </div>

    <form class="flex flex-col gap-5" @submit.prevent="save">
      <div class="flex flex-col gap-2">
        <span id="prayer-name-for" class="text-sm font-semibold text-text-secondary">
          {{ t("perpetual.form.for") }}
        </span>
        <div
          class="grid grid-cols-2 p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
          role="group"
          aria-labelledby="prayer-name-for"
        >
          <button
            v-for="option in GENDERS"
            :key="option.gender"
            type="button"
            class="rounded-control px-2 py-2.5 text-sm font-semibold transition-colors"
            :class="segmentClass(gender === option.gender)"
            :aria-pressed="gender === option.gender"
            @click="gender = option.gender"
          >
            {{ t(option.labelKey) }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <!-- « Prénom ben Prénom de la mère », comme on le dit : le mot du milieu
             suit le choix du dessus. -->
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          <div class="flex flex-col gap-2">
            <label for="prayer-first-name" class="text-sm font-semibold text-text-secondary">
              {{ t("perpetual.form.firstName") }}
            </label>
            <input
              id="prayer-first-name"
              v-model="firstName"
              type="text"
              class="field"
              autocomplete="off"
              :maxlength="PRAYER_NAME_MAX_LENGTH"
              :placeholder="t('perpetual.form.firstNamePlaceholder')"
              data-autofocus
            />
          </div>
          <span
            class="h-[2.875rem] inline-flex items-center px-0.5 font-bold text-primary"
            aria-hidden="true"
          >
            {{ connector }}
          </span>
          <div class="flex flex-col gap-2">
            <label for="prayer-mother-name" class="text-sm font-semibold text-text-secondary">
              {{ t("perpetual.form.motherName") }}
            </label>
            <input
              id="prayer-mother-name"
              v-model="motherName"
              :aria-label="t('perpetual.form.motherNameLabel')"
              type="text"
              class="field"
              autocomplete="off"
              :maxlength="PRAYER_NAME_MAX_LENGTH"
              :placeholder="t('perpetual.form.motherNamePlaceholder')"
            />
          </div>
        </div>
        <span class="text-xs text-text-secondary">{{ t("perpetual.form.hebrewHint") }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <span id="prayer-name-kind" class="text-sm font-semibold text-text-secondary">
          {{ t("perpetual.form.prayer") }}
        </span>
        <div
          class="grid grid-cols-2 p-0.5 rounded-btn bg-black/5 dark:bg-white/10"
          role="group"
          aria-labelledby="prayer-name-kind"
        >
          <button
            v-for="option in KINDS"
            :key="option.kind"
            type="button"
            class="rounded-control px-1.5 py-2.5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors"
            :class="segmentClass(kind === option.kind)"
            :aria-pressed="kind === option.kind"
            @click="kind = option.kind"
          >
            <AppIcon :name="option.icon" :size="15" />
            {{ t(option.labelKey) }}
          </button>
        </div>
      </div>

      <!-- Leilouy nichmat : la date du décès, si on la connaît, fait revenir le
           nom chaque année, la semaine qui précède l'anniversaire. -->
      <div v-if="kind === 'leilouy'" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-text-secondary">
          {{ t("perpetual.form.deathDate") }}
        </span>
        <div class="flex gap-3">
          <div class="w-24 shrink-0">
            <AppSelect
              v-model="deathDay"
              :options="dayOptions"
              :placeholder="t('perpetual.form.day')"
            />
          </div>
          <div class="min-w-0 flex-1">
            <AppSelect
              v-model="deathMonth"
              :options="monthOptions"
              :placeholder="t('perpetual.form.month')"
            />
          </div>
        </div>
        <div class="flex items-start justify-between gap-3">
          <span class="text-xs leading-relaxed text-text-secondary">
            {{
              dated
                ? t("perpetual.form.datedHint", { date: deathDateLabel })
                : t("perpetual.form.undatedHint", { days: PRAYER_NAME_TTL_DAYS })
            }}
          </span>
          <button
            v-if="deathDay || deathMonth"
            type="button"
            class="shrink-0 text-xs font-semibold text-primary"
            @click="clearDate"
          >
            {{ t("perpetual.form.clearDate") }}
          </button>
        </div>
      </div>

      <div class="rounded-card bg-surface-soft px-4 py-3 flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-text-secondary">
          {{ t("perpetual.form.preview") }}
        </span>
        <span
          class="flex items-center gap-2 font-semibold"
          :class="isComplete ? 'text-text-primary' : 'text-text-secondary/70'"
        >
          <AppIcon
            :name="kind === 'leilouy' ? 'candle' : 'heart'"
            :size="16"
            class="text-primary"
          />
          {{ previewName }}
        </span>
      </div>

      <p v-if="!isEdit" class="text-xs leading-relaxed text-text-secondary">
        {{
          dated
            ? t("perpetual.form.datedNote")
            : t("perpetual.form.ttlNote", { days: PRAYER_NAME_TTL_DAYS })
        }}
      </p>

      <div class="flex items-center gap-2" :class="isEdit ? 'justify-between' : 'justify-end'">
        <button
          v-if="isEdit"
          type="button"
          class="btn btn-danger"
          :disabled="isSaving"
          @click="remove"
        >
          <AppIcon name="trash" :size="15" />
          {{ t("perpetual.form.remove") }}
        </button>
        <button v-else type="button" class="btn btn-soft" @click="emit('close')">
          {{ t("perpetual.form.cancel") }}
        </button>
        <button type="submit" class="btn btn-primary" :disabled="!isComplete || isSaving">
          <AppIcon v-if="!isEdit" name="plus" :size="16" />
          {{ isEdit ? t("perpetual.form.save") : t("perpetual.form.add") }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
