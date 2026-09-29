import { computed, ref } from "vue";
import type { ChiourDoc } from "../models/models";
import {
  adminService,
  type AuteurWithId,
  type ReportWithId,
  type TokenWithId,
} from "../services/adminService";
import type { Announcement } from "../services/announcements";

/**
 * L'état du backoffice en un coup d'œil : ce que le tableau de bord résume
 * et ce que les pastilles du menu comptent (chiourim à relire, signalements
 * ouverts, incident en cours).
 *
 * Chargé par le layout à l'arrivée et à chaque changement de section, et
 * rechargé par une page après une action qui change un compte (publier un
 * chiour, résoudre un signalement). Au plus une lecture toutes les quelques
 * secondes : passer d'une section à l'autre ne relit pas tout.
 */

interface SummaryData {
  chiourim: ChiourDoc[];
  auteurs: AuteurWithId[];
  tokens: TokenWithId[];
  reports: ReportWithId[];
  announcements: Announcement[];
  sessions: { total: number; hidden: number };
}

const data = ref<SummaryData | null>(null);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
let loadedAt = 0;
let inflight: Promise<void> | null = null;

const FRESH_MS = 15_000;

export function refreshAdminSummary(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && data.value && Date.now() - loadedAt < FRESH_MS) return Promise.resolve();
  if (!data.value) status.value = "loading";
  inflight = (async () => {
    try {
      const [chiourim, auteurs, tokens, reports, announcements, sessions] = await Promise.all([
        adminService.listAllChiourim(),
        adminService.listAuteurs(),
        adminService.listAllTokens(),
        adminService.listReports(),
        adminService.listAnnouncements(),
        adminService.countSessions(),
      ]);
      data.value = { chiourim, auteurs, tokens, reports, announcements, sessions };
      loadedAt = Date.now();
      status.value = "ready";
    } catch (error) {
      console.error("Résumé du backoffice indisponible:", error);
      if (!data.value) status.value = "error";
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const byNewest = (a: { createdAt?: Date }, b: { createdAt?: Date }) =>
  (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);

export function useAdminSummary() {
  const chiourim = computed(() => data.value?.chiourim ?? []);
  const drafts = computed(() => chiourim.value.filter((c) => !c.published).sort(byNewest));
  const published = computed(() => chiourim.value.filter((c) => c.published));
  const noAuteur = computed(() => chiourim.value.filter((c) => !c.auteurId));
  const totalViews = computed(() => published.value.reduce((sum, c) => sum + (c.views ?? 0), 0));
  const recent = computed(() => [...published.value].sort(byNewest).slice(0, 5));

  const openReports = computed(() =>
    (data.value?.reports ?? []).filter((r) => r.status === "open"),
  );
  /** Sessions distinctes qui ont au moins un signalement ouvert. */
  const reportedSessions = computed(() => new Set(openReports.value.map((r) => r.sessionId)).size);

  const auteurs = computed(() => data.value?.auteurs ?? []);
  const auteursWithoutLink = computed(() => {
    const linked = new Set(
      (data.value?.tokens ?? []).filter((tok) => tok.active).map((tok) => tok.auteurId),
    );
    return auteurs.value.filter((a) => !linked.has(a.id));
  });

  const announcements = computed(() => data.value?.announcements ?? []);
  const incident = computed(
    () =>
      announcements.value.find((a) => a.kind === "incident" && a.published && !a.resolved) ?? null,
  );
  const announcementDrafts = computed(() => announcements.value.filter((a) => !a.published));
  const latestAnnouncement = computed(() => announcements.value.find((a) => a.published) ?? null);

  const sessions = computed(() => data.value?.sessions ?? { total: 0, hidden: 0 });

  return {
    status,
    chiourim,
    drafts,
    published,
    noAuteur,
    totalViews,
    recent,
    openReports,
    reportedSessions,
    auteurs,
    auteursWithoutLink,
    announcements,
    incident,
    announcementDrafts,
    latestAnnouncement,
    sessions,
    refresh: refreshAdminSummary,
  };
}
