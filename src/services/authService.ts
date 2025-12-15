import {
  getAuth,
  onAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { app, googleAuthProvider } from '../../firebase'
import type { User } from '../models/models'

export type { User }

export class AuthService {
  onAuthChanged(callback: (user: User | null) => void): () => void {
    const auth = getAuth(app)
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        callback({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email || 'Utilisateur',
          email: firebaseUser.email || '',
        })
      } else {
        callback(null)
      }
    })
    return unsubscribe
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const auth = getAuth(app)
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user) {
          resolve({
            id: user.uid,
            name: user.displayName || user.email || 'Utilisateur',
            email: user.email || '',
          })
        } else {
          resolve(null)
        }
        unsubscribe()
      })
    })
  }

  async isUserAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  }

  async requireAuthentication(
    router: { push: (path: string) => void },
    redirectPath: string = '/',
  ): Promise<User | null> {
    const user = await this.getCurrentUser()
    if (!user) {
      router.push(redirectPath)
      return null
    }
    return user
  }

  // ===== MÉTHODES D'AUTHENTIFICATION =====

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const auth = getAuth(app)
    const cred = await createUserWithEmailAndPassword(auth, email, password)

    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }

    await new Promise((resolve) => setTimeout(resolve, 100))

    return {
      id: cred.user.uid,
      name: displayName || cred.user.displayName || cred.user.email || 'Utilisateur',
      email: cred.user.email || email,
    }
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const auth = getAuth(app)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return {
      id: cred.user.uid,
      name: cred.user.displayName || cred.user.email || 'Utilisateur',
      email: cred.user.email || email,
    }
  }

  async signInWithGoogleRedirect(): Promise<void> {
    const auth = getAuth(app)
    await signInWithRedirect(auth, googleAuthProvider)
  }

  async getGoogleRedirectResult(): Promise<User | null> {
    const auth = getAuth(app)
    try {
      const result = await getRedirectResult(auth)
      if (result && result.user) {
        return {
          id: result.user.uid,
          name: result.user.displayName || result.user.email || 'Utilisateur',
          email: result.user.email || '',
        }
      }
      return null
    } catch (error) {
      console.error('Erreur lors de la récupération du résultat de redirection:', error)
      return null
    }
  }

  saveRedirectPath(path: string): void {
    localStorage.setItem('auth_redirect_path', path)
  }

  getAndClearRedirectPath(): string | null {
    const path = localStorage.getItem('auth_redirect_path')
    if (path) {
      localStorage.removeItem('auth_redirect_path')
      return path
    }
    return null
  }

  async logout(): Promise<void> {
    const auth = getAuth(app)
    await signOut(auth)
  }
}

export const authService = new AuthService()
