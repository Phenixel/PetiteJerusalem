<script setup lang="ts">
import { nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();
const toast = useToast();

interface Props {
  show: boolean;
  sessionName: string;
  shareUrl: string;
  /** Session text type (e.g. "Tehilim") used to tailor the pre-filled invite. */
  sessionType?: string;
}

interface Emits {
  (e: "update:show", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

declare global {
  interface Window {
    QRCode: {
      new (
        element: HTMLElement,
        options: {
          text: string;
          width: number;
          height: number;
          colorDark: string;
          colorLight: string;
          correctLevel: number;
        },
      ): void;
      CorrectLevel: {
        L: number;
        M: number;
        Q: number;
        H: number;
      };
    };
  }
}

const closeModal = () => {
  emit("update:show", false);
};

const generateQRCode = async () => {
  const qrContainer = document.getElementById("qr-code");
  if (qrContainer && props.shareUrl) {
    qrContainer.innerHTML = "";

    try {
      await new Promise((resolve, reject) => {
        if (window.QRCode) {
          resolve(true);
          return;
        }

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error("Erreur lors du chargement de QRCode"));
        document.head.appendChild(script);
      });

      new window.QRCode(qrContainer, {
        text: props.shareUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H,
      });
    } catch (error) {
      console.error("Erreur lors de la génération du QR code:", error);
      qrContainer.innerHTML = `<p class="text-red-500 font-medium">${t("shareModal.qrError")}</p>`;
    }
  }
};

/**
 * Build the pre-filled invite text. Tehilim sessions get a "chaîne de Tehilim"
 * wording (the #1 acquisition channel is WhatsApp), others a generic study one.
 * The session name usually already carries the intention (e.g. "… refoua
 * chelema de …"), so we interpolate it into the message.
 */
const buildShareMessage = () => {
  const key =
    props.sessionType === "Tehilim" ? "shareModal.inviteTehilim" : "shareModal.inviteStudy";
  return `${t(key, { name: props.sessionName })}\n\n${props.shareUrl}`;
};

const shareToWhatsApp = () => {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildShareMessage())}`;
  window.open(whatsappUrl, "_blank");
};

const shareToSMS = () => {
  const smsUrl = `sms:?body=${encodeURIComponent(buildShareMessage())}`;
  window.location.href = smsUrl;
};

const shareToFacebook = () => {
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(props.shareUrl)}`;
  window.open(facebookUrl, "_blank", "width=600,height=400");
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.shareUrl);
    toast.success(t("shareModal.linkCopied"));
  } catch (err) {
    console.error("Erreur lors de la copie:", err);
    // Fallback pour les navigateurs plus anciens
    const textArea = document.createElement("textarea");
    textArea.value = props.shareUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    toast.success(t("shareModal.linkCopied"));
  }
};

watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      nextTick(() => {
        generateQRCode();
      });
    }
  },
);
</script>

<template>
  <div v-if="show" class="modal-overlay animate-[fadeIn_0.3s_ease]" @click="closeModal">
    <div class="modal-panel animate-[scaleIn_0.3s_ease]" @click.stop>
      <div class="flex justify-between items-center mb-5">
        <h3 class="text-lg font-bold text-text-primary">
          {{ t("shareModal.title") }}
        </h3>
        <button @click="closeModal" class="icon-btn" :aria-label="t('common.close')">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-8">
        <button
          @click="shareToWhatsApp"
          class="flex flex-col items-center justify-center p-4 rounded-lg bg-green-600/10 text-green-700 hover:bg-green-600/15 transition-colors gap-2 dark:text-green-300"
        >
          <AppIcon name="whatsapp" :size="28" />
          <span class="font-medium">WhatsApp</span>
        </button>

        <button
          @click="shareToSMS"
          class="flex flex-col items-center justify-center p-4 rounded-lg bg-blue-600/10 text-blue-700 hover:bg-blue-600/15 transition-colors gap-2 dark:text-blue-300"
        >
          <AppIcon name="message" :size="28" />
          <span class="font-medium">SMS</span>
        </button>

        <button
          @click="shareToFacebook"
          class="flex flex-col items-center justify-center p-4 rounded-lg bg-indigo-600/10 text-indigo-700 hover:bg-indigo-600/15 transition-colors gap-2 dark:text-indigo-300"
        >
          <AppIcon name="facebook" :size="28" />
          <span class="font-medium">Facebook</span>
        </button>

        <button
          @click="copyToClipboard"
          class="flex flex-col items-center justify-center p-4 rounded-lg bg-black/5 text-text-primary hover:bg-black/10 transition-colors gap-2 dark:bg-white/10 dark:hover:bg-white/15"
        >
          <AppIcon name="copy" :size="28" />
          <span class="font-medium">{{ t("shareModal.copyLink") }}</span>
        </button>
      </div>

      <div class="text-center">
        <h4 class="text-sm font-semibold text-text-secondary mb-4">
          {{ t("shareModal.scanQR") }}
        </h4>
        <div
          id="qr-code"
          class="flex justify-center mb-2 p-2 bg-white rounded-lg inline-block"
        ></div>
        <p class="text-sm text-text-secondary">
          {{ t("shareModal.scanQRDesc") }}
        </p>
      </div>
    </div>
  </div>
</template>
