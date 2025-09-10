import {
  getAuth,
  onAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
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
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    return {
      id: cred.user.uid,
      name: cred.user.displayName || cred.user.email || 'Utilisateur',
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

  // Déconnexion
  async logout(): Promise<void> {
    const auth = getAuth(app)
    await signOut(auth)
  }
}
