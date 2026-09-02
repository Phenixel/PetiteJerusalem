<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { closeTefilinMirror, tefilinMirrorOpen } from "../composables/useTefilinMirror";

/**
 * Le miroir des téfilines : la caméra frontale, en plein écran, avec deux
 * repères pour poser le bayit de la tête droit et centré.
 *
 * Ce que les repères disent, et ce qu'ils ne disent pas. La ligne horizontale
 * se pose sur la naissance des cheveux : le bayit va au-dessus d'elle, jamais
 * en dessous. La verticale donne le milieu du visage, entre les yeux, et sert
 * aussi à voir d'un coup d'œil si le bayit penche. Le carré n'est qu'une
 * indication : à quelle distance on tient le téléphone, l'application n'en
 * sait rien, et elle ne mesure rien. Elle tend un miroir, la pose reste au
 * lecteur.
 *
 * Rien n'est enregistré ni envoyé nulle part : l'image reste dans la page, et
 * la caméra s'éteint dès la fenêtre fermée (voir `stop`, appelé aussi au
 * démontage : quitter la page ne doit pas laisser la caméra allumée).
 */
const { t } = useI18n();

type MirrorStatus = "idle" | "starting" | "live" | "denied" | "unavailable";

const status = ref<MirrorStatus>("idle");
const video = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;

function stop(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video.value) video.value.srcObject = null;
  status.value = "idle";
}

async function start(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    status.value = "unavailable";
    return;
  }
  status.value = "starting";
  try {
    // `facingMode: user` et non `exact` : un appareil sans caméra frontale
    // (un ordinateur avec une webcam externe) donne alors celle qu'il a,
    // plutôt qu'une erreur.
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
  } catch (error) {
    const nom = error instanceof Error ? error.name : "";
    status.value = nom === "NotAllowedError" || nom === "SecurityError" ? "denied" : "unavailable";
    return;
  }
  // Fermée pendant que la caméra s'allumait : on n'affiche rien et on rend
  // l'appareil.
  if (!tefilinMirrorOpen.value) {
    stop();
    return;
  }
  status.value = "live";
  // Le <video> n'existe qu'une fois le statut passé à « live ».
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!video.value || !stream) return;
  video.value.srcObject = stream;
  // Sur iOS la lecture ne part pas toujours seule, même en muted/playsinline.
  await video.value.play().catch(() => {
    // Lecture refusée : l'image restera figée, l'utilisateur peut rouvrir.
  });
}

watch(tefilinMirrorOpen, (ouvert) => {
  if (ouvert) void start();
  else stop();
});

onUnmounted(() => {
  stop();
  closeTefilinMirror();
});
</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="tefilinMirrorOpen"
        class="mirror-screen"
        role="dialog"
        aria-modal="true"
        :aria-label="t('textReading.mirror.title')"
      >
        <video
          v-if="status === 'live'"
          ref="video"
          class="mirror-video"
          autoplay
          playsinline
          muted
        ></video>

        <!-- Les repères, par-dessus l'image : deux traits et le carré du
             bayit, posé sur la ligne des cheveux. -->
        <div v-if="status === 'live'" class="mirror-guides" aria-hidden="true">
          <div class="guide-v"></div>
          <div class="guide-h"></div>
          <div class="guide-box"></div>
        </div>

        <!-- Ce que la caméra ne peut pas donner : refus, absence, attente. -->
        <p v-if="status !== 'live'" class="mirror-message">
          <template v-if="status === 'starting'">{{ t("textReading.mirror.starting") }}</template>
          <template v-else-if="status === 'denied'">{{ t("textReading.mirror.denied") }}</template>
          <template v-else>{{ t("textReading.mirror.unavailable") }}</template>
        </p>

        <p v-if="status === 'live'" class="mirror-hint">{{ t("textReading.mirror.hint") }}</p>

        <button
          type="button"
          class="mirror-close"
          :aria-label="t('common.close')"
          @click="closeTefilinMirror"
        >
          <AppIcon name="x" :size="22" />
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Plein écran, sans cadre ni panneau : l'image, les repères, un bouton. Le
   noir tient lieu de fond avant que la caméra ne réponde. */
.mirror-screen {
  position: fixed;
  inset: 0;
  /* Même étage que les fenêtres modales de l'app (voir .modal-overlay dans
     main.css) : au-dessus du mobilier flottant des pages, sous les toasts. */
  z-index: 60;
  background: #000;
  overflow: hidden;
}

/* Le miroir renvoie l'image retournée, comme un vrai : la main qui se lève à
   droite doit se lever à droite. */
.mirror-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.mirror-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Un trait clair cerné d'ombre : il doit rester lisible sur des cheveux
   clairs comme sur un mur sombre. */
.guide-v,
.guide-h,
.guide-box {
  position: absolute;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
}

/* La verticale s'arrête un peu sous la ligne des cheveux : elle sert à
   centrer le bayit et à voir s'il penche, pas à barrer le visage ni la
   consigne du bas. */
.guide-v {
  top: 0;
  height: 58%;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: rgb(255 255 255 / 0.55);
}

.guide-h {
  left: 0;
  right: 0;
  top: 42%;
  height: 1px;
  background: rgb(255 255 255 / 0.55);
}

/* Le bayit : au-dessus de la ligne des cheveux, centré. En pointillés, parce
   que c'est un repère et non une mesure. */
.guide-box {
  width: 16vmin;
  height: 16vmin;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -100%);
  border: 2px dashed rgb(255 255 255 / 0.75);
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
}

.mirror-message,
.mirror-hint {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(30rem, calc(100vw - 3rem));
  text-align: center;
  color: #fff;
  line-height: 1.5;
}

.mirror-message {
  top: 50%;
  margin-top: -2rem;
  font-size: 0.95rem;
}

.mirror-hint {
  bottom: max(2rem, env(safe-area-inset-bottom, 0px));
  font-size: 0.85rem;
  color: rgb(255 255 255 / 0.85);
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
}

/* Un voile sombre sous la consigne : elle doit rester lisible, quelle que
   soit la pièce derrière. */
.mirror-hint::before {
  content: "";
  position: absolute;
  inset: -1rem -1.5rem -2.5rem;
  z-index: -1;
  background: radial-gradient(ellipse at center, rgb(0 0 0 / 0.45), transparent 72%);
}

/* Le seul bouton de l'écran, assez grand pour le pouce, posé sous l'encoche. */
.mirror-close {
  position: absolute;
  top: max(1rem, env(safe-area-inset-top, 0px));
  inset-inline-end: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 9999px;
  color: #fff;
  background: rgb(0 0 0 / 0.4);
  backdrop-filter: blur(4px);
}

.mirror-close:hover {
  background: rgb(0 0 0 / 0.6);
}
</style>
