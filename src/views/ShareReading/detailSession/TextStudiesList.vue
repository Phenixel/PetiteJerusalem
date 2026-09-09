<script setup lang="ts">
import { sessionService } from "../../../services/sessionService";
import { reservationService } from "../../../services/reservationService";
import { appendHebrewNumeral, formatNumberWithHebrew } from "../../../services/hebrewNumerals";
import { computed, ref, toRef } from "vue";
import { useI18n } from "vue-i18n";
import type { Session, TextStudy, TextStudyReservation } from "../../../models/models";
import type { User } from "../../../services/authService";
import {
  chaptersOf,
  slotKey,
  useReservationIndex,
  type TextDisplayStatus,
} from "../../../composables/useReservationIndex";
import AppIcon from "../../../components/icons/AppIcon.vue";

const props = defineProps<{
  groupedTextStudies: Record<string, TextStudy[]>;
  session: Session;
  currentUser: User | null;
  guestEmail: string;
  selectedItems: Set<string>;
}>();

const emit = defineEmits<{
  // Toujours une section : les textes à un seul chapitre passent 1, jamais
  // « le texte entier ».
  (e: "item-click", textId: string, section: number): void;
  (e: "toggle-completion", textId: string, section: number): void;
  (e: "toggle-select-all", textId: string): void;
  // Dépliage d'un texte pour voir ses chapitres : passage obligé avant de
  // cocher une section. La page parente en fait une étape de funnel.
  (e: "text-expanded", textId: string): void;
  // Départ vers le lecteur depuis la chaîne (bouton « Lire » d'un texte, icône
  // de lecture d'un chapitre). La page parente en fait une étape de funnel :
  // le lecteur porte sa propre barre de réservation, une partie des
  // réservations part donc d'ici et pas de la case à cocher.
  (e: "read-clicked", textId: string, section?: number): void;
}>();

const expandedTexts = ref<Set<string>>(new Set());

const toggleTextExpansion = (textId: string) => {
  if (expandedTexts.value.has(textId)) {
    expandedTexts.value.delete(textId);
  } else {
    expandedTexts.value.add(textId);
    emit("text-expanded", textId);
  }
};

const { t } = useI18n();

const formatBookName = (bookName: string) => {
  // Le groupe « Mes réservations » est une clé virtuelle injectée par la page
  // parente, pas un nom de livre : ne pas le passer au formateur.
  if (bookName === t("detailSession.myReservations")) return bookName;
  return sessionService.formatBookName(bookName);
};

// Nom affiché sur les badges « Réservé par / Lu par ».
const reservedByName = (name: string | null | undefined) =>
  name || t("detailSession.textList.someone");

/*
 * Tout ce que le gabarit affiche est préparé ici, une fois par changement de
 * réservations, de sélection ou de dépliage : une ligne par chapitre, avec sa
 * réservation, son état coché et ce qu'on a le droit d'en faire. Avant, le
 * gabarit appelait six à quinze fonctions par ligne (« est-ce réservé ? »,
 * « par qui ? », « puis-je annuler ? »), réévaluées à chaque rendu pour
 * chaque carte et chaque section.
 */
const texts = computed(() => Object.values(props.groupedTextStudies).flat());
const { activeReservations, reservationAt, statusOf, availableSections } = useReservationIndex(
  toRef(props, "session"),
  texts,
);

// Réservations annulables par le visiteur courant. Évalué une fois par
// changement de réservations ou d'identité : la version précédente relisait
// le localStorage (identité invitée) à chaque appel.
const cancellableIds = computed(() => {
  const ids = new Set<string>();
  for (const reservation of activeReservations.value) {
    if (
      reservationService.canUserDeleteReservation(reservation, props.currentUser, props.guestEmail)
    ) {
      ids.add(reservation.id);
    }
  }
  return ids;
});

// Textes dont toutes les sections sont réservées ET lues : « Lu par » plutôt
// que « Réservé par ».
const fullyReadTexts = computed(() => {
  const readByText = new Map<string, { sections: Set<number>; allRead: boolean }>();
  for (const r of activeReservations.value) {
    if (r.section === undefined) continue;
    const entry = readByText.get(r.textStudyId) ?? { sections: new Set(), allRead: true };
    entry.sections.add(r.section);
    if (!r.isCompleted) entry.allRead = false;
    readByText.set(r.textStudyId, entry);
  }
  const ids = new Set<string>();
  for (const text of texts.value) {
    const entry = readByText.get(text.id);
    if (entry && entry.allRead && entry.sections.size >= text.totalSections) ids.add(text.id);
  }
  return ids;
});

