# Guide de contribution

Merci de l'intérêt que vous portez à **Petite Jérusalem**. Toute aide pour
améliorer cette plateforme au service de la communauté est la bienvenue.

## Comment contribuer ?

### Signaler un bug

Vous avez trouvé un bug ? Dites-le nous. Deux possibilités :

1. **Issues GitHub** : ouvrez une issue en décrivant ce que vous avez fait, ce
   que vous attendiez et ce qui s'est réellement passé.
2. **Formulaire Notion** : vous pouvez aussi passer par notre
   [formulaire de retour](https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4).

### Proposer une amélioration

Une idée de fonctionnalité ?

- Ouvrez une issue sur GitHub pour en discuter avant de coder.
- Ou utilisez notre
  [formulaire de retour](https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4)
  pour soumettre vos idées.

### Proposer une pull request (PR)

1. **Forkez** le projet.
2. Créez une branche pour votre fonctionnalité
   (`git checkout -b feature/ma-nouvelle-fonctionnalite`).
3. Faites vos modifications.
4. Vérifiez que le code est propre et que les tests passent :
   ```bash
   npm run verify
   ```
   `verify` enchaîne le type-check, `npm run lint` (ESLint, avec correction
   automatique) et les tests unitaires Vitest. C'est exactement ce que la CI
   rejoue sur chaque PR.
5. Commitez vos changements (`git commit -m 'Ajoute ma nouvelle fonctionnalité'`).
6. Poussez votre branche (`git push origin feature/ma-nouvelle-fonctionnalite`).
7. Ouvrez une pull request sur le dépôt principal.

## Conventions du dépôt

Elles sont écrites dans [CLAUDE.md](CLAUDE.md) et valent pour tout ce qui
s'écrit ici : code, commentaires, textes de l'interface, contenus,
documentation, messages de commit et de pull request.

- **Jamais de tiret long** : ni cadratin (U+2014), ni demi-cadratin (U+2013),
  nulle part. Selon le cas, on écrit deux-points, une virgule, des
  parenthèses, un point-virgule, « du 12 au 14 » pour une plage, ou une vraie
  liste. Le test `src/__tests__/typography.test.ts` parcourt tous les fichiers
  versionnés et échoue s'il en reste un.
- **Français** pour les commentaires et la documentation. Les identifiants
  suivent le fichier où ils vivent : anglais pour les noms techniques,
  français pour le domaine liturgique.
- **Espaces insécables** dans le français de l'interface : U+202F avant `!`,
  `?` et `;`, U+00A0 avant `:` et à l'intérieur des guillemets « ». Le test
  `src/__tests__/frenchTypography.test.ts` le vérifie sur `src/locales/fr`.

## Standards de code

- **TypeScript** : typage fort, évitez `any` autant que possible.
- **Vue 3** : Composition API avec `<script setup>`.
- **Style** : le projet utilise `eslint` et `prettier`. Lancez `npm run lint`
  et `npm run format` avant de commiter. Attention, `npm run format` ne
  formate que `src/` (`prettier --write src/`) : les scripts, la
  configuration et la documentation ne sont pas touchés.
- **CSS** : classes utilitaires **TailwindCSS** autant que possible.

## Tests garde-fous

Au-delà des tests fonctionnels, plusieurs tests unitaires tiennent des règles
du dépôt et font échouer la CI pour des raisons qui ne se voient pas dans le
diff : un tiret long dans un commentaire, une clé i18n utilisée mais absente
de `fr`, un import statique qui ramène Firestore dans le bundle initial, un
widget ajouté sur une seule plateforme, un texte corrigé sans que
`public/texts/manifest.json` suive… Ils sont listés, avec ce que chacun
attend, dans [docs/tests.md](docs/tests.md). Lisez cette page avant de
chercher longtemps pourquoi une PR est rouge.

## Important

Ce projet est destiné à un usage communautaire et **non commercial**. En
contribuant, vous acceptez que votre code fasse partie du projet sous licence
**CC BY-NC 4.0**.
