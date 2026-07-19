import {
  getAuth,
  onAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  signInWithCredential,
  reauthenticateWithPopup,
  getRedirectResult,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  deleteUser,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { app, googleAuthProvider } from "../../firebase";
import { isNativeApp } from "../composables/useNativeApp";
import type { User } from "../models/models";
import { userPreferencesService } from "./userPreferencesService";

export type { User };

function toUser(firebaseUser: FirebaseUser): User {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email || "Utilisateur",
    email: firebaseUser.email || "",
  };
}

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
    if (isNativeApp) {
      // Pas de redirect possible en webview : on passe par le flux natif.
      await this.signInWithGoogleNative();
      return;
    }
    const auth = getAuth(app);
    await signInWithRedirect(auth, googleAuthProvider);
  }

  async signInWithGooglePopup(): Promise<User> {
    if (isNativeApp) {
      return this.signInWithGoogleNative();
    }
    const auth = getAuth(app);
    const result = await signInWithPopup(auth, googleAuthProvider);
    return toUser(result.user);
  }

  // App native : le plugin ouvre le sélecteur de compte Google natif et rend
  // les credentials (skipNativeAuth dans capacitor.config.ts) ; la connexion
  // Firebase se fait ensuite dans le SDK JS de la webview, pour que
  // onAuthStateChanged & co continuent de fonctionner comme sur le web.
  private async signInWithGoogleNative(): Promise<User> {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error("Connexion Google annulée ou incomplète");
    }
    const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
    const cred = await signInWithCredential(getAuth(app), credential);
    return toUser(cred.user);
  }

  // Connexion Apple. Requise par Apple (règle 4.8) sur l'app iOS dès lors que
  // l'on propose un autre login tiers (Google). Affichée côté UI uniquement sur iOS.
  async signInWithApple(): Promise<User> {
    const auth = getAuth(app);
    const provider = new OAuthProvider("apple.com");

    if (isNativeApp) {
      // Flux natif iOS : la feuille "Sign in with Apple" du système, puis
      // bridge du credential (avec le rawNonce, spécificité Apple) vers le
      // SDK JS. La popup Firebase ne fonctionne pas en webview.
      const result = await FirebaseAuthentication.signInWithApple();
      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error("Connexion Apple annulée ou incomplète");
      }
      const credential = provider.credential({
        idToken,
        rawNonce: result.credential?.nonce ?? undefined,
      });
      const cred = await signInWithCredential(auth, credential);
      return toUser(cred.user);
    }

    provider.addScope("email");
    provider.addScope("name");
    const result = await signInWithPopup(auth, provider);
    return toUser(result.user);
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

    // Purge des données Firestore associées (préférences, progression de
    // lecture, tokens de notification) tant que l'utilisateur est encore
    // authentifié — les règles Firestore exigent request.auth.uid == userId.
    // Best-effort : un échec ne doit pas empêcher la suppression du compte
    // lui-même (sinon l'utilisateur resterait bloqué).
    try {
      await userPreferencesService.deletePreferences(user.uid);
    } catch (error) {
      console.error("Erreur lors de la suppression des préférences utilisateur:", error);
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
    if (isNativeApp) {
      // Déconnecte aussi la couche native (sinon le prochain login Google
      // resauterait le sélecteur de compte).
      await FirebaseAuthentication.signOut().catch(() => {});
    }
    const auth = getAuth(app);
    await signOut(auth);
  }
}

export const authService = new AuthService();
