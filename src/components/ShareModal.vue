<script setup lang="ts">
import { nextTick, watch } from 'vue'

interface Props {
  show: boolean
  sessionName: string
  shareUrl: string
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Déclaration TypeScript pour QRCode
declare global {
  interface Window {
    QRCode: {
      new (
        element: HTMLElement,
        options: {
          text: string
          width: number
          height: number
          colorDark: string
          colorLight: string
          correctLevel: number
        },
      ): void
      CorrectLevel: {
        L: number
        M: number
        Q: number
        H: number
      }
    }
  }
}

const closeModal = () => {
  emit('update:show', false)
}

const generateQRCode = async () => {
  const qrContainer = document.getElementById('qr-code')
  if (qrContainer && props.shareUrl) {
    qrContainer.innerHTML = ''

    try {
      // Charger dynamiquement la bibliothèque QRCode
      await new Promise((resolve, reject) => {
        if (window.QRCode) {
          resolve(true)
          return
        }

        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        script.onload = () => resolve(true)
        script.onerror = () => reject(new Error('Erreur lors du chargement de QRCode'))
        document.head.appendChild(script)
      })

      new window.QRCode(qrContainer, {
        text: props.shareUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H,
      })
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error)
      qrContainer.innerHTML =
        '<p class="text-red-500 font-medium">Erreur lors de la génération du QR code</p>'
    }
  }
}

const shareToWhatsApp = () => {
  const message = `Rejoignez-moi pour une session d'étude partagée : ${props.sessionName}\n\n${props.shareUrl}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, '_blank')
}

const shareToSMS = () => {
  const message = `Rejoignez-moi pour une session d'étude partagée : ${props.sessionName}\n\n${props.shareUrl}`
  const smsUrl = `sms:?body=${encodeURIComponent(message)}`
  window.location.href = smsUrl
}

const shareToFacebook = () => {
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(props.shareUrl)}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.shareUrl)
    alert('Lien copié dans le presse-papiers !')
  } catch (err) {
    console.error('Erreur lors de la copie:', err)
    // Fallback pour les navigateurs plus anciens
    const textArea = document.createElement('textarea')
    textArea.value = props.shareUrl
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Lien copié dans le presse-papiers !')
  }
}

// Générer le QR code quand le modal s'ouvre
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      nextTick(() => {
        generateQRCode()
      })
    }
  },
)
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease]"
    @click="closeModal"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[scaleIn_0.3s_ease] border border-gray-100"
      @click.stop
    >
      <div class="flex justify-between items-center p-4 border-b border-gray-100">
        <h3 class="text-lg font-bold text-gray-800">Partager cette session</h3>
        <button
          @click="closeModal"
          class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        >
          ✕
        </button>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-2 gap-4 mb-8">
          <button
            @click="shareToWhatsApp"
            class="flex flex-col items-center justify-center p-4 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-colors gap-2"
          >
            <span class="text-2xl">📱</span>
            <span class="font-medium">WhatsApp</span>
          </button>

          <button
            @click="shareToSMS"
            class="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors gap-2"
          >
            <span class="text-2xl">💬</span>
            <span class="font-medium">SMS</span>
          </button>

          <button
            @click="shareToFacebook"
            class="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors gap-2"
          >
            <span class="text-2xl">📘</span>
            <span class="font-medium">Facebook</span>
          </button>

          <button
            @click="copyToClipboard"
            class="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors gap-2"
          >
            <span class="text-2xl">📋</span>
            <span class="font-medium">Copier le lien</span>
          </button>
        </div>

        <div class="text-center pt-6 border-t border-gray-100">
          <h4 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">
            Ou scanner le QR code
          </h4>
          <div id="qr-code" class="flex justify-center mb-2"></div>
          <p class="text-sm text-gray-400">Scannez ce code pour accéder directement à la session</p>
        </div>
      </div>
    </div>
  </div>
</template>
