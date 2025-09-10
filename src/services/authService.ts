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

export interface User {
  id: string
  name: string
  email: string
}

export class AuthService {
  // S'abonner aux changements d'état d'authentification
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

  // Récupérer l'utilisateur connecté
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

  // Vérifier si l'utilisateur est connecté
  async isUserAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser()
    return user !== null
  }

  // Rediriger si pas d'utilisateur connecté
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

  // Inscription par email / mot de passe
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const auth = getAuth(app)
    const cred = await createUserWithEmailAndPassword(auth, email, password)

    // Mettre à jour le profil avec le nom d'affichage si fourni
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }

    // Attendre un peu pour que la mise à jour du profil soit propagée
    await new Promise((resolve) => setTimeout(resolve, 100))

    return {
      id: cred.user.uid,
      name: displayName || cred.user.displayName || cred.user.email || 'Utilisateur',
      email: cred.user.email || email,
    }
  }

  // Connexion par email / mot de passe
  async signInWithEmail(email: string, password: string): Promise<User> {
    const auth = getAuth(app)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return {
      id: cred.user.uid,
      name: cred.user.displayName || cred.user.email || 'Utilisateur',
      email: cred.user.email || email,
    }
  }

  // Connexion via Google (redirection)
  async signInWithGoogleRedirect(): Promise<void> {
    const auth = getAuth(app)
    await signInWithRedirect(auth, googleAuthProvider)
  }

  // Récupérer le résultat de la redirection Google
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

  // Sauvegarder la page d'origine pour redirection après connexion
  saveRedirectPath(path: string): void {
    localStorage.setItem('auth_redirect_path', path)
  }

  // Récupérer et supprimer la page d'origine sauvegardée
  getAndClearRedirectPath(): string | null {
    const path = localStorage.getItem('auth_redirect_path')
    if (path) {
      localStorage.removeItem('auth_redirect_path')
      return path
    }
    return null
  }

  // Déconnexion
  async logout(): Promise<void> {
    const auth = getAuth(app)
    await signOut(auth)
  }
}
