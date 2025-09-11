<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { EnumTypeTextStudy } from '../../models/typeTextStudy'
import { SessionService } from '../../services/sessionService'
import { TextTypeService } from '../../services/textTypeService'
import type { User } from '../../services/authService'
import { seoService } from '../../services/seoService'

const router = useRouter()
const sessionService = new SessionService()

const isLoading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const currentUser = ref<User | null>(null)

// Types de texte d'étude disponibles
const textStudyTypes = TextTypeService.getAllTypes()

// Données du formulaire
const sessionData = reactive({
  name: '',
  description: '',
  type: '' as EnumTypeTextStudy | '',
  dateLimit: '',
})

// Récupérer l'utilisateur connecté
onMounted(async () => {
  currentUser.value = await sessionService.requireAuthentication(router)
  const url = window.location.origin + '/share-reading/new-session'
  seoService.setMeta({
    title: 'Créer une session | Petite Jerusalem',
    description: 'Créez une session de lecture partagée et invitez la communauté à participer.',
    canonical: url,
    og: { url },
  })
})

const createSession = async () => {
  if (
    !sessionData.name ||
    !sessionData.description ||
    !sessionData.type ||
    !sessionData.dateLimit
  ) {
    message.value = 'Veuillez remplir tous les champs'
    messageType.value = 'error'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    await sessionService.createSessionWithValidation(
      sessionData.name,
      sessionData.description,
      sessionData.type as EnumTypeTextStudy,
      sessionData.dateLimit,
      currentUser.value!.id,
      currentUser.value!.name,
    )

    message.value = 'Session créée avec succès !'
    messageType.value = 'success'

    // Rediriger vers la page des sessions après un délai
    setTimeout(() => {
      router.push('/share-reading')
    }, 2000)
  } catch (error) {
    console.error('Erreur lors de la création de la session:', error)
    message.value = 'Erreur lors de la création de la session. Veuillez réessayer.'
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

// Retour à la page précédente
const goBack = () => {
  router.back()
}
</script>

<template>
  <main class="main-content">
    <div class="hero-section">
      <h2 class="hero-title">Créer une session</h2>
      <p class="hero-description">Créez une session de partage de lectures avec la communauté</p>
    </div>

    <div class="form-section">
      <form @submit.prevent="createSession" class="form-container">
        <div class="form-group">
          <label for="name" class="form-label">Titre de la session</label>
          <input
            type="text"
            id="name"
            v-model="sessionData.name"
            placeholder="Titre de la session"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="description" class="form-label">Description de la session</label>
          <textarea
            id="description"
            v-model="sessionData.description"
            placeholder="Description de la session"
            required
            class="form-input"
            rows="4"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="type" class="form-label">Type de texte</label>
          <select name="type" id="type" v-model="sessionData.type" required class="form-input">
            <option value="">Sélectionnez un type</option>
            <option v-for="type in textStudyTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="dateLimit" class="form-label">Date limite</label>
          <input
            type="date"
            id="dateLimit"
            v-model="sessionData.dateLimit"
            required
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-gradient" :disabled="isLoading">
            {{ isLoading ? 'Création en cours...' : 'Créer la session' }}
          </button>
          <button type="button" @click="goBack" class="btn-secondary">Annuler</button>
        </div>
      </form>
    </div>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </main>
</template>
