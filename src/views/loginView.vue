<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/authService'

const authService = new AuthService()
const router = useRouter()

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const displayName = ref('')
const loading = ref(false)
const errorMessage = ref<string | null>(null)

function setMode(newMode: 'login' | 'signup') {
  mode.value = newMode
  errorMessage.value = null
}

async function submitForm() {
  errorMessage.value = null
  loading.value = true
  try {
    if (mode.value === 'signup') {
      if (password.value !== confirmPassword.value) {
        throw new Error('Les mots de passe ne correspondent pas')
      }
      await authService.signUpWithEmail(
        email.value.trim(),
        password.value,
        displayName.value.trim() || undefined,
      )
    } else {
      await authService.signInWithEmail(email.value.trim(), password.value)
    }
    router.push('/')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur de connexion'
    errorMessage.value = msg
  } finally {
    loading.value = false
  }
}

async function loginWithGoogle() {
  try {
    await authService.signInWithGoogleRedirect()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur Google'
    errorMessage.value = msg
  }
}
</script>

<template>
  <main class="main-content">
    <section class="content-body">
      <div class="form-container max-width-600">
        <div class="mode-switch" :data-mode="mode">
          <div
            class="mode-switch__pill"
            :class="{ 'is-right': mode === 'signup' }"
            aria-hidden="true"
          />
          <button
            type="button"
            class="btn btn-md"
            :class="{ 'btn--glass': mode === 'login', 'is-active': mode === 'login' }"
            @click="setMode('login')"
            :disabled="loading"
          >
            Se connecter
          </button>
          <button
            type="button"
            class="btn btn-md"
            :class="{ 'btn--glass': mode === 'signup', 'is-active': mode === 'signup' }"
            @click="setMode('signup')"
            :disabled="loading"
          >
            Créer un compte
          </button>
        </div>

        <form @submit.prevent="submitForm">
          <div v-if="mode === 'signup'" class="form-group">
            <label class="form-label" for="displayName">Nom affiché</label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              class="form-input"
              placeholder="Votre nom"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="email">Adresse e-mail</label>
            <input
              id="email"
              v-model="email"
              type="email"
              class="form-input"
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Mot de passe</label>
            <input
              id="password"
              v-model="password"
              type="password"
              class="form-input"
              placeholder="••••••••"
              required
            />
          </div>

          <div v-if="mode === 'signup'" class="form-group">
            <label class="form-label" for="confirmPassword">Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="form-input"
              placeholder="••••••••"
              required
            />
          </div>

          <div v-if="errorMessage" class="message error">{{ errorMessage }}</div>

          <div class="form-actions">
            <button class="btn btn--secondary btn-lg" type="submit" :disabled="loading">
              {{
                loading ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : "S'inscrire"
              }}
            </button>
          </div>
        </form>

        <div class="center-content" style="margin-top: var(--spacing-2xl)">
          <p class="text-opacity-80">ou</p>
          <button class="btn btn--glass btn-md" @click="loginWithGoogle">
            <i class="fa-brands fa-google"></i>
            Se connecter avec Google
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.mode-switch {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 0;
  margin-bottom: var(--spacing-xl);
  background: var(--color-surface, transparent);
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  padding: 4px;
}

.mode-switch > button {
  position: relative;
  width: 100%;
  z-index: 1;
}

.mode-switch__pill {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  background: var(--color-bg-soft, rgba(0, 0, 0, 0.06));
  border-radius: 999px;
  transition: transform 220ms ease;
  transform: translateX(0%);
}

.mode-switch__pill.is-right {
  transform: translateX(100%);
}

.mode-switch .is-active {
  /* accentuer le label actif */
  color: var(--color-text-strong, inherit);
  font-weight: 600;
}
</style>
