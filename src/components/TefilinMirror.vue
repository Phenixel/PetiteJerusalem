<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { closeTefilinMirror, tefilinMirrorOpen } from "../composables/useTefilinMirror";

/**
 * Le miroir des téfilines : la caméra frontale dans un carré posé au milieu de
 * l'écran, avec trois repères pour placer le bayit de la tête droit et centré.
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

/**
 * `flush: "sync"` : la demande de caméra doit partir dans le geste qui ouvre
 * la fenêtre. Safari ne montre sa demande d'autorisation que tant que le
 * toucher est encore « actif » ; un tour de boucle plus tard, il refuse sans
 * rien demander.
 */
watch(
  tefilinMirrorOpen,
  (ouvert) => {
    if (ouvert) void start();
    else stop();
  },
  { flush: "sync" },
);

const surEchap = (event: KeyboardEvent) => {
  if (event.key === "Escape" && tefilinMirrorOpen.value) closeTefilinMirror();
};

onMounted(() => window.addEventListener("keydown", surEchap));

onUnmounted(() => {
  window.removeEventListener("keydown", surEchap);
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
      <!-- Un voile, comme les autres fenêtres de l'app : le toucher hors du
           miroir le referme. -->
      <div
        v-if="tefilinMirrorOpen"
        class="mirror-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('textReading.mirror.title')"
        @click="closeTefilinMirror"
      >
        <div class="mirror-card" @click.stop>
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
            <template v-else-if="status === 'denied'">{{
              t("textReading.mirror.denied")
            }}</template>
            <template v-else>{{ t("textReading.mirror.unavailable") }}</template>
          </p>

          <!-- Une croix discrète, dans le coin : le reste du carré est
               l'image. -->
          <button
            type="button"
            class="mirror-close"
            :aria-label="t('common.close')"
            @click="closeTefilinMirror"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <!-- La consigne sous le carré, pour ne rien poser sur l'image. -->
        <p v-if="status === 'live'" class="mirror-hint">{{ t("textReading.mirror.hint") }}</p>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.mirror-overlay {
  position: fixed;
  inset: 0;
  /* Même étage que les fenêtres modales de l'app (voir .modal-overlay dans
     main.css) : au-dessus du mobilier flottant des pages, sous les toasts. */
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background-color: rgb(20 16 8 / 0.55);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}

/* Un carré aux bords très arrondis, sans bordure : l'image occupe tout, il
   n'y a pas de cadre autour d'elle. Le noir tient lieu de fond le temps que
   la caméra réponde. */
.mirror-card {
  position: relative;
  width: min(22rem, calc(100vw - 2.5rem), calc(100vh - 10rem));
  aspect-ratio: 1 / 1;
  border-radius: 2rem;
  overflow: hidden;
  background: #000;
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
}

/* Le miroir renvoie l'image retournée, comme un vrai : la main qui se lève à
   droite doit se lever à droite. */
.mirror-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: block;
}

.mirror-guides {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Un trait clair cerné d'ombre : il doit rester lisible sur des cheveux
   clairs comme sur un mur sombre. */
.guide-v,
.guide-h {
  position: absolute;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
  background: rgb(255 255 255 / 0.55);
}

/* La verticale s'arrête sous la ligne des cheveux : elle sert à centrer le
   bayit et à voir s'il penche, pas à barrer le visage. */
.guide-v {
  top: 0;
  height: 62%;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
}

.guide-h {
  left: 0;
  right: 0;
  top: 42%;
  height: 1px;
}

/* Le bayit : au-dessus de la ligne des cheveux, centré. En pointillés, parce
   que c'est un repère et non une mesure. */
.guide-box {
  position: absolute;
  width: 22%;
  height: 22%;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -100%);
  border: 2px dashed rgb(255 255 255 / 0.75);
  border-radius: 4px;
}

.mirror-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #fff;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Discrète : une croix claire dans le coin, sans pastille ni cadre. L'ombre
   portée la tient lisible sur une image claire, la zone tactile reste large
   sous le doigt. */
.mirror-close {
  position: absolute;
  top: 0.25rem;
  inset-inline-end: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  color: rgb(255 255 255 / 0.7);
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 0.55));
  transition: color 0.15s ease;
}

.mirror-close:hover {
  color: #fff;
}

.mirror-hint {
  max-width: min(22rem, calc(100vw - 2.5rem));
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgb(255 255 255 / 0.9);
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
}
</style>
