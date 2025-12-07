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
        '<p style="color: #ff6b6b;">Erreur lors de la génération du QR code</p>'
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
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Partager cette session</h3>
        <button @click="closeModal" class="close-button">✕</button>
      </div>

      <div class="modal-body">
        <div class="share-options">
          <button @click="shareToWhatsApp" class="share-option whatsapp">
            <span class="share-icon">📱</span>
            <span>WhatsApp</span>
          </button>

          <button @click="shareToSMS" class="share-option sms">
            <span class="share-icon">💬</span>
            <span>SMS</span>
          </button>

          <button @click="shareToFacebook" class="share-option facebook">
            <span class="share-icon">📘</span>
            <span>Facebook</span>
          </button>

          <button @click="copyToClipboard" class="share-option copy">
            <span class="share-icon">📋</span>
            <span>Copier le lien</span>
          </button>
        </div>

        <div class="qr-section">
          <h4>Ou scanner le QR code :</h4>
          <div id="qr-code" class="qr-container"></div>
          <p class="qr-description">Scannez ce code pour accéder directement à la session</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Les styles sont déjà définis dans style.css */
</style>