interface ChapterRow {
  chapter: number;
  reservation: TextStudyReservation | undefined;
  reserved: boolean;
  reservedBy: string | null;
  completed: boolean;
  selected: boolean;
  /** Réservé par quelqu'un d'autre : la ligne ne réagit plus. */
  locked: boolean;
  canCancel: boolean;
}

interface TextCard {
  text: TextStudy;
  status: TextDisplayStatus;
  fullyRead: boolean;
  expanded: boolean;
  /** La ligne unique des textes à un seul chapitre. */
  single: ChapterRow | null;
  availableCount: number;
  allAvailableSelected: boolean;
  hasSelection: boolean;
  /** Les lignes de chapitres, seulement quand la carte est dépliée. */
  rows: ChapterRow[];
}

const rowOf = (text: TextStudy, chapter: number): ChapterRow => {
  const reservation = reservationAt(text.id, chapter);
  const reserved = reservation !== undefined;
  const canCancel = reserved && cancellableIds.value.has(reservation.id);
  return {
    chapter,
    reservation,
    reserved,
    reservedBy: reservation?.chosenByName || null,
    completed: reservation?.isCompleted === true,
    selected: props.selectedItems.has(slotKey(text.id, chapter)),
    locked: reserved && !canCancel,
    canCancel,
  };
};

const cardOf = (text: TextStudy): TextCard => {
  const expanded = text.totalSections > 1 && expandedTexts.value.has(text.id);
  const available = availableSections(text);
  const availableKeys = available.map((section) => slotKey(text.id, section));
  const rows = expanded
    ? chaptersOf(text.totalSections).map((chapter) => rowOf(text, chapter))
    : [];
  return {
    text,
    status: statusOf(text),
    fullyRead: fullyReadTexts.value.has(text.id),
    expanded,
    single: text.totalSections === 1 ? rowOf(text, 1) : null,
    availableCount: available.length,
    allAvailableSelected:
      availableKeys.length > 0 && availableKeys.every((key) => props.selectedItems.has(key)),
    // Anneau de surbrillance de la carte : au moins une section cochée.
    hasSelection: chaptersOf(text.totalSections).some((chapter) =>
      props.selectedItems.has(slotKey(text.id, chapter)),
    ),
    rows,
  };
};

const groupedCards = computed(() => {
  const groups: Record<string, TextCard[]> = {};
  for (const [bookName, bookTexts] of Object.entries(props.groupedTextStudies)) {
    groups[bookName] = bookTexts.map(cardOf);
  }
  return groups;
});

const handleCardClick = (card: TextCard) => {
  if (card.single) {
    // Texte à un seul chapitre : la carte bascule la réservation.
    if (!card.single.locked) emit("item-click", card.text.id, 1);
  } else if (!card.expanded) {
    toggleTextExpansion(card.text.id);
  }
};
</script>

