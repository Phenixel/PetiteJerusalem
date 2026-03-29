# CLAUDE.md — Guide pour Claude Code

Ce fichier décrit l'architecture, les conventions et les règles à respecter lorsqu'on travaille sur **Petite Jérusalem** avec Claude Code.

---

## Vue d'ensemble du projet

**Petite Jérusalem** est une application web Vue 3 + TypeScript destinée à la communauté juive francophone. Elle propose :

- **Partage de Lectures** : sessions de Limoud collaboratives avec réservation de textes
- **Chiourim** : catalogue de cours de Torah (audio + liens)
- **Halakhot Quotidiennes** : à venir

Backend : Firebase (Firestore + Authentication). Pas de serveur backend custom.

---

## Commandes essentielles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run test:unit    # Tests unitaires (Vitest, mode watch)
npm run verify       # type-check + lint + tests — à lancer avant tout commit
npm run lint         # ESLint --fix
npm run format       # Prettier sur src/
npm run type-check   # vue-tsc --build
```

**Toujours lancer `npm run verify` avant de proposer un commit ou une PR.**

---

## Architecture

```
src/
├── components/     # Composants UI réutilisables
├── composables/    # Logique Vue réutilisable (useTheme, useDarkMode, useLocale)
├── datas/          # JSON statique (textStudies.json)
├── locales/        # Fichiers de traduction (fr.ts, en.ts, he.ts)
├── models/         # Interfaces TypeScript et enums
├── repositories/   # Accès Firestore (ex: chiourRepository.ts)
├── router/         # Vue Router (routes.ts + index.ts)
├── services/       # Logique métier
├── views/          # Pages Vue (une par route)
└── __tests__/      # Tests unitaires Vitest
```

### Séparation des responsabilités

| Couche | Rôle |
|---|---|
| `views/` | Orchestration, liaison des composants, appels aux services |
| `services/` | Logique métier (sessionService, reservationService, authService…) |
| `repositories/` | Accès direct à Firestore, requêtes et mapping DTO ↔ modèles |
| `composables/` | État réactif partagé + lifecycle Vue |
| `components/` | Composants sans logique métier propre |

---

## Conventions de code

### TypeScript

- **Pas de `any`** sauf cas exceptionnel dûment commenté.
- Toutes les interfaces et types sont dans `src/models/`.
- Préférer les types stricts et les unions discriminées.

### Vue 3

- Toujours utiliser **`<script setup lang="ts">`** (Composition API).
- Ne jamais utiliser l'Options API ni `defineComponent`.
- Les composants sont en **PascalCase** (`SessionCard.vue`).
- Les props sont typées explicitement avec `defineProps<{...}>()`.
- Les emits sont typées avec `defineEmits<{...}>()`.

### Style / CSS

- Utiliser exclusivement les **classes utilitaires TailwindCSS**.
- Ne pas écrire de CSS custom sauf dans `src/assets/main.css` pour les variables globales.
- Les thèmes sont gérés via des variables CSS (voir `useTheme.ts`).
- Support du mode sombre via la classe `dark:` de Tailwind.

### Internationalisation (i18n)

- **Tout texte visible par l'utilisateur doit passer par `vue-i18n`** (`t('clé')`).
- Les clés sont définies dans `src/locales/fr.ts` (source de vérité), puis recopiées dans `en.ts` et `he.ts`.
- Le type `LocaleMessages` est exporté depuis `fr.ts` et utilisé pour typer les autres locales.
- Ne jamais hardcoder de chaînes de caractères en français, anglais ou hébreu dans les templates.

### Firebase / Firestore

- Les accès Firestore passent par les **repositories** ou les **services** dédiés.
- Ne jamais importer `db` ou `auth` directement dans une view ou un composant.
- Les dates Firestore (`Timestamp`) sont converties en `Date` JS dans la couche repository.

### Routing

- Les routes sont définies dans `src/router/routes.ts`.
- Les noms de routes sont en **kebab-case** (`detail-session`, `new-session`).
- La navigation programmatique utilise le nom de route (`router.push({ name: '...' })`), pas le path.

### SEO

- Chaque view appelle `seoService.setMeta(...)` dans `onMounted` avec titre, description et URL canonique.
- Les textes SEO sont dans les locales sous la clé `seo`.

---

## Tests

- Framework : **Vitest** avec `@vue/test-utils`.
- Les tests sont dans `src/__tests__/`.
- Nommage : `nomDuService.nomDuCas.test.ts`.
- Tester les services et utils en priorité ; les composants si la logique est non triviale.
- Lancer avec `npm run test:unit` (watch) ou `npm run verify` (single run).

---

## Ce qu'il ne faut pas faire

- Ne pas créer de fichiers de configuration (`.env`, scripts CI) sans en discuter.
- Ne pas modifier `firestore.rules` ou `firestore.indexes.json` sans validation.
- Ne pas installer de nouvelles dépendances sans justification claire.
- Ne pas contourner `npm run verify` (ne pas utiliser `--no-verify`).
- Ne pas ajouter de logique métier dans les composants — la mettre dans un service ou composable.
- Ne pas utiliser `<style scoped>` avec du CSS custom ; préférer TailwindCSS.

---

## Informations de déploiement

- Hébergement : **Firebase Hosting** (voir `firebase.json`).
- Build de production : `npm run build` → dossier `dist/`.
- Déploiement : `firebase deploy` (accès restreint aux mainteneurs).
