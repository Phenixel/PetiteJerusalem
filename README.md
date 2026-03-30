# Petite Jérusalem

> **Votre centre spirituel numérique** — Une plateforme communautaire dédiée à l'étude, au partage et à la croissance spirituelle de la communauté juive francophone.

![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12.x-FFCA28?logo=firebase&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey)

---

## Table des matières

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Commandes disponibles](#commandes-disponibles)
- [Contribution](#contribution)
- [Licence](#licence)

---

## Présentation

**Petite Jérusalem** est une application web open-source qui centralise plusieurs outils utiles pour la communauté juive francophone. Elle permet notamment de créer des sessions d'étude collaborative, de découvrir des cours de Torah (Chiourim), et à terme de recevoir des Halakhot quotidiennes.

Le projet est développé avec **Vue 3** (Composition API) et s'appuie sur **Firebase** pour l'authentification et la persistance des données.

---

## Fonctionnalités

### Disponibles

| Fonctionnalité | Description |
|---|---|
| **Partage de Lectures** | Créez des sessions de Limoud, répartissez des textes entre participants et suivez la progression en temps réel |
| **Chiourim** | Parcourez et écoutez des cours de Torah partagés par la communauté, filtrables par auteur et catégorie |
| **Authentification** | Connexion sécurisée via Firebase (email/mot de passe et Google OAuth) |
| **Mode invité** | Participation sans compte avec conversion de compte possible a posteriori |
| **Internationalisation** | Interface disponible en français, anglais et hébreu (avec support RTL) |
| **Thèmes** | Plusieurs thèmes de couleurs + mode sombre |

### À venir

- Halakhot Quotidiennes — lois juives quotidiennes personnalisées

---

## Architecture

```
src/
├── assets/           # Fichiers statiques (CSS global, images)
├── components/       # Composants réutilisables (Navbar, Footer, modals…)
│   └── icons/        # Icônes SVG en composants Vue
├── composables/      # Logique réutilisable (useTheme, useDarkMode, useLocale)
├── datas/            # Données statiques JSON (textes d'étude)
├── locales/          # Traductions i18n (fr, en, he)
├── models/           # Interfaces TypeScript et enums
├── repositories/     # Couche d'accès aux données (Firestore)
├── router/           # Configuration Vue Router
├── services/         # Logique métier (session, réservation, auth, SEO…)
├── views/            # Pages de l'application
│   ├── Chiourim/
│   ├── ShareReading/
│   └── profilePage/
└── __tests__/        # Tests unitaires Vitest
```

**Principes architecturaux :**
- Les **views** orchestrent ; les **services** contiennent la logique métier ; les **repositories** gèrent l'accès aux données Firestore.
- Les **composables** encapsulent la logique Vue réutilisable (state + lifecycle).
- Toute la couche de présentation utilise **TailwindCSS** avec des classes utilitaires.

---

## Stack technique

| Catégorie | Technologie | Version |
|---|---|---|
| Framework front-end | [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`) | ^3.5 |
| Langage | [TypeScript](https://www.typescriptlang.org/) | ~5.8 |
| Styles | [TailwindCSS](https://tailwindcss.com/) | ^4.1 |
| Backend / Auth / DB | [Firebase](https://firebase.google.com/) (Auth + Firestore) | ^12.2 |
| Internationalisation | [vue-i18n](https://vue-i18n.intlify.dev/) | ^11.2 |
| Routing | [Vue Router](https://router.vuejs.org/) | ^4.5 |
| Build | [Vite](https://vitejs.dev/) | ^7.0 |
| Tests | [Vitest](https://vitest.dev/) | ^3.2 |
| Linter / Formatter | ESLint + Prettier | — |

---

## Installation

### Prérequis

- **Node.js** `^20.19.0` ou `>=22.12.0`
- **npm** (inclus avec Node.js)
- Un projet Firebase configuré (Auth + Firestore)

### Étapes

1. **Cloner le dépôt**

   ```bash
   git clone git@github.com:Phenixel/PetiteJerusalem.git
   cd PetiteJerusalem
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Configurer Firebase**

   Créez un fichier `firebase.ts` à la racine (ou adaptez celui existant) avec vos identifiants Firebase :

   ```ts
   import { initializeApp } from "firebase/app";
   import { getAuth } from "firebase/auth";
   import { getFirestore } from "firebase/firestore";

   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     // ...
   };

   const app = initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   ```

4. **Lancer le serveur de développement**

   ```bash
   npm run dev
   ```

   L'application est accessible sur `http://localhost:5173`.

---

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Démarre le serveur de développement (Vite HMR) |
| `npm run build` | Compile et optimise pour la production |
| `npm run preview` | Prévisualise le build de production |
| `npm run test:unit` | Lance les tests unitaires en mode watch |
| `npm run verify` | Vérifie typage, lint et tests (à utiliser avant chaque commit) |
| `npm run lint` | Analyse et corrige le code avec ESLint |
| `npm run format` | Formate le code avec Prettier |
| `npm run type-check` | Vérifie les types TypeScript avec vue-tsc |

> **Conseil :** Lancez toujours `npm run verify` avant d'ouvrir une Pull Request.

---

## Contribution

Les contributions sont les bienvenues ! Consultez le fichier [CONTRIBUTING.md](CONTRIBUTING.md) pour les détails sur le processus, les standards de code et les conventions à respecter.

Pour signaler un bug ou proposer une fonctionnalité, ouvrez une [Issue GitHub](https://github.com/Phenixel/PetiteJerusalem/issues) ou utilisez notre [formulaire de feedback](https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4).

---

## Licence

Ce projet est sous licence **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

L'utilisation commerciale de ce code est **interdite**.
Voir le fichier [LICENSE](LICENSE) pour plus de détails.