<template>
  <div class="space-y-12">
    <div
      v-for="(cards, bookName) in groupedCards"
      :key="bookName"
      class="animate-[fadeIn_0.5s_ease]"
    >
      <h3 class="text-2xl font-bold text-text-primary mb-6">
        {{ formatBookName(String(bookName)) }}
      </h3>

      <!-- items-start : une carte dépliée s'allonge seule, sans étirer ses
           voisines repliées à la même hauteur. -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        <div
          v-for="card in cards"
          :key="card.text.id"
          class="card flex flex-col"
          :class="{ 'ring-2 ring-primary/50': card.hasSelection }"
        >
          <!-- En-tête du texte -->
          <div
            class="p-5 rounded-t-2xl transition-colors"
            :class="{
              'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/5':
                (!card.single && !card.expanded) || (card.single && !card.single.locked),
              'cursor-not-allowed opacity-60': card.single?.locked,
            }"
            @click="handleCardClick(card)"
          >
            <div class="flex justify-between items-start gap-3">
              <div class="flex-1 min-w-0">
                <h4
                  class="font-bold text-lg text-text-primary leading-tight truncate mb-1"
                  :title="appendHebrewNumeral(card.text.name)"
                >
                  {{ appendHebrewNumeral(card.text.name) }}
                </h4>
                <!-- Case à cocher directe pour les textes à un seul chapitre -->
                <label
                  v-if="card.single"
                  class="inline-flex items-center gap-2 cursor-pointer mt-1"
                  @click.stop
                  :class="{ 'opacity-60 cursor-not-allowed': card.single.locked }"
                >
                  <input
                    type="checkbox"
                    class="w-5 h-5 rounded accent-primary cursor-pointer"
                    :checked="card.single.reserved || card.single.selected"
                    @change="emit('item-click', card.text.id, 1)"
                    :disabled="card.single.locked"
                  />
                  <span class="text-sm font-medium text-text-secondary">
                    {{
                      card.single.selected
                        ? t("detailSession.textList.selected")
                        : t("detailSession.textList.reserve")
                    }}
                  </span>
                </label>
              </div>

              <div class="flex items-center gap-2 self-start">
                <router-link
                  :to="{
                    name: 'text-reading',
                    params: { textId: card.text.id },
                    query: { session: session.slug || session.id },
                  }"
                  class="btn btn-soft !px-3.5 !py-2 text-sm hover:!text-primary"
                  :title="t('detailSession.textList.readThisText')"
                  @click.stop="emit('read-clicked', card.text.id)"
                >
                  <AppIcon name="book-open" :size="15" />
                  {{ t("detailSession.textList.read") }}
                </router-link>
                <button
                  v-if="!card.single"
                  @click.stop="toggleTextExpansion(card.text.id)"
                  class="icon-btn"
                  :class="{ 'bg-black/5 text-text-primary dark:bg-white/10': card.expanded }"
                >
                  <AppIcon :name="card.expanded ? 'chevron-up' : 'chevron-down'" :size="15" />
                </button>
              </div>
            </div>
          </div>

          <!-- Statut global du texte -->
          <div class="px-5 pb-4">
            <!-- Texte à un seul chapitre réservé : réservé ou lu, par qui -->
            <div
              v-if="card.single?.reserved"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <span
                class="chip"
                :class="
                  card.single.completed
                    ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                "
              >
                <AppIcon :name="card.single.completed ? 'circle-check' : 'user-clock'" :size="12" />
                {{
                  card.single.completed
                    ? t("detailSession.textList.readBy", {
                        name: reservedByName(card.single.reservedBy),
                      })
                    : t("detailSession.textList.reservedBy", {
                        name: reservedByName(card.single.reservedBy),
                      })
                }}
              </span>

              <!-- Switch pour marquer comme lu (seulement si c'est notre réservation) -->
              <div v-if="card.single.canCancel" class="flex items-center gap-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    :aria-label="t('detailSession.textList.completed')"
                    :checked="card.single.completed"
                    @change="emit('toggle-completion', card.text.id, 1)"
                  />
                  <span
                    class="block w-9 h-5 bg-black/15 rounded-full peer peer-checked:bg-green-500 transition-colors dark:bg-white/20 dark:peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
                  ></span>
                  <span
                    class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"
                  ></span>
                </label>
                <span class="text-xs font-medium text-text-secondary">{{
                  t("detailSession.textList.completed")
                }}</span>
              </div>
            </div>
            <!-- Pour les textes à plusieurs chapitres -->
            <div v-else-if="!card.single">
              <span
                v-if="card.status.status === 'fully_reserved'"
                class="chip"
                :class="
                  card.fullyRead
                    ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                    : 'bg-red-600/10 text-red-700 dark:text-red-300'
                "
              >
                <AppIcon v-if="card.fullyRead" name="circle-check" :size="12" />
                {{
                  card.fullyRead
                    ? t("detailSession.textList.readBy", {
                        name: reservedByName(card.status.reservedBy),
                      })
                    : t("detailSession.textList.reservedBy", {
                        name: reservedByName(card.status.reservedBy),
                      })
                }}
              </span>
              <span
                v-else-if="card.status.status === 'partially_reserved'"
                class="chip bg-amber-500/10 text-amber-700 dark:text-amber-200"
              >
                {{ t("detailSession.textList.partiallyReserved") }}
              </span>
              <!-- « Disponible » reste sans couleur : le vert dit « lu » partout
                   ailleurs (interrupteur, bouton du lecteur), et deux sens pour
                   une même teinte rendaient la liste illisible. Rien = libre,
                   une couleur = quelqu'un s'en occupe. Même puce qu'au niveau
                   chapitre, plus bas. -->
              <span v-else class="chip bg-black/5 text-text-secondary dark:bg-white/10">
                {{ t("detailSession.textList.available") }}
              </span>
            </div>
            <span v-else class="chip bg-black/5 text-text-secondary dark:bg-white/10">
              {{ t("detailSession.textList.available") }}
            </span>
          </div>

          <!-- Sections du texte (dépliables), seulement si plus d'un chapitre -->
          <div v-if="card.expanded" class="animate-[fadeIn_0.3s_ease]">
            <div class="px-5 pb-1 flex items-center justify-between gap-3">
              <h5 class="text-xs font-semibold text-text-secondary">
                {{
                  t("detailSession.textList.availableSections", { count: card.text.totalSections })
                }}
              </h5>
              <button
                v-if="card.availableCount > 1"
                @click.stop="emit('toggle-select-all', card.text.id)"
                class="text-xs font-semibold text-primary hover:underline"
              >
                {{
                  card.allAvailableSelected
                    ? t("detailSession.textList.deselectAll")
                    : t("detailSession.textList.selectAll")
                }}
              </button>
            </div>

            <!-- Pas de hauteur maximale : un scroll par carte, à l'intérieur du
                 scroll de la page, faisait perdre les chapitres du bas. -->
            <div class="p-2">
              <div
                v-for="row in card.rows"
                :key="row.chapter"
                class="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors cursor-pointer select-none"
                :class="{
                  'bg-green-600/5 hover:bg-green-600/10 dark:bg-green-500/10 dark:hover:bg-green-500/15':
                    row.completed,
                  'bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/5 dark:hover:bg-amber-500/10':
                    row.reserved && !row.completed,
                  'hover:bg-black/[0.03] dark:hover:bg-white/5': !row.reserved,
                  'opacity-60 cursor-not-allowed': row.locked,
                }"
                @click="!row.locked && emit('item-click', card.text.id, row.chapter)"
              >
                <!-- Checkbox + Chapitre -->
                <div class="flex items-center gap-3 flex-shrink-0">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded accent-primary pointer-events-none"
                    :checked="row.reserved || row.selected"
                    :disabled="row.locked"
                  />
                  <span class="font-medium text-sm text-text-primary"
                    >{{ t("common.chapter") }} {{ formatNumberWithHebrew(row.chapter) }}</span
                  >
                </div>

                <!-- Statut à droite -->
                <div class="flex items-center gap-3">
                  <!-- Si réservé -->
                  <template v-if="row.reserved">
                    <!-- Switch « Lu », seulement pour nos réservations -->
                    <label
                      v-if="row.canCancel"
                      class="flex items-center gap-2 cursor-pointer group"
                      @click.stop
                    >
                      <span
                        class="text-xs text-text-secondary group-hover:text-text-primary transition-colors"
                        >{{ t("detailSession.textList.readToggle") }}</span
                      >
                      <div class="relative">
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          :aria-label="t('detailSession.textList.readToggle')"
                          :checked="row.completed"
                          @change="emit('toggle-completion', card.text.id, row.chapter)"
                        />
                        <div
                          class="w-8 h-4.5 bg-black/15 rounded-full peer peer-checked:bg-green-500 transition-colors dark:bg-white/20 dark:peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
                        ></div>
                        <div
                          class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5"
                        ></div>
                      </div>
                    </label>

                    <!-- Badge de statut compact -->
                    <span
                      class="chip"
                      :class="
                        row.completed
                          ? 'bg-green-600/10 text-green-700 dark:text-green-300'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                      "
                    >
                      <AppIcon :name="row.completed ? 'check' : 'user'" :size="11" />
                      {{ row.reservedBy || t("detailSession.textList.reserved") }}
                    </span>
                  </template>

                  <!-- Si sélectionné (en attente de confirmation) -->
                  <span v-else-if="row.selected" class="chip bg-primary/10 text-primary">
                    <AppIcon name="plus" :size="11" />
                    {{ t("detailSession.textList.selected") }}
                  </span>

                  <!-- Si disponible -->
                  <span v-else class="chip bg-black/5 text-text-secondary dark:bg-white/10">
                    {{ t("detailSession.textList.available") }}
                  </span>

                  <!-- Lien lecture interne -->
                  <router-link
                    :to="{
                      name: 'text-reading-section',
                      params: { textId: card.text.id, section: row.chapter },
                      query: { session: session.slug || session.id },
                    }"
                    class="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary hover:text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                    :title="t('detailSession.textList.readThisChapter')"
                    @click.stop="emit('read-clicked', card.text.id, row.chapter)"
                  >
                    <AppIcon name="book-reader" :size="16" />
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
