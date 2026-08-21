import {
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
import { auth, googleAuthProvider } from "../firebase/core";
import { isAuthCancellation } from "./authErrors";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";
import type { User } from "../models/models";
import { clearPreferencesCache, userPreferencesService } from "./userPreferencesService";
import { analyticsService } from "./analyticsService";
import { moderationService } from "./moderationService";

export type { User };

function toUser(firebaseUser: FirebaseUser): User {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email || "Utilisateur",
    email: firebaseUser.email || "",
  };
}

export class AuthService {
  // Firebase ne rejoue pas onAuthStateChanged après un updateProfile : le nom
  // affiché changerait dans le profil, et nulle part ailleurs (bandeau, menu
  // du compte...) jusqu'au prochain rechargement. On garde donc la liste des
  // abonnés pour les prévenir nous-mêmes, voir notifyProfileChanged.
  private readonly profileListeners = new Set<(user: User | null) => void>();

  onAuthChanged(callback: (user: User | null) => void): () => void {
    // Une enveloppe, et non `callback` lui-même : deux abonnements passant la
    // même fonction resteraient deux entrées, et se désabonneraient chacun.
    const listener = (user: User | null) => callback(user);
    this.profileListeners.add(listener);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      listener(firebaseUser ? toUser(firebaseUser) : null);
    });
    return () => {
      this.profileListeners.delete(listener);
      unsubscribe();
    };
  }

  /** Rejoue les abonnés d'onAuthChanged avec l'utilisateur courant. */
  private notifyProfileChanged(): void {
    const user = auth.currentUser ? toUser(auth.currentUser) : null;
    this.profileListeners.forEach((listener) => listener(user));
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        resolve(user ? toUser(user) : null);
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
    // Modération App Store : le pseudo s'affiche publiquement (créateur de
    // session, participant). Vérifié AVANT la création du compte.
    moderationService.assertClean(displayName);

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    analyticsService.capture("signed_up", { method: "email" });
    return {
      id: cred.user.uid,
      name: displayName || cred.user.displayName || cred.user.email || "Utilisateur",
      email: cred.user.email || email,
    };
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    analyticsService.capture("signed_in", { method: "email" });
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
    await signInWithRedirect(auth, googleAuthProvider);
  }

  async signInWithGooglePopup(): Promise<User> {
    if (isNativeApp) {
      return this.signInWithGoogleNative();
    }
    const result = await signInWithPopup(auth, googleAuthProvider);
    analyticsService.capture("signed_in", { method: "google" });
    return toUser(result.user);
  }

  // App native : le plugin ouvre le sélecteur de compte Google natif et rend
  // les credentials (skipNativeAuth dans capacitor.config.ts) ; la connexion
  // Firebase se fait ensuite dans le SDK JS de la webview, pour que
  // onAuthStateChanged & co continuent de fonctionner comme sur le web.
  private async signInWithGoogleNative(): Promise<User> {
    const result = await this.getGoogleCredentialNative();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error("Connexion Google annulée ou incomplète");
    }
    const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
    const cred = await signInWithCredential(auth, credential);
    analyticsService.capture("signed_in", { method: "google" });
    return toUser(cred.user);
  }

  // Sur Android, le plugin passe par le Credential Manager, qui est cassé sur
  // certains appareils (Play Services obsolète, gestionnaire de mots de passe
  // tiers type Samsung Pass...) : l'appel échoue sans qu'aucune UI n'apparaisse.
  // Dans ce cas, on retente avec le sélecteur de compte Google classique
  // (useCredentialManager: false). On ne retente pas si l'utilisateur a
  // simplement annulé le sélecteur.
  private async getGoogleCredentialNative() {
    try {
      return await FirebaseAuthentication.signInWithGoogle();
    } catch (error) {
      if (appPlatform !== "android" || isAuthCancellation(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Credential Manager indisponible, repli sur le sélecteur classique:", error);
      // Suivi du bug « bouton Google inerte » : mesure combien d'appareils
      // passent par le repli, et avec quelle erreur d'origine.
      analyticsService.capture("google_signin_fallback_used", { credential_manager_error: message });
      return FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
    }
  }

  // Connexion Apple. Requise par Apple (règle 4.8) sur l'app iOS dès lors que
  // l'on propose un autre login tiers (Google). Affichée côté UI uniquement sur iOS.
  async signInWithApple(): Promise<User> {
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
      analyticsService.capture("signed_in", { method: "apple" });
      return toUser(cred.user);
    }

    provider.addScope("email");
    provider.addScope("name");
    const result = await signInWithPopup(auth, provider);
    analyticsService.capture("signed_in", { method: "apple" });
    return toUser(result.user);
  }

  async getGoogleRedirectResult(): Promise<User | null> {
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        return toUser(result.user);
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

  /**
   * Change le nom d'affichage du compte connecté. Ce nom est public (créateur
   * de session, participant) : il passe donc par la modération, comme à
   * l'inscription.
   */
  async updateDisplayName(name: string): Promise<User> {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Aucun utilisateur connecté");
    }

    const displayName = name.trim();
    if (!displayName) {
      throw new Error("Le nom d'affichage ne peut pas être vide");
    }

    moderationService.assertClean(displayName);

    await updateProfile(user, { displayName });
    this.notifyProfileChanged();
    return toUser(user);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;

    if (!user || !user.email) {
      throw new Error("Aucun utilisateur connecté");
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, newPassword);
  }

  async deleteAccount(password?: string): Promise<void> {
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
    // authentifié, les règles Firestore exigent request.auth.uid == userId.
    // Best-effort : un échec ne doit pas empêcher la suppression du compte
    // lui-même (sinon l'utilisateur resterait bloqué).
    try {
      await userPreferencesService.deletePreferences(user.uid);
    } catch (error) {
      console.error("Erreur lors de la suppression des préférences utilisateur:", error);
    }

    await deleteUser(user);
    // Après le deleteUser (une suppression qui échoue ne doit pas compter),
    // mais avant tout reset : l'événement reste rattaché au compte supprimé.
    analyticsService.capture("account_deleted");
  }

  async reauthenticateWithGoogle(): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Aucun utilisateur connecté");
    }

    // reauthenticateWithPopup (et non signInWithPopup) : échoue si le compte
    // choisi dans le popup n'est pas le compte courant, sinon une suppression
    // de compte qui suit pourrait viser un autre compte Google.
    await reauthenticateWithPopup(user, googleAuthProvider);
  }

  // Ré-authentification Apple avant suppression de compte : même exigence de
  // connexion récente que Google, mais via la feuille Apple (native) ou la
  // popup Apple (web).
  async reauthenticateWithApple(): Promise<void> {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Aucun utilisateur connecté");
    }

    const provider = new OAuthProvider("apple.com");

    if (isNativeApp) {
      const result = await FirebaseAuthentication.signInWithApple();
      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error("Ré-authentification Apple annulée ou incomplète");
      }
      const credential = provider.credential({
        idToken,
        rawNonce: result.credential?.nonce ?? undefined,
      });
      await reauthenticateWithCredential(user, credential);
      return;
    }

    await reauthenticateWithPopup(user, provider);
  }

  isGoogleUser(): boolean {
    const user = auth.currentUser;

    if (!user) return false;

    return user.providerData.some((provider) => provider.providerId === "google.com");
  }

  isAppleUser(): boolean {
    const user = auth.currentUser;

    if (!user) return false;

    return user.providerData.some((provider) => provider.providerId === "apple.com");
  }

  hasPasswordProvider(): boolean {
    const user = auth.currentUser;

    if (!user) return false;

    return user.providerData.some((provider) => provider.providerId === "password");
  }

  async logout(): Promise<void> {
    // La copie locale des préférences (lecture quotidienne hors ligne) ne
    // survit pas à la déconnexion : elle sera reconstruite au prochain login.
    const uid = auth.currentUser?.uid;
    if (uid) clearPreferencesCache(uid);
    if (isNativeApp) {
      // Déconnecte aussi la couche native (sinon le prochain login Google
      // resauterait le sélecteur de compte).
      await FirebaseAuthentication.signOut().catch(() => {});
    }
    await signOut(auth);
    // Capturé avant le reset pour rester rattaché au compte qui se déconnecte.
    analyticsService.capture("signed_out");
    // Déconnexion explicite : les événements suivants repartent anonymes.
    analyticsService.reset();
  }
}

export const authService = new AuthService();
