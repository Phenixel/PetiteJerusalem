<script setup lang="ts">
import { onMounted } from "vue";
import { useAnnouncements } from "../../composables/useAnnouncements";
import { analyticsService } from "../../services/analyticsService";
import type { HomeHighlight } from "../../services/announcements";
import AnnouncementHomeCard from "./AnnouncementHomeCard.vue";

/**
 * Les informations de l'équipe, sur l'accueil, quand il y a quelque chose à
 * dire (voir homeHighlights) : une annonce pas encore lue en aperçu, titre et
 * début du texte ; lue, une ligne pendant une semaine ; un incident en cours
 * tant qu'il n'est pas réglé. Le reste du temps, rien : la liste complète
 * reste à un lien, en bas de l'accueil.
 */
const { highlights, load } = useAnnouncements();

onMounted(() => void load());

function opened(h: HomeHighlight): void {
  analyticsService.capture("announcement_opened", {
    id: h.announcement.id,
    source: "home",
    mode: h.mode,
  });
}
</script>

<template>
  <AnnouncementHomeCard
    v-for="h in highlights"
    :key="h.announcement.id"
    :announcement="h.announcement"
    :mode="h.mode"
    :unread-count="h.unreadCount"
    @open="opened(h)"
  />
</template>
