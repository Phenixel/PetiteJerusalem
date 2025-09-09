import { getAuth, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { app } from '../../firebase'

export interface User {
  id: string
  name: string
  email: string
}

export class AuthService {
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
}
