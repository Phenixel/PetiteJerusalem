# Versionnement : ce que disent les tags, et la règle à suivre

Le dépôt porte 86 tags. Ce document part de ce qu'ils racontent réellement,
vérifie l'intention derrière le `vX.Y.Z`, et fixe une règle applicable telle
quelle à la prochaine mise en production.

## 1. État des lieux

| Famille                              | Nombre | Exemples                                       |
| ------------------------------------ | ------ | ---------------------------------------------- |
| `vX.Y.Z` conformes                   | 72     | `v3.7.4`                                       |
| `vX.Y` à deux composantes            | 8      | `v2.1` … `v2.8`                                |
| hors convention                      | 6      | `2.7`, `3.5.2`, `V3.0.5`, `v3.1.2b`, `old/1.0`, `release/1.0` |

Six tags pointent sur un commit déjà tagué : `v3.1.2b`/`v3.1.3`,
`v2.4`/`v2.4.1`, `V3.0.5`/`v3.0.5`, `2.7`/`v2.7`, `3.5.2`/`v3.5.2`,
`v2.9.1`/`v2.9.2`. Ce sont des doublons, pas des versions.

L'histoire se lit en trois temps :

- **1.x** (`release/1.0`, juillet 2025) : l'ère Django, archivée sous `old/1.0`.
- **2.x** (décembre 2025 à juillet 2026) : le site Vue. Numérotation à deux
  composantes jusqu'à `v2.8`, puis `X.Y.Z` à partir de `v2.9.0`.
- **3.x** (depuis le 19 juillet 2026) : l'app native, ouverte par `v3.0.0`
  (Capacitor), puis le Play Store et TestFlight.

Un accident de numérotation : `v2.10.4` est suivi de `v2.20.0`, pas de
`v2.11.0`. Sans conséquence technique, mais le saut est visible dans
l'historique des versions du Play Store.

Rythme actuel : environ un tag par pull request fusionnée, de 0 à 7 correctifs
par cycle mineur, un cycle mineur tous les 3 à 14 jours depuis juin 2026.

## 2. L'hypothèse « Y = fonctionnalité majeure » : vérification

Elle tient à peu près une fois sur deux. Sur les onze incréments mineurs de
la période `X.Y.Z` (hors `v3.0.0`, qui est un majeur) :

**Conformes** : une vraie partie de l'app arrive.

- `v3.2.0` backoffice des chiourim
- `v3.4.0` lecture quotidienne (montées, marque-pages, chnei mikra)
- `v3.6.0` horaires du jour (zmanim)
- `v3.7.0` publication iOS, modération et conditions d'utilisation

**Non conformes** : le mineur a servi à dire « c'est gros », pas « c'est neuf ».

- `v2.10.0` migration Notion vers Firestore : de l'infrastructure, invisible
  pour le lecteur (344 lignes)
- `v2.20.0` refonte du système de design : énorme (3 060 lignes), mais aucune
  nouvelle page
- `v2.21.0` fond mur de pierre : 3 fichiers, 347 lignes, un décor
- `v3.1.0` polissage UX mobile et accueil
- `v3.3.0` PostHog, consentement et correction du bouton Google
- `v3.5.0` réorganisation en tableaux de bord

L'erreur symétrique existe autant : de vraies nouveautés sont sorties en
correctif.

- `v3.6.4` widgets d'écran d'accueil Android et Apple : 41 fichiers, 2 956
  lignes, une surface entièrement nouvelle
- `v2.8.1` refonte des pages de lecture et page « Étude » : 4 772 lignes
- `v3.7.4` textes de tefila, sli'hot, brakha a'harona : 1 318 lignes
- `v2.7.5` aperçus sociaux rendus côté serveur : 3 445 lignes

**Conclusion** : la taille de la PR ne sépare rien, les plages se recouvrent
complètement (de 347 à 4 295 lignes pour un mineur, de 12 à 4 772 pour un
correctif). Ce qui sépare, et ce que l'intention initiale visait, c'est la
**surface offerte au lecteur**. Il faut donc arrêter de trancher au ressenti
de l'effort et trancher sur un critère observable.

## 3. Les contraintes qui ne se négocient pas

Le tag n'est plus une étiquette : c'est le déclencheur de la mise en
production. `deploy.yml`, `deploy-android.yml` et `deploy-ios.yml` partent
tous les trois sur `refs/tags/v*`.

