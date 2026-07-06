# Plan de test du POC Capacitor

Objectif : **valider sur un vrai appareil, à coût minimal, que Capacitor couvre
les besoins clés** — avant de s'engager (Capacitor vs réécriture Flutter).
On commence par **Android** (zéro Mac requis, le moins de friction). iOS est une
phase 2 optionnelle.

## 1. Critères de décision (go / no-go)

On part sur Capacitor si, à la fin du test :

| Critère | Cible | OK ? |
|---|---|---|
| Fluidité navigation / scroll | « ça ne se voit pas que c'est une webview » | ☐ |
| Lecture de texte hors-ligne | un texte s'ouvre en **mode avion** | ☐ |
| Login email / mot de passe | création de compte + connexion OK | ☐ |
| Ressenti « app native » global | acceptable pour une V1 | ☐ |

Si la fluidité paraît molle → on saura que Flutter se justifie. Sinon → go.

## 2. Prérequis (Android)

- Node 22 (déjà requis par le projet)
- **Android Studio récent** + un SDK Android installé (Capacitor 8 → **JDK 21**)
- Un téléphone Android en mode développeur **ou** un émulateur configuré

## 3. Lancement (Android)

```bash
git fetch origin claude/capacitor-poc
git checkout claude/capacitor-poc
npm install

npm run build          # génère dist/ (web + textes locaux)
npx cap add android    # scaffold le projet natif android/ (une seule fois)
npm run cap:android    # rebuild + sync + ouvre Android Studio
```

Dans Android Studio : sélectionne ton device/émulateur → **Run** (▶).

> Itération rapide (optionnel) : `npm run dev -- --host`, puis dans
> `capacitor.config.ts` ajoute `server: { url: 'http://<ip-locale>:5173', cleartext: true }`,
> `npx cap sync`, relance. Le hot-reload web fonctionne. **À retirer avant tout build store.**

## 4. Scénarios de test (checklist)

**Fluidité / ressenti**
- ☐ Home → liste des sessions → détail d'une session → lecture d'un texte
- ☐ Scroll d'une longue liste de textes (ex. Tehilim / une grande Mishna)
- ☐ Bouton retour **matériel** Android (cohérent avec la navigation)
- ☐ Dark mode + changement de langue (fr / en / he, dont RTL hébreu)
- ☐ Affichage correct des safe-areas / encoche (pas de contenu coupé)

**Offline (le différenciateur)**
- ☐ Activer le **mode avion**
- ☐ Ouvrir un texte déjà jamais ouvert → il se charge (servi depuis le bundle)
- ☐ Naviguer entre sections/chapitres hors-ligne

**Auth**
- ☐ Inscription + connexion **email / mot de passe** → OK
- ☐ Bouton **Google** : tester, **noter** si la popup casse (comportement
  attendu en webview — sera réglé par le plugin natif en V1)
- ☐ Bouton **Apple** : vérifier qu'il **n'apparaît PAS** sur Android (gate iOS)

## 5. Hors-scope de ce test (phases ultérieures)

- Notifications push (FCM + Cloud Functions + clé APNs)
- Flux natif complet Google/Apple (`@capacitor-firebase/authentication`)
- Build signé + soumission stores

## 6. Phase 2 optionnelle — iOS (si Mac dispo)

```bash
# macOS + Xcode + CocoaPods (sudo gem install cocoapods)
npx cap add ios
npm run cap:ios        # ouvre Xcode → Run sur simulateur/device
```
- ☐ Mêmes scénarios fluidité + offline
- ☐ Bouton **Apple** visible (gate iOS) — login complet nécessitera la config
  Apple Developer (cf. `docs/capacitor-poc.md`)

## 7. Dépannage courant

| Symptôme | Piste |
|---|---|
| Écran blanc au lancement | `dist/` absent → relancer `npm run build` puis `npx cap sync` |
| Erreur build Gradle / JDK | vérifier **JDK 21** + Android Studio à jour |
| Modifs web non visibles | `npx cap sync` (ou `npm run app:build`) après chaque build |
| Textes 404 hors-ligne | confirmer que `public/texts/**` est bien dans `dist/` après build |
