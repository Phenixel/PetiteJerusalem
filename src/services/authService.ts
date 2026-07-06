import {
  getAuth,
  onAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  reauthenticateWithPopup,
  getRedirectResult,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  OAuthProvider,
  deleteUser,
} from "firebase/auth";
import { app, googleAuthProvider } from "../../firebase";
import type { User } from "../models/models";

export type { User };

export class AuthService {
  onAuthChanged(callback: (user: User | null) => void): () => void {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        callback({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email || "Utilisateur",
          email: firebaseUser.email || "",
        });
      } else {
        callback(null);
      }
    });
    return unsubscribe;
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const auth = getAuth(app);
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        if (user) {
          resolve({
            id: user.uid,
            name: user.displayName || user.email || "Utilisateur",
            email: user.email || "",
          });
        } else {
          resolve(null);
        }
        unsubscribe();
      });
    });
  }

  async isUserAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  async requireAuthentication(
    router: { push: (path: string) => void },
    redirectPath: string = "/",
  ): Promise<User | null> {
    const user = await this.getCurrentUser();
    if (!user) {
      router.push(redirectPath);
      return null;
    }
    return user;
  }

  // ===== MÉTHODES D'AUTHENTIFICATION =====

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const auth = getAuth(app);
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id: cred.user.uid,
      name: displayName || cred.user.displayName || cred.user.email || "Utilisateur",
      email: cred.user.email || email,
    };
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const auth = getAuth(app);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return {
      id: cred.user.uid,
      name: cred.user.displayName || cred.user.email || "Utilisateur",
      email: cred.user.email || email,
    };
  }

  async signInWithGoogleRedirect(): Promise<void> {
    const auth = getAuth(app);
    await signInWithRedirect(auth, googleAuthProvider);
  }

  async signInWithGooglePopup(): Promise<User> {
    const auth = getAuth(app);
    const result = await signInWithPopup(auth, googleAuthProvider);
    return {
      id: result.user.uid,
      name: result.user.displayName || result.user.email || "Utilisateur",
      email: result.user.email || "",
    };
  }

  // Connexion Apple. Requise par Apple (règle 4.8) sur l'app iOS dès lors que
  // l'on propose un autre login tiers (Google). Affichée côté UI uniquement sur iOS.
  //
  // NOTE Capacitor : sur le web cette popup fonctionne directement. Sur l'app
  // native iOS, il faudra basculer sur `@capacitor-firebase/authentication`
  // (`signInWithApple`) une fois le projet Xcode + la capability "Sign in with
  // Apple" en place — c'est le même chantier "auth native" que pour Google.
  async signInWithApple(): Promise<User> {
    const auth = getAuth(app);
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const result = await signInWithPopup(auth, provider);
    return {
      id: result.user.uid,
      name: result.user.displayName || result.user.email || "Utilisateur",
      email: result.user.email || "",
    };
  }

  async getGoogleRedirectResult(): Promise<User | null> {
    const auth = getAuth(app);
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        return {
          id: result.user.uid,
          name: result.user.displayName || result.user.email || "Utilisateur",
          email: result.user.email || "",
        };
      }
      return null;
    } catch (error) {
      console.error("Erreur lors de la récupération du résultat de redirection:", error);
      return null;
    }
  }

  saveRedirectPath(path: string): void {
    localStorage.setItem("auth_redirect_path", path);
  }

  getAndClearRedirectPath(): string | null {
    const path = localStorage.getItem("auth_redirect_path");
    if (path) {
      localStorage.removeItem("auth_redirect_path");
      return path;
    }
    return null;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user || !user.email) {
      throw new Error("Aucun utilisateur connecté");
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, newPassword);
  }

  async deleteAccount(password?: string): Promise<void> {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Aucun utilisateur connecté");
    }

    if (password && user.email) {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }

    await deleteUser(user);
  }

  async reauthenticateWithGoogle(): Promise<void> {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Aucun utilisateur connecté");
    }

    // reauthenticateWithPopup (et non signInWithPopup) : échoue si le compte
    // choisi dans le popup n'est pas le compte courant — sinon une suppression
    // de compte qui suit pourrait viser un autre compte Google.
    await reauthenticateWithPopup(user, googleAuthProvider);
  }

  isGoogleUser(): boolean {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) return false;

    return user.providerData.some((provider) => provider.providerId === "google.com");
  }

  hasPasswordProvider(): boolean {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) return false;

    return user.providerData.some((provider) => provider.providerId === "password");
  }

  async logout(): Promise<void> {
    const auth = getAuth(app);
    await signOut(auth);
  }
}

export const authService = new AuthService();
