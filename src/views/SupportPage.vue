<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "../components/icons/AppIcon.vue";
import SupportThreadChips from "../components/SupportThreadChips.vue";
import { openFeedback, resumeStashedFeedback, supportVersion } from "../composables/useFeedback";
import { isNativeApp } from "../composables/useNativeApp";
import { listSupportThreads } from "../services/feedbackService";
import { seoService } from "../services/seoService";
import { dateTimeFormat } from "../services/intlCache";
import { lastTeamMessage, threadSubject, type SupportThreadView } from "../services/support";

/**
 * Nous écrire : les messages envoyés à l'équipe, chacun en carte, et de quoi
 * en écrire un nouveau (la fenêtre du formulaire, la même partout). Une carte
 * ouvre la page du fil (/contact/:id), avec la conversation, où il en est et
 * ce qui a été envoyé. Dans l'app, sans compte aussi : l'appareil retrouve
 * ses messages. Sur le site, la page demande un compte (garde de route) : sans
 * lui, rien ne relie un message à la personne.
 *
 * La liste ne marque rien comme lu : la pastille « Nouvelle réponse » reste
 * jusqu'à ce qu'on ouvre le fil.
 */
const { t, locale } = useI18n();
const router = useRouter();

const status = ref<"loading" | "ready" | "error">("loading");
const threads = ref<SupportThreadView[]>([]);

async function load() {
  try {
    threads.value = await listSupportThreads();
    status.value = "ready";
  } catch (error) {
    console.error("Erreur lors du chargement des messages:", error);
    status.value = threads.value.length ? "ready" : "error";
  }
}

onMounted(() => {
  seoService.setMeta({ title: t("support.title"), robots: "noindex, nofollow" });
  void load();
  // De retour de la connexion proposée par le formulaire : il se rouvre sur
  // ce qui était amorcé.
  resumeStashedFeedback();
});

// Un message tout juste envoyé depuis la fenêtre : la liste le montre.
watch(supportVersion, () => void load());

const when = (ms: number) =>
  ms ? dateTimeFormat(locale.value, { dateStyle: "medium" }).format(new Date(ms)) : "";

const hasThreads = computed(() => threads.value.length > 0);

/** L'aperçu d'une carte : la dernière réponse de l'équipe, s'il y en a une. */
function preview(thread: SupportThreadView): string {
  const reply = lastTeamMessage(thread);
  return reply ? reply.text.replace(/\s+/g, " ").trim() : "";
}

/** L'app arrive ici depuis son profil : la page a son retour, comme ses voisines. */
function goBack(): void {
  if (router.options.history.state.back != null) router.back();
  else void router.replace("/profile");
}
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-12" :class="{ '!px-4 !pt-6': isNativeApp }">
    <button v-if="isNativeApp" type="button" class="back-link mb-4" @click="goBack">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("common.profile") }}
    </button>

    <div class="mb-8 text-center animate-[fadeIn_0.5s_ease]">
      <h1 class="font-display text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
        {{ t("support.title") }}
      </h1>
      <p class="mt-4 text-lg text-text-secondary leading-relaxed">
        {{ t("support.subtitle") }}
      </p>
      <button type="button" class="btn btn-primary mt-6" @click="openFeedback()">
        <AppIcon name="plus" :size="15" />
        {{ t("support.newMessage") }}
      </button>
    </div>

    <div v-if="status === 'loading'" class="space-y-4" aria-busy="true">
      <div v-for="n in 2" :key="n" class="card h-24 animate-pulse"></div>
    </div>

    <p v-else-if="status === 'error'" class="card p-8 text-center text-text-secondary">
      <AppIcon name="alert-circle" :size="20" class="mx-auto mb-3" />
      {{ t("support.loadError") }}
    </p>

    <p v-else-if="!hasThreads" class="card p-8 text-center text-text-secondary">
      {{ t("support.empty") }}
    </p>

    <template v-else>
      <h2 class="mb-3 text-lg font-bold text-text-primary">{{ t("support.historyTitle") }}</h2>
      <ul class="space-y-3">
        <li v-for="thread in threads" :key="thread.id">
          <RouterLink
            :to="`/contact/${thread.id}`"
            class="card card-hover flex items-start gap-3 p-4 md:p-5"
          >
            <span class="min-w-0 flex-1">
              <SupportThreadChips :thread="thread" />
              <span class="mt-2 block break-words font-semibold text-text-primary">
                {{ threadSubject(thread) }}
              </span>
              <span
                v-if="preview(thread)"
                class="mt-1.5 line-clamp-2 block break-words text-sm text-text-secondary"
              >
                <span class="font-semibold">{{ t("support.ourReply") }}</span>
                {{ preview(thread) }}
              </span>
              <span class="mt-1.5 block text-xs text-text-secondary">
                {{ t("support.sentOn", { date: when(thread.createdAt) }) }}
                <template v-if="thread.messages.length > 1">
                  ·
                  {{
                    t(
                      "support.messagesCount",
                      { n: thread.messages.length },
                      thread.messages.length,
                    )
                  }}
                </template>
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </main>
</template>