1. **Format strict.** Les deux workflows d'app rejettent tout ce qui n'est pas
   `^[0-9]+\.[0-9]+\.[0-9]+$`. Un tag comme `v3.1.2b` ou `v2.8` passe le
   filtre `v*`, déploie le site, puis fait échouer Android et iOS : la release
   sort à moitié.
2. **Minuscule.** `V3.0.5` et `3.5.2` ne correspondent pas à `v*` : ils ne
   déclenchent rien du tout.
3. **Y et Z restent sous 100.** Le numéro de build vaut
   `X × 1 000 000 + Y × 10 000 + Z × 100`. Au delà de 99, les versions se
   téléscopent, et les stores refusent un build déjà numéroté.
4. **Un tag ne se réutilise ni ne se déplace.** Play Console et App Store
   Connect refusent un numéro de build déjà vu. Pour republier, il faut un
   correctif de plus (`Z + 1`). C'est exactement ce qu'ont été `v3.7.1`,
   `v3.7.2` et `v3.7.3` : trois tentatives TestFlight, pas trois versions.
5. **Le corps de la release GitHub devient les notes des stores.** Un tag sans
   notes sort avec une phrase générique.

## 4. La règle, à partir de maintenant

Format : `vX.Y.Z`, trois nombres, un `v` minuscule, rien d'autre. Posé sur
`main`, une fois la CI verte.

### X, socle

On change de X quand la nature du produit change, pas quand le code change
beaucoup. Trois précédents, tous du même ordre : 1 le site Django, 2 le site
Vue, 3 l'app native. Un quatrième supposerait quelque chose d'aussi
structurel : changer de backend, ouvrir le produit à d'autres communautés,
refondre le modèle de données. Une refonte visuelle, même totale, n'est pas
un majeur (`v2.20.0` avait raison de rester en 2).

### Y, nouvelle surface

On incrémente Y quand le lecteur gagne **un endroit où aller** qui n'existait
pas. Trois questions, il faut deux « oui » :

1. Y a-t-il une nouvelle entrée dans la navigation, un nouvel écran principal,
   un nouveau widget, une nouvelle plateforme ou un nouveau rôle (backoffice,
   modération) ?
2. Est-ce que ça s'annonce en une phrase dans les notes du store, en commençant
   par un verbe d'arrivée (« Les horaires du jour arrivent dans l'app ») ?
3. Un utilisateur qui reviendrait après six mois le remarquerait-il sans qu'on
   le lui montre ?

À ce compte, `v3.6.4` (les widgets) aurait dû être `v3.7.0`, et `v2.21.0`
(le mur de pierre) un simple correctif. Un Y remet Z à zéro : le tag s'écrit
`v3.8.0`, jamais `v3.8`.

### Z, tout le reste

Correctifs, améliorations de l'existant, contenus ajoutés, refontes visuelles,
migrations techniques, performances, SEO, CI, et les republications forcées
par les stores. Sans plafond de taille : une PR de 3 000 lignes qui rend
l'existant meilleur reste un Z.

### Cas limites déjà rencontrés

| Situation                                    | Décision |
| -------------------------------------------- | -------- |
| Refonte du design system, aucune page nouvelle | Z        |
| Migration d'infrastructure invisible           | Z        |
| Outillage produit (PostHog, consentement)      | Z        |
| Nouvelle plateforme de publication (iOS)       | Y        |
| Nouvel espace réservé (backoffice)             | Y        |
| Widgets système                                | Y        |
| Corpus de textes ajouté à une section existante | Z       |
| Nouvelle section de la bibliothèque            | Y        |
| Republication après refus du store             | Z        |

## 5. Ménage conseillé sur les tags existants

À supprimer, sur le dépôt local comme sur `origin`, après avoir vérifié
qu'aucune release GitHub n'y est attachée : `2.7`, `3.5.2`, `V3.0.5`,
`v3.1.2b`, `v2.4.1` et `v2.9.2`. Ce sont des doublons exacts de tags valides,
et les trois premiers ne déclenchent aucun déploiement, ce qui rend leur
présence trompeuse.

À conserver tels quels : `release/1.0` et `old/1.0`, qui datent l'ère Django,
et les `v2.1` à `v2.8`, qui font partie de l'histoire même s'ils ne passeraient
plus la CI d'aujourd'hui.
