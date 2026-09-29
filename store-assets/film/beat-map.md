# Film de présentation : carte des temps

Boucle carrée de 22 s, en 1440 x 1440 à 60 images par seconde, d'un seul plan.
Le moteur est `film.html` : tout y est fonction du temps (`seek(t)`), et la
table `T` du script reprend exactement cette carte.

- Tempo de travail : 110 BPM, soit un temps toutes les 0,545 s.
- L'appui sur le bouton de lecture tombe au temps 18, à **9,818 s** : c'est
  là que le morceau doit placer son drop. Une fois le morceau mesuré, on cale
  son départ pour que son drop tombe à cet instant, sans rien déplacer
  d'autre.
- Chaque glissé dure 0,8 s sur `cubic-bezier(.45, 0, .15, 1)`, et le zoom de
  la caméra suit la même courbe (en espace logarithmique). Le contenu qui part
  s'efface dans la première moitié du glissé, celui qui arrive paraît dans la
  seconde.

## Les temps

| Temps | Instant   | Scène      | Ce qui se passe                                                                  |
| ----- | --------- | ---------- | -------------------------------------------------------------------------------- |
| 1     | 0,55 s    | Créer      | le curseur clique « Créer une chaîne »                                           |
|       | 0,62 s    | Créer      | la pastille glisse en sablier                                                    |
| 4     | 2,18 s    | Créer      | le sablier devient une coche                                                     |
| 6     | 3,27 s    | Discussion | la coche se scinde en trois points (goutte)                                      |
| 8     | 4,36 s    | Discussion | le point gauche monte et devient la question, qui se tape                        |
| 10    | 5,45 s    | Discussion | le point droit descend et devient la réponse, qui se tape                        |
| 13,5  | 7,36 s    | Discussion | les deux bulles se contractent en points et se versent dans celui du milieu      |
| 15    | 8,18 s    | Lecture    | le point se plie en triangle de lecture, sommet par sommet ; la caméra approche  |
| 18    | **9,82 s**| Lecture    | **drop** : le curseur appuie, un disque blanc naît sous le clic, l'app sombre inonde l'image en 0,4 s |
|       | 10,00 s   | Lecture    | la caméra recule sur l'écran entier du lecteur de chiourim                       |
| 20    | 10,91 s   | Lecture    | le coeur se remplit, couleur du thème                                            |
| 21    | 11,45 s   | Glisser    | le curseur tire la pochette de côté, le chiour suivant entre                     |
|       | 11,95 s   | Glisser    | l'app se reteinte depuis la nouvelle pochette (cercle parti de la pochette)      |
| 23    | 12,55 s   | Volume     | la caméra glisse jusqu'au volume                                                 |
|       | 13,50 s   | Volume     | le curseur monte le volume au maximum                                            |
|       | 14,10 s   | Volume     | il continue de tirer : la barre s'étire et emmène la caméra hors de l'app        |
|       | 14,95 s   | Courbe     | la ligne se pose et se plie en courbe ; le compteur monte de 0 à 150             |
| 30    | 16,36 s   | Plongée    | clic sur le dernier point (le bouton du volume) ; la caméra plonge dedans       |
|       | 17,20 s   | Fin        | « Ouvrir Petite Jérusalem » sort de la lumière                                   |
|       | 18,10 s   | Fin        | la pastille s'amincit en trait                                                   |
|       | 18,90 s   | Fin        | le trait se déploie en logo : le livre s'ouvre, le mur monte, la tour, les cyprès et le dôme sortent du mur |
|       | 20,40 s   | Fin        | le logo se replie en trait                                                       |
|       | 21,20 s   | Fin        | le trait s'épaissit en « Créer une chaîne » : la dernière image est la première  |

Aucun plan ne tient plus d'une seconde. Chaque passage de relais attend que
la forme précédente soit posée : le triangle finit à 8,98 s, avant l'appui ;
le trait finit à 18,90 s, quand le logo commence.

## Les contenus retenus

Faute de réponse sur les éléments demandés, le film présente Petite
Jérusalem avec ce que l'app contient déjà :

- **question et réponse** : « On se partage les Tehilim ? » et « 150 psaumes à
  douze : fini ce soir. » (le partage de lecture, que la courbe reprend en
  comptant les Tehilim lus) ;
- **pochettes** : deux chiourim de saison, dessinés dans le canvas en
  aplats, sans photo : « Les lois de Souccot » (vert loulav) puis « La joie de
  Sim'hat Torah » (rouge pomme), les couleurs des thèmes de fête de
  `docs/design.md` ;
- **logo** : celui de `public/favicon.svg`, redessiné pièce par pièce ;
- **bouton de fin** : « Ouvrir Petite Jérusalem ».

## Ce qui s'écarte de la commande, et pourquoi

La commande décrivait un habillage générique ; le film suit la charte du
dépôt (`docs/design.md`) :

- Manrope pour l'interface et Playfair Display pour les titres, au lieu de
  Geist ;
- un seul accent, le `primary` du thème par défaut (`#DE4F17`), au lieu du
  vert `#1ed760` ;
- la scène en beige à plat (`#f4f1ea`), sans dégradé ;
- l'app sombre part du fond sombre de l'app (`#111827`), teinté à 22 % par la
  pochette en cours ;
- surfaces à angles francs (8 px), commandes rondes.

## Le son (à venir)

La politique réseau de l'environnement refuse `mixkit.co` et
`assets.mixkit.co` : ni le morceau (« Head Bang » par défaut) ni les bruitages
ne peuvent être téléchargés d'ici. Dès qu'ils sont là (domaines autorisés, ou
fichiers déposés dans ce dossier) :

1. mesurer le tempo et le drop du morceau, et caler son départ sur 9,818 s ;
2. avant l'appui, le passer dans un passe-bas (comme depuis la pièce d'à
   côté), puis l'ouvrir en entier sur le drop ;
3. poser un bruitage par événement (clic, glissés, pop, inondation, coeur,
   glissé de pochette, élastique, clic final, déploiement du logo), chacun
   placé par son pic mesuré ;
4. normaliser à -14 LUFS.

## Le rendu (à venir, après validation)

Rendu Playwright à 60 images par seconde, flou de mouvement par moyenne de 4
sous-images, 12 sur le panoramique rapide (de 14,1 s à 14,9 s), puis
recherche des sauts d'une image à l'autre, et correction de chacun.

- Aperçu interactif : ouvrir `film.html` dans un navigateur.
- Images fixes : `node stills.mjs <dossier> <t1> <t2> ...`.
- Planche contact : `node sheet.mjs <sortie.png> <colonnes> <t1> <t2> ...`.
