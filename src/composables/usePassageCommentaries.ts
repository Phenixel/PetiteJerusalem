import { computed, ref, shallowRef, watch, type Ref } from "vue";
import type { TextStudyJsonEntry } from "../models/models";
import {
  loadDafMeforshim,
  loadParashaRashi,
  type DafMeforshim,
  type RashiComment,
  type TextSection,
} from "../services/textService";

/**
 * Les commentaires d'un passage du texte ouvert : Rachi et Tossafot pour une
 * guemara (le Rachbam en Bava Batra, là où il prend la place de Rachi), Rachi
 * pour une paracha. Ils servent au bouton « Commentaires » de la bulle d'un
 * passage et au panneau d'étude (CommentaryPanel.vue), et, bout à bout, à la
 * page du daf (TalmudDafPages.vue).
 *
 * Rien ne se charge à l'ouverture du texte : les fichiers viennent au premier
 * passage touché, ou à l'ouverture de la page du daf (`ensure`). Un chapitre
 * de guemara en demande une ou deux tranches, une paracha son fichier Rachi.
 */

/** Un commentateur et ce qu'il dit du passage. */
export interface CommentaryGroup {
  source: "rashi" | "rashbam" | "tosafot";
  comments: RashiComment[];
}

/** Le corpus dont le texte ouvert a des commentaires, ou null. */
export type CommentaryCorpus = "talmud" | "torah" | null;

export function commentaryCorpusOf(
  type: string | undefined,
  section: TextSection | null,
): CommentaryCorpus {
  if (!section) return null;
  if (type === "Talmud Bavli" && section.dafBlocks?.length) return "talmud";
  // La forme du Sefer Torah et Rachi ont le même domaine : les parachiot.
  if (section.scrollMarks?.length) return "torah";
  return null;
}

/**
 * Une ligne de la section (l'index de `he`) → l'amoud et le passage de
 * Sefaria qui portent ses commentaires.
 */
export function talmudPassageOf(
  section: TextSection,
  line: number,
): { amud: number; passage: number } | null {
  let offset = 0;
  for (const block of section.dafBlocks ?? []) {
    if (line < offset + block.lines.length) {
      if (block.amud === undefined) return null;
      return { amud: block.amud, passage: block.passages?.[line - offset] ?? line - offset };
    }
    offset += block.lines.length;
  }
  return null;
}

/** Les commentaires d'une ligne de guemara, dans l'ordre de la page. */
export function talmudGroups(
  meforshim: Map<number, DafMeforshim>,
  section: TextSection,
  line: number,
): CommentaryGroup[] {
  const place = talmudPassageOf(section, line);
  const amud = place ? meforshim.get(place.amud) : undefined;
  if (!place || !amud) return [];
  return [
    { source: amud.inner, comments: amud.rashi[place.passage] ?? [] },
    { source: "tosafot" as const, comments: amud.tosafot[place.passage] ?? [] },
  ].filter((g) => g.comments.length > 0);
}

export function usePassageCommentaries(
  textEntry: Ref<TextStudyJsonEntry | null>,
  section: Ref<TextSection | null>,
) {
  const corpus = computed<CommentaryCorpus>(() =>
    commentaryCorpusOf(textEntry.value ? String(textEntry.value.type) : undefined, section.value),
  );
  const state = ref<"idle" | "loading" | "ready" | "error">("idle");
  /** Guemara : les commentaires par index d'amoud du traité. */
  const talmud = shallowRef<Map<number, DafMeforshim> | null>(null);
  /** Torah : Rachi verset par verset, aligné sur `he`. */
  const torah = shallowRef<RashiComment[][] | null>(null);

  let request = 0;
  // Un autre texte, un autre chapitre : ce qui était chargé ne vaut plus.
  watch([textEntry, section], () => {
    request++;
    state.value = "idle";
    talmud.value = null;
    torah.value = null;
  });

  /** Charge les commentaires de la section ouverte, une fois. */
  async function ensure(): Promise<void> {
    const entry = textEntry.value;
    const open = section.value;
    if (!entry || !open || !corpus.value) return;
    if (state.value === "loading" || state.value === "ready") return;
    const mine = ++request;
    state.value = "loading";
    try {
      if (corpus.value === "talmud") {
        const amudim = (open.dafBlocks ?? [])
          .map((b) => b.amud)
          .filter((a): a is number => a !== undefined);
        const loaded = await loadDafMeforshim(entry, amudim);
        if (mine !== request) return;
        talmud.value = loaded;
      } else {
        const loaded = await loadParashaRashi(entry);
        if (mine !== request) return;
        torah.value = loaded;
      }
      state.value = "ready";
    } catch {
      if (mine === request) state.value = "error";
    }
  }

  /** Les commentaires d'une ligne de la section, une fois chargés. */
  function groupsAt(line: number): CommentaryGroup[] {
    const open = section.value;
    if (!open || state.value !== "ready") return [];
    if (corpus.value === "talmud" && talmud.value) return talmudGroups(talmud.value, open, line);
    if (corpus.value === "torah" && torah.value) {
      const comments = torah.value[line] ?? [];
      return comments.length ? [{ source: "rashi", comments }] : [];
    }
    return [];
  }

  return { corpus, state, talmud, ensure, groupsAt };
}

/** Le nom de chaque commentateur, en clés écrites en clair (i18nUsage.test.ts). */
export const COMMENTARY_LABELS = {
  rashi: "textReading.commentaries.rashi",
  rashbam: "textReading.commentaries.rashbam",
  tosafot: "textReading.commentaries.tosafot",
} as const;
