<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "../../components/icons/AppIcon.vue";
import GuestForm from "../../components/GuestForm.vue";

/**
 * L'encadré d'une lecture partagée : la session, pour qui la section est
 * réservée, et les gestes qui vont avec (réserver, marquer comme lu,
 * annuler). Purement présentationnel : l'état et les actions restent à la
 * page de lecture, qui l'affiche deux fois, en tête et au bas du texte,
 * pour qu'on marque sa lecture là où on la finit.
 */

const { t } = useI18n();

defineProps<{
  sessionSlug: string;
  sessionName: string;
  /** La réservation courante est celle du lecteur. */
  isMine: boolean;
  isCompleted: boolean;
  /** Section réservée par quelqu'un d'autre. */
  isReserved: boolean;
  reservedBy?: string | null;
  isReserving: boolean;
  /** Lecteur sans compte : le formulaire invité accompagne la réservation. */
  isGuest: boolean;
  guestIntroText: string;
  guestEmailRequired: boolean;
  reservationForm: { name: string; email: string };
  /** Distingue les `id` des champs quand l'encadré apparaît deux fois. */
  guestFormIdPrefix?: string;
}>();

defineEmits<{
  (e: "update:reservationForm", value: { name: string; email: string }): void;
  (e: "toggleRead"): void;
  (e: "cancel"): void;
  (e: "reserve"): void;
  (e: "guestFirstInput", field: "name" | "email"): void;
}>();
</script>

<template>
  <div class="p-4 card">
    <!-- Current session -->
    <router-link
      :to="`/share-reading/session/${sessionSlug}`"
      class="flex items-center gap-2 mb-3 text-sm font-semibold text-text-primary hover:text-primary transition-colors"
    >
      <AppIcon name="users" :size="16" class="text-primary flex-shrink-0" />
      <span class="truncate">{{ sessionName }}</span>
    </router-link>

    <!-- Reserved by me -->
    <div v-if="isMine" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <span
        class="chip !text-sm w-fit"
        :class="
          isCompleted
            ? 'bg-green-600/10 text-green-700 dark:text-green-300'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
        "
      >
        <AppIcon :name="isCompleted ? 'circle-check' : 'user-clock'" :size="14" />
        {{ isCompleted ? t("textReading.readByYou") : t("textReading.reservedByYou") }}
      </span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          @click="$emit('toggleRead')"
          :disabled="isReserving"
          class="btn !px-3 !py-1.5 text-sm"
          :class="
            isCompleted
              ? 'btn-soft'
              : 'bg-green-600/10 text-green-700 hover:bg-green-600/20 dark:text-green-300'
          "
        >
          <AppIcon name="check" :size="13" />
          {{ isCompleted ? t("textReading.unmarkRead") : t("textReading.markRead") }}
        </button>
        <button
          @click="$emit('cancel')"
          :disabled="isReserving"
          class="icon-btn hover:!text-red-600 disabled:opacity-50"
          :title="t('textReading.cancel')"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </div>

    <!-- Reserved by someone else -->
    <div v-else-if="isReserved" class="flex items-center gap-2">
      <span
        class="chip !text-sm w-fit"
        :class="
          isCompleted
            ? 'bg-green-600/10 text-green-700 dark:text-green-300'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
        "
      >
        <AppIcon :name="isCompleted ? 'circle-check' : 'user'" :size="14" />
        {{
          isCompleted
            ? t("textReading.readBy", { name: reservedBy || t("textReading.someone") })
            : t("textReading.reservedBy", { name: reservedBy || t("textReading.someone") })
        }}
      </span>
    </div>

    <!-- Available -->
    <div v-else>
      <div v-if="isGuest" class="mb-4">
        <p class="text-sm text-text-secondary mb-3">
          {{ guestIntroText }}
        </p>
        <GuestForm
          :reservation-form="reservationForm"
          :email-required="guestEmailRequired"
          :id-prefix="guestFormIdPrefix"
          @update:reservation-form="$emit('update:reservationForm', $event)"
          @first-input="$emit('guestFirstInput', $event)"
        />
      </div>
      <button @click="$emit('reserve')" :disabled="isReserving" class="btn btn-primary text-sm">
        <AppIcon name="bookmark" :size="13" />
        {{ t("textReading.reserve") }}
      </button>
    </div>
  </div>
</template>
