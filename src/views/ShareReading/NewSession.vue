<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
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

// Gestion de la sélection fine des livres
const availableBooks = ref<string[]>([])
const selectedBooks = ref<string[]>([])
const isBookSelectionEnabled = ref(false)

// Observer les changements de type pour charger les livres
watch(
  () => sessionData.type,
  async (newType) => {
    selectedBooks.value = []
    availableBooks.value = []
    isBookSelectionEnabled.value = false

    if (newType) {
      try {
        const books = await sessionService.getBooksByType(newType as EnumTypeTextStudy)
        if (books.length > 0) {
          availableBooks.value = books
          // Par défaut, tout sélectionner comme demandé
          selectedBooks.value = [...books]
          isBookSelectionEnabled.value = true
        }
      } catch (error) {
        console.error('Erreur lors du chargement des livres:', error)
      }
    }
  },
)

const toggleAllBooks = () => {
  if (selectedBooks.value.length === availableBooks.value.length) {
    selectedBooks.value = []
  } else {
    selectedBooks.value = [...availableBooks.value]
  }
}

const formatBookName = (bookName: string) => {
  return sessionService.formatBookName(bookName)
}

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

  if (isBookSelectionEnabled.value && selectedBooks.value.length === 0) {
    message.value = 'Veuillez sélectionner au moins une partie du texte'
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
      selectedBooks.value.length > 0 ? selectedBooks.value : undefined,
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
  <main class="mx-auto px-6 py-12 min-h-screen">
    <div class="text-center mb-12 animate-[fadeIn_0.5s_ease]">
      <h2
        class="text-3xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent md:text-4xl font-bold text-text-primary mb-4"
      >
        Créer une session
      </h2>
      <p class="text-text-secondary text-lg">
        Créez une session de partage de lectures avec la communauté
      </p>
    </div>

    <div
      class="bg-white/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-8 md:p-10 animate-[fadeIn_0.5s_ease_0.1s] text-left dark:bg-gray-800/60 dark:border-gray-700"
    >
      <form @submit.prevent="createSession" class="space-y-6">
        <div>
          <label
            for="name"
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-200"
            >Titre de la session</label
          >
          <input
            type="text"
            id="name"
            v-model="sessionData.name"
            placeholder="Ex: Étude de la Parasha de la semaine"
            required
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-600"
          />
        </div>

        <div>
          <label
            for="description"
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-200"
            >Description de la session</label
          >
          <textarea
            id="description"
            v-model="sessionData.description"
            placeholder="Décrivez l'objectif de cette session d'étude..."
            required
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-y dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-600"
            rows="4"
          ></textarea>
        </div>

        <div>
          <label
            for="type"
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-200"
            >Type de texte</label
          >
          <div class="relative">
            <select
              name="type"
              id="type"
              v-model="sessionData.type"
              required
              class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-600"
            >
              <option value="">Sélectionnez un type</option>
              <option v-for="type in textStudyTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
            <i
              class="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none dark:text-gray-400"
            ></i>
          </div>
        </div>

        <!-- Sélection des parties/livres (s'affiche uniquement si des livres sont disponibles) -->
        <div v-if="isBookSelectionEnabled" class="animate-[fadeIn_0.3s_ease]">
          <label class="block text-sm font-semibold text-text-primary mb-3 dark:text-gray-200">
            Sélectionner les parties à inclure
            <span class="text-xs font-normal text-text-secondary ml-2 dark:text-gray-400">
              ({{ selectedBooks.length }}/{{ availableBooks.length }})
            </span>
          </label>

          <div
            class="bg-white/50 rounded-xl border border-gray-200 p-4 max-h-60 overflow-y-auto custom-scrollbar dark:bg-gray-700/50 dark:border-gray-600"
          >
            <div class="flex items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="w-5 h-5 rounded text-primary border-gray-300 focus:ring-primary accent-primary"
                  :checked="selectedBooks.length === availableBooks.length"
                  :indeterminate="
                    selectedBooks.length > 0 && selectedBooks.length < availableBooks.length
                  "
                  @change="toggleAllBooks"
                />
                <span class="ml-2 text-sm font-semibold text-text-primary dark:text-gray-200"
                  >Tout sélectionner</span
                >
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                v-for="book in availableBooks"
                :key="book"
                class="inline-flex items-center cursor-pointer hover:bg-black/5 p-1 rounded transition-colors dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded text-primary border-gray-300 focus:ring-primary accent-primary"
                  :value="book"
                  v-model="selectedBooks"
                />
                <span class="ml-2 text-sm text-text-secondary dark:text-gray-300">{{
                  formatBookName(book)
                }}</span>
              </label>
            </div>
          </div>
          <p
            v-if="selectedBooks.length === 0"
            class="text-xs text-red-500 mt-1 flex items-center gap-1"
          >
            <i class="fa-solid fa-triangle-exclamation"></i>
            Veuillez sélectionner au moins une partie
          </p>
        </div>

        <div>
          <label
            for="dateLimit"
            class="block text-sm font-semibold text-text-primary mb-2 dark:text-gray-200"
            >Date limite</label
          >
          <input
            type="date"
            id="dateLimit"
            v-model="sessionData.dateLimit"
            required
            class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none cursor-pointer dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:focus:bg-gray-600 dark:[color-scheme:dark]"
          />
        </div>

        <div class="flex flex-col-reverse sm:flex-row gap-4 pt-4">
          <button
            type="button"
            @click="goBack"
            class="px-6 py-3 bg-white border border-gray-200 text-text-secondary font-bold rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Annuler
          </button>
          <button
            type="submit"
            class="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:flex-1 disabled:opacity-70 disabled:cursor-wait"
            :disabled="isLoading"
          >
            {{ isLoading ? 'Création en cours...' : 'Créer la session' }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="message"
      class="mt-6 p-4 rounded-xl text-center font-medium animate-[fadeIn_0.3s_ease]"
      :class="
        messageType === 'success'
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-red-100 text-red-700 border border-red-200'
      "
    >
      <i class="fa-solid fa-check-circle mr-2" v-if="messageType === 'success'"></i>
      <i class="fa-solid fa-exclamation-circle mr-2" v-if="messageType === 'error'"></i>
      {{ message }}
    </div>
  </main>
</template>
