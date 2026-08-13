# Captures d'écran App Store

Ranger ici les captures par langue (`fr-FR/`, `en-US/`, `he/`), puis les
déposer à la main dans App Store Connect : `scripts/appstore-listing.mjs` ne
les envoie pas (l'API impose un envoi en plusieurs morceaux avec somme de
contrôle, pour un geste qui se fait une fois).

**Format** : l'app est universelle, donc deux séries par langue.

| Famille | Dimensions acceptées | Simulateur |
|---|---|---|
| iPhone 6,9" | 1320 × 2868, 1290 × 2796 ou 1260 × 2736 | iPhone 17 Pro Max |
| iPad 13" | 2064 × 2752 ou 2048 × 2732 | iPad Pro 13" |

PNG ou JPEG sRGB **sans canal alpha**. Apple redimensionne pour les appareils
plus petits de chaque famille.

**Écrans** (mêmes que la fiche Play Store, voir
`store-assets/metadata/android/fr-FR/images/phoneScreenshots/`) :

1. accueil connecté (tableau de bord)
2. session de partage de lecture
3. bibliothèque
4. lecteur de texte (Tehilim 1)
5. lecture quotidienne
6. détail d'un chiour
7. accueil visiteur

**Comment les produire** : lancer l'app dans le simulateur iOS avec les
données de démo, puis `⌘S` pour enregistrer une capture sur le bureau.
Les captures Android du repo ont les bons écrans mais ni le bon ratio ni la
bonne barre système — ne pas les réutiliser telles quelles.
